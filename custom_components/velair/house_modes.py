"""House Modes: away staging, sleep and pre-sleep holds, travel park and freeze.

The scheduler creates one ``HouseModesCoordinator``. It observes the presence,
corroboration, sleep, and travel entities named in ``settings["house_modes"]``
and writes every decision through the shared hold API
(``async_pause_zone`` / ``async_resume_zone``), so holds fold with every other
Velair authority. It never calls a ``climate.*`` service; the only non-climate
service call is ``homeassistant.turn_off`` on the configured travel entity
when ``travel_auto_exit_on_arrival`` is on.

Doctrine (``docs/dev/home-policy-spec.md`` section 1):

- P1: a hand-set value is protected; zones in a fresh Manual adjustment are
  skipped, and ``travel_off`` is only released when a person turns the head on.
- P2: an empty house only gets warmer, so away and travel holds are raise-only.
- P5: uncertain occupancy holds the current state; an ``unknown`` or
  ``unavailable`` presence, corroboration, sleep, or travel input never makes
  the house empty or asleep and never releases anything by itself.
"""

from __future__ import annotations

import asyncio
from dataclasses import dataclass, field
from datetime import datetime, time, timedelta
import logging
from typing import TYPE_CHECKING, Any

from homeassistant.core import CALLBACK_TYPE, callback
from homeassistant.helpers.event import (
    async_track_point_in_time,
    async_track_state_change_event,
)
from homeassistant.util import dt as dt_util

from .const import (
    EVENT_TYPE_HOUSE_MODE_CHANGED,
    EVENT_TYPE_HOUSE_ZONE_PARKED,
    HOLD_CONSTRAINT_LOWER_ONLY,
    HOLD_CONSTRAINT_RAISE_ONLY,
    HVAC_MODE_OFF,
    ZONE_PAUSE_ACTION_HOLD,
    ZONE_PAUSE_ACTION_NONE,
)
from .house_modes_models import (
    DEFAULT_MANUAL_LEASE_MINUTES,
    DEFAULT_SETBACK_FAN_MODE,
    DEFAULT_SETBACK_HVAC_MODE,
    HOUSE_MODE_AWAY,
    HOUSE_MODE_AWAY_DEEP,
    HOUSE_MODE_DISABLED,
    HOUSE_MODE_HOME,
    HOUSE_MODE_SLEEP,
    HOUSE_MODE_TRAVEL,
    HOUSE_MODES_PAUSE_IDS,
    HOUSE_MODES_ZONE_TEMPERATURE_KEYS,
    PAUSE_ID_AWAY_1H,
    PAUSE_ID_AWAY_6H,
    PAUSE_ID_PRESLEEP,
    PAUSE_ID_SLEEP,
    PAUSE_ID_TRAVEL_OFF,
    PAUSE_ID_TRAVEL_PARK,
    TRAVEL_RECHECK_MINUTES,
    HouseModesRuntimeData,
    HouseModesSettingsData,
    HouseModesZoneData,
    normalize_house_modes_data,
    normalize_house_modes_runtime_data,
    normalize_house_modes_settings,
    normalize_presleep_time,
)
from .temperature import CELSIUS

if TYPE_CHECKING:  # pragma: no cover - typing only
    from .scheduler import VelairScheduler

_LOGGER = logging.getLogger(__name__)

RUNTIME_KEY = "house_modes_runtime"
SETTINGS_KEY = "house_modes"

STATE_HOME = "home"
STATE_NOT_HOME = "not_home"
STATE_ON = "on"
STATE_OFF = "off"
UNCERTAIN_STATES = (None, "", "unknown", "unavailable")

REASON_HEAD_OFF = "head_off"
REASON_HEAD_UNAVAILABLE = "head_unavailable"
REASON_MANUAL_FRESH = "manual_fresh"
REASON_MANUAL = "manual"
REASON_BLOCKED = "blocked"
REASON_DISABLED = "zone_disabled"
REASON_NO_TEMPERATURE = "no_temperature"

LABEL_AWAY_1 = "away stage 1"
LABEL_AWAY_2 = "away stage 2"
LABEL_SLEEP = "sleep"
LABEL_PRESLEEP = "pre-sleep"
LABEL_TRAVEL_PARK = "travel park"


@dataclass
class _Runtime:
    """In-memory runtime; persisted as ``settings["house_modes_runtime"]``."""

    state: str = HOUSE_MODE_DISABLED
    sleeping: bool = False
    sleep_since: datetime | None = None
    travel_active: bool = False
    travel_since: datetime | None = None
    empty_since: datetime | None = None
    away_stage: int = 0
    presleep_applied_on: str | None = None
    saved_minimums: dict[str, dict[str, float | None]] = field(default_factory=dict)
    humidity_assist_enabled_zones: list[str] = field(default_factory=list)
    last_action: str | None = None
    last_action_at: datetime | None = None
    # Not persisted.
    next_stage_at: datetime | None = None
    presence_empty: bool = False
    presence_certain: bool = True
    zone_reasons: dict[str, str] = field(default_factory=dict)


@dataclass
class _PresenceFacts:
    """Presence evaluation at one instant."""

    configured: bool
    certain: bool
    empty: bool
    empty_since: datetime | None
    home_since: datetime | None
    quiet_until: datetime | None


