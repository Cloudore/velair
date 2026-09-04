"""Humidity Assist: bounded dew-point duty-cycle control for managed climates.

The module owns the per-zone state machine and the cross-zone coordinator.
The scheduler creates one ``HumidityAssistCoordinator`` and exposes a small
set of hooks: a delivery-authority tier that serves the pulse target while a
zone is pulsing, refresh triggers after zone control changes, and a status
projection for the API and generated entities.

Decision semantics are ported from a production Home Assistant automation
that pulses air-conditioning zones colder for bounded runs whenever a room's
dew point drifts above its target, with priority rooms, a cap on simultaneous
pulses, compressor rests, an initial pull-down phase, and an external gate
that suspends non-priority pulses.
"""

from __future__ import annotations

import asyncio
from dataclasses import dataclass, field
from functools import partial
from datetime import datetime, timedelta
import logging
import math
from statistics import median as _statistics_median
from typing import TYPE_CHECKING, Any

from homeassistant.core import CALLBACK_TYPE, callback
from homeassistant.helpers.event import (
    async_track_point_in_time,
    async_track_state_change_event,
)
from homeassistant.util import dt as dt_util

from .const import (
    ACTION_SET_TEMPERATURE,
    EVENT_TYPE_HUMIDITY_ASSIST_STATE_CHANGED,
    MODE_AUTO,
    ZONE_PAUSE_ACTION_NONE,
    ZONE_PAUSE_ACTION_TURN_OFF,
)
from .models import (
    HUMIDITY_ASSIST_MEASURE_DEW_POINT,
    ClimateEvent,
    HumidityAssistData,
    HumidityAssistRuntimeData,
    HumidityAssistSettingsData,
    normalize_humidity_assist_data,
    normalize_humidity_assist_runtime_data,
    normalize_humidity_assist_settings,
)
from .temperature import (
    CELSIUS,
    absolute_temperature,
    state_temperature_unit,
    temperature_delta,
)

if TYPE_CHECKING:  # pragma: no cover - typing only
    from .scheduler import VelairScheduler

_LOGGER = logging.getLogger(__name__)

STATE_DISABLED = "disabled"
STATE_UNAVAILABLE = "unavailable"
STATE_BLOCKED_MANUAL = "blocked_manual"
STATE_BLOCKED_GATE = "blocked_gate"
STATE_WAITING = "waiting"
STATE_PULSING = "pulsing"
STATE_RESTING = "resting"

DECISION_DISABLED = "disabled"
DECISION_MANUAL_HOLD = "manual_hold"
DECISION_UNAVAILABLE = "unavailable"
DECISION_HOLD_ACTIVE = "hold_active"
DECISION_REST_BUDGET = "rest_budget"
DECISION_REST_MAX = "rest_max"
DECISION_REST_LOW = "rest_low"
DECISION_START = "start"
DECISION_HOLD_REST = "hold_rest"
DECISION_REST_ALIGN = "rest_align"

REST_DECISIONS = (DECISION_REST_BUDGET, DECISION_REST_MAX, DECISION_REST_LOW)

SOURCE_PULSE = "humidity_assist_pulse"
SOURCE_REST = "humidity_assist_rest"

DEBOUNCE_SECONDS = 20
MAX_SAMPLES = 720
MEDIAN_HISTORY_MINUTES = 10
PREVIOUS_MEDIAN_AGE = timedelta(minutes=2)

# Celsius-degree constants from the source controller. Dew-point zones scale
# them to the runtime unit; relative-humidity zones use them as percent points.
STOP_BUFFER_MIN_WIDENING_C = 0.2
PREDICTIVE_MARGIN_C = 0.2
TREND_EPSILON_C = 0.05
STOP_RAW_TOLERANCE_C = 0.15
STOP_DEEP_MARGIN_C = 0.4
MIN_DEW_POINT_GOAL_C = 18.0
PULSE_SETPOINT_TOLERANCE_C = 0.31


@dataclass
class _ZoneRuntime:
    """Runtime and persisted state for one zone."""

    state: str = STATE_DISABLED
    decision: str = DECISION_DISABLED
    last_evaluation: str = DECISION_DISABLED
    reason: str | None = None
    phase_started_at: datetime | None = None
    last_pulse_started_at: datetime | None = None
    last_pulse_ended_at: datetime | None = None
    pull_down_started_at: datetime | None = None
    last_median: float | None = None
    previous_state: dict[str, Any] | None = None
    samples: list[tuple[datetime, float]] = field(default_factory=list)
    median_history: list[tuple[datetime, float]] = field(default_factory=list)
    activation_override: bool = False
    rest_align_done: bool = False
    next_transition_at: datetime | None = None
    unsub_timer: CALLBACK_TYPE | None = None
    facts: dict[str, Any] = field(default_factory=dict)


@dataclass
class _ZoneFacts:
    """Evaluation inputs for one zone at one instant."""

    entity_id: str
    config: HumidityAssistData
    unit: str
    ready: bool
    reason: str | None
    blocked_manual: bool
    climate_available: bool
    valid: bool
    raw: float | None
    median: float | None
    median_previous: float | None
    target: float | None
    control_goal: float | None
    start_threshold: float | None
    stop_threshold: float | None
    stop_buffer: float
    pull_down_active: bool
    budget_limited: bool
    emergency_high: bool
    predictive_high: bool
    two_high: bool
    low_and_not_rising: bool
    pulsing: bool
    age_minutes: float
    min_on: float
    max_on: float
    min_off: float
    priority: bool
    excess: float | None
    activation_override: bool


