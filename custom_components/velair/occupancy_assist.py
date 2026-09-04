"""Occupancy Assist: staged vacancy setbacks and staged arrival comfort.

One ``OccupancyAssistCoordinator`` owns a small per-zone state machine driven
by an occupancy entity. An empty room only gets warmer (raise-only setback
holds); a room someone entered cools in stages (a lower-only ``comfort`` hold,
then a release to the schedule). Every write is a Velair hold through the
existing pause API; the module never calls ``climate.*`` services.

Clocks are measured from the source entity's ``last_changed`` so a restart
does not reset them. Uncertain occupancy (``unknown``/``unavailable``) holds
the current state: nothing is applied and nothing is released.
"""

from __future__ import annotations

import asyncio
from dataclasses import dataclass, field
from datetime import datetime, timedelta
from functools import partial
import logging
from typing import TYPE_CHECKING, Any

from homeassistant.core import CALLBACK_TYPE, callback
from homeassistant.helpers.dispatcher import async_dispatcher_connect
from homeassistant.helpers.event import (
    async_track_point_in_utc_time,
    async_track_state_change_event,
)
from homeassistant.util import dt as dt_util

from .const import (
    ACTION_SET_TEMPERATURE,
    EVENT_TYPE_OCCUPANCY_ASSIST_STATE_CHANGED,
    HOLD_CONSTRAINT_LOWER_ONLY,
    HOLD_CONSTRAINT_RAISE_ONLY,
    MODE_AUTO,
    SIGNAL_SCHEDULER_UPDATED,
    ZONE_PAUSE_ACTION_HOLD,
    ZONE_PAUSE_ACTION_NONE,
    ZONE_PAUSE_ACTION_TURN_OFF,
)
from .occupancy_assist_models import (
    MAX_OCCUPANCY_ASSIST_ARRIVAL_STAGES,
    MAX_OCCUPANCY_ASSIST_SETBACK_STAGES,
    OCCUPANCY_ASSIST_ARRIVAL_RELEASE_PAUSE_IDS,
    OCCUPANCY_ASSIST_COMFORT_PAUSE_ID,
    OCCUPANCY_ASSIST_SETBACK_PAUSE_ID,
    OCCUPANCY_ASSIST_STATE_ARRIVING_1,
    OCCUPANCY_ASSIST_STATE_BLOCKED,
    OCCUPANCY_ASSIST_STATE_COMFORT,
    OCCUPANCY_ASSIST_STATE_DISABLED,
    OCCUPANCY_ASSIST_STATE_OCCUPIED,
    OCCUPANCY_ASSIST_STATE_UNAVAILABLE,
    OCCUPANCY_ASSIST_STATE_VACANT,
    OccupancyAssistData,
    OccupancyAssistRuntimeData,
    normalize_occupancy_assist_data,
    normalize_occupancy_assist_runtime_data,
)

if TYPE_CHECKING:  # pragma: no cover - typing only
    from .scheduler import VelairScheduler

_LOGGER = logging.getLogger(__name__)

WEEKDAYS = (
    "monday",
    "tuesday",
    "wednesday",
    "thursday",
    "friday",
    "saturday",
    "sunday",
)

SOURCE_OCCUPANCY_ASSIST = "occupancy_assist"

ACTION_SETBACK_HOLD = "setback_hold"
ACTION_COMFORT_HOLD = "comfort_hold"
ACTION_COMFORT_RELEASED = "comfort_released"
ACTION_ARRIVAL_RELEASED = "arrival_released"
ACTION_DISABLED_RELEASED = "disabled_released"

BLOCKED_BY_MANUAL = "manual"
BLOCKED_BY_PAUSE = "pause"
BLOCKED_BY_BOOST = "boost"
BLOCKED_BY_PROFILE = "profile"
BLOCKED_BY_SCHEDULER = "scheduler_paused"
BLOCKED_BY_EXTERNAL = "external_execution"
BLOCKED_BY_MIGRATION = "temperature_migration"

REASON_DISABLED = "disabled"
REASON_ZONE_DISABLED = "zone_disabled"
REASON_NO_OCCUPANCY_ENTITY = "no_occupancy_entity"
REASON_SOURCE_UNAVAILABLE = "source_unavailable"
REASON_OCCUPIED = "occupied"
REASON_AWAITING_CORROBORATION = "awaiting_corroboration"
REASON_ARRIVAL_STAGE = "arrival_stage"
REASON_ARRIVAL_COMPLETE = "arrival_complete"
REASON_EXIT_GRACE = "exit_grace"
REASON_VACANT = "vacant"
REASON_SETBACK_STAGE = "setback_stage"
REASON_BLOCKING_ENTITY = "blocking_entity"

ON_STATES = ("on",)
OFF_STATES = ("off",)


@dataclass
class _ZoneRuntime:
    """Runtime and persisted state for one zone."""

    state: str = OCCUPANCY_ASSIST_STATE_DISABLED
    stage: int | None = None
    applied_stage: int | None = None
    arrival_released: bool = False
    reason: str | None = None
    blocked_by: str | None = None
    occupied_since: datetime | None = None
    vacant_since: datetime | None = None
    next_stage_at: datetime | None = None
    next_temperature: float | None = None
    timer_at: datetime | None = None
    hold_temperature: float | None = None
    last_action: str | None = None
    last_action_at: datetime | None = None
    error: str | None = None
    source_value: str | None = None
    source_observed_at: datetime | None = None
    unsub_timer: CALLBACK_TYPE | None = None
    facts: dict[str, Any] = field(default_factory=dict)


