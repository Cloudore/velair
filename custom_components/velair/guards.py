"""Guards: never-off recovery, snooze, Manual-adjustment release, activity holds.

The scheduler creates one ``GuardsCoordinator`` and exposes a handful of
one-line hooks: start/stop, a settings-changed notification, a refresh
trigger after any zone control change, an observation of external climate
changes, and status getters for the API and the generated entities.

Every write goes through the scheduler's hold API (``async_pause_zone`` /
``async_resume_zone``), ``async_resume_automatic_control`` and
``async_enter_manual_adjustment``. Guards never call ``climate.*``
services. Everything they need from other modules (occupancy entities,
presence and travel entities, setback stages) is read defensively from
the persisted Velair data and from live Home Assistant state.

Doctrine (home policy spec, section 1):

- P1: a hand-set value is protected until a documented release rule ends it
  (never younger than the lease).
- P5: uncertain evidence (``unknown``/``unavailable`` sensors) never
  triggers a release.
- Never OFF: a head turned off by a person comes back on after a grace
  period unless snoozed.
"""

from __future__ import annotations

import asyncio
from dataclasses import dataclass, field
from datetime import datetime, timedelta
from functools import partial
import logging
from typing import TYPE_CHECKING, Any

from homeassistant.core import CALLBACK_TYPE, callback
from homeassistant.helpers.event import (
    async_track_point_in_time,
    async_track_state_change_event,
)
from homeassistant.util import dt as dt_util

from .const import (
    ACTION_TURN_OFF,
    EVENT_TYPE_ACTIVITY_HOLD_CHANGED,
    EVENT_TYPE_MANUAL_HOLD_RELEASED,
    EVENT_TYPE_NEVER_OFF_GRACE_STARTED,
    EVENT_TYPE_NEVER_OFF_RECOVERED,
    EVENT_TYPE_NEVER_OFF_SNOOZED,
    HOLD_CONSTRAINT_ABSOLUTE,
    HOLD_CONSTRAINT_RAISE_ONLY,
    HVAC_MODE_OFF,
    HVAC_MODE_OPTIONS,
    MODE_AUTO,
    ZONE_PAUSE_ACTION_HOLD,
    ZONE_PAUSE_ACTION_NONE,
    ZONE_PAUSE_ACTION_TURN_OFF,
)
from .guards_models import (
    BELOW_MINIMUM_ACTION_FLOOR_HOLD,
    BELOW_MINIMUM_ACTION_RELEASE,
    GUARDS_STATE_ACTIVITY_HOLD,
    GUARDS_STATE_FLOOR_HOLD,
    GUARDS_STATE_IDLE,
    GUARDS_STATE_MANUAL_WATCH,
    GUARDS_STATE_OFF_GRACE,
    GUARDS_STATE_RECOVERING,
    GUARDS_STATE_SNOOZED,
    MAX_SNOOZE_MINUTES,
    PAUSE_ID_FLOOR,
    PAUSE_ID_NEVER_OFF_RECOVER,
    PAUSE_ID_NEVER_OFF_SNOOZE,
    PAUSE_ID_TRAVEL_OFF,
    PAUSE_ID_WATCHDOG,
    GuardsActivityHoldData,
    GuardsRuntimeData,
    GuardsSettingsData,
    GuardsZoneData,
    normalize_guards_runtime_data,
    normalize_guards_settings,
    normalize_guards_zone_data,
)
from .temperature import CELSIUS, temperature_delta

if TYPE_CHECKING:  # pragma: no cover - typing only
    from .scheduler import VelairScheduler

_LOGGER = logging.getLogger(__name__)

SOURCE = "guards"
RECOVERY_LABEL = "Never-off recovery"
FLOOR_LABEL = "Floor"
# Rule (c): the live setpoint must sit clearly below the zone floor.
BELOW_MINIMUM_TOLERANCE_C = 0.31

REASON_VACANT = "vacant"
REASON_TRAVEL = "travel"
REASON_BELOW_MINIMUM = "below_minimum"
REASON_HOUSE_EMPTY = "house_empty"
REASON_OWNER_PRESENT = "owner_present"
REASON_MANUAL_ENDED = "manual_ended"

_UNCERTAIN = (None, "unknown", "unavailable", "")
_HOME_STATES = ("home", "on")


@dataclass
class _ZoneRuntime:
    """Runtime and persisted state for one zone."""

    state: str = GUARDS_STATE_IDLE
    grace_started_at: datetime | None = None
    grace_ends_at: datetime | None = None
    previous_target: float | None = None
    previous_hvac_mode: str | None = None
    relight_requested_at: datetime | None = None
    snooze_started_at: datetime | None = None
    floor_since: datetime | None = None
    floor_manual_since: datetime | None = None
    floor_manual_active: bool = False
    last_action: str | None = None
    last_action_at: datetime | None = None
    next_transition_at: datetime | None = None
    unsub_timer: CALLBACK_TYPE | None = None
    facts: dict[str, Any] = field(default_factory=dict)


@dataclass
class _HouseFacts:
    """House-level evidence shared by every zone at one instant."""

    travel_on: bool
    travel_since: datetime | None
    empty_since: datetime | None
    owners_away_since: datetime | None


@dataclass
class _ZoneFacts:
    """Evaluation inputs for one zone at one instant."""

    entity_id: str
    config: GuardsZoneData
    zone_enabled: bool
    head_state: str | None
    head_available: bool
    head_off: bool
    head_changed_at: datetime | None
    setpoint: float | None
    pause_ids: list[str]
    pauses: list[dict[str, Any]]
    manual_since: datetime | None
    occupancy_entity_id: str | None
    occupancy_state: str | None
    occupancy_off_since: datetime | None
    stage3_temperature: float | None
    minimum_temperature: float | None
    velair_intends_off: bool
    unit: str

    @property
    def snoozed(self) -> bool:
        return PAUSE_ID_NEVER_OFF_SNOOZE in self.pause_ids

    @property
    def travel_frozen(self) -> bool:
        return PAUSE_ID_TRAVEL_OFF in self.pause_ids

    @property
    def recovering(self) -> bool:
        return PAUSE_ID_NEVER_OFF_RECOVER in self.pause_ids

    @property
    def snooze_until(self) -> str | None:
        for pause in self.pauses:
            if pause.get("pause_id") == PAUSE_ID_NEVER_OFF_SNOOZE:
                until = pause.get("until")
                return until if isinstance(until, str) else None
        return None