class HouseModesCoordinator:
    """Whole-home presence, sleep, and travel policy on top of the hold API."""

    def __init__(self, scheduler: VelairScheduler) -> None:
        self._scheduler = scheduler
        self._hass = scheduler._hass
        self._runtime = _Runtime()
        self._lock = asyncio.Lock()
        self._started = False
        self._evaluating = False
        self._rerun_requested = False
        self._tracked_entities: tuple[str, ...] = ()
        self._unsub_listener: CALLBACK_TYPE | None = None
        self._unsub_timer: CALLBACK_TYPE | None = None
        self._timer_due_at: datetime | None = None
        self._observed: dict[str, tuple[str | None, datetime]] = {}
        self._pending_tasks: set[asyncio.Task[Any]] = set()
        self._load_persisted_runtime()

    # ------------------------------------------------------------------
    # Lifecycle
    # ------------------------------------------------------------------
    def _load_persisted_runtime(self) -> None:
        settings = self._scheduler._data.get("settings") or {}
        record = normalize_house_modes_runtime_data(settings.get(RUNTIME_KEY))
        runtime = self._runtime
        runtime.state = record["state"]
        runtime.sleeping = record["sleeping"]
        runtime.sleep_since = _parse_timestamp(record["sleep_since"])
        runtime.travel_active = record["travel_active"]
        runtime.travel_since = _parse_timestamp(record["travel_since"])
        runtime.empty_since = _parse_timestamp(record["empty_since"])
        runtime.away_stage = record["away_stage"]
        runtime.presleep_applied_on = record["presleep_applied_on"]
        runtime.saved_minimums = {
            entity_id: dict(value) for entity_id, value in record["saved_minimums"].items()
        }
        runtime.humidity_assist_enabled_zones = list(
            record["humidity_assist_enabled_zones"]
        )
        runtime.last_action = record["last_action"]
        runtime.last_action_at = _parse_timestamp(record["last_action_at"])

    async def async_start(self) -> None:
        """Register listeners and evaluate once."""
        self._started = True
        self._refresh_listeners()
        await self.async_evaluate(reason="start")

    async def async_stop(self) -> None:
        """Stop listeners and timers; the runtime record stays persisted."""
        self._started = False
        self._clear_listener()
        self._clear_timer()
        for task in list(self._pending_tasks):
            task.cancel()
        self._pending_tasks.clear()

    # ------------------------------------------------------------------
    # Configuration access and updates
    # ------------------------------------------------------------------
    def settings(self) -> HouseModesSettingsData:
        """Return the normalized global settings in the runtime unit."""
        settings = self._scheduler._data.get("settings") or {}
        return normalize_house_modes_settings(settings.get(SETTINGS_KEY), self._settings_unit())

    def zone_config(self, entity_id: str) -> HouseModesZoneData:
        """Return the normalized per-zone settings in the zone's unit."""
        zone = self._scheduler._data["zones"].get(entity_id) or {}
        return normalize_house_modes_data(zone.get(SETTINGS_KEY), self._unit(entity_id))

    def zone_configs(self) -> dict[str, HouseModesZoneData]:
        """Return every zone's normalized settings."""
        return {entity_id: self.zone_config(entity_id) for entity_id in self._zone_ids()}

    async def async_update_settings(self, updates: dict[str, Any]) -> HouseModesSettingsData:
        """Merge and persist global settings through the scheduler."""
        if "presleep_time" in updates and updates["presleep_time"] is not None:
            if normalize_presleep_time(updates["presleep_time"]) is None:
                raise ValueError("presleep_time must be HH:MM or null")
        current = self._scheduler._data.get("settings", {}).get(SETTINGS_KEY)
        merged = {**(current if isinstance(current, dict) else {}), **updates}
        temperature = merged.get("travel_park_temperature")
        if temperature is not None:
            if isinstance(temperature, bool):
                raise ValueError("travel_park_temperature must be a number")
            try:
                number = float(temperature)
            except (TypeError, ValueError) as err:
                raise ValueError("travel_park_temperature must be a number") from err
            minimum, maximum = self._settings_temperature_bounds()
            if not minimum <= number <= maximum:
                raise ValueError(
                    f"travel_park_temperature must be between {minimum:g} and {maximum:g}"
                )
        next_settings = normalize_house_modes_settings(merged, self._settings_unit())
        await self._scheduler.async_update_settings({SETTINGS_KEY: next_settings})
        return next_settings

    async def async_update_zone_config(
        self, entity_id: str, updates: dict[str, Any]
    ) -> HouseModesZoneData:
        """Validate, persist, and apply a per-zone settings change."""
        self._scheduler.ensure_managed_entity(entity_id)
        previous = self.zone_config(entity_id)
        merged = {**previous, **updates}
        minimum, maximum = self._scheduler.get_temperature_limits(entity_id)
        for key in HOUSE_MODES_ZONE_TEMPERATURE_KEYS:
            value = merged.get(key)
            if value is None:
                continue
            if isinstance(value, bool):
                raise ValueError(f"{key} must be a number")
            try:
                number = float(value)
            except (TypeError, ValueError) as err:
                raise ValueError(f"{key} must be a number") from err
            if not minimum - 0.000001 <= number <= maximum + 0.000001:
                raise ValueError(
                    f"{key} must be between {minimum:g} and {maximum:g} for {entity_id}"
                )
        next_config = normalize_house_modes_data(merged, self._unit(entity_id))
        zone = self._scheduler._data["zones"][entity_id]
        previous_stored = zone.get(SETTINGS_KEY)
        zone[SETTINGS_KEY] = next_config
        try:
            await self._scheduler._async_save_data()
        except Exception:
            if previous_stored is None:
                zone.pop(SETTINGS_KEY, None)
            else:
                zone[SETTINGS_KEY] = previous_stored
            raise
        await self._async_zone_config_changed(entity_id, previous, next_config)
        self._scheduler._async_write_state()
        return next_config

    async def _async_zone_config_changed(
        self,
        entity_id: str,
        previous: HouseModesZoneData,
        current: HouseModesZoneData,
    ) -> None:
        now = dt_util.now()
        pause_ids = self._pause_ids(entity_id, now)
        if previous["away_enabled"] and not current["away_enabled"]:
            for pause_id in (PAUSE_ID_AWAY_1H, PAUSE_ID_AWAY_6H):
                if pause_id in pause_ids:
                    await self._async_release(entity_id, pause_id, reason="house_modes_zone_disabled")
        if previous["sleep_enabled"] and not current["sleep_enabled"]:
            if PAUSE_ID_SLEEP in pause_ids:
                await self._async_release(entity_id, PAUSE_ID_SLEEP, reason="house_modes_zone_disabled")
            await self._async_restore_sleep_minimum(entity_id)
        if previous["travel_park_enabled"] and not current["travel_park_enabled"]:
            if PAUSE_ID_TRAVEL_PARK in pause_ids:
                await self._async_release(entity_id, PAUSE_ID_TRAVEL_PARK, reason="house_modes_zone_disabled")
        if (
            self._runtime.sleeping
            and current["sleep_enabled"]
            and PAUSE_ID_SLEEP in pause_ids
            and (
                previous["sleep_temperature"] != current["sleep_temperature"]
                or previous["sleep_constraint"] != current["sleep_constraint"]
                or previous["sleep_fan_mode"] != current["sleep_fan_mode"]
            )
        ):
            await self._async_apply_sleep_zone(entity_id, current, now)
        if self._started:
            await self.async_evaluate(reason="config")

    async def async_settings_changed(self) -> None:
        """React to a global settings change (called by the scheduler hook)."""
        self._refresh_listeners()
        if self._started:
            await self.async_evaluate(reason="settings")

    # ------------------------------------------------------------------
    # Public projection
    # ------------------------------------------------------------------
    def status(self) -> dict[str, Any]:
        """Return the runtime status for the API and the house mode sensor."""
        now = dt_util.now()
        runtime = self._runtime
        settings = self.settings()
        zones_parked: list[str] = []
        zones_frozen: list[str] = []
        zones_presleep: list[str] = []
        zones_sleeping: list[str] = []
        zones_away: list[str] = []
        for entity_id in self._zone_ids():
            pause_ids = self._pause_ids(entity_id, now)
            if PAUSE_ID_TRAVEL_PARK in pause_ids:
                zones_parked.append(entity_id)
            if PAUSE_ID_TRAVEL_OFF in pause_ids:
                zones_frozen.append(entity_id)
            if PAUSE_ID_PRESLEEP in pause_ids:
                zones_presleep.append(entity_id)
            if PAUSE_ID_SLEEP in pause_ids:
                zones_sleeping.append(entity_id)
            if PAUSE_ID_AWAY_1H in pause_ids or PAUSE_ID_AWAY_6H in pause_ids:
                zones_away.append(entity_id)
        return {
            "state": runtime.state,
            "enabled": settings["enabled"],
            "sleeping": runtime.sleeping,
            "travel_active": runtime.travel_active,
            "away_stage": runtime.away_stage,
            "presence_empty": runtime.presence_empty,
            "presence_certain": runtime.presence_certain,
            "empty_since": _isoformat(runtime.empty_since),
            "next_stage_at": _isoformat(runtime.next_stage_at),
            "travel_since": _isoformat(runtime.travel_since),
            "sleep_since": _isoformat(runtime.sleep_since),
            "zones_parked": zones_parked,
            "zones_frozen": zones_frozen,
            "zones_away": zones_away,
            "zones_sleeping": zones_sleeping,
            "zones_presleep": zones_presleep,
            "zone_reasons": dict(runtime.zone_reasons),
            "next_evaluation_at": _isoformat(self._timer_due_at),
            "last_action": runtime.last_action,
            "last_action_at": _isoformat(runtime.last_action_at),
            "settings": settings,
            "zones": self.zone_configs(),
        }

    # ------------------------------------------------------------------
    # Listeners and timers
    # ------------------------------------------------------------------
    def _refresh_listeners(self) -> None:
        settings = self.settings()
        entity_ids: set[str] = set()
        if settings["enabled"]:
            entity_ids.update(settings["presence_entity_ids"])
            entity_ids.update(settings["presence_corroboration_entity_ids"])
            for key in ("sleep_entity_id", "travel_entity_id"):
                if settings[key]:
                    entity_ids.add(settings[key])
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

    def _clear_timer(self) -> None:
        if self._unsub_timer is not None:
            self._unsub_timer()
            self._unsub_timer = None
        self._timer_due_at = None

    def _arm_timer(self, due_at: datetime | None) -> None:
        if due_at == self._timer_due_at and (self._unsub_timer is not None or due_at is None):
            return
        self._clear_timer()
        if due_at is None:
            return
        self._timer_due_at = due_at
        self._unsub_timer = async_track_point_in_time(
            self._hass, self._handle_timer, due_at
        )

    @callback
    def _handle_timer(self, _now: datetime) -> None:
        self._unsub_timer = None
        self._timer_due_at = None
        self._create_task(self.async_evaluate(reason="timer"))

    @callback
    def _handle_state_change(self, event: Any) -> None:
        """Re-evaluate on any tracked input change; arrival may auto-exit travel."""
        data = getattr(event, "data", {}) or {}
        entity_id = data.get("entity_id")
        if not isinstance(entity_id, str) or entity_id not in self._tracked_entities:
            return
        settings = self.settings()
        new_state = getattr(data.get("new_state"), "state", None)
        old_state = getattr(data.get("old_state"), "state", None)
        if (
            settings["enabled"]
            and settings["travel_auto_exit_on_arrival"]
            and settings["travel_entity_id"]
            and entity_id in settings["presence_entity_ids"]
            and new_state == STATE_HOME
            and old_state != STATE_HOME
            and self._runtime.travel_active
        ):
            self._create_task(self._async_auto_exit_travel(entity_id, settings))
        self._create_task(self.async_evaluate(reason="state"))

    def _create_task(self, coroutine: Any) -> None:
        task = self._hass.async_create_task(coroutine)
        if task is not None:
            self._pending_tasks.add(task)
            task.add_done_callback(self._pending_tasks.discard)

    # ------------------------------------------------------------------
    # External change hook (called from the scheduler under the zone lock)
    # ------------------------------------------------------------------
    @callback
    def handle_external_change(
        self,
        entity_id: str,
        previous: dict[str, object],
        current: dict[str, object],
    ) -> None:
        """Observe head off/on transitions made by a person or another system."""
        if not self._started or entity_id not in self._scheduler._data["zones"]:
            return
        previous_mode = previous.get("hvac_mode")
        current_mode = current.get("hvac_mode")
        if previous_mode == HVAC_MODE_OFF and current_mode not in (None, HVAC_MODE_OFF):
            self._create_task(self._async_head_turned_on(entity_id))
        elif current_mode == HVAC_MODE_OFF and previous_mode not in (None, HVAC_MODE_OFF):
            self._create_task(self._async_head_turned_off(entity_id))

    async def _async_head_turned_on(self, entity_id: str) -> None:
        await self._async_wait_for_zone(entity_id)
        async with self._lock:
            now = dt_util.now()
            if PAUSE_ID_TRAVEL_OFF not in self._pause_ids(entity_id, now):
                return
            await self._async_release(
                entity_id,
                PAUSE_ID_TRAVEL_OFF,
                apply_current_schedule=False,
                reason="house_modes_head_turned_on",
            )
            if self._manual_status(entity_id, now) is None:
                try:
                    await self._scheduler.async_enter_manual_adjustment(entity_id)
                except ValueError as err:
                    _LOGGER.debug(
                        "House Modes could not protect %s after it was turned on: %s",
                        entity_id,
                        err,
                    )
            self._note_action(f"{entity_id}: travel freeze released by hand", now)
            await self._async_persist()
            self._scheduler._async_write_state()

    async def _async_head_turned_off(self, entity_id: str) -> None:
        await self._async_wait_for_zone(entity_id)
        async with self._lock:
            settings = self.settings()
            runtime = self._runtime
            if (
                not settings["enabled"]
                or not runtime.travel_active
                or not settings["travel_freeze_off_heads"]
            ):
                return
            if not self._zone_enabled(entity_id) or not self.zone_config(entity_id)["travel_park_enabled"]:
                return
            now = dt_util.now()
            if not self._head_off(entity_id) or self._manual_status(entity_id, now) is None:
                # keep_automatic re-asserted the target; nothing to freeze.
                return
            if PAUSE_ID_TRAVEL_OFF in self._pause_ids(entity_id, now):
                return
            if await self._async_freeze(entity_id, PAUSE_ID_TRAVEL_OFF):
                self._fire_zone_parked(entity_id, PAUSE_ID_TRAVEL_OFF, None, "head_turned_off")
                self._note_action(f"{entity_id}: frozen off during travel", now)
                await self._async_persist()
                self._scheduler._async_write_state()

    async def _async_wait_for_zone(self, entity_id: str) -> None:
        """Let the scheduler finish the external-change transition first.

        The hook runs under the zone override lock; the follow-up must observe
        the Manual adjustment that transition creates, so it waits for the lock
        to be released before looking at the zone.
        """
        lock_getter = getattr(self._scheduler, "_zone_override_lock", None)
        if not callable(lock_getter):
            return
        try:
            async with lock_getter(entity_id):
                pass
        except Exception:  # pragma: no cover - defensive
            return

    # ------------------------------------------------------------------
    # Evaluation
    # ------------------------------------------------------------------
    async def async_evaluate(self, *, reason: str = "manual") -> None:
        """Evaluate presence, sleep, and travel and apply transitions.

        Coalesces any evaluation requested while one is already running into
        one more pass of the same loop, rather than recursing: a sustained
        burst of rerun requests (e.g. during a slow or failing climate
        delivery) must not grow the call stack without bound.
        """
        if self._evaluating:
            self._rerun_requested = True
            return
        async with self._lock:
            self._evaluating = True
            try:
                current_reason = reason
                passes = 0
                while True:
                    await self._async_evaluate_locked(current_reason)
                    if not self._rerun_requested:
                        break
                    self._rerun_requested = False
                    current_reason = "rerun"
                    passes += 1
                    if passes % 5 == 0:
                        # Cede the event loop periodically: a sustained burst of
                        # rerun requests (e.g. a flood of settings changes, or a
                        # slow/retrying climate delivery) must not monopolize it
                        # for however long the burst lasts -- other coroutines
                        # (HTTP/WebSocket handling, other entities' state writes)
                        # need a turn too, or the whole instance appears hung.
                        await asyncio.sleep(0)
            finally:
                self._evaluating = False

    async def _async_evaluate_locked(self, reason: str) -> None:
        now = dt_util.now()
        settings = self.settings()
        runtime = self._runtime
        previous_state = runtime.state
        previous_sleeping = runtime.sleeping
        previous_record = self._record()

        if not settings["enabled"]:
            if (
                runtime.state != HOUSE_MODE_DISABLED
                or runtime.travel_active
                or runtime.sleeping
                or runtime.away_stage
            ):
                await self._async_disable_all(now, settings)
            runtime.state = HOUSE_MODE_DISABLED
            runtime.next_stage_at = None
            self._clear_timer()
            await self._async_finish(
                previous_state, previous_sleeping, previous_record, reason, now
            )
            return

        presence = self._presence_facts(now, settings)
        runtime.presence_empty = presence.empty
        runtime.presence_certain = presence.certain
        travel = self._binary_state(settings["travel_entity_id"])
        sleep = self._binary_state(settings["sleep_entity_id"])

        if travel is True and not runtime.travel_active:
            await self._async_travel_enter(now, settings, presence)
        elif runtime.travel_active and (
            travel is False or settings["travel_entity_id"] is None
        ):
            await self._async_travel_exit(now, settings)
        elif runtime.travel_active:
            await self._async_travel_recheck(now, settings, presence)

        if sleep is True:
            await self._async_sleep_on(now, settings)
        elif runtime.sleeping and (sleep is False or settings["sleep_entity_id"] is None):
            await self._async_sleep_off(now, settings)

        await self._async_away_staging(now, settings, presence)
        await self._async_presleep(now, settings, presence)

        runtime.state = self._derive_state()
        self._arm_timer(self._next_boundary(now, settings, presence))
        await self._async_finish(
            previous_state, previous_sleeping, previous_record, reason, now
        )
        _LOGGER.debug(
            "House Modes evaluated (%s): state=%s empty=%s stage=%s travel=%s sleeping=%s",
            reason,
            runtime.state,
            presence.empty,
            runtime.away_stage,
            runtime.travel_active,
            runtime.sleeping,
        )

    async def _async_finish(
        self,
        previous_state: str,
        previous_sleeping: bool,
        previous_record: HouseModesRuntimeData,
        reason: str,
        now: datetime,
    ) -> None:
        runtime = self._runtime
        record = self._record()
        changed = record != previous_record
        if changed:
            await self._async_persist(record)
        if runtime.state != previous_state or runtime.sleeping != previous_sleeping:
            self._scheduler._async_fire_event(
                EVENT_TYPE_HOUSE_MODE_CHANGED,
                {
                    "previous": previous_state,
                    "state": runtime.state,
                    "sleeping": runtime.sleeping,
                    "reason": reason,
                    "empty_since": _isoformat(runtime.empty_since),
                    "travel_since": _isoformat(runtime.travel_since),
                    "sleep_since": _isoformat(runtime.sleep_since),
                },
            )
            await self._async_logbook_mode(previous_state, runtime.state)
        if changed:
            self._scheduler._async_write_state()

    def _derive_state(self) -> str:
        runtime = self._runtime
        if runtime.travel_active:
            return HOUSE_MODE_TRAVEL
        if runtime.away_stage >= 2:
            return HOUSE_MODE_AWAY_DEEP
        if runtime.away_stage == 1:
            return HOUSE_MODE_AWAY
        if runtime.sleeping:
            return HOUSE_MODE_SLEEP
        return HOUSE_MODE_HOME

    # ------------------------------------------------------------------
    # Presence
    # ------------------------------------------------------------------
    def _presence_facts(
        self, now: datetime, settings: HouseModesSettingsData
    ) -> _PresenceFacts:
        entity_ids = settings["presence_entity_ids"]
        if not entity_ids:
            return _PresenceFacts(False, True, False, None, None, None)
        certain = True
        all_away = True
        away_changed: list[datetime] = []
        home_changed: list[datetime] = []
        uses_last_changed = False
        for entity_id in entity_ids:
            state = self._hass.states.get(entity_id)
            value = getattr(state, "state", None)
            if value in UNCERTAIN_STATES:
                certain = False
                all_away = False
                continue
            changed_at, from_state = self._changed_at(entity_id, state, now)
            uses_last_changed = uses_last_changed or from_state
            if value == STATE_NOT_HOME:
                away_changed.append(changed_at)
            else:
                all_away = False
                if value == STATE_HOME:
                    home_changed.append(changed_at)
        home_since = min(home_changed) if home_changed else None
        if not all_away:
            return _PresenceFacts(True, certain, False, None, home_since, None)

        empty_since = max(away_changed) if away_changed else now
        quiet_until: datetime | None = None
        corroboration = settings["presence_corroboration_entity_ids"]
        if corroboration:
            quiet = timedelta(minutes=settings["presence_corroboration_quiet_minutes"])
            latest_off: datetime | None = None
            for entity_id in corroboration:
                state = self._hass.states.get(entity_id)
                value = getattr(state, "state", None)
                if value in UNCERTAIN_STATES:
                    return _PresenceFacts(True, False, False, None, home_since, None)
                if value != STATE_OFF:
                    return _PresenceFacts(True, certain, False, None, home_since, None)
                changed_at, from_state = self._changed_at(entity_id, state, now)
                uses_last_changed = uses_last_changed or from_state
                if latest_off is None or changed_at > latest_off:
                    latest_off = changed_at
            if latest_off is not None:
                quiet_end = latest_off + quiet
                if quiet_end > now:
                    return _PresenceFacts(True, certain, False, None, home_since, quiet_end)
                empty_since = max(empty_since, quiet_end)
        persisted = self._runtime.empty_since
        if not uses_last_changed and persisted is not None and persisted < empty_since:
            # No ``last_changed`` on the inputs: keep the persisted clock so a
            # restart does not restart the away timers.
            empty_since = persisted
        return _PresenceFacts(True, certain, True, empty_since, None, quiet_until)

    def _changed_at(
        self, entity_id: str, state: Any, now: datetime
    ) -> tuple[datetime, bool]:
        """Return when ``entity_id`` entered its state and whether HA told us."""
        last_changed = getattr(state, "last_changed", None)
        if isinstance(last_changed, datetime):
            return dt_util.as_local(last_changed), True
        value = getattr(state, "state", None)
        observed = self._observed.get(entity_id)
        if observed is None or observed[0] != value:
            self._observed[entity_id] = (value, now)
            return now, False
        return observed[1], False

    def _binary_state(self, entity_id: str | None) -> bool | None:
        if not entity_id:
            return None
        value = getattr(self._hass.states.get(entity_id), "state", None)
        if value == STATE_ON:
            return True
        if value == STATE_OFF:
            return False
        return None

    # ------------------------------------------------------------------
    # Away staging
    # ------------------------------------------------------------------
    async def _async_away_staging(
        self,
        now: datetime,
        settings: HouseModesSettingsData,
        presence: _PresenceFacts,
    ) -> None:
        runtime = self._runtime
        runtime.next_stage_at = None
        release_after = timedelta(minutes=settings["arrival_release_minutes"])
        if presence.home_since is not None and now - presence.home_since >= release_after:
            if runtime.away_stage or self._any_zone_has(now, PAUSE_ID_AWAY_1H, PAUSE_ID_AWAY_6H):
                await self._async_release_away(now, reason="house_modes_arrival")
                self._note_action("arrival released away holds", now)
            runtime.away_stage = 0
            runtime.empty_since = None
            return
        if not presence.empty or presence.empty_since is None:
            return  # P5: uncertain or transient presence holds the current state.
        runtime.empty_since = presence.empty_since
        if runtime.travel_active:
            return  # Travel park already covers an empty house.
        stage1_at = presence.empty_since + timedelta(minutes=settings["away_after_minutes"])
        deep_minutes = settings["away_deep_after_minutes"]
        stage2_at = (
            presence.empty_since + timedelta(minutes=deep_minutes) if deep_minutes > 0 else None
        )
        if now >= stage1_at:
            await self._async_apply_away_stage(1, now, settings)
            if runtime.away_stage < 1:
                runtime.away_stage = 1
                self._note_action("away stage 1 applied", now)
        if stage2_at is not None and now >= stage2_at:
            await self._async_apply_away_stage(2, now, settings)
            if runtime.away_stage < 2:
                runtime.away_stage = 2
                self._note_action("away stage 2 applied", now)
        if runtime.away_stage < 1:
            runtime.next_stage_at = stage1_at
        elif stage2_at is not None and runtime.away_stage < 2:
            runtime.next_stage_at = stage2_at

    async def _async_apply_away_stage(
        self, stage: int, now: datetime, settings: HouseModesSettingsData
    ) -> None:
        lease = self._lease_minutes()
        for entity_id in self._zone_ids():
            config = self.zone_config(entity_id)
            if not self._zone_enabled(entity_id) or not config["away_enabled"]:
                self._runtime.zone_reasons[entity_id] = REASON_DISABLED
                continue
            skip = self._away_skip_reason(entity_id, now, lease)
            if skip is not None:
                self._runtime.zone_reasons[entity_id] = skip
                continue
            self._runtime.zone_reasons.pop(entity_id, None)
            hvac_mode, fan_mode = self._setback_modes(entity_id)
            pause_ids = self._pause_ids(entity_id, now)
            if PAUSE_ID_AWAY_1H not in pause_ids:
                await self._async_hold(
                    entity_id,
                    PAUSE_ID_AWAY_1H,
                    temperature=config["away_temperature"],
                    constraint=HOLD_CONSTRAINT_RAISE_ONLY,
                    hvac_mode=hvac_mode,
                    fan_mode=fan_mode,
                    label=LABEL_AWAY_1,
                )
            if (
                stage >= 2
                and config["away_deep_temperature"] is not None
                and PAUSE_ID_AWAY_6H not in pause_ids
            ):
                await self._async_hold(
                    entity_id,
                    PAUSE_ID_AWAY_6H,
                    temperature=config["away_deep_temperature"],
                    constraint=HOLD_CONSTRAINT_RAISE_ONLY,
                    hvac_mode=hvac_mode,
                    fan_mode=fan_mode,
                    label=LABEL_AWAY_2,
                )

    def _away_skip_reason(self, entity_id: str, now: datetime, lease: int) -> str | None:
        head = self._head_state(entity_id)
        if head in UNCERTAIN_STATES:
            return REASON_HEAD_UNAVAILABLE
        if head == HVAC_MODE_OFF:
            return REASON_HEAD_OFF
        manual = self._manual_status(entity_id, now)
        if manual is not None:
            started = _parse_timestamp(manual.get("started_at"))
            if started is None or now - started < timedelta(minutes=lease):
                return REASON_MANUAL_FRESH
        if self._blocked(entity_id):
            return REASON_BLOCKED
        return None

    async def _async_release_away(self, now: datetime, *, reason: str) -> None:
        for entity_id in self._zone_ids():
            pause_ids = self._pause_ids(entity_id, now)
            for pause_id in (PAUSE_ID_AWAY_1H, PAUSE_ID_AWAY_6H):
                if pause_id in pause_ids:
                    await self._async_release(entity_id, pause_id, reason=reason)
            self._runtime.zone_reasons.pop(entity_id, None)

    # ------------------------------------------------------------------
    # Sleep and pre-sleep
    # ------------------------------------------------------------------
    async def _async_sleep_on(self, now: datetime, settings: HouseModesSettingsData) -> None:
        """Apply the sleep hold to every eligible zone, reconciling on every call.

        Called on every evaluate cycle while sleep is on, not only on the
        off-to-on transition: a zone that was manual, disabled, or simply
        missing its hold (a restart or an outage can clear a hold without
        clearing `runtime.sleeping`) must not stay unheld for the rest of
        the night just because the transition already happened once. Zones
        that already hold "sleep" are left untouched -- no redundant writes.
        """
        runtime = self._runtime
        for entity_id in self._zone_ids():
            pause_ids = self._pause_ids(entity_id, now)
            if PAUSE_ID_PRESLEEP in pause_ids:
                await self._async_release(
                    entity_id,
                    PAUSE_ID_PRESLEEP,
                    apply_current_schedule=False,
                    reason="house_modes_sleep",
                )
        for entity_id in self._zone_ids():
            config = self.zone_config(entity_id)
            if not self._zone_enabled(entity_id) or not config["sleep_enabled"]:
                continue
            if self._manual_status(entity_id, now) is not None:
                runtime.zone_reasons[entity_id] = REASON_MANUAL
                continue
            if PAUSE_ID_SLEEP in self._pause_ids(entity_id, now):
                continue
            self._runtime.zone_reasons.pop(entity_id, None)
            await self._async_apply_sleep_zone(entity_id, config, now)
        if not runtime.sleeping:
            runtime.sleeping = True
            runtime.sleep_since = now
            self._note_action("sleep holds applied", now)

    async def _async_apply_sleep_zone(
        self, entity_id: str, config: HouseModesZoneData, now: datetime
    ) -> None:
        hvac_mode, _fan_mode = self._setback_modes(entity_id)
        await self._async_hold(
            entity_id,
            PAUSE_ID_SLEEP,
            temperature=config["sleep_temperature"],
            constraint=config["sleep_constraint"],
            hvac_mode=hvac_mode,
            fan_mode=config["sleep_fan_mode"],
            label=LABEL_SLEEP,
        )
        if config["sleep_minimum_temperature"] is not None:
            await self._async_apply_sleep_minimum(entity_id, config["sleep_minimum_temperature"])

    async def _async_sleep_off(self, now: datetime, settings: HouseModesSettingsData) -> None:
        runtime = self._runtime
        for entity_id in self._zone_ids():
            if PAUSE_ID_SLEEP in self._pause_ids(entity_id, now):
                await self._async_release(entity_id, PAUSE_ID_SLEEP, reason="house_modes_wake")
        await self._async_restore_sleep_minimums()
        runtime.sleeping = False
        runtime.sleep_since = None
        self._note_action("sleep holds released", now)

    async def _async_apply_sleep_minimum(self, entity_id: str, value: float) -> None:
        scheduler = self._scheduler
        try:
            record = self._runtime.saved_minimums.get(entity_id)
            current = scheduler.get_zone_limits(entity_id)["min_temperature"]
            saved = record["saved"] if record is not None else current
            await scheduler.async_update_zone_limits(entity_id, {"min_temperature": value})
            applied = scheduler.get_zone_limits(entity_id)["min_temperature"]
            self._runtime.saved_minimums[entity_id] = {"saved": saved, "applied": applied}
        except Exception as err:  # pragma: no cover - limits validation is defensive
            _LOGGER.warning(
                "House Modes could not apply the sleep minimum for %s: %s", entity_id, err
            )

    async def _async_restore_sleep_minimums(self) -> None:
        for entity_id in list(self._runtime.saved_minimums):
            await self._async_restore_sleep_minimum(entity_id)

    async def _async_restore_sleep_minimum(self, entity_id: str) -> None:
        record = self._runtime.saved_minimums.pop(entity_id, None)
        if record is None:
            return
        scheduler = self._scheduler
        try:
            current = scheduler.get_zone_limits(entity_id)["min_temperature"]
            if not _same_temperature(current, record.get("applied")):
                _LOGGER.debug(
                    "House Modes keeps the minimum of %s: it was changed while asleep",
                    entity_id,
                )
                return
            await scheduler.async_update_zone_limits(
                entity_id, {"min_temperature": record.get("saved")}
            )
        except Exception as err:  # pragma: no cover - defensive
            _LOGGER.warning(
                "House Modes could not restore the minimum for %s: %s", entity_id, err
            )

    async def _async_presleep(
        self,
        now: datetime,
        settings: HouseModesSettingsData,
        presence: _PresenceFacts,
    ) -> None:
        presleep_time = settings["presleep_time"]
        if presleep_time is None:
            return
        start = _window_start(now, presleep_time)
        end = start + timedelta(minutes=settings["presleep_duration_minutes"])
        if not start <= now < end:
            return
        marker = start.date().isoformat()
        runtime = self._runtime
        if runtime.presleep_applied_on == marker:
            return
        runtime.presleep_applied_on = marker
        if runtime.travel_active or presence.empty or runtime.sleeping:
            self._note_action("pre-sleep skipped", now)
            return
        hold_until = end.isoformat()
        applied = 0
        for entity_id in self._zone_ids():
            config = self.zone_config(entity_id)
            temperature = config["presleep_temperature"]
            if not self._zone_enabled(entity_id) or temperature is None:
                continue
            if self._manual_status(entity_id, now) is not None:
                runtime.zone_reasons[entity_id] = REASON_MANUAL
                continue
            hvac_mode, _fan_mode = self._setback_modes(entity_id)
            if await self._async_hold(
                entity_id,
                PAUSE_ID_PRESLEEP,
                temperature=temperature,
                constraint=HOLD_CONSTRAINT_LOWER_ONLY,
                hvac_mode=hvac_mode,
                fan_mode=None,
                label=LABEL_PRESLEEP,
                until=hold_until,
            ):
                applied += 1
        self._note_action(f"pre-sleep holds applied to {applied} zone(s)", now)

    # ------------------------------------------------------------------
    # Travel
    # ------------------------------------------------------------------
    async def _async_travel_enter(
        self,
        now: datetime,
        settings: HouseModesSettingsData,
        presence: _PresenceFacts,
    ) -> None:
        runtime = self._runtime
        runtime.travel_active = True
        runtime.travel_since = now
        for entity_id in self._zone_ids():
            await self._async_travel_zone(entity_id, now, settings, presence, reason="travel_started")
        if settings["travel_enable_humidity_assist"]:
            await self._async_set_humidity_assist(True)
        self._note_action("travel started", now)

    async def _async_travel_recheck(
        self,
        now: datetime,
        settings: HouseModesSettingsData,
        presence: _PresenceFacts,
    ) -> None:
        for entity_id in self._zone_ids():
            await self._async_travel_zone(entity_id, now, settings, presence, reason="travel_recheck")

    async def _async_travel_zone(
        self,
        entity_id: str,
        now: datetime,
        settings: HouseModesSettingsData,
        presence: _PresenceFacts,
        *,
        reason: str,
    ) -> None:
        config = self.zone_config(entity_id)
        if not self._zone_enabled(entity_id) or not config["travel_park_enabled"]:
            return
        pause_ids = self._pause_ids(entity_id, now)
        if PAUSE_ID_TRAVEL_OFF in pause_ids:
            return
        if self._head_off(entity_id) and self._manual_status(entity_id, now) is not None:
            if settings["travel_freeze_off_heads"]:
                if await self._async_freeze(entity_id, PAUSE_ID_TRAVEL_OFF):
                    self._fire_zone_parked(entity_id, PAUSE_ID_TRAVEL_OFF, None, reason)
            return
        if presence.empty:
            if PAUSE_ID_TRAVEL_PARK in pause_ids:
                return
            if await self._async_hold(
                entity_id,
                PAUSE_ID_TRAVEL_PARK,
                temperature=settings["travel_park_temperature"],
                constraint=HOLD_CONSTRAINT_RAISE_ONLY,
                hvac_mode=settings["travel_park_hvac_mode"],
                fan_mode=settings["travel_park_fan_mode"],
                label=LABEL_TRAVEL_PARK,
            ):
                self._fire_zone_parked(
                    entity_id, PAUSE_ID_TRAVEL_PARK, settings["travel_park_temperature"], reason
                )
        elif presence.home_since is not None and PAUSE_ID_TRAVEL_PARK in pause_ids:
            # Someone is definitely home: park is lifted; uncertainty keeps it (P5).
            await self._async_release(
                entity_id, PAUSE_ID_TRAVEL_PARK, reason="house_modes_travel_presence"
            )

    async def _async_travel_exit(self, now: datetime, settings: HouseModesSettingsData) -> None:
        runtime = self._runtime
        for entity_id in self._zone_ids():
            pause_ids = self._pause_ids(entity_id, now)
            if PAUSE_ID_TRAVEL_PARK in pause_ids:
                await self._async_release(entity_id, PAUSE_ID_TRAVEL_PARK, reason="house_modes_travel_ended")
            if PAUSE_ID_TRAVEL_OFF in pause_ids and not self._head_off(entity_id):
                await self._async_release(
                    entity_id,
                    PAUSE_ID_TRAVEL_OFF,
                    apply_current_schedule=False,
                    reason="house_modes_travel_ended",
                )
        runtime.travel_active = False
        runtime.travel_since = None
        if settings["travel_enable_humidity_assist"]:
            await self._async_set_humidity_assist(False)
        self._note_action("travel ended", now)

    async def _async_auto_exit_travel(
        self, presence_entity_id: str, settings: HouseModesSettingsData
    ) -> None:
        travel_entity_id = settings["travel_entity_id"]
        if not travel_entity_id:
            return
        try:
            await self._hass.services.async_call(
                "homeassistant",
                "turn_off",
                {"entity_id": travel_entity_id},
                blocking=True,
            )
        except Exception:  # pragma: no cover - service failures are logged
            _LOGGER.exception("House Modes could not turn off %s", travel_entity_id)
            return
        self._note_action(f"travel auto-exit: {presence_entity_id} arrived", dt_util.now())

    async def _async_set_humidity_assist(self, enabled: bool) -> None:
        scheduler = self._scheduler
        candidates = getattr(scheduler, "humidity_assist_candidate_entities", None)
        setter = getattr(scheduler, "async_set_humidity_assist", None)
        config_getter = getattr(scheduler, "get_humidity_assist_config", None)
        if not callable(candidates) or not callable(setter):
            return
        runtime = self._runtime
        if enabled:
            targets = list(candidates())
            enabled_by_us: list[str] = []
            for entity_id in targets:
                already = False
                if callable(config_getter):
                    try:
                        already = bool(config_getter(entity_id).get("enabled"))
                    except Exception:  # pragma: no cover - defensive
                        already = False
                if already:
                    continue
                try:
                    await setter(entity_id, True)
                    enabled_by_us.append(entity_id)
                except ValueError as err:
                    _LOGGER.debug("Humidity Assist not enabled for %s: %s", entity_id, err)
            runtime.humidity_assist_enabled_zones = enabled_by_us
            return
        for entity_id in list(runtime.humidity_assist_enabled_zones):
            try:
                await setter(entity_id, False)
            except ValueError as err:
                _LOGGER.debug("Humidity Assist not disabled for %s: %s", entity_id, err)
        runtime.humidity_assist_enabled_zones = []

    # ------------------------------------------------------------------
    # Disable
    # ------------------------------------------------------------------
    async def _async_disable_all(self, now: datetime, settings: HouseModesSettingsData) -> None:
        for entity_id in self._zone_ids():
            pause_ids = self._pause_ids(entity_id, now)
            for pause_id in HOUSE_MODES_PAUSE_IDS:
                if pause_id in pause_ids:
                    await self._async_release(entity_id, pause_id, reason="house_modes_disabled")
        await self._async_restore_sleep_minimums()
        if self._runtime.humidity_assist_enabled_zones:
            await self._async_set_humidity_assist(False)
        runtime = self._runtime
        runtime.away_stage = 0
        runtime.empty_since = None
        runtime.sleeping = False
        runtime.sleep_since = None
        runtime.travel_active = False
        runtime.travel_since = None
        runtime.presleep_applied_on = None
        runtime.zone_reasons.clear()
        self._note_action("house modes disabled", now)

    # ------------------------------------------------------------------
    # Timer boundaries
    # ------------------------------------------------------------------
    def _next_boundary(
        self,
        now: datetime,
        settings: HouseModesSettingsData,
        presence: _PresenceFacts,
    ) -> datetime | None:
        runtime = self._runtime
        candidates: list[datetime] = []
        if runtime.next_stage_at is not None:
            candidates.append(runtime.next_stage_at)
        if presence.quiet_until is not None:
            candidates.append(presence.quiet_until)
        if presence.home_since is not None and (
            runtime.away_stage or self._any_zone_has(now, PAUSE_ID_AWAY_1H, PAUSE_ID_AWAY_6H)
        ):
            candidates.append(
                presence.home_since + timedelta(minutes=settings["arrival_release_minutes"])
            )
        if settings["presleep_time"] is not None:
            start = _window_start(now, settings["presleep_time"])
            candidates.append(start + timedelta(days=1))
        if runtime.travel_active:
            candidates.append(now + timedelta(minutes=TRAVEL_RECHECK_MINUTES))
        future = [when for when in candidates if when > now]
        return min(future) if future else None

    # ------------------------------------------------------------------
    # Hold API wrappers
    # ------------------------------------------------------------------
    async def _async_hold(
        self,
        entity_id: str,
        pause_id: str,
        *,
        temperature: float,
        constraint: str,
        hvac_mode: str | None,
        fan_mode: str | None,
        label: str,
        until: str | None = None,
    ) -> bool:
        scheduler = self._scheduler
        attempts = [(hvac_mode, fan_mode)]
        if hvac_mode is not None or fan_mode is not None:
            attempts.append((None, None))
        for attempt_hvac, attempt_fan in attempts:
            try:
                await scheduler.async_pause_zone(
                    entity_id,
                    action=ZONE_PAUSE_ACTION_HOLD,
                    pause_id=pause_id,
                    until=until,
                    temperature=temperature,
                    constraint=constraint,
                    hvac_mode=attempt_hvac,
                    fan_mode=attempt_fan,
                    label=label,
                )
                return True
            except ValueError as err:
                _LOGGER.debug(
                    "House Modes hold %s rejected for %s (%s/%s): %s",
                    pause_id,
                    entity_id,
                    attempt_hvac,
                    attempt_fan,
                    err,
                )
            except Exception:  # pragma: no cover - delivery failures are logged
                _LOGGER.exception("House Modes hold %s failed for %s", pause_id, entity_id)
                return False
        return False

    async def _async_freeze(self, entity_id: str, pause_id: str) -> bool:
        try:
            await self._scheduler.async_pause_zone(
                entity_id,
                action=ZONE_PAUSE_ACTION_NONE,
                pause_id=pause_id,
                preserve_current_climate_state=True,
            )
            return True
        except ValueError as err:
            _LOGGER.debug("House Modes freeze %s rejected for %s: %s", pause_id, entity_id, err)
        except Exception:  # pragma: no cover - defensive
            _LOGGER.exception("House Modes freeze %s failed for %s", pause_id, entity_id)
        return False

    async def _async_release(
        self,
        entity_id: str,
        pause_id: str,
        *,
        apply_current_schedule: bool = True,
        reason: str,
    ) -> bool:
        try:
            await self._scheduler.async_resume_zone(
                entity_id,
                pause_id=pause_id,
                apply_current_schedule=apply_current_schedule,
                reason=reason,
            )
            return True
        except ValueError as err:
            _LOGGER.debug("House Modes release %s rejected for %s: %s", pause_id, entity_id, err)
        except Exception:  # pragma: no cover - defensive
            _LOGGER.exception("House Modes release %s failed for %s", pause_id, entity_id)
        return False

    # ------------------------------------------------------------------
    # Zone facts
    # ------------------------------------------------------------------
    def _zone_ids(self) -> list[str]:
        return sorted(self._scheduler._data["zones"])

    def _zone_enabled(self, entity_id: str) -> bool:
        zone = self._scheduler._data["zones"].get(entity_id)
        return zone is not None and bool(zone.get("enabled", True))

    def _head_state(self, entity_id: str) -> str | None:
        return getattr(self._hass.states.get(entity_id), "state", None)

    def _head_off(self, entity_id: str) -> bool:
        return self._head_state(entity_id) == HVAC_MODE_OFF

    def _manual_status(self, entity_id: str, now: datetime) -> dict[str, object] | None:
        try:
            return self._scheduler._manual_control_status(entity_id, now)
        except KeyError:
            return None

    def _pause_ids(self, entity_id: str, now: datetime) -> set[str]:
        if entity_id not in self._scheduler._data["zones"]:
            return set()
        return {
            pause_id
            for reason in self._scheduler._active_zone_pause_reasons(entity_id, now)
            if isinstance((pause_id := reason.get("pause_id")), str)
        }

    def _any_zone_has(self, now: datetime, *pause_ids: str) -> bool:
        return any(
            set(pause_ids) & self._pause_ids(entity_id, now) for entity_id in self._zone_ids()
        )

    def _blocked(self, entity_id: str) -> bool:
        zone = self._scheduler._data["zones"].get(entity_id) or {}
        occupancy = zone.get("occupancy_assist")
        blocking = occupancy.get("blocking_entity_ids") if isinstance(occupancy, dict) else None
        if not isinstance(blocking, list):
            return False
        return any(
            getattr(self._hass.states.get(blocker), "state", None) == STATE_ON
            for blocker in blocking
            if isinstance(blocker, str)
        )

    def _setback_modes(self, entity_id: str) -> tuple[str | None, str | None]:
        """Return the zone's Occupancy Assist setback modes (spec section 3 defaults)."""
        zone = self._scheduler._data["zones"].get(entity_id) or {}
        occupancy = zone.get("occupancy_assist")
        if not isinstance(occupancy, dict):
            return DEFAULT_SETBACK_HVAC_MODE, DEFAULT_SETBACK_FAN_MODE
        hvac_mode = occupancy.get("setback_hvac_mode", DEFAULT_SETBACK_HVAC_MODE)
        fan_mode = occupancy.get("setback_fan_mode", DEFAULT_SETBACK_FAN_MODE)
        return (
            hvac_mode if isinstance(hvac_mode, str) and hvac_mode else None,
            fan_mode if isinstance(fan_mode, str) and fan_mode else None,
        )

    def _lease_minutes(self) -> int:
        settings = self._scheduler._data.get("settings") or {}
        guards = settings.get("guards")
        value = guards.get("manual_lease_minutes") if isinstance(guards, dict) else None
        try:
            return max(0, int(value))
        except (TypeError, ValueError):
            return DEFAULT_MANUAL_LEASE_MINUTES

    def _unit(self, entity_id: str | None) -> str:
        unit_getter = getattr(self._scheduler._climate_manager, "temperature_unit", None)
        if entity_id is not None and callable(unit_getter):
            try:
                unit = unit_getter(entity_id)
            except Exception:  # pragma: no cover - defensive
                unit = None
            if unit:
                return unit
        return CELSIUS

    def _settings_unit(self) -> str:
        zones = self._zone_ids()
        return self._unit(zones[0] if zones else None)

    def _settings_temperature_bounds(self) -> tuple[float, float]:
        """Return the widest target range over the managed climates."""
        lows: list[float] = []
        highs: list[float] = []
        for entity_id in self._zone_ids():
            try:
                low, high = self._scheduler.get_temperature_limits(entity_id)
            except Exception:  # pragma: no cover - defensive
                continue
            lows.append(low)
            highs.append(high)
        if not lows:
            return -58.0, 212.0
        return min(lows), max(highs)

    # ------------------------------------------------------------------
    # Persistence, events, and logbook
    # ------------------------------------------------------------------
    def _record(self) -> HouseModesRuntimeData:
        runtime = self._runtime
        return {
            "state": runtime.state,
            "sleeping": runtime.sleeping,
            "sleep_since": _isoformat(runtime.sleep_since),
            "travel_active": runtime.travel_active,
            "travel_since": _isoformat(runtime.travel_since),
            "empty_since": _isoformat(runtime.empty_since),
            "away_stage": runtime.away_stage,
            "presleep_applied_on": runtime.presleep_applied_on,
            "saved_minimums": {
                entity_id: dict(value) for entity_id, value in runtime.saved_minimums.items()
            },
            "humidity_assist_enabled_zones": list(runtime.humidity_assist_enabled_zones),
            "last_action": runtime.last_action,
            "last_action_at": _isoformat(runtime.last_action_at),
        }

    async def _async_persist(self, record: HouseModesRuntimeData | None = None) -> None:
        settings = self._scheduler._data.setdefault("settings", {})
        settings[RUNTIME_KEY] = record if record is not None else self._record()
        try:
            await self._scheduler._async_save_data()
        except Exception:  # pragma: no cover - persistence failures are logged
            _LOGGER.exception("House Modes could not persist its runtime")

    def _note_action(self, action: str, now: datetime) -> None:
        self._runtime.last_action = action
        self._runtime.last_action_at = now

    def _fire_zone_parked(
        self,
        entity_id: str,
        pause_id: str,
        temperature: float | None,
        reason: str,
    ) -> None:
        self._scheduler._async_fire_event(
            EVENT_TYPE_HOUSE_ZONE_PARKED,
            {
                "entity_id": entity_id,
                "pause_id": pause_id,
                "action": (
                    ZONE_PAUSE_ACTION_NONE
                    if pause_id == PAUSE_ID_TRAVEL_OFF
                    else ZONE_PAUSE_ACTION_HOLD
                ),
                "temperature": temperature,
                "reason": reason,
            },
        )

    async def _async_logbook_mode(self, previous: str, state: str) -> None:
        scheduler = self._scheduler
        try:
            message = scheduler._message(
                f"House mode changed from {previous} to {state}",
                f"Modo de la casa cambiado de {previous} a {state}",
            )
            await scheduler._async_logbook(message)
        except Exception:  # pragma: no cover - logbook is best effort
            _LOGGER.debug("House Modes logbook entry failed", exc_info=True)


def _window_start(now: datetime, wall_time: str) -> datetime:
    """Return the most recent occurrence of ``HH:MM`` at or before ``now``."""
    hour, minute = (int(part) for part in wall_time.split(":", 1))
    candidate = datetime.combine(now.date(), time(hour=hour, minute=minute), tzinfo=now.tzinfo)
    if candidate > now:
        candidate -= timedelta(days=1)
    return candidate


def _same_temperature(left: float | None, right: float | None) -> bool:
    if left is None or right is None:
        return left is None and right is None
    return abs(float(left) - float(right)) < 0.000001


def _parse_timestamp(value: Any) -> datetime | None:
    if not isinstance(value, str) or not value:
        return None
    parsed = dt_util.parse_datetime(value)
    if parsed is None:
        return None
    return dt_util.as_local(parsed)


def _isoformat(value: datetime | None) -> str | None:
    return value.isoformat() if value is not None else None