@dataclass
class _ZoneFacts:
    """Evaluation inputs for one zone at one instant."""

    entity_id: str
    config: OccupancyAssistData
    ready: bool
    reason: str | None
    source: str | None  # "on", "off" or None (unknown/unavailable)
    source_since: datetime | None
    arrival_since: datetime | None
    corroborated: bool
    blocking_entity: str | None
    blocked_by: str | None
    setback_hold: dict[str, Any] | None
    comfort_hold: dict[str, Any] | None


@dataclass
class _Decision:
    """Desired outcome for one zone."""

    state: str
    reason: str
    stage: int | None = None
    hold_temperature: float | None = None
    setback_temperature: float | None = None
    setback_stage: int | None = None
    comfort_temperature: float | None = None
    release_comfort: bool = False
    release_final: bool = False
    next_at: datetime | None = None
    next_temperature: float | None = None


class OccupancyAssistCoordinator:
    """Per-zone occupancy state machines sharing listeners and timers."""

    def __init__(self, scheduler: VelairScheduler) -> None:
        self._scheduler = scheduler
        self._hass = scheduler._hass
        self._zones: dict[str, _ZoneRuntime] = {}
        self._lock = asyncio.Lock()
        self._started = False
        self._tracked_entities: tuple[str, ...] = ()
        self._unsub_listener: CALLBACK_TYPE | None = None
        self._unsub_dispatcher: CALLBACK_TYPE | None = None
        self._refresh_task_pending = False
        self._evaluating = False
        self._rerun_requested = False
        self._load_persisted_runtime()

    # ------------------------------------------------------------------
    # Lifecycle
    # ------------------------------------------------------------------
    def _load_persisted_runtime(self) -> None:
        data = self._scheduler._data
        records = normalize_occupancy_assist_runtime_data(
            data.get("occupancy_assist_runtime"),
            list(data.get("zones", {})),
        )
        data["occupancy_assist_runtime"] = records
        for entity_id, record in records.items():
            runtime = self._runtime(entity_id)
            runtime.state = record.get("state", OCCUPANCY_ASSIST_STATE_DISABLED)
            runtime.stage = record.get("stage")
            runtime.applied_stage = record.get("applied_stage")
            runtime.arrival_released = bool(record.get("arrival_released", False))
            runtime.occupied_since = _parse_timestamp(record.get("occupied_since"))
            runtime.vacant_since = _parse_timestamp(record.get("vacant_since"))
            runtime.last_action = record.get("last_action")
            runtime.last_action_at = _parse_timestamp(record.get("last_action_at"))

    async def async_start(self) -> None:
        """Register listeners and evaluate every zone once."""
        self._started = True
        self._refresh_listeners()
        if self._unsub_dispatcher is None:
            self._unsub_dispatcher = async_dispatcher_connect(
                self._hass, SIGNAL_SCHEDULER_UPDATED, self._handle_scheduler_updated
            )
        await self.async_evaluate(reason="start")

    async def async_stop(self) -> None:
        """Stop listeners and timers; runtime records stay persisted."""
        self._started = False
        self._clear_listener()
        if self._unsub_dispatcher is not None:
            self._unsub_dispatcher()
            self._unsub_dispatcher = None
        for runtime in self._zones.values():
            self._clear_zone_timer(runtime)

    def handle_unit_change(self) -> None:
        """Nothing unit-bound is cached; re-evaluate with the converted config."""
        for runtime in self._zones.values():
            runtime.facts = {}
        self.schedule_refresh()

    # ------------------------------------------------------------------
    # Public projection used by the scheduler, API, and entities
    # ------------------------------------------------------------------
    def config(self, entity_id: str) -> OccupancyAssistData:
        """Return the normalized configuration of one managed zone."""
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
        config = self._config(entity_id)
        runtime = self._zones.get(entity_id)
        state = runtime.state if runtime is not None else OCCUPANCY_ASSIST_STATE_DISABLED
        return {
            "state": state,
            "enabled": config["enabled"],
            "configured": bool(config["occupancy_entity_id"]),
            "reason": runtime.reason if runtime is not None else None,
            "occupancy_entity_id": config["occupancy_entity_id"],
            "occupied_since": _isoformat(runtime.occupied_since if runtime else None),
            "vacant_since": _isoformat(runtime.vacant_since if runtime else None),
            "stage": runtime.stage if runtime is not None else None,
            "next_stage_at": _isoformat(runtime.next_stage_at if runtime else None),
            "next_temperature": runtime.next_temperature if runtime else None,
            "blocked_by": runtime.blocked_by if runtime is not None else None,
            "hold_temperature": runtime.hold_temperature if runtime else None,
            "last_action": runtime.last_action if runtime is not None else None,
            "last_action_at": _isoformat(runtime.last_action_at if runtime else None),
            "error": runtime.error if runtime is not None else None,
            "corroborated": bool(runtime.facts.get("corroborated", False)) if runtime else False,
            "arrival_released": bool(runtime.arrival_released) if runtime else False,
            "comfort_temperature": config["comfort_temperature"],
            "sync_comfort_to_schedule": config["sync_comfort_to_schedule"],
        }

    # ------------------------------------------------------------------
    # Configuration changes
    # ------------------------------------------------------------------
    async def async_update_config(
        self, entity_id: str, updates: dict[str, Any]
    ) -> OccupancyAssistData:
        """Validate, persist, and apply one per-zone configuration update."""
        scheduler = self._scheduler
        scheduler._ensure_local_execution(entity_id)
        previous = self._config(entity_id)
        merged = {**previous, **(updates or {})}
        next_config = normalize_occupancy_assist_data(merged)
        self._validate_update(entity_id, merged, next_config)
        if self._comfort_sync_due(previous, next_config):
            await self._async_sync_comfort_schedule(entity_id, next_config)
        scheduler._data["zones"][entity_id]["occupancy_assist"] = next_config
        await scheduler._async_save_data()
        await self.async_config_changed(entity_id, previous, next_config)
        scheduler._async_write_state()
        return next_config

    def _validate_update(
        self,
        entity_id: str,
        merged: dict[str, Any],
        next_config: OccupancyAssistData,
    ) -> None:
        scheduler = self._scheduler
        if next_config["enabled"] and not next_config["occupancy_entity_id"]:
            raise ValueError("Occupancy Assist requires an occupancy entity")
        raw_setback = merged.get("setback_stages")
        if raw_setback is not None:
            if not isinstance(raw_setback, list):
                raise ValueError("setback_stages must be a list")
            if len(raw_setback) > MAX_OCCUPANCY_ASSIST_SETBACK_STAGES:
                raise ValueError(
                    f"setback_stages accepts at most {MAX_OCCUPANCY_ASSIST_SETBACK_STAGES} stages"
                )
            _ensure_ascending(raw_setback, "setback_stages")
            for stage in raw_setback:
                if not isinstance(stage, dict) or stage.get("temperature") is None:
                    raise ValueError("Every setback stage needs a temperature")
        raw_arrival = merged.get("arrival_stages")
        if raw_arrival is not None:
            if not isinstance(raw_arrival, list) or not raw_arrival:
                raise ValueError("arrival_stages needs at least one stage")
            if len(raw_arrival) > MAX_OCCUPANCY_ASSIST_ARRIVAL_STAGES:
                raise ValueError(
                    f"arrival_stages accepts at most {MAX_OCCUPANCY_ASSIST_ARRIVAL_STAGES} stages"
                )
            _ensure_ascending(raw_arrival, "arrival_stages")
            last = raw_arrival[-1]
            if isinstance(last, dict) and last.get("temperature") is not None:
                raise ValueError(
                    "The last arrival stage must release to the schedule (temperature: null)"
                )
        minimum, maximum = scheduler.get_temperature_limits(entity_id)
        temperatures = [next_config["comfort_temperature"]]
        temperatures.extend(
            stage["temperature"]
            for key in ("setback_stages", "arrival_stages")
            for stage in next_config[key]
            if stage["temperature"] is not None
        )
        for temperature in temperatures:
            if not minimum <= float(temperature) <= maximum:
                raise ValueError(
                    f"Occupancy Assist temperatures must be between {minimum:g} and {maximum:g}"
                )
        hvac_mode = next_config["setback_hvac_mode"]
        supported = getattr(scheduler._climate_manager, "supported_hvac_modes", None)
        if hvac_mode is not None and callable(supported):
            modes = supported(entity_id)
            if modes and hvac_mode not in modes:
                raise ValueError(f"{entity_id} does not support hvac_mode {hvac_mode}")

    @staticmethod
    def _comfort_sync_due(
        previous: OccupancyAssistData, current: OccupancyAssistData
    ) -> bool:
        if not current["sync_comfort_to_schedule"]:
            return False
        if not previous["sync_comfort_to_schedule"]:
            return True
        return any(
            previous[key] != current[key]
            for key in ("comfort_temperature", "setback_hvac_mode", "setback_fan_mode")
        )

    async def _async_sync_comfort_schedule(
        self, entity_id: str, config: OccupancyAssistData
    ) -> None:
        """Write the comfort temperature as the zone's whole weekly schedule."""
        block: dict[str, Any] = {
            "start": "00:00",
            "action": ACTION_SET_TEMPERATURE,
            "temperature": float(config["comfort_temperature"]),
        }
        if config["setback_hvac_mode"]:
            block["hvac_mode"] = config["setback_hvac_mode"]
        if config["setback_fan_mode"]:
            block["fan_mode"] = config["setback_fan_mode"]
        scheduler = self._scheduler
        await scheduler.async_set_daily_schedule(entity_id, WEEKDAYS[0], [block])
        await scheduler.async_copy_day_schedule(entity_id, WEEKDAYS[0], list(WEEKDAYS[1:]))

    async def async_config_changed(
        self,
        entity_id: str,
        previous: OccupancyAssistData,
        current: OccupancyAssistData,
    ) -> None:
        """React to a per-zone configuration change."""
        runtime = self._runtime(entity_id)
        if previous["enabled"] and not current["enabled"]:
            previous_state = runtime.state
            await self._async_disable_zone(entity_id, runtime)
            if previous_state != OCCUPANCY_ASSIST_STATE_DISABLED:
                self._fire_state_changed(
                    entity_id,
                    previous_state,
                    _Decision(OCCUPANCY_ASSIST_STATE_DISABLED, REASON_DISABLED),
                )
        if previous["occupancy_entity_id"] != current["occupancy_entity_id"]:
            runtime.source_value = None
            runtime.source_observed_at = None
        self._refresh_listeners()
        self._persist_runtime(entity_id)
        await self._scheduler._async_save_data()
        if self._started:
            await self.async_evaluate(reason="config")

    async def async_settings_changed(self, settings: dict | None = None) -> None:
        """React to a global settings change (limits can move stage targets)."""
        self._refresh_listeners()
        if self._started:
            await self.async_evaluate(reason="settings")

    def schedule_refresh(self) -> None:
        """Schedule one coalesced evaluation."""
        if not self._started or self._refresh_task_pending:
            return
        self._refresh_task_pending = True
        self._hass.async_create_task(self._async_run_scheduled_refresh())

    async def _async_run_scheduled_refresh(self) -> None:
        self._refresh_task_pending = False
        await self.async_evaluate(reason="refresh")

    @callback
    def _handle_scheduler_updated(self) -> None:
        self.schedule_refresh()

    @callback
    def _handle_zone_timer(self, _now: datetime, *, entity_id: str) -> None:
        runtime = self._zones.get(entity_id)
        if runtime is not None:
            runtime.unsub_timer = None
        self._hass.async_create_task(self.async_evaluate(reason="timer"))

    # ------------------------------------------------------------------
    # Listeners
    # ------------------------------------------------------------------
    def _refresh_listeners(self) -> None:
        entity_ids: set[str] = set()
        for entity_id in self._scheduler._data["zones"]:
            config = self._config(entity_id)
            if not config["enabled"] or not config["occupancy_entity_id"]:
                continue
            entity_ids.add(config["occupancy_entity_id"])
            entity_ids.update(config["blocking_entity_ids"])
            entity_ids.update(config["corroboration_entity_ids"])
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
        """Evaluate every zone and apply the resulting transitions.

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
                while True:
                    await self._async_evaluate_locked(current_reason)
                    if not self._rerun_requested:
                        break
                    self._rerun_requested = False
                    current_reason = "rerun"
            finally:
                self._evaluating = False

    async def _async_evaluate_locked(self, reason: str) -> None:
        now = dt_util.now()
        changed = False
        persist = False
        for entity_id in list(self._scheduler._data["zones"]):
            facts = self._zone_facts(entity_id, now)
            decision = self._decide(facts, now)
            zone_changed, zone_persist = await self._async_apply(facts, decision, now)
            changed = changed or zone_changed
            persist = persist or zone_persist
            self._reschedule_timer(entity_id, decision.next_at, now)
        if persist:
            await self._scheduler._async_save_data()
        if changed:
            self._scheduler._async_write_state()
        _LOGGER.debug(
            "Occupancy Assist evaluated (%s): %s",
            reason,
            {entity_id: runtime.state for entity_id, runtime in self._zones.items()},
        )

    def _zone_facts(self, entity_id: str, now: datetime) -> _ZoneFacts:
        config = self._config(entity_id)
        runtime = self._runtime(entity_id)
        zone = self._scheduler._data["zones"].get(entity_id)
        reason: str | None = None
        if zone is None or not zone.get("enabled", True):
            reason = REASON_ZONE_DISABLED
        elif not config["enabled"]:
            reason = REASON_DISABLED
        elif not config["occupancy_entity_id"]:
            reason = REASON_NO_OCCUPANCY_ENTITY
        ready = reason is None
        source: str | None = None
        source_since: datetime | None = None
        if ready:
            state = self._hass.states.get(config["occupancy_entity_id"])
            source = _on_off(state)
            if source is None:
                reason = REASON_SOURCE_UNAVAILABLE
            else:
                source_since = self._source_since(runtime, state, source, now)
        corroborated = True
        arrival_since = source_since
        if ready and source == "on" and config["corroboration_entity_ids"]:
            anchors: list[datetime] = []
            for corroboration_id in config["corroboration_entity_ids"]:
                corroboration_state = self._hass.states.get(corroboration_id)
                if _on_off(corroboration_state) != "on":
                    continue
                corroboration_since = _state_since(corroboration_state)
                if corroboration_since is not None:
                    anchors.append(corroboration_since)
            corroborated = bool(anchors)
            arrival_since = (
                max(source_since, min(anchors))
                if anchors and source_since is not None
                else None
            )
        blocking_entity = next(
            (
                blocking_id
                for blocking_id in config["blocking_entity_ids"]
                if _on_off(self._hass.states.get(blocking_id)) == "on"
            ),
            None,
        ) if ready else None
        blocked_by = self._control_block(entity_id, now) if ready else None
        holds = self._holds(entity_id, now)
        return _ZoneFacts(
            entity_id=entity_id,
            config=config,
            ready=ready,
            reason=reason,
            source=source,
            source_since=source_since,
            arrival_since=arrival_since,
            corroborated=corroborated,
            blocking_entity=blocking_entity,
            blocked_by=blocked_by,
            setback_hold=holds.get(OCCUPANCY_ASSIST_SETBACK_PAUSE_ID),
            comfort_hold=holds.get(OCCUPANCY_ASSIST_COMFORT_PAUSE_ID),
        )

    def _decide(self, facts: _ZoneFacts, now: datetime) -> _Decision:
        """Return the desired outcome for one zone (pure, no side effects)."""
        if not facts.ready:
            return _Decision(OCCUPANCY_ASSIST_STATE_DISABLED, facts.reason or REASON_DISABLED)
        if facts.source is None:
            return _Decision(OCCUPANCY_ASSIST_STATE_UNAVAILABLE, REASON_SOURCE_UNAVAILABLE)
        config = facts.config
        if facts.source == "on":
            return self._decide_arrival(facts, config, now)
        return self._decide_vacancy(facts, config, now)

    @staticmethod
    def _decide_arrival(
        facts: _ZoneFacts, config: OccupancyAssistData, now: datetime
    ) -> _Decision:
        stages = config["arrival_stages"]
        anchor = facts.arrival_since
        if anchor is None:
            return _Decision(
                OCCUPANCY_ASSIST_STATE_OCCUPIED,
                REASON_AWAITING_CORROBORATION if not facts.corroborated else REASON_OCCUPIED,
            )
        elapsed = now - anchor
        reached = [
            index
            for index, stage in enumerate(stages)
            if elapsed >= timedelta(minutes=stage["after_minutes"])
        ]
        if not reached:
            first = stages[0]
            return _Decision(
                OCCUPANCY_ASSIST_STATE_OCCUPIED,
                REASON_OCCUPIED,
                next_at=anchor + timedelta(minutes=first["after_minutes"]),
                next_temperature=first["temperature"],
            )
        index = reached[-1]
        stage = stages[index]
        if stage["temperature"] is None:
            return _Decision(
                OCCUPANCY_ASSIST_STATE_COMFORT,
                REASON_ARRIVAL_COMPLETE,
                release_final=True,
            )
        following = stages[index + 1] if index + 1 < len(stages) else None
        return _Decision(
            OCCUPANCY_ASSIST_STATE_ARRIVING_1,
            REASON_ARRIVAL_STAGE,
            stage=index + 1,
            hold_temperature=float(stage["temperature"]),
            comfort_temperature=float(stage["temperature"]),
            next_at=(
                anchor + timedelta(minutes=following["after_minutes"])
                if following is not None
                else None
            ),
            next_temperature=following["temperature"] if following is not None else None,
        )

    @staticmethod
    def _decide_vacancy(
        facts: _ZoneFacts, config: OccupancyAssistData, now: datetime
    ) -> _Decision:
        anchor = facts.source_since or now
        elapsed = now - anchor
        grace = timedelta(minutes=config["arrival_exit_grace_minutes"])
        if facts.comfort_hold is not None and elapsed < grace:
            # Left during an arrival stage: keep the comfort hold for the grace.
            return _Decision(
                OCCUPANCY_ASSIST_STATE_ARRIVING_1,
                REASON_EXIT_GRACE,
                stage=_hold_stage(facts.comfort_hold),
                hold_temperature=_hold_temperature(facts.comfort_hold),
                next_at=anchor + grace,
                next_temperature=None,
            )
        release_comfort = facts.comfort_hold is not None
        applied_temperature = _hold_temperature(facts.setback_hold)
        applied_stage = _hold_stage(facts.setback_hold)
        stages = config["setback_stages"]
        if facts.blocking_entity is not None:
            return _Decision(
                OCCUPANCY_ASSIST_STATE_BLOCKED,
                REASON_BLOCKING_ENTITY,
                stage=applied_stage,
                hold_temperature=applied_temperature,
                release_comfort=release_comfort,
            )
        due = [
            index
            for index, stage in enumerate(stages)
            if elapsed >= timedelta(minutes=stage["after_minutes"])
        ]
        if not due:
            first = stages[0] if stages else None
            return _Decision(
                OCCUPANCY_ASSIST_STATE_VACANT,
                REASON_VACANT,
                stage=applied_stage,
                hold_temperature=applied_temperature,
                release_comfort=release_comfort,
                next_at=(
                    anchor + timedelta(minutes=first["after_minutes"])
                    if first is not None
                    else None
                ),
                next_temperature=first["temperature"] if first is not None else None,
            )
        index = due[-1]
        stage = stages[index]
        target = float(stage["temperature"])
        if applied_temperature is not None:
            target = max(target, applied_temperature)  # a stage never lowers
        following = stages[index + 1] if index + 1 < len(stages) else None
        return _Decision(
            f"setback_{index + 1}",
            REASON_SETBACK_STAGE,
            stage=index + 1,
            hold_temperature=target,
            setback_temperature=target,
            setback_stage=index + 1,
            release_comfort=release_comfort,
            next_at=(
                anchor + timedelta(minutes=following["after_minutes"])
                if following is not None
                else None
            ),
            next_temperature=(
                max(float(following["temperature"]), target)
                if following is not None
                else None
            ),
        )

    async def _async_apply(
        self, facts: _ZoneFacts, decision: _Decision, now: datetime
    ) -> tuple[bool, bool]:
        """Apply one decision; return (state_changed, persist_needed)."""
        entity_id = facts.entity_id
        runtime = self._runtime(entity_id)
        previous_state = runtime.state
        previous_stage = runtime.stage
        runtime.facts = {"corroborated": facts.corroborated}
        runtime.occupied_since = facts.source_since if facts.source == "on" else None
        runtime.vacant_since = facts.source_since if facts.source == "off" else None
        runtime.next_stage_at = decision.next_at
        runtime.next_temperature = decision.next_temperature
        runtime.blocked_by = (
            facts.blocking_entity
            if decision.state == OCCUPANCY_ASSIST_STATE_BLOCKED
            else facts.blocked_by
        )
        runtime.reason = decision.reason
        runtime.hold_temperature = decision.hold_temperature
        runtime.state = decision.state
        runtime.stage = decision.stage
        runtime.error = None

        arrival_in_progress = decision.state in (
            OCCUPANCY_ASSIST_STATE_ARRIVING_1,
            OCCUPANCY_ASSIST_STATE_COMFORT,
        )
        if not arrival_in_progress and runtime.arrival_released:
            runtime.arrival_released = False

        acted = False
        if facts.ready and facts.source is not None and facts.blocked_by is None:
            acted = await self._async_perform(facts, decision, runtime, now)

        if decision.state == OCCUPANCY_ASSIST_STATE_DISABLED and previous_state not in (
            OCCUPANCY_ASSIST_STATE_DISABLED,
        ):
            await self._async_disable_zone(entity_id, runtime)
            acted = True

        changed = previous_state != decision.state or previous_stage != decision.stage
        if changed:
            self._fire_state_changed(entity_id, previous_state, decision)
        if changed or acted:
            self._persist_runtime(entity_id)
        return changed or acted, changed or acted

    async def _async_perform(
        self,
        facts: _ZoneFacts,
        decision: _Decision,
        runtime: _ZoneRuntime,
        now: datetime,
    ) -> bool:
        """Perform the hold writes and releases a decision asks for."""
        entity_id = facts.entity_id
        scheduler = self._scheduler
        acted = False
        try:
            if decision.release_comfort and facts.comfort_hold is not None:
                await scheduler.async_resume_zone(
                    entity_id,
                    pause_id=OCCUPANCY_ASSIST_COMFORT_PAUSE_ID,
                    reason=SOURCE_OCCUPANCY_ASSIST,
                )
                if OCCUPANCY_ASSIST_COMFORT_PAUSE_ID not in self._holds(entity_id, now):
                    self._record_action(runtime, ACTION_COMFORT_RELEASED, now)
                    await self._async_logbook(
                        entity_id,
                        "Occupancy Assist released the comfort hold for {name}",
                        "Occupancy Assist liberó la retención de confort en {name}",
                    )
                    acted = True
            setback_target = self._snap(entity_id, decision.setback_temperature)
            if setback_target is not None and (
                _hold_temperature(facts.setback_hold) != setback_target
                or _hold_stage(facts.setback_hold) != decision.setback_stage
            ):
                config = facts.config
                before = facts.setback_hold
                await scheduler.async_pause_zone(
                    entity_id,
                    action=ZONE_PAUSE_ACTION_HOLD,
                    pause_id=OCCUPANCY_ASSIST_SETBACK_PAUSE_ID,
                    temperature=setback_target,
                    constraint=HOLD_CONSTRAINT_RAISE_ONLY,
                    hvac_mode=config["setback_hvac_mode"],
                    fan_mode=config["setback_fan_mode"],
                    label=f"setback stage {decision.setback_stage}",
                )
                after = self._holds(entity_id, now).get(OCCUPANCY_ASSIST_SETBACK_PAUSE_ID)
                runtime.applied_stage = decision.setback_stage
                runtime.hold_temperature = setback_target
                if after != before:
                    self._record_action(runtime, ACTION_SETBACK_HOLD, now)
                    await self._async_logbook(
                        entity_id,
                        f"Occupancy Assist setback stage {decision.setback_stage} for {{name}} "
                        f"({self._format_temperature(entity_id, setback_target)})",
                        f"Occupancy Assist etapa de retroceso {decision.setback_stage} en {{name}} "
                        f"({self._format_temperature(entity_id, setback_target)})",
                    )
                    acted = True
            comfort_target = self._snap(entity_id, decision.comfort_temperature)
            if comfort_target is not None and (
                _hold_temperature(facts.comfort_hold) != comfort_target
                or _hold_stage(facts.comfort_hold) != decision.stage
            ):
                before = facts.comfort_hold
                await scheduler.async_pause_zone(
                    entity_id,
                    action=ZONE_PAUSE_ACTION_HOLD,
                    pause_id=OCCUPANCY_ASSIST_COMFORT_PAUSE_ID,
                    temperature=comfort_target,
                    constraint=HOLD_CONSTRAINT_LOWER_ONLY,
                    label=f"arrival stage {decision.stage}",
                )
                after = self._holds(entity_id, now).get(OCCUPANCY_ASSIST_COMFORT_PAUSE_ID)
                runtime.hold_temperature = comfort_target
                if after != before:
                    self._record_action(runtime, ACTION_COMFORT_HOLD, now)
                    await self._async_logbook(
                        entity_id,
                        f"Occupancy Assist arrival stage {decision.stage} for {{name}} "
                        f"({self._format_temperature(entity_id, comfort_target)})",
                        f"Occupancy Assist etapa de llegada {decision.stage} en {{name}} "
                        f"({self._format_temperature(entity_id, comfort_target)})",
                    )
                    acted = True
            if decision.release_final and not runtime.arrival_released:
                await self._async_release_arrival(entity_id, now)
                runtime.arrival_released = True
                runtime.applied_stage = None
                self._record_action(runtime, ACTION_ARRIVAL_RELEASED, now)
                await self._async_logbook(
                    entity_id,
                    "Occupancy Assist arrival complete for {name}: schedule restored",
                    "Occupancy Assist llegada completada en {name}: horario restaurado",
                )
                acted = True
        except ValueError as err:
            runtime.error = str(err)
            _LOGGER.warning("Occupancy Assist could not update %s: %s", entity_id, err)
        except Exception:  # pragma: no cover - delivery failures are logged
            _LOGGER.exception("Occupancy Assist failed for %s", entity_id)
        return acted

    async def _async_release_arrival(self, entity_id: str, now: datetime) -> None:
        """Release the arrival pause ids in order, then ``comfort``."""
        scheduler = self._scheduler
        present = set(self._holds(entity_id, now, all_actions=True))
        pause_ids = [
            pause_id
            for pause_id in (
                *OCCUPANCY_ASSIST_ARRIVAL_RELEASE_PAUSE_IDS,
                OCCUPANCY_ASSIST_COMFORT_PAUSE_ID,
            )
            if pause_id in present
        ]
        for index, pause_id in enumerate(pause_ids):
            await scheduler.async_resume_zone(
                entity_id,
                pause_id=pause_id,
                apply_current_schedule=index == len(pause_ids) - 1,
                reason=SOURCE_OCCUPANCY_ASSIST,
            )

    async def _async_disable_zone(self, entity_id: str, runtime: _ZoneRuntime) -> None:
        """Release both owned holds for a zone that is no longer managed."""
        scheduler = self._scheduler
        now = dt_util.now()
        present = set(self._holds(entity_id, now, all_actions=True))
        owned = [
            pause_id
            for pause_id in (
                OCCUPANCY_ASSIST_SETBACK_PAUSE_ID,
                OCCUPANCY_ASSIST_COMFORT_PAUSE_ID,
            )
            if pause_id in present
        ]
        for index, pause_id in enumerate(owned):
            try:
                await scheduler.async_resume_zone(
                    entity_id,
                    pause_id=pause_id,
                    apply_current_schedule=index == len(owned) - 1,
                    reason=SOURCE_OCCUPANCY_ASSIST,
                )
            except ValueError as err:
                runtime.error = str(err)
                _LOGGER.warning("Occupancy Assist could not release %s: %s", entity_id, err)
        self._clear_zone_timer(runtime)
        runtime.state = OCCUPANCY_ASSIST_STATE_DISABLED
        runtime.stage = None
        runtime.applied_stage = None
        runtime.arrival_released = False
        runtime.next_stage_at = None
        runtime.next_temperature = None
        runtime.hold_temperature = None
        runtime.blocked_by = None
        runtime.reason = REASON_DISABLED
        if owned:
            self._record_action(runtime, ACTION_DISABLED_RELEASED, now)

    # ------------------------------------------------------------------
    # Facts helpers
    # ------------------------------------------------------------------
    def _source_since(
        self, runtime: _ZoneRuntime, state, value: str, now: datetime
    ) -> datetime:
        """Return when the source entered its current value (restart-safe)."""
        since = _state_since(state)
        if since is not None:
            runtime.source_value = value
            runtime.source_observed_at = since
            return since
        if runtime.source_value != value or runtime.source_observed_at is None:
            runtime.source_value = value
            runtime.source_observed_at = now
        return runtime.source_observed_at

    def _control_block(self, entity_id: str, now: datetime) -> str | None:
        """Return why no hold may be written or released right now."""
        scheduler = self._scheduler
        if scheduler.temperature_migration_blocked:
            return BLOCKED_BY_MIGRATION
        if scheduler._is_external_execution(entity_id):
            return BLOCKED_BY_EXTERNAL
        if scheduler.mode != MODE_AUTO:
            return BLOCKED_BY_SCHEDULER
        if scheduler._manual_control_status(entity_id, now) is not None:
            return BLOCKED_BY_MANUAL
        override = scheduler._get_active_zone_override(entity_id, now)
        if isinstance(override, dict):
            if override.get("type") == "pause" and override.get("action") in (
                ZONE_PAUSE_ACTION_NONE,
                ZONE_PAUSE_ACTION_TURN_OFF,
            ):
                return BLOCKED_BY_PAUSE
            if override.get("type") == "boost":
                return BLOCKED_BY_BOOST
        behavior = scheduler._profile_zone_behavior(entity_id)
        if behavior.get("behavior") == "pause":
            return BLOCKED_BY_PROFILE
        return None

    def _holds(
        self, entity_id: str, now: datetime, *, all_actions: bool = False
    ) -> dict[str, dict[str, Any]]:
        """Return the active identified pause reasons of one zone by id."""
        if entity_id not in self._scheduler._data["zones"]:
            return {}
        reasons = self._scheduler._active_zone_pause_reasons(entity_id, now)
        return {
            reason["pause_id"]: reason
            for reason in reasons
            if isinstance(reason.get("pause_id"), str)
            and (all_actions or reason.get("action") == ZONE_PAUSE_ACTION_HOLD)
        }

    # ------------------------------------------------------------------
    # Timers
    # ------------------------------------------------------------------
    def _reschedule_timer(
        self, entity_id: str, next_at: datetime | None, now: datetime
    ) -> None:
        runtime = self._runtime(entity_id)
        if next_at is not None and next_at <= now:
            next_at = None
        if runtime.unsub_timer is not None and runtime.timer_at == next_at:
            return
        self._clear_zone_timer(runtime)
        runtime.timer_at = next_at
        if next_at is None or not self._started:
            return
        runtime.unsub_timer = async_track_point_in_utc_time(
            self._hass,
            partial(self._handle_zone_timer, entity_id=entity_id),
            dt_util.as_utc(next_at),
        )

    @staticmethod
    def _clear_zone_timer(runtime: _ZoneRuntime) -> None:
        if runtime.unsub_timer is not None:
            runtime.unsub_timer()
            runtime.unsub_timer = None
        runtime.timer_at = None

    # ------------------------------------------------------------------
    # Helpers
    # ------------------------------------------------------------------
    def _runtime(self, entity_id: str) -> _ZoneRuntime:
        runtime = self._zones.get(entity_id)
        if runtime is None:
            runtime = _ZoneRuntime()
            self._zones[entity_id] = runtime
        return runtime

    def _config(self, entity_id: str) -> OccupancyAssistData:
        zone = self._scheduler._data["zones"].get(entity_id) or {}
        return normalize_occupancy_assist_data(zone.get("occupancy_assist"))

    def _snap(self, entity_id: str, temperature: float | None) -> float | None:
        """Snap a requested hold target to the climate's own step grid."""
        if temperature is None:
            return None
        try:
            return float(self._scheduler.normalize_target_temperature(entity_id, temperature))
        except ValueError:
            return float(temperature)

    @staticmethod
    def _record_action(runtime: _ZoneRuntime, action: str, now: datetime) -> None:
        runtime.last_action = action
        runtime.last_action_at = now

    def _persist_runtime(self, entity_id: str) -> None:
        runtime = self._runtime(entity_id)
        record: OccupancyAssistRuntimeData = {
            "state": runtime.state,
            "stage": runtime.stage,
            "applied_stage": runtime.applied_stage,
            "arrival_released": runtime.arrival_released,
            "occupied_since": _isoformat(runtime.occupied_since),
            "vacant_since": _isoformat(runtime.vacant_since),
            "last_action": runtime.last_action,
            "last_action_at": _isoformat(runtime.last_action_at),
        }
        store = self._scheduler._data.setdefault("occupancy_assist_runtime", {})
        store[entity_id] = record

    def _fire_state_changed(
        self, entity_id: str, previous_state: str, decision: _Decision
    ) -> None:
        self._scheduler._async_fire_event(
            EVENT_TYPE_OCCUPANCY_ASSIST_STATE_CHANGED,
            {
                "entity_id": entity_id,
                "previous": previous_state,
                "state": decision.state,
                "stage": decision.stage,
                "temperature": decision.hold_temperature,
                "reason": decision.reason,
            },
        )

    def _format_temperature(self, entity_id: str, temperature: float) -> str:
        formatter = getattr(self._scheduler, "_format_temperature", None)
        if callable(formatter):
            try:
                return formatter(entity_id, temperature)
            except Exception:  # pragma: no cover - defensive
                pass
        return f"{temperature:g}"

    async def _async_logbook(self, entity_id: str, english: str, spanish: str) -> None:
        scheduler = self._scheduler
        name = scheduler._friendly_entity_name(entity_id)
        message = scheduler._message(
            english.replace("{name}", name), spanish.replace("{name}", name)
        )
        try:
            await scheduler._async_logbook(message, entity_id=entity_id)
        except Exception:  # pragma: no cover - logbook is best effort
            _LOGGER.debug("Occupancy Assist logbook entry failed", exc_info=True)