class GuardsCoordinator:
    """Per-zone guard rules coordinated across the home."""

    def __init__(self, scheduler: VelairScheduler) -> None:
        self._scheduler = scheduler
        self._hass = scheduler._hass
        self._zones: dict[str, _ZoneRuntime] = {}
        self._lock = asyncio.Lock()
        self._started = False
        self._tracked_entities: tuple[str, ...] = ()
        self._unsub_listener: CALLBACK_TYPE | None = None
        self._refresh_task_pending = False
        self._evaluating = False
        self._rerun_requested = False
        self._external: dict[str, dict[str, Any]] = {}
        self._tasks: set[asyncio.Task[Any]] = set()
        self._load_persisted_runtime()

    # ------------------------------------------------------------------
    # Lifecycle
    # ------------------------------------------------------------------
    def _load_persisted_runtime(self) -> None:
        """Restore grace and relight timestamps persisted with the settings."""
        data = self._scheduler._data
        settings = data.get("settings")
        if not isinstance(settings, dict):
            return
        records = normalize_guards_runtime_data(
            settings.get("guards_runtime"), list(data.get("zones", {}))
        )
        settings["guards_runtime"] = records
        for entity_id, record in records.items():
            runtime = self._runtime(entity_id)
            runtime.state = record.get("state", GUARDS_STATE_IDLE)
            runtime.grace_started_at = _parse_timestamp(record.get("grace_started_at"))
            runtime.grace_ends_at = _parse_timestamp(record.get("grace_ends_at"))
            runtime.previous_target = record.get("previous_target")
            runtime.previous_hvac_mode = record.get("previous_hvac_mode")
            runtime.relight_requested_at = _parse_timestamp(
                record.get("relight_requested_at")
            )
            runtime.snooze_started_at = _parse_timestamp(record.get("snooze_started_at"))
            runtime.floor_since = _parse_timestamp(record.get("floor_since"))
            runtime.floor_manual_since = _parse_timestamp(record.get("floor_manual_since"))
            runtime.floor_manual_active = bool(record.get("floor_manual_active", False))
            runtime.last_action = record.get("last_action")
            runtime.last_action_at = _parse_timestamp(record.get("last_action_at"))

    async def async_start(self) -> None:
        """Register listeners and evaluate every zone once."""
        self._started = True
        self._refresh_listeners()
        await self.async_evaluate(reason="start")

    async def async_stop(self) -> None:
        """Stop listeners and timers; persisted timestamps stay in place."""
        self._started = False
        self._clear_listener()
        for runtime in self._zones.values():
            self._clear_zone_timer(runtime)
        for task in list(self._tasks):
            if not task.done():
                task.cancel()
        self._tasks.clear()

    async def async_drain(self) -> None:
        """Wait for scheduled evaluations to finish (used by tests)."""
        for _ in range(50):
            pending = [task for task in self._tasks if not task.done()]
            if not pending:
                return
            await asyncio.gather(*pending, return_exceptions=True)

    # ------------------------------------------------------------------
    # Public projection used by the scheduler, API and entities
    # ------------------------------------------------------------------
    def config(self, entity_id: str) -> GuardsZoneData:
        """Return the normalized per-zone Guards configuration."""
        self._scheduler.ensure_managed_entity(entity_id)
        return self._config(entity_id)

    def statuses(self) -> dict[str, dict[str, Any]]:
        """Return the runtime status for every managed zone."""
        return {
            entity_id: self.status(entity_id)
            for entity_id in self._scheduler._data["zones"]
        }

    def status(self, entity_id: str) -> dict[str, Any]:
        """Return the runtime status for one zone."""
        settings = self._settings()
        config = self._config(entity_id)
        runtime = self._zones.get(entity_id)
        facts = runtime.facts if runtime is not None else {}
        return {
            "state": runtime.state if runtime is not None else GUARDS_STATE_IDLE,
            "enabled": settings["enabled"],
            "never_off_enabled": settings["enabled"]
            and settings["never_off_enabled"]
            and config["never_off_enabled"],
            "manual_release_enabled": settings["enabled"]
            and settings["manual_release_enabled"],
            "grace_started_at": _isoformat(runtime.grace_started_at if runtime else None),
            "grace_ends_at": _isoformat(runtime.grace_ends_at if runtime else None),
            "previous_target": runtime.previous_target if runtime else None,
            "snooze_until": facts.get("snooze_until"),
            "snooze_started_at": _isoformat(runtime.snooze_started_at if runtime else None),
            "floor_since": _isoformat(runtime.floor_since if runtime else None),
            "manual_since": facts.get("manual_since"),
            "manual_release_at": facts.get("manual_release_at"),
            "activity_entity_id": facts.get("activity_entity_id"),
            "occupancy_entity_id": facts.get("occupancy_entity_id"),
            "pause_ids": list(facts.get("pause_ids", [])),
            "next_transition_at": _isoformat(
                runtime.next_transition_at if runtime else None
            ),
            "last_action": runtime.last_action if runtime else None,
            "last_action_at": _isoformat(runtime.last_action_at if runtime else None),
        }

    # ------------------------------------------------------------------
    # Configuration changes and service entry points
    # ------------------------------------------------------------------
    async def async_update_zone_config(
        self, entity_id: str, updates: dict[str, Any]
    ) -> GuardsZoneData:
        """Merge, validate and persist per-zone settings."""
        scheduler = self._scheduler
        scheduler.ensure_managed_entity(entity_id)
        previous = self._config(entity_id)
        raw_holds = updates.get("activity_holds")
        if "activity_holds" in updates:
            if not isinstance(raw_holds, list):
                raise ValueError("activity_holds must be a list")
            minimum, maximum = scheduler.get_temperature_limits(entity_id)
            for raw_hold in raw_holds:
                if not isinstance(raw_hold, dict) or not raw_hold.get("entity_id"):
                    raise ValueError("Every activity hold needs an entity_id")
                temperature = raw_hold.get("temperature")
                if not isinstance(temperature, (int, float)) or isinstance(temperature, bool):
                    raise ValueError("Every activity hold needs a temperature")
                if not minimum <= float(temperature) <= maximum:
                    raise ValueError(
                        f"Activity hold temperature must be between {minimum} and {maximum}"
                    )
        next_config = normalize_guards_zone_data({**previous, **updates})
        if isinstance(raw_holds, list) and len(next_config["activity_holds"]) != len(raw_holds):
            raise ValueError("An activity hold is invalid")
        scheduler._data["zones"][entity_id]["guards"] = next_config
        await scheduler._async_save_data()
        self._refresh_listeners()
        if self._started:
            await self.async_evaluate(reason="config")
        scheduler._async_write_state()
        return next_config

    async def async_settings_changed(self) -> None:
        """React to a global parameter change."""
        self._refresh_listeners()
        if self._started:
            await self.async_evaluate(reason="settings")

    async def async_snooze(
        self,
        entity_id: str,
        duration_minutes: int | None = None,
        *,
        source: str = "service",
    ) -> None:
        """Keep a head off: timed ``neveroff_snooze`` freeze replacing the manual."""
        scheduler = self._scheduler
        scheduler.ensure_managed_entity(entity_id)
        settings = self._settings()
        minutes = (
            int(duration_minutes)
            if duration_minutes is not None
            else settings["never_off_snooze_minutes"]
        )
        if not 1 <= minutes <= MAX_SNOOZE_MINUTES:
            raise ValueError(
                f"duration_minutes must be between 1 and {MAX_SNOOZE_MINUTES}"
            )
        now = dt_util.now()
        until = now + timedelta(minutes=minutes)
        await scheduler.async_pause_zone(
            entity_id,
            action=ZONE_PAUSE_ACTION_NONE,
            pause_id=PAUSE_ID_NEVER_OFF_SNOOZE,
            until=until.isoformat(),
        )
        # The snooze now owns the freeze; the person's Manual adjustment is
        # released without re-delivering anything (the freeze wins).
        await scheduler.async_resume_automatic_control(entity_id)
        runtime = self._runtime(entity_id)
        self._clear_grace(runtime)
        runtime.snooze_started_at = now
        self._record_action(runtime, "snoozed", now)
        runtime.state = GUARDS_STATE_SNOOZED
        self._persist_runtime(entity_id)
        await scheduler._async_save_data()
        self._fire(
            EVENT_TYPE_NEVER_OFF_SNOOZED,
            {
                "entity_id": entity_id,
                "snooze_until": until.isoformat(),
                "duration_minutes": minutes,
                "source": source,
            },
        )
        scheduler._async_write_state()

    @callback
    def observe_external_change(
        self,
        entity_id: str,
        *,
        previous: dict[str, Any],
        current: dict[str, Any],
    ) -> None:
        """Record an external control change; evaluated on the next refresh."""
        if entity_id not in self._scheduler._data.get("zones", {}):
            return
        record = self._external.setdefault(entity_id, {})
        previous_mode = previous.get("hvac_mode")
        current_mode = current.get("hvac_mode")
        if current_mode == HVAC_MODE_OFF:
            record["turned_off"] = True
            record["previous_hvac_mode"] = (
                previous_mode if isinstance(previous_mode, str) else None
            )
            previous_target = previous.get("temperature")
            if not isinstance(previous_target, (int, float)):
                previous_target = _state_setpoint(self._hass.states.get(entity_id))
            record["previous_target"] = (
                float(previous_target) if isinstance(previous_target, (int, float)) else None
            )
        elif previous_mode == HVAC_MODE_OFF and current_mode not in (None, HVAC_MODE_OFF):
            record["turned_on"] = True
        self.schedule_refresh()

    def schedule_refresh(self, delay_seconds: float = 0) -> None:
        """Schedule one coalesced evaluation after control state changes."""
        if not self._started or self._refresh_task_pending:
            return
        self._refresh_task_pending = True
        self._create_task(self._async_run_scheduled_refresh())

    async def _async_run_scheduled_refresh(self) -> None:
        self._refresh_task_pending = False
        await self.async_evaluate(reason="refresh")

    def _create_task(self, coroutine) -> None:
        task = self._hass.async_create_task(coroutine)
        if task is not None and hasattr(task, "add_done_callback"):
            self._tasks.add(task)
            task.add_done_callback(self._tasks.discard)

    @callback
    def _handle_zone_timer(self, _now: datetime, *, entity_id: str) -> None:
        runtime = self._zones.get(entity_id)
        if runtime is not None:
            runtime.unsub_timer = None
            runtime.next_transition_at = None
        self._create_task(self.async_evaluate(reason="timer"))

    # ------------------------------------------------------------------
    # Listeners
    # ------------------------------------------------------------------
    def _refresh_listeners(self) -> None:
        entity_ids: set[str] = set()
        settings = self._settings()
        house = self._house_modes_settings()
        for entity_id in self._scheduler._data["zones"]:
            entity_ids.add(entity_id)
            occupancy = self._occupancy_entity_id(entity_id)
            if occupancy:
                entity_ids.add(occupancy)
            for hold in self._config(entity_id)["activity_holds"]:
                entity_ids.add(hold["entity_id"])
        entity_ids.update(settings["owner_entity_ids"])
        entity_ids.update(house["presence_entity_ids"])
        if house["travel_entity_id"]:
            entity_ids.add(house["travel_entity_id"])
        tracked = tuple(sorted(entity_ids))
        if tracked == self._tracked_entities:
            return
        self._clear_listener()
        self._tracked_entities = tracked
        if not tracked:
            return
        self._unsub_listener = async_track_state_change_event(
            self._hass, list(tracked), self._handle_state_change
        )

    def _clear_listener(self) -> None:
        if self._unsub_listener is not None:
            self._unsub_listener()
            self._unsub_listener = None
        self._tracked_entities = ()

    @callback
    def _handle_state_change(self, event) -> None:
        data = getattr(event, "data", {}) or {}
        entity_id = data.get("entity_id")
        if isinstance(entity_id, str) and entity_id in self._tracked_entities:
            self.schedule_refresh()

    # ------------------------------------------------------------------
    # Evaluation
    # ------------------------------------------------------------------
    async def async_evaluate(self, *, reason: str = "manual") -> None:
        """Evaluate every zone and apply the resulting transitions."""
        if self._evaluating:
            self._rerun_requested = True
            return
        async with self._lock:
            self._evaluating = True
            try:
                await self._async_evaluate_locked(reason)
            finally:
                self._evaluating = False
        if self._rerun_requested:
            self._rerun_requested = False
            await self.async_evaluate(reason="rerun")

    async def _async_evaluate_locked(self, reason: str) -> None:
        now = dt_util.now()
        settings = self._settings()
        house = self._house_facts(settings, now)
        changed = False
        persist = False
        candidates: dict[str, list[datetime]] = {}
        for entity_id in list(self._scheduler._data["zones"]):
            external = self._external.pop(entity_id, None)
            runtime = self._runtime(entity_id)
            try:
                if not settings["enabled"]:
                    zone_candidates: list[datetime] = []
                    zone_changed = self._reset_zone(runtime, now)
                else:
                    zone_changed, zone_candidates = await self._async_evaluate_zone(
                        entity_id, runtime, external, settings, house, now
                    )
            except Exception:  # pragma: no cover - one zone must not stop the rest
                _LOGGER.exception("Guards evaluation failed for %s", entity_id)
                continue
            candidates[entity_id] = zone_candidates
            if zone_changed:
                self._persist_runtime(entity_id)
                changed = True
                persist = True
        self._reschedule_timers(candidates, now)
        if persist:
            await self._scheduler._async_save_data()
        if changed:
            self._scheduler._async_write_state()
        _LOGGER.debug(
            "Guards evaluated (%s): %s",
            reason,
            {entity_id: runtime.state for entity_id, runtime in self._zones.items()},
        )

    def _reset_zone(self, runtime: _ZoneRuntime, now: datetime) -> bool:
        """Disabled: drop grace timers and report idle without acting."""
        changed = runtime.grace_ends_at is not None or runtime.state != GUARDS_STATE_IDLE
        self._clear_grace(runtime)
        runtime.state = GUARDS_STATE_IDLE
        runtime.facts = {}
        return changed

    async def _async_evaluate_zone(
        self,
        entity_id: str,
        runtime: _ZoneRuntime,
        external: dict[str, Any] | None,
        settings: GuardsSettingsData,
        house: _HouseFacts,
        now: datetime,
    ) -> tuple[bool, list[datetime]]:
        scheduler = self._scheduler
        facts = self._zone_facts(entity_id, now)
        candidates: list[datetime] = []
        changed = False
        previous_state = runtime.state
        never_off = (
            settings["never_off_enabled"]
            and facts.config["never_off_enabled"]
            and facts.zone_enabled
        )

        # 1. A snoozed head turned on by a person: the snooze ends and the
        #    person's setting is protected by a Manual adjustment.
        if external and external.get("turned_on") and facts.snoozed:
            await self._async_release_snooze_for_person(entity_id)
            self._clear_grace(runtime)
            self._record_action(runtime, "snooze_released_by_person", now)
            changed = True
            facts = self._zone_facts(entity_id, now)

        # 2. Never-off: grace, cancellation and recovery.
        if facts.head_available and not facts.head_off:
            runtime.relight_requested_at = None
        if runtime.grace_ends_at is not None:
            cancel: str | None = None
            if not never_off:
                cancel = "disabled"
            elif facts.head_available and not facts.head_off:
                cancel = "head_on"
            elif facts.snoozed:
                cancel = "snoozed"
            elif facts.travel_frozen:
                cancel = "travel_off"
            elif facts.velair_intends_off:
                cancel = "velair_off"
            if cancel is not None:
                self._clear_grace(runtime)
                self._record_action(runtime, f"grace_cancelled_{cancel}", now)
                changed = True
            elif not facts.head_available:
                pass  # P5: keep waiting until the head reports again.
            elif now >= runtime.grace_ends_at:
                if house.travel_on and settings["never_off_respect_travel"]:
                    pass  # No relight while travel is on; re-checked on change.
                else:
                    await self._async_recover(entity_id, runtime, facts, now)
                    changed = True
                    facts = self._zone_facts(entity_id, now)
            else:
                candidates.append(runtime.grace_ends_at)
        elif (
            never_off
            and facts.head_available
            and facts.head_off
            and not facts.snoozed
            and not facts.travel_frozen
            and not facts.velair_intends_off
            and self._may_arm_grace(runtime, facts, settings, now)
        ):
            self._arm_grace(entity_id, runtime, facts, external, settings, now)
            candidates.append(runtime.grace_ends_at)  # type: ignore[arg-type]
            changed = True

        # 3. Vacancy or house-empty release of the snooze (and the watchdog).
        #    The window counts from the later of the room going empty and the
        #    pause starting, so an already-empty room keeps a fresh snooze.
        if facts.snoozed:
            if runtime.snooze_started_at is None:
                # Unknown after a restart: the pause's own start is the truth.
                runtime.snooze_started_at = (
                    _pause_started_at(facts.pauses, PAUSE_ID_NEVER_OFF_SNOOZE) or now
                )
                changed = True
        elif runtime.snooze_started_at is not None:
            runtime.snooze_started_at = None
            changed = True
        releasable = [
            pause_id
            for pause_id in (PAUSE_ID_WATCHDOG, PAUSE_ID_NEVER_OFF_SNOOZE)
            if pause_id in facts.pause_ids
        ]
        if releasable and settings["never_off_enabled"] and facts.zone_enabled:
            release_after = timedelta(
                minutes=settings["never_off_snooze_release_vacant_minutes"]
            )
            released: dict[str, str] = {}
            for pause_id in releasable:
                started = (
                    runtime.snooze_started_at
                    if pause_id == PAUSE_ID_NEVER_OFF_SNOOZE
                    else None
                ) or _pause_started_at(facts.pauses, pause_id)
                for since, why in (
                    (facts.occupancy_off_since, REASON_VACANT),
                    (house.empty_since, REASON_HOUSE_EMPTY),
                ):
                    if since is None:
                        continue
                    anchor = max(since, started) if started is not None else since
                    due_at = anchor + release_after
                    if due_at <= now:
                        released.setdefault(pause_id, why)
                    else:
                        candidates.append(due_at)
            if released:
                for pause_id, why in released.items():
                    await self._async_resume(entity_id, pause_id, reason=f"guards_{why}")
                runtime.relight_requested_at = now
                self._record_action(
                    runtime, f"snooze_released_{next(iter(released.values()))}", now
                )
                changed = True
                facts = self._zone_facts(entity_id, now)

        # 4. Manual-adjustment release rules (a), (b) and (c).
        manual_release_at: datetime | None = None
        if (
            facts.manual_since is not None
            and settings["manual_release_enabled"]
            and facts.zone_enabled
        ):
            lease_end = facts.manual_since + timedelta(
                minutes=settings["manual_lease_minutes"]
            )
            options: list[tuple[datetime, str]] = []
            if facts.occupancy_off_since is not None:
                # The vacancy window counts from the later of the room going
                # empty and the adjustment itself, so a hand-set value made in
                # an already-empty room gets its full window.
                vacant_since = max(facts.occupancy_off_since, facts.manual_since)
                options.append(
                    (
                        max(
                            lease_end,
                            vacant_since
                            + timedelta(minutes=settings["manual_release_vacant_minutes"]),
                        ),
                        REASON_VACANT,
                    )
                )
            if (
                settings["manual_release_on_travel"]
                and house.travel_on
                and (house.travel_since is None or facts.manual_since <= house.travel_since)
            ):
                options.append((lease_end, REASON_TRAVEL))
            if (
                settings["manual_release_below_minimum"]
                and house.owners_away_since is not None
                and facts.minimum_temperature is not None
                and facts.setpoint is not None
                and facts.setpoint
                < facts.minimum_temperature
                - temperature_delta(BELOW_MINIMUM_TOLERANCE_C, CELSIUS, facts.unit)
            ):
                options.append(
                    (
                        max(
                            lease_end,
                            house.owners_away_since
                            + timedelta(minutes=settings["owner_away_minutes"]),
                        ),
                        REASON_BELOW_MINIMUM,
                    )
                )
            due = sorted(option for option in options if option[0] <= now)
            if due:
                reason = due[0][1]
                if (
                    reason == REASON_BELOW_MINIMUM
                    and facts.config["manual_release_below_minimum_action"]
                    == BELOW_MINIMUM_ACTION_FLOOR_HOLD
                ):
                    await self._async_floor_hold(entity_id, runtime, facts, now)
                else:
                    await self._async_release_manual(entity_id, runtime, facts, reason, now)
                changed = True
                facts = self._zone_facts(entity_id, now)
            elif options:
                manual_release_at = min(option[0] for option in options)
                candidates.append(manual_release_at)

        # 4b. A floor hold stands in for the Manual adjustment it replaced: it
        #     ends when an owner is back, when a newer Manual adjustment ends,
        #     or when rules (a)/(b) would have ended the original one.
        if PAUSE_ID_FLOOR in facts.pause_ids and facts.zone_enabled:
            if facts.manual_since is not None and not runtime.floor_manual_active:
                runtime.floor_manual_active = True
                changed = True
            floor_reason, floor_at = self._floor_release(runtime, facts, settings, house, now)
            if floor_reason is not None:
                await self._async_resume(entity_id, PAUSE_ID_FLOOR, reason=f"guards_{floor_reason}")
                self._clear_floor(runtime)
                self._record_action(runtime, f"floor_hold_released_{floor_reason}", now)
                changed = True
                facts = self._zone_facts(entity_id, now)
            elif floor_at is not None:
                if manual_release_at is None or floor_at < manual_release_at:
                    manual_release_at = floor_at
                candidates.append(floor_at)
        elif runtime.floor_since is not None:
            self._clear_floor(runtime)
            changed = True

        # 5. Activity holds.
        activity_entity_id: str | None = None
        grouped: dict[str, list[GuardsActivityHoldData]] = {}
        for hold in facts.config["activity_holds"]:
            grouped.setdefault(hold["pause_id"], []).append(hold)
        for pause_id, holds in grouped.items():
            engaged = pause_id in facts.pause_ids
            readings = [
                (hold, *_state_of(self._hass, hold["entity_id"], now))
                for hold in holds
            ]
            on_holds = [hold for hold, state, _changed in readings if state == "on"]
            if on_holds:
                activity_entity_id = activity_entity_id or on_holds[0]["entity_id"]
                if facts.zone_enabled and await self._async_engage_activity(
                    entity_id, on_holds[0], engaged
                ):
                    self._record_action(runtime, "activity_hold_engaged", now)
                    changed = True
                    facts = self._zone_facts(entity_id, now)
                continue
            if not engaged or not facts.zone_enabled:
                continue
            if any(state in _UNCERTAIN for _hold, state, _changed in readings):
                continue  # P5: hold the current state.
            latest_hold, _state, latest_changed = max(
                readings, key=lambda item: item[2] or now
            )
            due_at = (latest_changed or now) + timedelta(
                minutes=latest_hold["release_delay_minutes"]
            )
            if due_at <= now:
                await self._async_release_activity(
                    entity_id, runtime, facts, latest_hold, settings, now
                )
                changed = True
                facts = self._zone_facts(entity_id, now)
            else:
                candidates.append(due_at)

        # 6. Project the state and attributes.
        runtime.facts = {
            "pause_ids": list(facts.pause_ids),
            "snooze_until": facts.snooze_until,
            "manual_since": _isoformat(facts.manual_since),
            "manual_release_at": _isoformat(manual_release_at),
            "activity_entity_id": activity_entity_id,
            "occupancy_entity_id": facts.occupancy_entity_id,
            "floor_since": _isoformat(runtime.floor_since),
        }
        runtime.state = self._project_state(runtime, facts, settings, activity_entity_id)
        if runtime.state != previous_state:
            changed = True
        return changed, candidates

    def _project_state(
        self,
        runtime: _ZoneRuntime,
        facts: _ZoneFacts,
        settings: GuardsSettingsData,
        activity_entity_id: str | None,
    ) -> str:
        if runtime.grace_ends_at is not None:
            return GUARDS_STATE_OFF_GRACE
        if facts.snoozed:
            return GUARDS_STATE_SNOOZED
        if facts.manual_since is not None and settings["manual_release_enabled"]:
            return GUARDS_STATE_MANUAL_WATCH
        if PAUSE_ID_FLOOR in facts.pause_ids:
            return GUARDS_STATE_FLOOR_HOLD
        if facts.recovering:
            return GUARDS_STATE_RECOVERING
        if activity_entity_id is not None and any(
            hold["pause_id"] in facts.pause_ids for hold in facts.config["activity_holds"]
        ):
            return GUARDS_STATE_ACTIVITY_HOLD
        return GUARDS_STATE_IDLE

    # ------------------------------------------------------------------
    # Never-off actions
    # ------------------------------------------------------------------
    def _may_arm_grace(
        self,
        runtime: _ZoneRuntime,
        facts: _ZoneFacts,
        settings: GuardsSettingsData,
        now: datetime,
    ) -> bool:
        """Avoid re-arming while a relight Velair just requested is in flight."""
        requested = runtime.relight_requested_at
        if requested is None:
            return True
        if facts.head_changed_at is not None and facts.head_changed_at > requested:
            return True
        retry_after = timedelta(minutes=settings["never_off_grace_minutes"])
        return now - requested >= retry_after

    def _arm_grace(
        self,
        entity_id: str,
        runtime: _ZoneRuntime,
        facts: _ZoneFacts,
        external: dict[str, Any] | None,
        settings: GuardsSettingsData,
        now: datetime,
    ) -> None:
        grace = timedelta(minutes=settings["never_off_grace_minutes"])
        runtime.grace_started_at = now
        runtime.grace_ends_at = now + grace
        if external and external.get("turned_off"):
            runtime.previous_target = external.get("previous_target")
            runtime.previous_hvac_mode = external.get("previous_hvac_mode")
        else:
            runtime.previous_target = facts.setpoint
            runtime.previous_hvac_mode = None
        runtime.relight_requested_at = None
        self._record_action(runtime, "grace_started", now)
        self._fire(
            EVENT_TYPE_NEVER_OFF_GRACE_STARTED,
            {
                "entity_id": entity_id,
                "grace_started_at": now.isoformat(),
                "grace_ends_at": runtime.grace_ends_at.isoformat(),
                "grace_minutes": settings["never_off_grace_minutes"],
                "previous_target": runtime.previous_target,
                "previous_hvac_mode": runtime.previous_hvac_mode,
                "snooze_minutes": settings["never_off_snooze_minutes"],
            },
        )

    async def _async_recover(
        self,
        entity_id: str,
        runtime: _ZoneRuntime,
        facts: _ZoneFacts,
        now: datetime,
    ) -> None:
        """Hold ``neveroff_recover`` raise-only, then hand the zone back to Velair."""
        scheduler = self._scheduler
        values = [
            value
            for value in (
                runtime.previous_target,
                facts.stage3_temperature,
                facts.minimum_temperature,
            )
            if isinstance(value, (int, float))
        ]
        temperature = max(values) if values else None
        hvac_mode = self._usable_hvac_mode(entity_id, runtime.previous_hvac_mode)
        applied: float | None = None
        if temperature is not None:
            for candidate_mode in dict.fromkeys((hvac_mode, None)):
                try:
                    await scheduler.async_pause_zone(
                        entity_id,
                        action=ZONE_PAUSE_ACTION_HOLD,
                        pause_id=PAUSE_ID_NEVER_OFF_RECOVER,
                        temperature=temperature,
                        constraint=HOLD_CONSTRAINT_RAISE_ONLY,
                        hvac_mode=candidate_mode,
                        label=RECOVERY_LABEL,
                    )
                except ValueError as err:
                    _LOGGER.warning(
                        "Guards could not hold %s for never-off recovery: %s",
                        entity_id,
                        err,
                    )
                    continue
                applied = temperature
                hvac_mode = candidate_mode
                break
        try:
            # Velair delivers the hold (or the schedule) with the mode first.
            await scheduler.async_resume_automatic_control(entity_id)
        except ValueError as err:
            _LOGGER.warning("Guards could not resume %s after grace: %s", entity_id, err)
        self._clear_grace(runtime)
        runtime.relight_requested_at = now
        self._record_action(runtime, "recovered", now)
        self._fire(
            EVENT_TYPE_NEVER_OFF_RECOVERED,
            {
                "entity_id": entity_id,
                "temperature": applied,
                "hvac_mode": hvac_mode if applied is not None else None,
                "constraint": HOLD_CONSTRAINT_RAISE_ONLY,
                "pause_id": PAUSE_ID_NEVER_OFF_RECOVER,
                "previous_target": runtime.previous_target,
                "recovered_at": now.isoformat(),
            },
        )

    async def _async_release_snooze_for_person(self, entity_id: str) -> None:
        scheduler = self._scheduler
        # A leftover recovery hold would be re-delivered the moment the
        # freeze goes; drop it first while the freeze still blocks delivery.
        await self._async_resume(
            entity_id,
            PAUSE_ID_NEVER_OFF_RECOVER,
            reason="guards_person",
            apply_current_schedule=False,
        )
        await self._async_resume(
            entity_id,
            PAUSE_ID_NEVER_OFF_SNOOZE,
            reason="guards_person",
            apply_current_schedule=False,
        )
        try:
            await scheduler.async_enter_manual_adjustment(entity_id)
        except ValueError as err:
            _LOGGER.warning(
                "Guards could not protect the manual turn-on of %s: %s", entity_id, err
            )

    # ------------------------------------------------------------------
    # Manual release and activity holds
    # ------------------------------------------------------------------
    async def _async_release_manual(
        self,
        entity_id: str,
        runtime: _ZoneRuntime,
        facts: _ZoneFacts,
        reason: str,
        now: datetime,
    ) -> None:
        try:
            await self._scheduler.async_resume_automatic_control(entity_id)
        except ValueError as err:
            _LOGGER.warning("Guards could not release the manual on %s: %s", entity_id, err)
            return
        age_minutes = (
            round((now - facts.manual_since).total_seconds() / 60, 1)
            if facts.manual_since is not None
            else None
        )
        self._record_action(runtime, f"manual_released_{reason}", now)
        self._fire(
            EVENT_TYPE_MANUAL_HOLD_RELEASED,
            {
                "entity_id": entity_id,
                "reason": reason,
                "action": BELOW_MINIMUM_ACTION_RELEASE,
                "manual_since": _isoformat(facts.manual_since),
                "age_minutes": age_minutes,
                "released_at": now.isoformat(),
            },
        )

    async def _async_floor_hold(
        self,
        entity_id: str,
        runtime: _ZoneRuntime,
        facts: _ZoneFacts,
        now: datetime,
    ) -> None:
        """Rule (c) with ``floor_hold``: land the room exactly on the floor.

        The hold is ``absolute`` because Velair already clamps every delivery
        to the floor: a raise-only hold would fold to the schedule target and
        the room would not stay at the floor the way the legacy clamp kept it.
        """
        scheduler = self._scheduler
        try:
            await scheduler.async_pause_zone(
                entity_id,
                action=ZONE_PAUSE_ACTION_HOLD,
                pause_id=PAUSE_ID_FLOOR,
                temperature=facts.minimum_temperature,
                constraint=HOLD_CONSTRAINT_ABSOLUTE,
                label=FLOOR_LABEL,
            )
        except ValueError as err:
            _LOGGER.warning("Guards could not hold %s at its floor: %s", entity_id, err)
            return
        try:
            await scheduler.async_resume_automatic_control(entity_id)
        except ValueError as err:
            _LOGGER.warning("Guards could not resume %s for the floor: %s", entity_id, err)
        runtime.floor_since = now
        runtime.floor_manual_since = facts.manual_since
        runtime.floor_manual_active = False
        self._record_action(runtime, "floor_hold_placed", now)
        age_minutes = (
            round((now - facts.manual_since).total_seconds() / 60, 1)
            if facts.manual_since is not None
            else None
        )
        self._fire(
            EVENT_TYPE_MANUAL_HOLD_RELEASED,
            {
                "entity_id": entity_id,
                "reason": REASON_BELOW_MINIMUM,
                "action": BELOW_MINIMUM_ACTION_FLOOR_HOLD,
                "floor_temperature": facts.minimum_temperature,
                "manual_since": _isoformat(facts.manual_since),
                "age_minutes": age_minutes,
                "released_at": now.isoformat(),
            },
        )

    def _floor_release(
        self,
        runtime: _ZoneRuntime,
        facts: _ZoneFacts,
        settings: GuardsSettingsData,
        house: _HouseFacts,
        now: datetime,
    ) -> tuple[str | None, datetime | None]:
        """Return (reason due now, next candidate) for an active floor hold."""
        options: list[tuple[datetime, str]] = []
        present_since = self._present_since(settings["owner_entity_ids"], now)
        if present_since is not None:
            options.append(
                (
                    present_since + timedelta(minutes=settings["owner_away_minutes"]),
                    REASON_OWNER_PRESENT,
                )
            )
        if facts.manual_since is None:
            if runtime.floor_manual_active:
                return REASON_MANUAL_ENDED, None
            origin = runtime.floor_manual_since or runtime.floor_since or now
            lease_end = origin + timedelta(minutes=settings["manual_lease_minutes"])
            if facts.occupancy_off_since is not None:
                options.append(
                    (
                        max(
                            lease_end,
                            max(facts.occupancy_off_since, origin)
                            + timedelta(minutes=settings["manual_release_vacant_minutes"]),
                        ),
                        REASON_VACANT,
                    )
                )
            if (
                settings["manual_release_on_travel"]
                and house.travel_on
                and (house.travel_since is None or origin <= house.travel_since)
            ):
                options.append((lease_end, REASON_TRAVEL))
        due = sorted(option for option in options if option[0] <= now)
        if due:
            return due[0][1], None
        return None, (min(option[0] for option in options) if options else None)

    def _present_since(self, entity_ids: list[str], now: datetime) -> datetime | None:
        """Return since when the longest-present owner has been home, or None."""
        earliest: datetime | None = None
        for entity_id in entity_ids:
            state, changed_at = _state_of(self._hass, entity_id, now)
            if state not in _HOME_STATES:
                continue
            changed_at = changed_at or now
            earliest = changed_at if earliest is None or changed_at < earliest else earliest
        return earliest

    @staticmethod
    def _clear_floor(runtime: _ZoneRuntime) -> None:
        runtime.floor_since = None
        runtime.floor_manual_since = None
        runtime.floor_manual_active = False

    async def _async_engage_activity(
        self,
        entity_id: str,
        hold: GuardsActivityHoldData,
        engaged: bool,
    ) -> bool:
        """Ensure the hold exists; return True when it was newly engaged."""
        try:
            await self._scheduler.async_pause_zone(
                entity_id,
                action=ZONE_PAUSE_ACTION_HOLD,
                pause_id=hold["pause_id"],
                temperature=hold["temperature"],
                constraint=hold["constraint"],
                hvac_mode=self._usable_hvac_mode(entity_id, hold["hvac_mode"]),
                label=hold["label"] or f"activity {hold['entity_id']}",
            )
        except ValueError as err:
            _LOGGER.warning("Guards could not hold %s for activity: %s", entity_id, err)
            return False
        if engaged:
            return False
        self._fire(
            EVENT_TYPE_ACTIVITY_HOLD_CHANGED,
            {
                "entity_id": entity_id,
                "activity_entity_id": hold["entity_id"],
                "pause_id": hold["pause_id"],
                "active": True,
                "temperature": hold["temperature"],
                "constraint": hold["constraint"],
                "resumed_automatic": False,
            },
        )
        return True

    async def _async_release_activity(
        self,
        entity_id: str,
        runtime: _ZoneRuntime,
        facts: _ZoneFacts,
        hold: GuardsActivityHoldData,
        settings: GuardsSettingsData,
        now: datetime,
    ) -> None:
        await self._async_resume(entity_id, hold["pause_id"], reason="guards_activity")
        resumed_automatic = False
        if facts.manual_since is not None:
            age = now - facts.manual_since
            if age >= timedelta(minutes=settings["manual_lease_minutes"]):
                try:
                    await self._scheduler.async_resume_automatic_control(entity_id)
                    resumed_automatic = True
                except ValueError as err:
                    _LOGGER.warning(
                        "Guards could not resume %s after activity: %s", entity_id, err
                    )
        self._record_action(runtime, "activity_hold_released", now)
        self._fire(
            EVENT_TYPE_ACTIVITY_HOLD_CHANGED,
            {
                "entity_id": entity_id,
                "activity_entity_id": hold["entity_id"],
                "pause_id": hold["pause_id"],
                "active": False,
                "temperature": hold["temperature"],
                "constraint": hold["constraint"],
                "resumed_automatic": resumed_automatic,
            },
        )

    async def _async_resume(
        self,
        entity_id: str,
        pause_id: str,
        *,
        reason: str,
        apply_current_schedule: bool = True,
    ) -> None:
        try:
            await self._scheduler.async_resume_zone(
                entity_id,
                pause_id=pause_id,
                apply_current_schedule=apply_current_schedule,
                reason=reason,
            )
        except ValueError as err:
            _LOGGER.warning("Guards could not release %s on %s: %s", pause_id, entity_id, err)

    # ------------------------------------------------------------------
    # Facts
    # ------------------------------------------------------------------
    def _zone_facts(self, entity_id: str, now: datetime) -> _ZoneFacts:
        scheduler = self._scheduler
        zone = scheduler._data["zones"].get(entity_id) or {}
        config = normalize_guards_zone_data(zone.get("guards"))
        zone_enabled = (
            bool(zone.get("enabled", True))
            and scheduler.mode == MODE_AUTO
            and not getattr(scheduler, "temperature_migration_blocked", False)
            and not getattr(scheduler, "_stopped", False)
            and not _external_execution(scheduler, entity_id)
        )
        head = self._hass.states.get(entity_id)
        head_state, head_changed_at = _state_of(self._hass, entity_id, now)
        head_available = head_state not in _UNCERTAIN
        override = scheduler.get_zone_override_status(entity_id)
        pauses = [
            pause for pause in (override.get("pauses") or []) if isinstance(pause, dict)
        ]
        pause_ids = [
            pause["pause_id"] for pause in pauses if isinstance(pause.get("pause_id"), str)
        ]
        context = scheduler.get_zone_context(entity_id)
        manual_since = (
            _parse_timestamp(context.get("manual_since"))
            if context.get("control_mode") == "manual"
            else None
        )
        occupancy_entity_id = self._occupancy_entity_id(entity_id)
        occupancy_state, occupancy_changed_at = _state_of(
            self._hass, occupancy_entity_id, now
        )
        occupancy_off_since = (
            (occupancy_changed_at or now) if occupancy_state == "off" else None
        )
        active_event = scheduler.get_active_target_event(entity_id)
        velair_intends_off = override.get("action") == ZONE_PAUSE_ACTION_TURN_OFF or (
            active_event is not None and active_event.action == ACTION_TURN_OFF
        )
        return _ZoneFacts(
            entity_id=entity_id,
            config=config,
            zone_enabled=zone_enabled,
            head_state=head_state,
            head_available=head_available,
            head_off=head_state == HVAC_MODE_OFF,
            head_changed_at=head_changed_at,
            setpoint=_state_setpoint(head),
            pause_ids=pause_ids,
            pauses=pauses,
            manual_since=manual_since,
            occupancy_entity_id=occupancy_entity_id,
            occupancy_state=occupancy_state,
            occupancy_off_since=occupancy_off_since,
            stage3_temperature=self._stage3_temperature(entity_id),
            minimum_temperature=self._minimum_temperature(entity_id),
            velair_intends_off=velair_intends_off,
            unit=self._unit(entity_id),
        )

    def _house_facts(self, settings: GuardsSettingsData, now: datetime) -> _HouseFacts:
        house = self._house_modes_settings()
        travel_state, travel_changed_at = _state_of(
            self._hass, house["travel_entity_id"], now
        )
        return _HouseFacts(
            travel_on=travel_state == "on",
            travel_since=travel_changed_at if travel_state == "on" else None,
            empty_since=self._away_since(house["presence_entity_ids"], now),
            owners_away_since=self._away_since(settings["owner_entity_ids"], now),
        )

    def _away_since(self, entity_ids: list[str], now: datetime) -> datetime | None:
        """Return when the last of these presence entities left, or None.

        P5: an empty list or any ``unknown``/``unavailable`` entity means
        "no evidence": the house (or the owners) never count as away.
        """
        if not entity_ids:
            return None
        latest: datetime | None = None
        for entity_id in entity_ids:
            state, changed_at = _state_of(self._hass, entity_id, now)
            if state in _UNCERTAIN or state in _HOME_STATES:
                return None
            changed_at = changed_at or now
            latest = changed_at if latest is None or changed_at > latest else latest
        return latest

    def _occupancy_entity_id(self, entity_id: str) -> str | None:
        zone = self._scheduler._data["zones"].get(entity_id) or {}
        occupancy = zone.get("occupancy_assist")
        if not isinstance(occupancy, dict):
            return None
        value = occupancy.get("occupancy_entity_id")
        return value if isinstance(value, str) and "." in value else None

    def _stage3_temperature(self, entity_id: str) -> float | None:
        zone = self._scheduler._data["zones"].get(entity_id) or {}
        occupancy = zone.get("occupancy_assist")
        if not isinstance(occupancy, dict):
            return None
        stages = occupancy.get("setback_stages")
        if not isinstance(stages, list) or not stages or not isinstance(stages[-1], dict):
            return None
        value = stages[-1].get("temperature")
        return float(value) if isinstance(value, (int, float)) and not isinstance(value, bool) else None

    def _minimum_temperature(self, entity_id: str) -> float | None:
        try:
            limits = self._scheduler.get_zone_limits(entity_id)
        except Exception:  # pragma: no cover - defensive
            return None
        value = limits.get("min_temperature") if isinstance(limits, dict) else None
        return float(value) if isinstance(value, (int, float)) else None

    def _house_modes_settings(self) -> dict[str, Any]:
        settings = self._scheduler._data.get("settings") or {}
        house = settings.get("house_modes")
        house = house if isinstance(house, dict) else {}
        presence = house.get("presence_entity_ids")
        travel = house.get("travel_entity_id")
        return {
            "presence_entity_ids": [
                item for item in presence if isinstance(item, str) and "." in item
            ]
            if isinstance(presence, list)
            else [],
            "travel_entity_id": travel if isinstance(travel, str) and "." in travel else None,
        }

    def _usable_hvac_mode(self, entity_id: str, hvac_mode: str | None) -> str | None:
        if hvac_mode is None or hvac_mode not in HVAC_MODE_OPTIONS:
            return None
        supported = getattr(self._scheduler._climate_manager, "supported_hvac_modes", None)
        if callable(supported):
            try:
                modes = supported(entity_id)
            except Exception:  # pragma: no cover - defensive
                modes = None
            if modes and hvac_mode not in modes:
                return None
        return hvac_mode

    # ------------------------------------------------------------------
    # Timers
    # ------------------------------------------------------------------
    def _reschedule_timers(
        self, candidates: dict[str, list[datetime]], now: datetime
    ) -> None:
        for entity_id, runtime in self._zones.items():
            future = [when for when in candidates.get(entity_id, []) if when > now]
            next_at = min(future) if future else None
            if next_at == runtime.next_transition_at and (
                runtime.unsub_timer is not None or next_at is None
            ):
                continue
            self._clear_zone_timer(runtime)
            runtime.next_transition_at = next_at
            if next_at is None or not self._started:
                continue
            runtime.unsub_timer = async_track_point_in_time(
                self._hass,
                partial(self._handle_zone_timer, entity_id=entity_id),
                next_at,
            )

    @staticmethod
    def _clear_zone_timer(runtime: _ZoneRuntime) -> None:
        if runtime.unsub_timer is not None:
            runtime.unsub_timer()
            runtime.unsub_timer = None
        runtime.next_transition_at = None

    # ------------------------------------------------------------------
    # Helpers
    # ------------------------------------------------------------------
    def _runtime(self, entity_id: str) -> _ZoneRuntime:
        runtime = self._zones.get(entity_id)
        if runtime is None:
            runtime = _ZoneRuntime()
            self._zones[entity_id] = runtime
        return runtime

    def _config(self, entity_id: str) -> GuardsZoneData:
        zone = self._scheduler._data["zones"].get(entity_id) or {}
        return normalize_guards_zone_data(zone.get("guards"))

    def _settings(self) -> GuardsSettingsData:
        settings = self._scheduler._data.get("settings") or {}
        return normalize_guards_settings(settings.get("guards"))

    def _unit(self, entity_id: str) -> str:
        unit_getter = getattr(self._scheduler._climate_manager, "temperature_unit", None)
        if callable(unit_getter):
            try:
                unit = unit_getter(entity_id)
            except Exception:  # pragma: no cover - defensive
                unit = None
            if unit:
                return unit
        return CELSIUS

    @staticmethod
    def _clear_grace(runtime: _ZoneRuntime) -> None:
        runtime.grace_started_at = None
        runtime.grace_ends_at = None

    @staticmethod
    def _record_action(runtime: _ZoneRuntime, action: str, now: datetime) -> None:
        runtime.last_action = action
        runtime.last_action_at = now

    def _persist_runtime(self, entity_id: str) -> None:
        runtime = self._runtime(entity_id)
        record: GuardsRuntimeData = {
            "state": runtime.state,
            "grace_started_at": _isoformat(runtime.grace_started_at),
            "grace_ends_at": _isoformat(runtime.grace_ends_at),
            "previous_target": runtime.previous_target,
            "previous_hvac_mode": runtime.previous_hvac_mode,
            "relight_requested_at": _isoformat(runtime.relight_requested_at),
            "snooze_started_at": _isoformat(runtime.snooze_started_at),
            "floor_since": _isoformat(runtime.floor_since),
            "floor_manual_since": _isoformat(runtime.floor_manual_since),
            "floor_manual_active": runtime.floor_manual_active,
            "last_action": runtime.last_action,
            "last_action_at": _isoformat(runtime.last_action_at),
        }
        settings = self._scheduler._data.setdefault("settings", {})
        store = settings.setdefault("guards_runtime", {})
        store[entity_id] = record

    def _fire(self, event_name: str, data: dict[str, Any]) -> None:
        self._scheduler._async_fire_event(event_name, data)