class HumidityAssistCoordinator:
    """Cross-zone arbitration for Humidity Assist pulses."""

    def __init__(self, scheduler: VelairScheduler) -> None:
        self._scheduler = scheduler
        self._hass = scheduler._hass
        self._zones: dict[str, _ZoneRuntime] = {}
        self._lock = asyncio.Lock()
        self._started = False
        self._tracked_entities: tuple[str, ...] = ()
        self._unsub_listener: CALLBACK_TYPE | None = None
        self._unsub_refresh_timer: CALLBACK_TYPE | None = None
        self._refresh_due_at: datetime | None = None
        self._refresh_task_pending = False
        self._evaluating = False
        self._rerun_requested = False
        self._compliant = False
        self._load_persisted_runtime()

    # ------------------------------------------------------------------
    # Lifecycle
    # ------------------------------------------------------------------
    def _load_persisted_runtime(self) -> None:
        """Restore phase timestamps persisted with the scheduler data."""
        data = self._scheduler._data
        records = normalize_humidity_assist_runtime_data(
            data.get("humidity_assist_runtime"),
            list(data.get("zones", {})),
        )
        data["humidity_assist_runtime"] = records
        for entity_id, record in records.items():
            runtime = self._runtime(entity_id)
            runtime.state = record.get("state", STATE_DISABLED)
            runtime.decision = record.get("decision") or (
                DECISION_START if runtime.state == STATE_PULSING else DECISION_HOLD_REST
            )
            runtime.last_evaluation = runtime.decision
            runtime.phase_started_at = _parse_timestamp(record.get("phase_started_at"))
            runtime.last_pulse_started_at = _parse_timestamp(
                record.get("last_pulse_started_at")
            )
            runtime.last_pulse_ended_at = _parse_timestamp(
                record.get("last_pulse_ended_at")
            )
            runtime.pull_down_started_at = _parse_timestamp(
                record.get("pull_down_started_at")
            )
            runtime.last_median = record.get("last_median")
            runtime.previous_state = record.get("previous_state")
            if runtime.state == STATE_PULSING and runtime.last_pulse_started_at is None:
                runtime.state = STATE_WAITING

    async def async_start(self) -> None:
        """Register listeners and evaluate every zone once."""
        self._started = True
        self._seed_samples()
        self._refresh_listeners()
        await self.async_evaluate(reason="start")

    async def async_stop(self) -> None:
        """Stop listeners and timers; phase timestamps stay persisted."""
        self._started = False
        self._clear_listener()
        self._clear_refresh_timer()
        for runtime in self._zones.values():
            self._clear_zone_timer(runtime)

    def handle_unit_change(self) -> None:
        """Discard unit-bound samples; the next evaluation rebuilds them."""
        for runtime in self._zones.values():
            runtime.samples.clear()
            runtime.median_history.clear()
            runtime.last_median = None
            runtime.facts = {}
        self._seed_samples()
        self.schedule_refresh()

    # ------------------------------------------------------------------
    # Public projection used by the scheduler, API, and entities
    # ------------------------------------------------------------------
    def is_pulsing(self, entity_id: str) -> bool:
        """Return whether one zone is currently in a pulse."""
        runtime = self._zones.get(entity_id)
        return runtime is not None and runtime.state == STATE_PULSING

    def pulse_event(self, entity_id: str, now: datetime | None = None) -> ClimateEvent | None:
        """Return the pulse target that owns delivery while pulsing."""
        runtime = self._zones.get(entity_id)
        if runtime is None or runtime.state != STATE_PULSING:
            return None
        config = self._config(entity_id)
        if config["pulse_temperature"] is None:
            return None
        return self._build_pulse_event(entity_id, config, now or dt_util.now())

    def is_compliant(self) -> bool:
        """Return whether every enabled zone is at or below its target."""
        return self._compliant

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
        settings = self._settings()
        facts = runtime.facts if runtime is not None else {}
        state = runtime.state if runtime is not None else STATE_DISABLED
        payload: dict[str, Any] = {
            "state": state,
            "decision": runtime.decision if runtime is not None else DECISION_DISABLED,
            "last_evaluation": (
                runtime.last_evaluation if runtime is not None else DECISION_DISABLED
            ),
            "reason": runtime.reason if runtime is not None else None,
            "enabled": config["enabled"],
            "configured": bool(config["sensor_entity_id"] and config["target"] is not None),
            "sensor_entity_id": config["sensor_entity_id"],
            "measure": config["measure"],
            "unit": self._measure_unit(entity_id, config),
            "target": config["target"],
            "effective_target": facts.get("control_goal", config["target"]),
            "raw": facts.get("raw"),
            "median": facts.get("median"),
            "excess": facts.get("excess"),
            "priority": config["priority"],
            "pulse_temperature": config["pulse_temperature"],
            "pulse_hvac_mode": config["pulse_hvac_mode"],
            "pulse_fan_mode": config["pulse_fan_mode"],
            "gate_entity_id": settings["gate_entity_id"],
            "gate_active": self._gate_active(settings),
            "pull_down_active": bool(facts.get("pull_down_active", False)),
            "emergency_high": bool(facts.get("emergency_high", False)),
            "phase_started_at": _isoformat(runtime.phase_started_at if runtime else None),
            "last_pulse_started_at": _isoformat(
                runtime.last_pulse_started_at if runtime else None
            ),
            "last_pulse_ended_at": _isoformat(
                runtime.last_pulse_ended_at if runtime else None
            ),
            "next_transition_at": _isoformat(
                runtime.next_transition_at if runtime else None
            ),
        }
        return payload

    # ------------------------------------------------------------------
    # Configuration changes
    # ------------------------------------------------------------------
    async def async_config_changed(
        self,
        entity_id: str,
        previous: HumidityAssistData,
        current: HumidityAssistData,
    ) -> None:
        """React to a per-zone configuration change."""
        runtime = self._runtime(entity_id)
        if current["enabled"] and not previous["enabled"]:
            runtime.pull_down_started_at = dt_util.now()
            runtime.activation_override = True
        elif not current["enabled"] and previous["enabled"]:
            runtime.pull_down_started_at = None
            runtime.activation_override = False
        if previous["sensor_entity_id"] != current["sensor_entity_id"]:
            runtime.samples.clear()
            runtime.median_history.clear()
            runtime.last_median = None
        self._seed_samples()
        self._refresh_listeners()
        self._persist_runtime(entity_id)
        await self._scheduler._async_save_data()
        if self._started:
            await self.async_evaluate(reason="config")

    async def async_settings_changed(self) -> None:
        """React to a global parameter change."""
        self._refresh_listeners()
        if self._started:
            await self.async_evaluate(reason="settings")

    def schedule_refresh(self, delay_seconds: float = 0) -> None:
        """Schedule one coalesced evaluation after control state changes."""
        if not self._started:
            return
        if delay_seconds <= 0:
            if self._refresh_task_pending:
                return
            self._refresh_task_pending = True
            self._hass.async_create_task(self._async_run_scheduled_refresh())
            return
        due_at = dt_util.now() + timedelta(seconds=delay_seconds)
        if self._unsub_refresh_timer is not None:
            if self._refresh_due_at is not None and self._refresh_due_at <= due_at:
                return
            self._clear_refresh_timer()
        self._refresh_due_at = due_at
        self._unsub_refresh_timer = async_track_point_in_time(
            self._hass,
            self._handle_refresh_timer,
            due_at,
        )

    async def _async_run_scheduled_refresh(self) -> None:
        self._refresh_task_pending = False
        await self.async_evaluate(reason="refresh")

    @callback
    def _handle_refresh_timer(self, _now: datetime) -> None:
        self._unsub_refresh_timer = None
        self._refresh_due_at = None
        self._hass.async_create_task(self.async_evaluate(reason="debounce"))

    @callback
    def _handle_zone_timer(self, _now: datetime, *, entity_id: str) -> None:
        runtime = self._zones.get(entity_id)
        if runtime is not None:
            runtime.unsub_timer = None
            runtime.next_transition_at = None
        self._hass.async_create_task(self.async_evaluate(reason="timer"))

    # ------------------------------------------------------------------
    # Listeners and samples
    # ------------------------------------------------------------------
    def _refresh_listeners(self) -> None:
        entity_ids: set[str] = set()
        settings = self._settings()
        for entity_id in self._scheduler._data["zones"]:
            config = self._config(entity_id)
            if not config["enabled"] or not config["sensor_entity_id"]:
                continue
            entity_ids.add(config["sensor_entity_id"])
            entity_ids.add(entity_id)
        if entity_ids and settings["gate_entity_id"]:
            entity_ids.add(settings["gate_entity_id"])
        tracked = tuple(sorted(entity_ids))
        if tracked == self._tracked_entities:
            return
        self._clear_listener()
        self._tracked_entities = tracked
        if not tracked:
            return
        self._unsub_listener = async_track_state_change_event(
            self._hass,
            list(tracked),
            self._handle_state_change,
        )

    def _clear_listener(self) -> None:
        if self._unsub_listener is not None:
            self._unsub_listener()
            self._unsub_listener = None
        self._tracked_entities = ()

    def _clear_refresh_timer(self) -> None:
        if self._unsub_refresh_timer is not None:
            self._unsub_refresh_timer()
            self._unsub_refresh_timer = None
        self._refresh_due_at = None

    @callback
    def _handle_state_change(self, event) -> None:
        """Record sensor samples and schedule evaluation without polling."""
        data = getattr(event, "data", {}) or {}
        entity_id = data.get("entity_id")
        if not isinstance(entity_id, str) or entity_id not in self._tracked_entities:
            return
        settings = self._settings()
        if entity_id == settings["gate_entity_id"]:
            self.schedule_refresh()
            return
        for zone_entity_id in self._scheduler._data["zones"]:
            config = self._config(zone_entity_id)
            if config["sensor_entity_id"] != entity_id or not config["enabled"]:
                continue
            new_state = data.get("new_state")
            if new_state is None:
                new_state = self._hass.states.get(entity_id)
            value = self._reading_from_state(zone_entity_id, config, new_state)
            if value is not None:
                self._record_sample(zone_entity_id, value, dt_util.now())
        self.schedule_refresh(DEBOUNCE_SECONDS)

    def _seed_samples(self) -> None:
        """Seed an initial sample from the current sensor reading."""
        now = dt_util.now()
        for entity_id in self._scheduler._data["zones"]:
            config = self._config(entity_id)
            if not config["enabled"] or not config["sensor_entity_id"]:
                continue
            runtime = self._runtime(entity_id)
            if runtime.samples:
                continue
            value = self._reading(entity_id, config)
            if value is not None:
                self._record_sample(entity_id, value, now)

    def _record_sample(self, entity_id: str, value: float, when: datetime) -> None:
        runtime = self._runtime(entity_id)
        runtime.samples.append((when, value))
        window = timedelta(minutes=self._settings()["median_window_minutes"])
        cutoff = when - window
        runtime.samples = [
            sample for sample in runtime.samples if sample[0] >= cutoff
        ][-MAX_SAMPLES:]

    def rolling_median(self, entity_id: str, now: datetime | None = None) -> float | None:
        """Return the median of samples inside the configured window."""
        runtime = self._zones.get(entity_id)
        if runtime is None:
            return None
        now = now or dt_util.now()
        window = timedelta(minutes=self._settings()["median_window_minutes"])
        values = [value for when, value in runtime.samples if now - when <= window]
        if not values:
            return None
        return float(_statistics_median(values))

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
        gate_on = self._gate_active(settings)
        facts = {
            entity_id: self._zone_facts(entity_id, now, settings, gate_on)
            for entity_id in self._scheduler._data["zones"]
        }
        priority_waiting = any(
            item.priority
            and item.ready
            and not item.blocked_manual
            and item.climate_available
            and not item.pulsing
            and item.age_minutes >= item.min_off
            and item.two_high
            for item in facts.values()
        )
        active_count = sum(
            1 for item in facts.values() if item.pulsing and not item.blocked_manual
        )
        ordered = sorted(
            facts.values(),
            key=lambda item: (
                not item.priority,
                -(item.excess if item.excess is not None else -math.inf),
                item.entity_id,
            ),
        )
        changed = False
        persist = False
        for item in ordered:
            decision, next_state = self._decide(
                item, settings, priority_waiting, active_count
            )
            if decision == DECISION_START:
                active_count += 1
            elif decision in REST_DECISIONS:
                active_count -= 1
            transition_changed, transition_persist = await self._async_apply_transition(
                item, decision, next_state, now
            )
            changed = changed or transition_changed
            persist = persist or transition_persist
        self._record_medians(facts, now)
        self._update_compliance(facts)
        self._reschedule_timers(facts, now)
        if persist:
            await self._scheduler._async_save_data()
        if changed:
            self._scheduler._async_write_state()
        _LOGGER.debug("Humidity Assist evaluated (%s): %s", reason, {
            entity_id: (self._zones[entity_id].state, self._zones[entity_id].decision)
            for entity_id in facts
            if entity_id in self._zones
        })

    def _decide(
        self,
        item: _ZoneFacts,
        settings: HumidityAssistSettingsData,
        priority_waiting: bool,
        active_count: int,
    ) -> tuple[str, str]:
        """Return (decision, next_state) for one zone."""
        if not item.ready:
            return DECISION_DISABLED, STATE_DISABLED
        if item.blocked_manual:
            return DECISION_MANUAL_HOLD, STATE_BLOCKED_MANUAL
        if not item.climate_available:
            return DECISION_UNAVAILABLE, STATE_UNAVAILABLE
        if item.pulsing:
            if item.age_minutes >= item.max_on:
                return DECISION_REST_MAX, STATE_RESTING
            if item.age_minutes >= item.min_on and item.low_and_not_rising:
                return DECISION_REST_LOW, STATE_RESTING
            if (
                item.age_minutes >= item.min_on
                and item.budget_limited
                and not item.priority
                and not item.emergency_high
            ):
                return DECISION_REST_BUDGET, STATE_RESTING
            return DECISION_HOLD_ACTIVE, STATE_PULSING
        if not item.valid:
            return DECISION_UNAVAILABLE, STATE_UNAVAILABLE
        priority_allowed = item.priority or (
            not priority_waiting
            and (not item.budget_limited or item.emergency_high)
        )
        start_ready = (
            (item.activation_override or item.age_minutes >= item.min_off)
            and item.two_high
            and priority_allowed
            and active_count < settings["max_simultaneous_pulses"]
        )
        if start_ready:
            return DECISION_START, STATE_PULSING
        gated = item.budget_limited and not item.priority and not item.emergency_high
        if item.age_minutes < item.min_off:
            next_state = STATE_RESTING
        elif gated:
            next_state = STATE_BLOCKED_GATE
        else:
            next_state = STATE_WAITING
        if self._needs_rest_alignment(item):
            return DECISION_REST_ALIGN, next_state
        return DECISION_HOLD_REST, next_state

    def _needs_rest_alignment(self, item: _ZoneFacts) -> bool:
        """Return whether the device still sits at the pulse setpoint."""
        runtime = self._zones.get(item.entity_id)
        if runtime is None or runtime.rest_align_done:
            return False
        if runtime.last_pulse_ended_at is None:
            return False
        pulse_temperature = item.config["pulse_temperature"]
        if pulse_temperature is None:
            return False
        state = self._hass.states.get(item.entity_id)
        if state is None or getattr(state, "state", None) != item.config["pulse_hvac_mode"]:
            return False
        attributes = getattr(state, "attributes", {}) or {}
        try:
            current = float(attributes.get("temperature"))
        except (TypeError, ValueError):
            return False
        tolerance = temperature_delta(PULSE_SETPOINT_TOLERANCE_C, CELSIUS, item.unit)
        if abs(current - pulse_temperature) > tolerance:
            return False
        if self._scheduler._resolve_authoritative_delivery_event(item.entity_id) is None:
            return runtime.previous_state is not None
        return True

    async def _async_apply_transition(
        self,
        item: _ZoneFacts,
        decision: str,
        next_state: str,
        now: datetime,
    ) -> tuple[bool, bool]:
        """Apply one decision; return (state_changed, persist_needed)."""
        entity_id = item.entity_id
        runtime = self._runtime(entity_id)
        previous_state = runtime.state
        previous_decision = runtime.decision
        runtime.last_evaluation = decision
        # ``decision`` explains the current phase: hold decisions never hide
        # the transition that started it unless the state itself changes.
        if previous_state != next_state or decision not in (
            DECISION_HOLD_ACTIVE,
            DECISION_HOLD_REST,
        ):
            runtime.decision = decision
        runtime.reason = item.reason
        runtime.facts = {
            "raw": item.raw,
            "median": item.median,
            "median_previous": item.median_previous,
            "excess": item.excess,
            "control_goal": item.control_goal,
            "start_threshold": item.start_threshold,
            "stop_threshold": item.stop_threshold,
            "pull_down_active": item.pull_down_active,
            "budget_limited": item.budget_limited,
            "emergency_high": item.emergency_high,
            "two_high": item.two_high,
            "low_and_not_rising": item.low_and_not_rising,
            "valid": item.valid,
            "ready": item.ready,
            "target": item.target,
        }
        persist = False
        changed = previous_state != next_state or previous_decision != decision

        if decision == DECISION_START:
            runtime.last_pulse_started_at = now
            runtime.phase_started_at = now
            runtime.activation_override = False
            runtime.rest_align_done = False
            runtime.previous_state = self._climate_snapshot(entity_id)
            runtime.state = STATE_PULSING
            self._begin_pulse_ownership(entity_id)
            self._persist_runtime(entity_id)
            persist = True
            self._fire_state_changed(entity_id, previous_state, item)
            await self._async_logbook_pulse(entity_id, item, started=True)
            await self._async_apply_pulse(entity_id, item.config, now)
            return True, persist

        if decision in REST_DECISIONS:
            runtime.last_pulse_ended_at = now
            runtime.phase_started_at = now
            runtime.state = next_state
            runtime.rest_align_done = True
            self._end_pulse_ownership(entity_id)
            self._persist_runtime(entity_id)
            persist = True
            self._fire_state_changed(entity_id, previous_state, item)
            await self._async_logbook_pulse(entity_id, item, started=False, decision=decision)
            await self._async_apply_rest(entity_id)
            return True, persist

        if previous_state == STATE_PULSING and next_state != STATE_PULSING:
            # Interrupted pulse: manual/pause authority, unavailable climate,
            # or the feature was disabled. Record the rest boundary.
            runtime.last_pulse_ended_at = now
            runtime.phase_started_at = now
            runtime.state = next_state
            runtime.rest_align_done = True
            self._end_pulse_ownership(entity_id)
            self._persist_runtime(entity_id)
            persist = True
            self._fire_state_changed(entity_id, previous_state, item)
            if next_state == STATE_DISABLED:
                await self._async_apply_rest(entity_id)
            return True, persist

        if decision == DECISION_REST_ALIGN:
            runtime.rest_align_done = True
            self._scheduler._invalidate_climate_delivery(entity_id)
            if previous_state != next_state:
                runtime.state = next_state
                runtime.phase_started_at = now
                self._persist_runtime(entity_id)
                persist = True
                self._fire_state_changed(entity_id, previous_state, item)
            await self._async_apply_rest(entity_id)
            return True, persist

        if previous_state != next_state:
            runtime.state = next_state
            runtime.phase_started_at = now
            if next_state == STATE_DISABLED:
                runtime.facts = {}
            self._persist_runtime(entity_id)
            persist = True
            self._fire_state_changed(entity_id, previous_state, item)
        return changed, persist

    async def _async_apply_pulse(
        self,
        entity_id: str,
        config: HumidityAssistData,
        now: datetime,
    ) -> None:
        event = self._build_pulse_event(entity_id, config, now)
        try:
            await self._scheduler._async_apply_event(event, source=SOURCE_PULSE)
        except Exception:  # pragma: no cover - delivery failures are logged
            _LOGGER.exception("Humidity Assist pulse failed for %s", entity_id)
        finally:
            # The physical call path force-refreshes Room Assist, which drops
            # suppression; a pulse keeps owning the setpoint until it ends.
            if self.is_pulsing(entity_id):
                self._scheduler._room_sensor_assist_suppressed.add(entity_id)

    async def _async_apply_rest(self, entity_id: str) -> None:
        """Re-apply whatever is authoritative below the pulse tier."""
        scheduler = self._scheduler
        runtime = self._runtime(entity_id)
        try:
            event = scheduler._resolve_authoritative_delivery_event(entity_id)
            if event is not None:
                await scheduler._async_apply_event(event, source=SOURCE_REST)
                return
            snapshot = runtime.previous_state
            if (
                snapshot
                and scheduler.mode == MODE_AUTO
                and not scheduler._stopped
                and not scheduler.temperature_migration_blocked
                and not scheduler._is_external_execution(entity_id)
                and not scheduler._is_zone_override_active(entity_id, dt_util.now())
            ):
                await scheduler._climate_manager.async_restore_state(entity_id, snapshot)
        except Exception:  # pragma: no cover - delivery failures are logged
            _LOGGER.exception("Humidity Assist rest failed for %s", entity_id)
        finally:
            refresh = getattr(
                scheduler, "_async_refresh_room_sensor_assist_from_current_event", None
            )
            if callable(refresh) and entity_id in scheduler._room_sensor_assist_candidate_climates():
                self._hass.async_create_task(refresh(entity_id))

    def _begin_pulse_ownership(self, entity_id: str) -> None:
        self._scheduler._room_sensor_assist_suppressed.add(entity_id)
        self._scheduler._invalidate_climate_delivery(entity_id)

    def _end_pulse_ownership(self, entity_id: str) -> None:
        self._scheduler._room_sensor_assist_suppressed.discard(entity_id)
        self._scheduler._invalidate_climate_delivery(entity_id)

    def _build_pulse_event(
        self,
        entity_id: str,
        config: HumidityAssistData,
        now: datetime,
    ) -> ClimateEvent:
        return ClimateEvent(
            entity_id=entity_id,
            when=now,
            temperature=config["pulse_temperature"],
            weekday=None,
            start=None,
            action=ACTION_SET_TEMPERATURE,
            hvac_mode=config["pulse_hvac_mode"],
            fan_mode=config["pulse_fan_mode"],
        )

    def _climate_snapshot(self, entity_id: str) -> dict[str, Any] | None:
        snapshot_getter = getattr(self._scheduler._climate_manager, "climate_state_snapshot", None)
        if not callable(snapshot_getter):
            return None
        try:
            snapshot = snapshot_getter(entity_id)
        except Exception:  # pragma: no cover - defensive
            return None
        return dict(snapshot) if isinstance(snapshot, dict) and snapshot else None

    # ------------------------------------------------------------------
    # Facts
    # ------------------------------------------------------------------
    def _zone_facts(
        self,
        entity_id: str,
        now: datetime,
        settings: HumidityAssistSettingsData,
        gate_on: bool,
    ) -> _ZoneFacts:
        config = self._config(entity_id)
        runtime = self._runtime(entity_id)
        unit = self._unit(entity_id)
        dew_point = config["measure"] == HUMIDITY_ASSIST_MEASURE_DEW_POINT

        def scale(value_c: float) -> float:
            return temperature_delta(value_c, CELSIUS, unit) if dew_point else value_c

        reason: str | None = None
        if not config["enabled"]:
            reason = "disabled"
        elif not config["sensor_entity_id"]:
            reason = "no_sensor"
        elif config["target"] is None:
            reason = "no_target"
        elif config["pulse_temperature"] is None:
            reason = "no_pulse_temperature"
        ready = reason is None
        pulsing = runtime.state == STATE_PULSING

        blocked_manual = ready and self._blocked_manual(entity_id, now)
        climate_state = self._hass.states.get(entity_id)
        climate_available = climate_state is not None and getattr(
            climate_state, "state", None
        ) not in (None, "unknown", "unavailable")
        if ready and not climate_available:
            reason = "climate_unavailable"

        raw = self._reading(entity_id, config) if ready else None
        median_now = self.rolling_median(entity_id, now) if ready else None
        if median_now is None and raw is not None:
            median_now = raw
        median_previous = self._median_previous(runtime, now)
        if median_previous is None:
            median_previous = median_now
        valid = ready and raw is not None and median_now is not None
        if ready and climate_available and not valid:
            reason = "sensor_unavailable"

        target = config["target"]
        pull_down_active = self._pull_down_active(runtime, settings, now)
        budget_limited = gate_on and not pull_down_active
        offset = settings["initial_pull_down_target_offset"] if pull_down_active else 0.0
        control_goal: float | None = None
        start_threshold: float | None = None
        stop_threshold: float | None = None
        start_buffer = settings["start_buffer"]
        stop_buffer = max(
            settings["stop_buffer"],
            start_buffer + scale(STOP_BUFFER_MIN_WIDENING_C),
        )
        if target is not None:
            control_goal = target - offset
            if dew_point:
                control_goal = max(
                    absolute_temperature(MIN_DEW_POINT_GOAL_C, CELSIUS, unit),
                    control_goal,
                )
            start_threshold = control_goal - start_buffer
            stop_threshold = control_goal - stop_buffer

        predictive_high = False
        two_high = False
        low_and_not_rising = False
        emergency_high = False
        excess: float | None = None
        if valid and target is not None:
            assert raw is not None and median_now is not None and median_previous is not None
            assert control_goal is not None and start_threshold is not None
            assert stop_threshold is not None
            trend = scale(TREND_EPSILON_C)
            predictive_high = (
                median_now >= start_threshold - scale(PREDICTIVE_MARGIN_C)
                and median_now > median_previous + trend
            )
            two_high = (
                (median_now >= start_threshold and median_previous >= start_threshold)
                or raw >= control_goal
                or predictive_high
            )
            low_and_not_rising = (
                (
                    median_now <= stop_threshold
                    and raw <= stop_threshold + scale(STOP_RAW_TOLERANCE_C)
                    and median_now <= median_previous + trend
                )
                or (
                    raw <= stop_threshold
                    and median_now <= start_threshold
                    and median_now <= median_previous - trend
                )
                or (
                    raw <= stop_threshold - scale(STOP_DEEP_MARGIN_C)
                    and median_now <= target
                    and median_now <= median_previous + trend
                )
            )
            margin = (
                settings["emergency_margin_priority"]
                if config["priority"]
                else settings["emergency_margin_standard"]
            )
            emergency_high = max(raw, median_now) >= target + margin
            excess = round(max(raw, median_now) - target, 6)

        min_on = float(settings["min_on_minutes"])
        max_on = max(
            float(settings["max_on_minutes"]),
            min_on,
            float(settings["initial_pull_down_max_run_minutes"]) if pull_down_active else 0.0,
        )
        min_off = float(settings["min_off_minutes"])
        anchor = runtime.last_pulse_started_at if pulsing else runtime.last_pulse_ended_at
        age_minutes = (
            (now - anchor).total_seconds() / 60 if anchor is not None else math.inf
        )

        return _ZoneFacts(
            entity_id=entity_id,
            config=config,
            unit=unit,
            ready=ready,
            reason=reason,
            blocked_manual=blocked_manual,
            climate_available=climate_available,
            valid=valid,
            raw=raw,
            median=median_now,
            median_previous=median_previous,
            target=target,
            control_goal=control_goal,
            start_threshold=start_threshold,
            stop_threshold=stop_threshold,
            stop_buffer=stop_buffer,
            pull_down_active=pull_down_active,
            budget_limited=budget_limited,
            emergency_high=emergency_high,
            predictive_high=predictive_high,
            two_high=two_high,
            low_and_not_rising=low_and_not_rising,
            pulsing=pulsing,
            age_minutes=age_minutes,
            min_on=min_on,
            max_on=max_on,
            min_off=min_off,
            priority=config["priority"],
            excess=excess,
            activation_override=runtime.activation_override,
        )

    def _blocked_manual(self, entity_id: str, now: datetime) -> bool:
        """Return whether a higher authority owns the zone right now."""
        scheduler = self._scheduler
        zone = scheduler._data["zones"].get(entity_id)
        if zone is None or not zone.get("enabled", True):
            return True
        if (
            scheduler.mode != MODE_AUTO
            or scheduler._stopped
            or scheduler.temperature_migration_blocked
            or scheduler._is_external_execution(entity_id)
        ):
            return True
        if scheduler._manual_control_status(entity_id, now) is not None:
            return True
        override = scheduler._get_active_zone_override(entity_id, now)
        if isinstance(override, dict):
            if override.get("type") == "pause":
                if override.get("action") in (
                    ZONE_PAUSE_ACTION_NONE,
                    ZONE_PAUSE_ACTION_TURN_OFF,
                ):
                    return True
            elif override.get("type") == "boost":
                return True
        behavior = scheduler._profile_zone_behavior(entity_id)
        return behavior.get("behavior") == "pause"

    @staticmethod
    def _pull_down_active(
        runtime: _ZoneRuntime,
        settings: HumidityAssistSettingsData,
        now: datetime,
    ) -> bool:
        window = settings["initial_pull_down_window_minutes"]
        started = runtime.pull_down_started_at
        if window <= 0 or started is None:
            return False
        age = (now - started).total_seconds() / 60
        return 0 <= age < window

    @staticmethod
    def _median_previous(runtime: _ZoneRuntime, now: datetime) -> float | None:
        history = runtime.median_history
        if history:
            aged = [value for when, value in history if now - when >= PREVIOUS_MEDIAN_AGE]
            if aged:
                return aged[-1]
            return history[0][1]
        return runtime.last_median

    def _record_medians(self, facts: dict[str, _ZoneFacts], now: datetime) -> None:
        cutoff = now - timedelta(minutes=MEDIAN_HISTORY_MINUTES)
        for entity_id, item in facts.items():
            runtime = self._runtime(entity_id)
            if item.median is None:
                continue
            runtime.median_history.append((now, item.median))
            trimmed = [entry for entry in runtime.median_history if entry[0] >= cutoff]
            runtime.median_history = trimmed or runtime.median_history[-1:]
            runtime.last_median = item.median

    def _update_compliance(self, facts: dict[str, _ZoneFacts]) -> None:
        enabled = [item for item in facts.values() if item.ready]
        self._compliant = bool(enabled) and all(
            item.valid
            and item.target is not None
            and item.raw is not None
            and item.median is not None
            and item.raw <= item.target
            and item.median <= item.target
            for item in enabled
        )

    # ------------------------------------------------------------------
    # Timers
    # ------------------------------------------------------------------
    def _reschedule_timers(self, facts: dict[str, _ZoneFacts], now: datetime) -> None:
        settings = self._settings()
        for entity_id, item in facts.items():
            runtime = self._runtime(entity_id)
            candidates: list[datetime] = []
            if item.ready and not item.blocked_manual:
                if item.pulsing and runtime.last_pulse_started_at is not None:
                    started = runtime.last_pulse_started_at
                    candidates.append(started + timedelta(minutes=item.min_on))
                    candidates.append(started + timedelta(minutes=item.max_on))
                elif runtime.last_pulse_ended_at is not None:
                    candidates.append(
                        runtime.last_pulse_ended_at + timedelta(minutes=item.min_off)
                    )
                if item.pull_down_active and runtime.pull_down_started_at is not None:
                    candidates.append(
                        runtime.pull_down_started_at
                        + timedelta(minutes=settings["initial_pull_down_window_minutes"])
                    )
            future = [when for when in candidates if when > now]
            next_at = min(future) if future else None
            if next_at == runtime.next_transition_at and (
                runtime.unsub_timer is not None or next_at is None
            ):
                continue
            self._clear_zone_timer(runtime)
            runtime.next_transition_at = next_at
            if next_at is None:
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

    def _config(self, entity_id: str) -> HumidityAssistData:
        zone = self._scheduler._data["zones"].get(entity_id) or {}
        return normalize_humidity_assist_data(zone.get("humidity_assist"))

    def _settings(self) -> HumidityAssistSettingsData:
        settings = self._scheduler._data.get("settings") or {}
        return normalize_humidity_assist_settings(settings.get("humidity_assist"))

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

    def _measure_unit(self, entity_id: str, config: HumidityAssistData) -> str:
        if config["measure"] == HUMIDITY_ASSIST_MEASURE_DEW_POINT:
            return self._unit(entity_id)
        return "%"

    def _gate_active(self, settings: HumidityAssistSettingsData) -> bool:
        gate = settings["gate_entity_id"]
        if not gate:
            return False
        state = self._hass.states.get(gate)
        return getattr(state, "state", None) == "on"

    def _reading(self, entity_id: str, config: HumidityAssistData) -> float | None:
        sensor = config["sensor_entity_id"]
        if not sensor:
            return None
        return self._reading_from_state(entity_id, config, self._hass.states.get(sensor))

    def _reading_from_state(
        self,
        entity_id: str,
        config: HumidityAssistData,
        state,
    ) -> float | None:
        value = _state_numeric(state)
        if value is None:
            return None
        if config["measure"] != HUMIDITY_ASSIST_MEASURE_DEW_POINT:
            return value
        unit = self._unit(entity_id)
        source_unit = state_temperature_unit(state, unit)
        return round(absolute_temperature(value, source_unit, unit), 6)

    def _persist_runtime(self, entity_id: str) -> None:
        runtime = self._runtime(entity_id)
        record: HumidityAssistRuntimeData = {
            "state": runtime.state,
            "decision": runtime.decision,
            "phase_started_at": _isoformat(runtime.phase_started_at),
            "last_pulse_started_at": _isoformat(runtime.last_pulse_started_at),
            "last_pulse_ended_at": _isoformat(runtime.last_pulse_ended_at),
            "pull_down_started_at": _isoformat(runtime.pull_down_started_at),
            "last_median": runtime.last_median,
            "previous_state": runtime.previous_state,
        }
        store = self._scheduler._data.setdefault("humidity_assist_runtime", {})
        store[entity_id] = record

    def _fire_state_changed(
        self,
        entity_id: str,
        previous_state: str,
        item: _ZoneFacts,
    ) -> None:
        runtime = self._runtime(entity_id)
        self._scheduler._async_fire_event(
            EVENT_TYPE_HUMIDITY_ASSIST_STATE_CHANGED,
            {
                "entity_id": entity_id,
                "previous_state": previous_state,
                "state": runtime.state,
                "decision": runtime.decision,
                "target": item.target,
                "raw": item.raw,
                "median": item.median,
                "next_transition_at": _isoformat(runtime.next_transition_at),
            },
        )

    async def _async_logbook_pulse(
        self,
        entity_id: str,
        item: _ZoneFacts,
        *,
        started: bool,
        decision: str | None = None,
    ) -> None:
        scheduler = self._scheduler
        name = scheduler._friendly_entity_name(entity_id)
        unit = self._measure_unit(entity_id, item.config)
        median = f"{item.median:.1f}{unit}" if item.median is not None else "?"
        if started:
            message = scheduler._message(
                f"Humidity Assist pulse started for {name} (median {median})",
                f"Impulso de Humidity Assist iniciado en {name} (mediana {median})",
            )
        else:
            message = scheduler._message(
                f"Humidity Assist pulse ended for {name}: {decision} (median {median})",
                f"Impulso de Humidity Assist finalizado en {name}: {decision} (mediana {median})",
            )
        try:
            await scheduler._async_logbook(message, entity_id=entity_id)
        except Exception:  # pragma: no cover - logbook is best effort
            _LOGGER.debug("Humidity Assist logbook entry failed", exc_info=True)


def _state_numeric(state) -> float | None:
    """Return a finite numeric state value."""
    if state is None:
        return None
    raw = getattr(state, "state", None)
    if raw in (None, "unknown", "unavailable", ""):
        return None
    try:
        value = float(raw)
    except (TypeError, ValueError):
        return None
    return value if math.isfinite(value) else None


def _parse_timestamp(value: Any) -> datetime | None:
    if not isinstance(value, str) or not value:
        return None
    parsed = dt_util.parse_datetime(value)
    if parsed is None:
        return None
    return dt_util.as_local(parsed)


def _isoformat(value: datetime | None) -> str | None:
    return value.isoformat() if value is not None else None