def _ensure_ascending(stages: list, name: str) -> None:
    previous: int | None = None
    for stage in stages:
        if not isinstance(stage, dict):
            raise ValueError(f"{name} entries must be objects")
        try:
            minutes = int(stage.get("after_minutes"))
        except (TypeError, ValueError) as err:
            raise ValueError(f"{name} entries need after_minutes") from err
        if minutes < 0:
            raise ValueError(f"{name} minutes cannot be negative")
        if previous is not None and minutes <= previous:
            raise ValueError(f"{name} must use strictly ascending after_minutes")
        previous = minutes


def _on_off(state) -> str | None:
    """Return "on"/"off" for a usable state, None when uncertain (P5)."""
    if state is None:
        return None
    value = getattr(state, "state", None)
    if value in ON_STATES:
        return "on"
    if value in OFF_STATES:
        return "off"
    return None


def _state_since(state) -> datetime | None:
    value = getattr(state, "last_changed", None)
    if isinstance(value, datetime):
        return dt_util.as_local(value)
    if isinstance(value, str):
        return _parse_timestamp(value)
    return None


def _hold_temperature(hold: dict[str, Any] | None) -> float | None:
    if hold is None:
        return None
    value = hold.get("temperature")
    return float(value) if isinstance(value, (int, float)) else None


def _hold_stage(hold: dict[str, Any] | None) -> int | None:
    if hold is None:
        return None
    label = hold.get("label")
    if isinstance(label, str):
        parts = label.rsplit(" ", 1)
        if len(parts) == 2 and parts[1].isdigit():
            return int(parts[1])
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