def _external_execution(scheduler: Any, entity_id: str) -> bool:
    checker = getattr(scheduler, "_is_external_execution", None)
    if not callable(checker):
        return False
    try:
        return bool(checker(entity_id))
    except Exception:  # pragma: no cover - defensive
        return False


def _state_of(hass, entity_id: str | None, now: datetime) -> tuple[str | None, datetime | None]:
    """Return (state, last_changed) for an entity, tolerating stubs."""
    if not entity_id:
        return None, None
    state = hass.states.get(entity_id)
    if state is None:
        return None, None
    return getattr(state, "state", None), _as_datetime(getattr(state, "last_changed", None))


def _pause_started_at(pauses: list[dict[str, Any]], pause_id: str) -> datetime | None:
    """Return the start of one identified pause reason, when known."""
    for pause in pauses:
        if pause.get("pause_id") == pause_id:
            return _parse_timestamp(pause.get("started_at"))
    return None


def _state_setpoint(state) -> float | None:
    attributes = getattr(state, "attributes", {}) if state is not None else {}
    value = attributes.get("temperature") if isinstance(attributes, dict) else None
    if isinstance(value, bool) or not isinstance(value, (int, float)):
        return None
    return float(value)


def _as_datetime(value: Any) -> datetime | None:
    if isinstance(value, datetime):
        return value
    if isinstance(value, str):
        return _parse_timestamp(value)
    return None


def _parse_timestamp(value: Any) -> datetime | None:
    if not isinstance(value, str) or not value:
        return None
    parsed = dt_util.parse_datetime(value)
    if parsed is None:
        return None
    return dt_util.as_local(parsed)


def _isoformat(value: datetime | None) -> str | None:
    return value.isoformat() if value is not None else None
