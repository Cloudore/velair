"""Humidity Assist state machine, coordinator, and boundary tests."""

from __future__ import annotations

import asyncio
from copy import deepcopy
from datetime import timedelta
import importlib
import sys
from types import SimpleNamespace
import unittest
from unittest.mock import AsyncMock, Mock, patch

from . import helpers
from .helpers import (
    ACTION_SET_TEMPERATURE,
    EVENT_VELAIR,
    NOW,
    FakeClimateManager,
    FakeHass,
    VelairScheduler,
    empty_week_schedule,
    normalize_schedule_data,
    scheduler_module,
)

humidity_module = importlib.import_module("custom_components.velair.humidity_assist")
models_module = helpers.models_module
const_module = helpers.const_module
storage_module = importlib.import_module("custom_components.velair.storage")
api_module = importlib.import_module("custom_components.velair.api")
services_module = importlib.import_module("custom_components.velair.services")

LIVING = "climate.living"
DEN = "climate.den"
GUEST = "climate.guest"
GATE = "input_boolean.budget_exhausted"


def _sensor_id(entity_id: str) -> str:
    return f"sensor.{entity_id.split('.')[1]}_dew_point"


class HumidityAssistTestCase(unittest.IsolatedAsyncioTestCase):
    """Shared fixture: three cooling zones on a 29 degree rest schedule."""

    zones = (LIVING, DEN, GUEST)

    def setUp(self) -> None:
        self.hass = FakeHass()
        self.climate = FakeClimateManager()
        self.save_count = 0
        self.data = normalize_schedule_data(
            {
                "zones": {
                    entity_id: {
                        "enabled": True,
                        "schedule": {
                            **empty_week_schedule(),
                            "tuesday": [
                                {
                                    "start": "00:00",
                                    "action": ACTION_SET_TEMPERATURE,
                                    "temperature": 29,
                                    "hvac_mode": "cool",
                                }
                            ],
                        },
                        "humidity_assist": {
                            "enabled": True,
                            "sensor_entity_id": _sensor_id(entity_id),
                            "measure": "dew_point",
                            "target": 22.0,
                            "priority": entity_id == LIVING,
                            "pulse_temperature": 24.0,
                            "pulse_hvac_mode": "cool",
                        },
                    }
                    for entity_id in self.zones
                },
            },
            list(self.zones),
        )
        for entity_id in self.zones:
            self.hass.states[entity_id] = SimpleNamespace(
                state="cool",
                attributes={"temperature": 29, "current_temperature": 27, "fan_mode": "auto"},
            )
            self._sensor(entity_id, 21.0)
        self.scheduler = VelairScheduler(
            self.hass,
            self.data,
            self.climate,
            self._async_save,
        )
        self.coordinator = self.scheduler._humidity_assist
        self._set_time(NOW)

    def tearDown(self) -> None:
        scheduler_module.dt_util.now = lambda: NOW

    async def _async_save(self) -> None:
        self.save_count += 1

    def _set_time(self, when) -> None:
        scheduler_module.dt_util.now = lambda: when

    def _sensor(self, entity_id: str, value: float, *, unit: str = "°C") -> None:
        self.hass.states[_sensor_id(entity_id)] = SimpleNamespace(
            state=str(value),
            attributes={"unit_of_measurement": unit, "device_class": "temperature"},
        )

    def _settings(self, **updates) -> None:
        self.data["settings"]["humidity_assist"] = {
            **self.data["settings"]["humidity_assist"],
            **updates,
        }

    def _config(self, entity_id: str, **updates) -> None:
        self.data["zones"][entity_id]["humidity_assist"] = {
            **self.data["zones"][entity_id]["humidity_assist"],
            **updates,
        }

    async def _start(self) -> None:
        await self.scheduler.async_start()
        await asyncio.sleep(0)

    async def _evaluate(self, when=None) -> None:
        if when is not None:
            self._set_time(when)
        await self.coordinator.async_evaluate()
        await asyncio.sleep(0)

    def _state(self, entity_id: str) -> str:
        return self.coordinator.status(entity_id)["state"]

    def _decision(self, entity_id: str) -> str:
        return self.coordinator.status(entity_id)["decision"]

    def _evaluation(self, entity_id: str) -> str:
        return self.coordinator.status(entity_id)["last_evaluation"]

    def _pulse_calls(self, entity_id: str) -> list[tuple]:
        return [
            call for call in self.climate.calls
            if call[0] == "set_temperature" and call[1] == entity_id and call[2] == 24.0
        ]

    def _rest_calls(self, entity_id: str) -> list[tuple]:
        return [
            call for call in self.climate.calls
            if call[0] == "set_temperature" and call[1] == entity_id and call[2] == 29.0
        ]

    def _events(self, name: str = "humidity_assist_state_changed") -> list[dict]:
        return [
            payload
            for event_type, payload in self.hass.bus.events
            if event_type == EVENT_VELAIR and payload.get("event") == name
        ]

    def _applied_events(self, source: str) -> list[dict]:
        return [
            payload
            for payload in self._events("climate_target_applied")
            if payload.get("source") == source
        ]

    def _high(self, entity_id: str, value: float = 22.5) -> None:
        """Push a zone clearly above its start threshold with a settled median."""
        self._sensor(entity_id, value)
        runtime = self.coordinator._runtime(entity_id)
        runtime.samples = [(NOW - timedelta(minutes=5), value), (NOW, value)]
        runtime.median_history = [(NOW - timedelta(minutes=4), value)]
        runtime.last_median = value

    def _low(self, entity_id: str, value: float = 20.0) -> None:
        """Push a zone below its stop threshold with a settled median."""
        self._sensor(entity_id, value)
        runtime = self.coordinator._runtime(entity_id)
        runtime.samples = [(NOW - timedelta(minutes=5), value), (NOW, value)]
        runtime.median_history = [(NOW - timedelta(minutes=4), value)]
        runtime.last_median = value


class DecisionLadderTest(HumidityAssistTestCase):
    """One test per ladder branch."""

    async def test_start_pulses_when_median_and_previous_exceed_start_threshold(self) -> None:
        self._high(GUEST, 22.0)
        await self._start()

        self.assertEqual(self._state(GUEST), "pulsing")
        self.assertEqual(self._decision(GUEST), "start")
        self.assertEqual(
            self._pulse_calls(GUEST),
            [("set_temperature", GUEST, 24.0, True, "cool")],
        )
        self.assertEqual(
            [event["source"] for event in self._applied_events("humidity_assist_pulse")],
            ["humidity_assist_pulse"],
        )
        change = [event for event in self._events() if event["entity_id"] == GUEST][0]
        self.assertEqual(change["previous_state"], "disabled")
        self.assertEqual(change["state"], "pulsing")
        self.assertEqual(change["decision"], "start")
        self.assertEqual(change["target"], 22.0)
        self.assertEqual(change["raw"], 22.0)
        self.assertEqual(change["median"], 22.0)
        self.assertIn("next_transition_at", change)
        self.assertEqual(
            self.data["humidity_assist_runtime"][GUEST]["last_pulse_started_at"],
            NOW.isoformat(),
        )
        self.assertGreaterEqual(self.save_count, 1)

    async def test_start_uses_raw_at_control_goal_even_with_low_median(self) -> None:
        self._low(GUEST, 21.0)
        self._sensor(GUEST, 22.0)
        await self._start()

        self.assertEqual(self._decision(GUEST), "start")

    async def test_start_uses_predictive_rise_below_threshold(self) -> None:
        runtime = self.coordinator._runtime(GUEST)
        runtime.samples = [(NOW - timedelta(minutes=5), 21.7), (NOW, 21.7)]
        runtime.median_history = [(NOW - timedelta(minutes=4), 21.55)]
        self._sensor(GUEST, 21.7)
        await self._start()

        # start_threshold = 21.8; median 21.7 >= 21.6 and rising by > 0.05.
        self.assertEqual(self._decision(GUEST), "start")

    async def test_hold_active_keeps_pulse_before_minimum_on_time(self) -> None:
        self._high(GUEST)
        await self._start()
        self._low(GUEST)
        await self._evaluate(NOW + timedelta(minutes=5))

        self.assertEqual(self._state(GUEST), "pulsing")
        self.assertEqual(self._evaluation(GUEST), "hold_active")
        self.assertEqual(self._decision(GUEST), "start")
        self.assertEqual(len(self._rest_calls(GUEST)), 0)

    async def test_rest_low_after_minimum_on_when_low_and_not_rising(self) -> None:
        self._high(GUEST)
        await self._start()
        self._low(GUEST)
        await self._evaluate(NOW + timedelta(minutes=10))

        self.assertEqual(self._state(GUEST), "resting")
        self.assertEqual(self._decision(GUEST), "rest_low")
        self.assertEqual(
            self._rest_calls(GUEST),
            [("set_temperature", GUEST, 29.0, True, "cool")],
        )
        self.assertEqual(
            [event["source"] for event in self._applied_events("humidity_assist_rest")],
            ["humidity_assist_rest"],
        )
        self.assertEqual(
            self.data["humidity_assist_runtime"][GUEST]["last_pulse_ended_at"],
            (NOW + timedelta(minutes=10)).isoformat(),
        )

    async def test_rest_max_ends_pulse_at_maximum_on_even_while_high(self) -> None:
        self._high(GUEST)
        await self._start()
        self._high(GUEST, 23.0)
        await self._evaluate(NOW + timedelta(minutes=20))

        self.assertEqual(self._state(GUEST), "resting")
        self.assertEqual(self._decision(GUEST), "rest_max")
        self.assertEqual(len(self._rest_calls(GUEST)), 1)

    async def test_rest_budget_ends_standard_pulse_when_gate_turns_on(self) -> None:
        self._settings(gate_entity_id=GATE)
        self.hass.states[GATE] = SimpleNamespace(state="off", attributes={})
        self._high(GUEST, 22.2)
        await self._start()
        self.assertEqual(self._state(GUEST), "pulsing")

        self.hass.states[GATE] = SimpleNamespace(state="on", attributes={})
        await self._evaluate(NOW + timedelta(minutes=5))
        self.assertEqual(self._evaluation(GUEST), "hold_active")

        await self._evaluate(NOW + timedelta(minutes=10))
        self.assertEqual(self._decision(GUEST), "rest_budget")
        self.assertEqual(self._state(GUEST), "resting")

    async def test_rest_budget_spares_priority_and_emergency_zones(self) -> None:
        self._settings(gate_entity_id=GATE, max_simultaneous_pulses=3)
        self.hass.states[GATE] = SimpleNamespace(state="on", attributes={})
        self._high(LIVING)
        self._high(GUEST, 22.6)  # emergency: >= 22 + 0.5
        await self._start()
        self.assertEqual(self._state(LIVING), "pulsing")
        self.assertEqual(self._state(GUEST), "pulsing")

        await self._evaluate(NOW + timedelta(minutes=12))
        self.assertEqual(self._evaluation(LIVING), "hold_active")
        self.assertEqual(self._evaluation(GUEST), "hold_active")
        self.assertEqual(self._state(LIVING), "pulsing")
        self.assertEqual(self._state(GUEST), "pulsing")

    async def test_rest_align_reapplies_rest_when_device_still_at_pulse_setpoint(self) -> None:
        self._high(GUEST)
        await self._start()
        self._low(GUEST)
        await self._evaluate(NOW + timedelta(minutes=10))
        self.assertEqual(self._state(GUEST), "resting")
        rest_calls = len(self._rest_calls(GUEST))

        # The device reports the pulse setpoint again, e.g. after a lost write.
        self.hass.states[GUEST] = SimpleNamespace(
            state="cool", attributes={"temperature": 24, "current_temperature": 26}
        )
        self.coordinator._runtime(GUEST).rest_align_done = False
        await self._evaluate(NOW + timedelta(minutes=11))

        self.assertEqual(self._decision(GUEST), "rest_align")
        self.assertEqual(len(self._rest_calls(GUEST)), rest_calls + 1)

        await self._evaluate(NOW + timedelta(minutes=12))
        self.assertEqual(self._evaluation(GUEST), "hold_rest")

    async def test_hold_rest_while_waiting_below_threshold(self) -> None:
        self._low(GUEST)
        await self._start()

        self.assertEqual(self._state(GUEST), "waiting")
        self.assertEqual(self._decision(GUEST), "hold_rest")
        self.assertEqual(self.climate.calls, [])

    async def test_manual_hold_blocks_pulse_and_interrupts_active_pulse(self) -> None:
        self._high(GUEST)
        await self._start()
        self.assertEqual(self._state(GUEST), "pulsing")

        self.climate.snapshots[GUEST] = {"hvac_mode": "cool", "temperature": 24.0}
        self._set_time(NOW + timedelta(minutes=1))
        await self.scheduler.async_enter_manual_adjustment(GUEST)
        await asyncio.sleep(0)
        await self._evaluate(NOW + timedelta(minutes=1))

        self.assertEqual(self._state(GUEST), "blocked_manual")
        self.assertEqual(self._decision(GUEST), "manual_hold")
        self.assertIsNone(self.scheduler._humidity_assist.pulse_event(GUEST))
        self.assertIsNone(self.scheduler._resolve_authoritative_delivery_event(GUEST))
        # Interrupted pulses record their end so the compressor rest applies.
        self.assertEqual(
            self.data["humidity_assist_runtime"][GUEST]["last_pulse_ended_at"],
            (NOW + timedelta(minutes=1)).isoformat(),
        )

    async def test_pause_with_action_none_or_turn_off_blocks_pulsing(self) -> None:
        self._high(GUEST)
        self._high(DEN)
        self.data["zones"][GUEST]["pauses"] = [
            {"started_at": NOW.isoformat(), "action": "none", "pause_id": "guard"}
        ]
        self.data["zones"][GUEST]["override"] = {"type": "pause", "action": "none"}
        self.data["zones"][DEN]["pauses"] = [
            {"started_at": NOW.isoformat(), "action": "turn_off", "pause_id": "window"}
        ]
        self.data["zones"][DEN]["override"] = {"type": "pause", "action": "turn_off"}
        await self._start()

        self.assertEqual(self._state(GUEST), "blocked_manual")
        self.assertEqual(self._state(DEN), "blocked_manual")
        self.assertEqual(self._pulse_calls(GUEST), [])
        self.assertEqual(self._pulse_calls(DEN), [])

    async def test_unavailable_climate_or_sensor(self) -> None:
        self._high(GUEST)
        self.hass.states[GUEST] = SimpleNamespace(state="unavailable", attributes={})
        self.hass.states[_sensor_id(DEN)] = SimpleNamespace(state="unknown", attributes={})
        await self._start()

        self.assertEqual(self._state(GUEST), "unavailable")
        self.assertEqual(self._decision(GUEST), "unavailable")
        self.assertEqual(self.coordinator.status(GUEST)["reason"], "climate_unavailable")
        self.assertEqual(self._state(DEN), "unavailable")
        self.assertEqual(self.coordinator.status(DEN)["reason"], "sensor_unavailable")
        self.assertEqual(self.climate.calls, [])

    async def test_disabled_without_sensor_target_or_pulse_temperature(self) -> None:
        self._config(GUEST, sensor_entity_id=None)
        self._config(DEN, target=None)
        self._config(LIVING, pulse_temperature=None)
        await self._start()

        for entity_id, reason in ((GUEST, "no_sensor"), (DEN, "no_target"), (LIVING, "no_pulse_temperature")):
            status = self.coordinator.status(entity_id)
            self.assertEqual(status["state"], "disabled")
            self.assertEqual(status["reason"], reason)


class ArbitrationTest(HumidityAssistTestCase):
    """Cross-zone arbitration: simultaneous cap, priority, and gate."""

    async def test_max_simultaneous_and_priority_ordering(self) -> None:
        self._settings(max_simultaneous_pulses=2)
        self._high(LIVING, 22.2)  # priority, smallest excess
        self._high(DEN, 22.8)     # standard, largest excess
        self._high(GUEST, 22.4)   # standard, medium excess
        await self._start()

        self.assertEqual(self._state(LIVING), "pulsing")
        self.assertEqual(self._state(DEN), "pulsing")
        self.assertEqual(self._state(GUEST), "waiting")
        self.assertEqual(self._decision(GUEST), "hold_rest")
        pulse_order = [call[1] for call in self.climate.calls if call[2] == 24.0]
        self.assertEqual(pulse_order, [LIVING, DEN])

        # A slot frees up when the priority zone rests; the waiting zone starts.
        self._low(LIVING)
        await self._evaluate(NOW + timedelta(minutes=10))
        self.assertEqual(self._state(LIVING), "resting")
        self.assertEqual(self._state(GUEST), "pulsing")

    async def test_priority_zone_waiting_blocks_standard_start(self) -> None:
        self._settings(max_simultaneous_pulses=2)
        self._high(LIVING)
        self._high(GUEST)
        # Priority zone still inside its rest period: waiting but not eligible.
        living_runtime = self.coordinator._runtime(LIVING)
        living_runtime.last_pulse_ended_at = NOW - timedelta(minutes=2)
        await self._start()

        self.assertEqual(self._state(LIVING), "resting")
        self.assertEqual(self._state(GUEST), "pulsing")

        # Once the priority zone is eligible but not yet started, standard zones yield.
        self._low(GUEST)
        await self._evaluate(NOW + timedelta(minutes=10))
        self.assertEqual(self._state(GUEST), "resting")
        self.assertEqual(self._state(LIVING), "pulsing")
        den_runtime = self.coordinator._runtime(DEN)
        self._high(DEN)
        self._high(LIVING)
        self.coordinator._runtime(LIVING).state = "waiting"
        self.coordinator._runtime(LIVING).last_pulse_ended_at = NOW - timedelta(hours=1)
        self.coordinator._runtime(LIVING).last_pulse_started_at = None
        self.data["zones"][LIVING]["pauses"] = []
        # Simulate a full house: the priority zone cannot start (cap reached by others)
        self._settings(max_simultaneous_pulses=1)
        self.coordinator._runtime(GUEST).state = "pulsing"
        self.coordinator._runtime(GUEST).last_pulse_started_at = NOW + timedelta(minutes=9)
        await self._evaluate(NOW + timedelta(minutes=11))
        self.assertEqual(self._state(LIVING), "waiting")
        self.assertEqual(self._decision(DEN), "hold_rest")
        self.assertNotEqual(den_runtime.state, "pulsing")

    async def test_gate_blocks_standard_zones_unless_emergency(self) -> None:
        self._settings(gate_entity_id=GATE, max_simultaneous_pulses=3)
        self.hass.states[GATE] = SimpleNamespace(state="on", attributes={})
        self._high(LIVING, 22.2)   # priority: pulses regardless of the gate
        self._high(DEN, 22.2)      # standard, no emergency: gated
        self._high(GUEST, 22.7)    # standard, emergency (>= 22.5): pulses
        await self._start()

        self.assertEqual(self._state(LIVING), "pulsing")
        self.assertEqual(self._state(DEN), "blocked_gate")
        self.assertEqual(self._decision(DEN), "hold_rest")
        self.assertEqual(self._state(GUEST), "pulsing")
        self.assertTrue(self.coordinator.status(GUEST)["emergency_high"])
        self.assertTrue(self.coordinator.status(DEN)["gate_active"])

        self.hass.states[GATE] = SimpleNamespace(state="off", attributes={})
        await self._evaluate(NOW + timedelta(seconds=30))
        self.assertEqual(self._state(DEN), "pulsing")

    async def test_gate_is_ignored_during_initial_pull_down(self) -> None:
        self._settings(gate_entity_id=GATE)
        self.hass.states[GATE] = SimpleNamespace(state="on", attributes={})
        self.coordinator._runtime(DEN).pull_down_started_at = NOW - timedelta(minutes=10)
        self._high(DEN, 22.2)
        await self._start()

        self.assertEqual(self._state(DEN), "pulsing")
        self.assertFalse(self.coordinator.status(DEN)["gate_active"] and self.coordinator._runtime(DEN).facts["budget_limited"])


class ThresholdTest(HumidityAssistTestCase):
    """Buffers, pull-down, median, and rest timing."""

    async def test_stop_buffer_is_widened_to_start_buffer_plus_margin(self) -> None:
        self._settings(start_buffer=0.6, stop_buffer=0.5)
        self._high(GUEST)
        await self._start()
        facts = self.coordinator._runtime(GUEST).facts

        # start = 22 - 0.6 = 21.4, stop uses max(0.5, 0.6 + 0.2) = 0.8 -> 21.2
        self.assertAlmostEqual(facts["start_threshold"], 21.4)
        self.assertAlmostEqual(facts["stop_threshold"], 21.2)

        # 21.3 is below start but above the widened stop: the pulse keeps going.
        self._low(GUEST, 21.3)
        await self._evaluate(NOW + timedelta(minutes=10))
        self.assertEqual(self._evaluation(GUEST), "hold_active")
        self.assertEqual(self._state(GUEST), "pulsing")

    async def test_initial_pull_down_lowers_target_and_extends_maximum_run(self) -> None:
        self._settings(
            initial_pull_down_window_minutes=90,
            initial_pull_down_max_run_minutes=45,
            initial_pull_down_target_offset=0.6,
        )
        self.coordinator._runtime(GUEST).pull_down_started_at = NOW
        # 21.7 is above the pulled-down start threshold (21.4 - 0.2 = 21.2)
        self._high(GUEST, 21.7)
        await self._start()

        status = self.coordinator.status(GUEST)
        self.assertTrue(status["pull_down_active"])
        self.assertAlmostEqual(status["effective_target"], 21.4)
        self.assertEqual(self._state(GUEST), "pulsing")

        # Still high after the normal 20 minute maximum: the pull-down allows 45.
        await self._evaluate(NOW + timedelta(minutes=25))
        self.assertEqual(self._evaluation(GUEST), "hold_active")
        await self._evaluate(NOW + timedelta(minutes=45))
        self.assertEqual(self._decision(GUEST), "rest_max")

        # After the window, the base target applies again and 21.7 is compliant.
        self._high(GUEST, 21.7)
        await self._evaluate(NOW + timedelta(minutes=100))
        self.assertFalse(self.coordinator.status(GUEST)["pull_down_active"])
        self.assertAlmostEqual(self.coordinator.status(GUEST)["effective_target"], 22.0)
        self.assertNotEqual(self._state(GUEST), "pulsing")

    async def test_enable_starts_pull_down_and_bypasses_minimum_off(self) -> None:
        self._config(GUEST, enabled=False)
        await self._start()
        self.assertEqual(self._state(GUEST), "disabled")
        self.coordinator._runtime(GUEST).last_pulse_ended_at = NOW - timedelta(minutes=1)
        self._high(GUEST)

        await self.scheduler.async_update_zone_humidity_assist(GUEST, {"enabled": True})
        await asyncio.sleep(0)

        runtime = self.coordinator._runtime(GUEST)
        self.assertEqual(runtime.pull_down_started_at, NOW)
        self.assertEqual(self._state(GUEST), "pulsing")

    async def test_rolling_median_uses_window_and_expires_old_samples(self) -> None:
        self._settings(median_window_minutes=15)
        runtime = self.coordinator._runtime(GUEST)
        runtime.samples = [
            (NOW - timedelta(minutes=20), 30.0),  # outside the window
            (NOW - timedelta(minutes=10), 21.0),
            (NOW - timedelta(minutes=5), 23.0),
            (NOW, 22.0),
        ]

        self.assertEqual(self.coordinator.rolling_median(GUEST, NOW), 22.0)
        self.assertEqual(
            self.coordinator.rolling_median(GUEST, NOW + timedelta(minutes=7)),
            22.5,
        )
        self.assertIsNone(
            self.coordinator.rolling_median(GUEST, NOW + timedelta(minutes=40)),
        )

    async def test_state_change_records_samples_and_debounces_refresh(self) -> None:
        original_tracker = humidity_module.async_track_state_change_event
        original_timer = humidity_module.async_track_point_in_time
        tracker = Mock(return_value=Mock())
        timer = Mock(return_value=Mock())
        humidity_module.async_track_state_change_event = tracker
        humidity_module.async_track_point_in_time = timer
        self.addCleanup(setattr, humidity_module, "async_track_state_change_event", original_tracker)
        self.addCleanup(setattr, humidity_module, "async_track_point_in_time", original_timer)
        self._settings(gate_entity_id=GATE)
        await self._start()

        tracked = tracker.call_args.args[1]
        self.assertEqual(
            sorted(tracked),
            sorted([*self.zones, *(_sensor_id(zone) for zone in self.zones), GATE]),
        )

        self.coordinator._handle_state_change(
            SimpleNamespace(
                data={
                    "entity_id": _sensor_id(GUEST),
                    "new_state": SimpleNamespace(state="23.4", attributes={"unit_of_measurement": "°C"}),
                }
            )
        )
        self.assertEqual(self.coordinator._runtime(GUEST).samples[-1][1], 23.4)
        debounce_calls = [
            call for call in timer.call_args_list
            if call.args[2] == NOW + timedelta(seconds=humidity_module.DEBOUNCE_SECONDS)
        ]
        self.assertEqual(len(debounce_calls), 1)

    async def test_minimum_off_is_enforced_and_timer_scheduled(self) -> None:
        original_timer = humidity_module.async_track_point_in_time
        timer = Mock(return_value=Mock())
        humidity_module.async_track_point_in_time = timer
        self.addCleanup(setattr, humidity_module, "async_track_point_in_time", original_timer)
        self._high(GUEST)
        await self._start()
        self._low(GUEST)
        await self._evaluate(NOW + timedelta(minutes=10))
        self.assertEqual(self._state(GUEST), "resting")
        self.assertEqual(
            self.coordinator.status(GUEST)["next_transition_at"],
            (NOW + timedelta(minutes=20)).isoformat(),
        )
        self.assertIn(
            NOW + timedelta(minutes=20),
            [call.args[2] for call in timer.call_args_list],
        )

        self._high(GUEST, 23.0)
        await self._evaluate(NOW + timedelta(minutes=15))
        self.assertEqual(self._state(GUEST), "resting")
        self.assertEqual(self._evaluation(GUEST), "hold_rest")
        self.assertEqual(self._decision(GUEST), "rest_low")

        await self._evaluate(NOW + timedelta(minutes=20))
        self.assertEqual(self._state(GUEST), "pulsing")

    async def test_pulse_timers_cover_minimum_and_maximum_on(self) -> None:
        original_timer = humidity_module.async_track_point_in_time
        timer = Mock(return_value=Mock())
        humidity_module.async_track_point_in_time = timer
        self.addCleanup(setattr, humidity_module, "async_track_point_in_time", original_timer)
        self._high(GUEST)
        await self._start()

        self.assertEqual(
            self.coordinator.status(GUEST)["next_transition_at"],
            (NOW + timedelta(minutes=10)).isoformat(),
        )
        await self._evaluate(NOW + timedelta(minutes=10))
        self.assertEqual(
            self.coordinator.status(GUEST)["next_transition_at"],
            (NOW + timedelta(minutes=20)).isoformat(),
        )


class ContinuityTest(HumidityAssistTestCase):
    """Restart, compliance, disable, and runtime projections."""

    async def test_restart_continues_pulse_from_persisted_timestamps(self) -> None:
        self._high(GUEST)
        await self._start()
        persisted = deepcopy(self.data)
        persisted["humidity_assist_runtime"] = deepcopy(self.data["humidity_assist_runtime"])
        self.assertEqual(persisted["humidity_assist_runtime"][GUEST]["state"], "pulsing")

        restarted_hass = FakeHass()
        restarted_hass.states.update(self.hass.states)
        restarted_climate = FakeClimateManager()
        restarted = VelairScheduler(
            restarted_hass,
            normalize_schedule_data(models_module.serialize_schedule_data(persisted), list(self.zones)),
            restarted_climate,
            self._async_save,
        )
        coordinator = restarted._humidity_assist
        self.assertEqual(coordinator.status(GUEST)["state"], "pulsing")
        self._set_time(NOW + timedelta(minutes=8))
        self.assertEqual(
            restarted._resolve_authoritative_delivery_event(GUEST).temperature,
            24.0,
        )
        await restarted.async_start()
        await asyncio.sleep(0)
        self.assertEqual(coordinator.status(GUEST)["decision"], "start")
        self.assertEqual(coordinator.status(GUEST)["last_evaluation"], "hold_active")
        self.assertEqual(
            coordinator.status(GUEST)["last_pulse_started_at"],
            NOW.isoformat(),
        )

        self._set_time(NOW + timedelta(minutes=20))
        await coordinator.async_evaluate()
        await asyncio.sleep(0)
        self.assertEqual(coordinator.status(GUEST)["decision"], "rest_max")
        self.assertEqual(
            [call for call in restarted_climate.calls if call[2] == 29.0],
            [("set_temperature", GUEST, 29.0, True, "cool")],
        )

    async def test_compliance_requires_raw_and_median_at_or_below_target(self) -> None:
        self._low(LIVING, 21.0)
        self._low(DEN, 21.5)
        self._low(GUEST, 22.0)
        await self._start()
        self.assertTrue(self.scheduler.humidity_assist_compliant)

        self._sensor(GUEST, 22.1)
        await self._evaluate(NOW + timedelta(seconds=30))
        self.assertFalse(self.scheduler.humidity_assist_compliant)

        self._config(GUEST, enabled=False)
        await self._evaluate(NOW + timedelta(seconds=60))
        self.assertTrue(self.scheduler.humidity_assist_compliant)

        for entity_id in self.zones:
            self._config(entity_id, enabled=False)
        await self._evaluate(NOW + timedelta(seconds=90))
        self.assertFalse(self.scheduler.humidity_assist_compliant)

    async def test_disable_ends_pulse_and_restores_rest(self) -> None:
        self._high(GUEST)
        await self._start()
        self.assertEqual(self._state(GUEST), "pulsing")

        await self.scheduler.async_set_humidity_assist(GUEST, False)
        await asyncio.sleep(0)

        self.assertEqual(self._state(GUEST), "disabled")
        self.assertEqual(
            self._rest_calls(GUEST),
            [("set_temperature", GUEST, 29.0, True, "cool")],
        )
        self.assertIsNone(self.coordinator._runtime(GUEST).pull_down_started_at)

    async def test_rest_restores_previous_state_when_nothing_is_authoritative(self) -> None:
        self.data["zones"][GUEST]["schedule"] = empty_week_schedule()
        self.climate.snapshots[GUEST] = {"hvac_mode": "cool", "temperature": 29.0}
        self._high(GUEST)
        await self._start()
        self.assertEqual(self._state(GUEST), "pulsing")

        self._low(GUEST)
        await self._evaluate(NOW + timedelta(minutes=10))
        self.assertEqual(self._state(GUEST), "resting")
        self.assertIn(
            ("restore_state", GUEST, {"hvac_mode": "cool", "temperature": 29.0}),
            self.climate.calls,
        )

    async def test_zone_runtime_status_reports_drying_and_pulse_target(self) -> None:
        self._high(GUEST)
        await self._start()

        status = self.scheduler.get_zone_runtime_statuses()[GUEST]
        self.assertEqual(status["state"], "drying")
        self.assertEqual(status["target_temperature"], 24.0)
        self.assertEqual(self.scheduler.get_zone_runtime_statuses()[DEN]["state"], "scheduled")

    async def test_pulse_applies_fan_mode_and_dry_mode(self) -> None:
        self._config(GUEST, pulse_hvac_mode="dry", pulse_fan_mode="auto")
        self._high(GUEST)
        await self._start()

        self.assertEqual(
            [call for call in self.climate.calls if call[1] == GUEST][0],
            (
                "set_temperature",
                GUEST,
                24.0,
                True,
                "dry",
                {
                    "fan_mode": "auto",
                    "humidity": None,
                    "preset_mode": None,
                    "swing_mode": None,
                    "swing_horizontal_mode": None,
                },
            ),
        )

    async def test_status_payload_exposes_decision_context(self) -> None:
        self._high(GUEST)
        await self._start()
        status = self.scheduler.get_humidity_assist_status(GUEST)

        self.assertEqual(status["state"], "pulsing")
        self.assertEqual(status["decision"], "start")
        self.assertEqual(status["target"], 22.0)
        self.assertEqual(status["effective_target"], 22.0)
        self.assertEqual(status["raw"], 22.5)
        self.assertEqual(status["median"], 22.5)
        self.assertAlmostEqual(status["excess"], 0.5)
        self.assertFalse(status["priority"])
        self.assertEqual(status["phase_started_at"], NOW.isoformat())
        self.assertEqual(status["pulse_temperature"], 24.0)
        self.assertEqual(status["sensor_entity_id"], _sensor_id(GUEST))
        self.assertFalse(status["gate_active"])
        self.assertFalse(status["pull_down_active"])
        self.assertEqual(status["unit"], "°C")

    async def test_stop_clears_timers_and_start_is_idempotent(self) -> None:
        self._high(GUEST)
        await self._start()
        await self.scheduler.async_stop()
        self.assertFalse(self.coordinator._started)
        self.assertIsNone(self.coordinator._runtime(GUEST).unsub_timer)


class FahrenheitTest(HumidityAssistTestCase):
    """Unit handling for pulse temperatures and dew-point conversions."""

    async def test_fahrenheit_installation_converts_sensor_and_scales_buffers(self) -> None:
        self.climate.temperature_unit = lambda entity_id: "°F"
        self.climate.limits[GUEST] = (60.0, 90.0)
        self._config(LIVING, enabled=False)
        self._config(DEN, enabled=False)
        # Rest schedule and pulse temperature are stored in Fahrenheit.
        self.data["zones"][GUEST]["schedule"]["tuesday"][0]["temperature"] = 84.0
        self._config(GUEST, target=71.6, pulse_temperature=75.0)
        self._settings(start_buffer=0.36, stop_buffer=1.08)
        # A Celsius dew point sensor: 22.5 C = 72.5 F, above the 71.6 F target.
        self._sensor(GUEST, 22.5, unit="°C")
        runtime = self.coordinator._runtime(GUEST)
        runtime.samples = [(NOW - timedelta(minutes=5), 72.5), (NOW, 72.5)]
        runtime.median_history = [(NOW - timedelta(minutes=4), 72.5)]
        await self._start()

        status = self.coordinator.status(GUEST)
        self.assertEqual(status["unit"], "°F")
        self.assertAlmostEqual(status["raw"], 72.5)
        self.assertEqual(self._state(GUEST), "pulsing")
        self.assertEqual(
            [call for call in self.climate.calls if call[1] == GUEST][0],
            ("set_temperature", GUEST, 75.0, True, "cool"),
        )
        facts = runtime.facts
        self.assertAlmostEqual(facts["start_threshold"], 71.6 - 0.36)
        # stop buffer widening uses 0.2 C = 0.36 F
        self.assertAlmostEqual(facts["stop_threshold"], 71.6 - 1.08)

    def test_storage_converts_pulse_temperature_targets_and_buffers(self) -> None:
        data = {
            "zones": {
                GUEST: {
                    "humidity_assist": {
                        "measure": "dew_point",
                        "target": 22.0,
                        "pulse_temperature": 24.0,
                    }
                },
                DEN: {
                    "humidity_assist": {
                        "measure": "relative_humidity",
                        "target": 60.0,
                        "pulse_temperature": 23.0,
                    }
                },
            },
            "settings": {
                "humidity_assist": {
                    "start_buffer": 0.2,
                    "stop_buffer": 0.6,
                    "emergency_margin_priority": 0.3,
                    "emergency_margin_standard": 0.5,
                    "initial_pull_down_target_offset": 0.6,
                    "min_on_minutes": 10,
                }
            },
        }
        storage_module._convert_scheduler_temperatures(data, "°C", "°F")

        guest = data["zones"][GUEST]["humidity_assist"]
        den = data["zones"][DEN]["humidity_assist"]
        self.assertAlmostEqual(guest["target"], 71.6)
        self.assertAlmostEqual(guest["pulse_temperature"], 75.2)
        self.assertEqual(den["target"], 60.0)
        self.assertAlmostEqual(den["pulse_temperature"], 73.4)
        settings = data["settings"]["humidity_assist"]
        self.assertAlmostEqual(settings["start_buffer"], 0.36)
        self.assertAlmostEqual(settings["stop_buffer"], 1.08)
        self.assertAlmostEqual(settings["emergency_margin_priority"], 0.54)
        self.assertAlmostEqual(settings["initial_pull_down_target_offset"], 1.08)
        self.assertEqual(settings["min_on_minutes"], 10)


class NormalizationTest(unittest.TestCase):
    """Tolerant normalization of garbage configuration."""

    def test_zone_config_repairs_garbage(self) -> None:
        normalized = models_module.normalize_humidity_assist_data(
            {
                "enabled": "yes",
                "sensor_entity_id": "   ",
                "measure": "absolute",
                "target": "warm",
                "priority": 1,
                "pulse_temperature": 9999,
                "pulse_hvac_mode": "heat",
                "pulse_fan_mode": "  ",
            }
        )
        self.assertEqual(
            normalized,
            {
                "enabled": True,
                "sensor_entity_id": None,
                "measure": "dew_point",
                "target": None,
                "priority": True,
                "pulse_temperature": None,
                "pulse_hvac_mode": "cool",
                "pulse_fan_mode": None,
            },
        )
        self.assertEqual(
            models_module.normalize_humidity_assist_data("garbage")["enabled"],
            False,
        )
        relative = models_module.normalize_humidity_assist_data(
            {"measure": "relative_humidity", "target": 150}
        )
        self.assertIsNone(relative["target"])

    def test_settings_repair_garbage_and_keep_max_on_above_min_on(self) -> None:
        settings = models_module.normalize_humidity_assist_settings(
            {
                "start_buffer": "x",
                "stop_buffer": -3,
                "min_on_minutes": 30,
                "max_on_minutes": 5,
                "min_off_minutes": "10",
                "max_simultaneous_pulses": 0,
                "emergency_margin_priority": None,
                "median_window_minutes": 100000,
                "initial_pull_down_window_minutes": -1,
                "gate_entity_id": "not-an-entity",
            }
        )
        self.assertEqual(settings["start_buffer"], 0.2)
        self.assertEqual(settings["stop_buffer"], 0.0)
        self.assertEqual(settings["min_on_minutes"], 30)
        self.assertEqual(settings["max_on_minutes"], 30)
        self.assertEqual(settings["min_off_minutes"], 10)
        self.assertEqual(settings["max_simultaneous_pulses"], 1)
        self.assertEqual(settings["emergency_margin_priority"], 0.3)
        self.assertEqual(settings["median_window_minutes"], 240)
        self.assertEqual(settings["initial_pull_down_window_minutes"], 0)
        self.assertIsNone(settings["gate_entity_id"])
        self.assertEqual(
            models_module.normalize_humidity_assist_settings(None),
            {
                "start_buffer": 0.2,
                "stop_buffer": 0.6,
                "min_on_minutes": 10,
                "max_on_minutes": 20,
                "min_off_minutes": 10,
                "max_simultaneous_pulses": 2,
                "emergency_margin_priority": 0.3,
                "emergency_margin_standard": 0.5,
                "median_window_minutes": 15,
                "initial_pull_down_window_minutes": 90,
                "initial_pull_down_max_run_minutes": 45,
                "initial_pull_down_target_offset": 0.6,
                "gate_entity_id": None,
            },
        )

    def test_runtime_records_drop_unknown_zones_and_bad_timestamps(self) -> None:
        records = models_module.normalize_humidity_assist_runtime_data(
            {
                GUEST: {
                    "state": "pulsing",
                    "last_pulse_started_at": "not a date",
                    "last_pulse_ended_at": NOW.isoformat(),
                    "last_median": "22.4",
                    "previous_state": {"hvac_mode": "cool", "temperature": 29},
                },
                "climate.unknown": {"state": "pulsing"},
                DEN: "garbage",
            },
            [GUEST, DEN],
        )
        self.assertEqual(set(records), {GUEST})
        self.assertEqual(records[GUEST]["state"], "pulsing")
        self.assertIsNone(records[GUEST]["last_pulse_started_at"])
        self.assertEqual(records[GUEST]["last_pulse_ended_at"], NOW.isoformat())
        self.assertEqual(records[GUEST]["last_median"], 22.4)
        self.assertEqual(
            records[GUEST]["previous_state"],
            {"hvac_mode": "cool", "temperature": 29.0},
        )

    def test_schedule_data_round_trips_humidity_assist_sections(self) -> None:
        data = normalize_schedule_data(
            {
                "zones": {GUEST: {"humidity_assist": {"enabled": True, "target": 21}}},
                "settings": {"humidity_assist": {"min_on_minutes": 12}},
                "humidity_assist_runtime": {GUEST: {"state": "resting"}},
            },
            [GUEST, DEN],
        )
        self.assertTrue(data["zones"][GUEST]["humidity_assist"]["enabled"])
        self.assertFalse(data["zones"][DEN]["humidity_assist"]["enabled"])
        self.assertEqual(data["settings"]["humidity_assist"]["min_on_minutes"], 12)
        self.assertEqual(data["humidity_assist_runtime"][GUEST]["state"], "resting")
        serialized = models_module.serialize_schedule_data(data)
        self.assertEqual(serialized["humidity_assist_runtime"][GUEST]["state"], "resting")
        self.assertIn("humidity_assist", serialized["zones"][GUEST])


class ServiceAndApiTest(unittest.IsolatedAsyncioTestCase):
    """Service registration/forwarding and WebSocket schemas."""

    class _ServiceRegistry:
        def __init__(self) -> None:
            self.handlers: dict[tuple[str, str], tuple[object, object]] = {}
            self.removed: list[tuple[str, str]] = []

        def has_service(self, domain: str, service: str) -> bool:
            return (domain, service) in self.handlers

        def async_register(self, domain, service, handler, *, schema=None) -> None:
            self.handlers[(domain, service)] = (handler, schema)

        def async_remove(self, domain: str, service: str) -> None:
            self.removed.append((domain, service))

    def setUp(self) -> None:
        self.scheduler = SimpleNamespace(
            async_set_humidity_assist=AsyncMock(),
            async_update_zone_humidity_assist=AsyncMock(),
            humidity_assist_candidate_entities=lambda: [LIVING, DEN],
            ensure_managed_entity=Mock(),
            set_temperature_migration_blocked=Mock(),
            temperature_migration_blocked=False,
        )
        self.services = self._ServiceRegistry()
        self.hass = SimpleNamespace(
            services=self.services,
            data={
                const_module.DOMAIN: {
                    "entry": {
                        "scheduler": self.scheduler,
                        "storage": SimpleNamespace(temperature_migration_required=False),
                        "operation_active": None,
                        "operation_recovery": None,
                    }
                }
            },
        )

    async def test_enable_and_disable_services_target_one_or_every_configured_zone(self) -> None:
        await services_module.async_setup_services(self.hass)
        enable, _schema = self.services.handlers[
            (const_module.DOMAIN, const_module.SERVICE_ENABLE_HUMIDITY_ASSIST)
        ]
        disable, _schema = self.services.handlers[
            (const_module.DOMAIN, const_module.SERVICE_DISABLE_HUMIDITY_ASSIST)
        ]

        await enable(SimpleNamespace(data={"entity_id": [GUEST]}))
        await enable(SimpleNamespace(data={}))
        await disable(SimpleNamespace(data={}))

        self.assertEqual(
            [call.args for call in self.scheduler.async_set_humidity_assist.await_args_list],
            [(GUEST, True), (LIVING, True), (DEN, True), (LIVING, False), (DEN, False)],
        )
        await services_module.async_unload_services(self.hass)
        self.assertIn(
            (const_module.DOMAIN, const_module.SERVICE_SET_HUMIDITY_ASSIST),
            self.services.removed,
        )

    async def test_set_service_forwards_fields_and_maps_errors(self) -> None:
        await services_module.async_setup_services(self.hass)
        handler, _schema = self.services.handlers[
            (const_module.DOMAIN, const_module.SERVICE_SET_HUMIDITY_ASSIST)
        ]
        await handler(
            SimpleNamespace(
                data={"entity_id": GUEST, "target": 21.5, "priority": True, "pulse_hvac_mode": "dry"}
            )
        )
        self.scheduler.async_update_zone_humidity_assist.assert_awaited_once_with(
            GUEST, {"target": 21.5, "priority": True, "pulse_hvac_mode": "dry"}
        )
        self.scheduler.async_update_zone_humidity_assist.side_effect = ValueError("needs a sensor")
        with self.assertRaisesRegex(services_module.HomeAssistantError, "needs a sensor"):
            await handler(SimpleNamespace(data={"entity_id": GUEST, "enabled": True}))

    async def test_ws_update_zone_humidity_assist_forwards_and_reports_errors(self) -> None:
        runtime = {
            "scheduler": self.scheduler,
            "storage": SimpleNamespace(
                temperature_migration_required=False,
                data={"settings": {"humidity_assist": {"min_on_minutes": 10}}},
            ),
            "operation_active": None,
            "operation_recovery": None,
        }
        original_get_runtime = api_module._get_runtime
        original_build = api_module._build_schedule_response
        api_module._get_runtime = lambda _hass: runtime
        api_module._build_schedule_response = lambda _runtime: {"ok": True}
        self.addCleanup(setattr, api_module, "_get_runtime", original_get_runtime)
        self.addCleanup(setattr, api_module, "_build_schedule_response", original_build)
        connection = SimpleNamespace(send_result=Mock(), send_error=Mock())

        await api_module.ws_update_zone_humidity_assist(
            SimpleNamespace(),
            connection,
            {
                "id": 7,
                "type": "velair/update_zone_humidity_assist",
                "entity_id": GUEST,
                "humidity_assist": {"enabled": True, "target": 22},
            },
        )
        self.scheduler.async_update_zone_humidity_assist.assert_awaited_once_with(
            GUEST, {"enabled": True, "target": 22}
        )
        connection.send_result.assert_called_once_with(7, {"ok": True})

        self.scheduler.async_update_zone_humidity_assist.side_effect = ValueError("bad target")
        await api_module.ws_update_zone_humidity_assist(
            SimpleNamespace(),
            connection,
            {
                "id": 8,
                "type": "velair/update_zone_humidity_assist",
                "entity_id": GUEST,
                "humidity_assist": {"target": 99},
            },
        )
        connection.send_error.assert_called_once_with(8, "invalid_humidity_assist", "bad target")

    async def test_ws_update_settings_merges_humidity_assist_parameters(self) -> None:
        scheduler = SimpleNamespace(async_update_settings=AsyncMock())
        runtime = {
            "scheduler": scheduler,
            "storage": SimpleNamespace(
                temperature_migration_required=False,
                data={"settings": {"humidity_assist": {"min_on_minutes": 12, "gate_entity_id": GATE}}},
            ),
            "operation_active": None,
            "operation_recovery": None,
            "entry": SimpleNamespace(options={}),
        }
        original_get_runtime = api_module._get_runtime
        original_build = api_module._build_schedule_response
        api_module._get_runtime = lambda _hass: runtime
        api_module._build_schedule_response = lambda _runtime: {"ok": True}
        self.addCleanup(setattr, api_module, "_get_runtime", original_get_runtime)
        self.addCleanup(setattr, api_module, "_build_schedule_response", original_build)
        connection = SimpleNamespace(send_result=Mock(), send_error=Mock())

        await api_module.ws_update_settings(
            SimpleNamespace(),
            connection,
            {
                "id": 9,
                "type": "velair/update_settings",
                "humidity_assist": {"max_simultaneous_pulses": 3},
            },
        )
        scheduler.async_update_settings.assert_awaited_once_with(
            {
                "humidity_assist": {
                    "min_on_minutes": 12,
                    "gate_entity_id": GATE,
                    "max_simultaneous_pulses": 3,
                }
            }
        )

    def test_schedule_response_includes_humidity_assist_sections(self) -> None:
        data = normalize_schedule_data({}, [GUEST])
        runtime = {
            "entry": SimpleNamespace(
                options={},
                data={"climate_entities": [GUEST]},
                runtime_data=SimpleNamespace(climate_manager=FakeClimateManager()),
            ),
            "scheduler": SimpleNamespace(
                next_event=None,
                next_events=[],
                get_active_overrides=lambda: {},
                get_operational_status=lambda: "idle",
                get_comfort_assessments=lambda: {},
                get_room_sensor_assist_statuses=lambda: {},
                get_humidity_assist_statuses=lambda: {GUEST: {"state": "waiting"}},
                humidity_assist_compliant=True,
                get_zone_runtime_statuses=lambda: {},
            ),
            "storage": SimpleNamespace(data=data),
        }
        response = api_module._build_schedule_response(runtime)
        self.assertEqual(response["humidity_assist"], {GUEST: {"state": "waiting"}})
        self.assertTrue(response["humidity_assist_compliant"])
        self.assertIn("humidity_assist", response["settings"])
        self.assertIn("humidity_assist", response["zones"][GUEST])
        exported = api_module._export_zones(data["zones"])
        self.assertIn("humidity_assist", exported[GUEST])


class ConfigurationValidationTest(HumidityAssistTestCase):
    """Scheduler-level validation of per-zone updates."""

    async def test_enable_requires_sensor_target_and_pulse_temperature(self) -> None:
        self._config(GUEST, enabled=False, sensor_entity_id=None)
        with self.assertRaisesRegex(ValueError, "sensor"):
            await self.scheduler.async_update_zone_humidity_assist(GUEST, {"enabled": True})
        self._config(GUEST, sensor_entity_id=_sensor_id(GUEST), target=None)
        with self.assertRaisesRegex(ValueError, "target"):
            await self.scheduler.async_update_zone_humidity_assist(GUEST, {"enabled": True})
        self._config(GUEST, target=22.0, pulse_temperature=None)
        with self.assertRaisesRegex(ValueError, "pulse temperature"):
            await self.scheduler.async_update_zone_humidity_assist(GUEST, {"enabled": True})
        with self.assertRaisesRegex(ValueError, "pulse_temperature must be between"):
            await self.scheduler.async_update_zone_humidity_assist(
                GUEST, {"pulse_temperature": 60}
            )

    async def test_update_persists_and_fires_state_change_on_enable(self) -> None:
        self._config(GUEST, enabled=False)
        await self._start()
        self._high(GUEST)

        config = await self.scheduler.async_update_zone_humidity_assist(
            GUEST, {"enabled": True, "priority": True, "pulse_fan_mode": "high"}
        )
        await asyncio.sleep(0)

        self.assertTrue(config["enabled"])
        self.assertTrue(config["priority"])
        self.assertEqual(config["pulse_fan_mode"], "high")
        self.assertEqual(self._state(GUEST), "pulsing")
        self.assertEqual(
            self.data["humidity_assist_runtime"][GUEST]["pull_down_started_at"],
            NOW.isoformat(),
        )


class RerunCoalescingTest(HumidityAssistTestCase):
    """A sustained burst of rerun requests must not grow the call stack."""

    async def test_sustained_rerun_bursts_do_not_recurse(self) -> None:
        coordinator = self.coordinator
        calls = {"n": 0}
        target_reruns = sys.getrecursionlimit() + 500

        async def fake_locked(reason: str) -> None:
            calls["n"] += 1
            if calls["n"] <= target_reruns:
                coordinator._rerun_requested = True

        coordinator._async_evaluate_locked = fake_locked
        await coordinator.async_evaluate(reason="test")

        self.assertEqual(calls["n"], target_reruns + 1)
        self.assertFalse(coordinator._evaluating)
        self.assertFalse(coordinator._rerun_requested)

    async def test_sustained_rerun_bursts_yield_to_the_event_loop(self) -> None:
        coordinator = self.coordinator
        calls = {"n": 0}
        target_reruns = 47  # enough to cross several 5-pass yield boundaries

        async def fake_locked(reason: str) -> None:
            calls["n"] += 1
            if calls["n"] <= target_reruns:
                coordinator._rerun_requested = True

        coordinator._async_evaluate_locked = fake_locked
        with patch("asyncio.sleep", wraps=asyncio.sleep) as sleep_mock:
            await coordinator.async_evaluate(reason="test")

        self.assertEqual(calls["n"], target_reruns + 1)
        # A pass every 5 coalesced reruns cedes the loop once, so a burst of
        # 47 reruns must yield: it must not run start-to-finish uninterrupted.
        self.assertEqual(sleep_mock.call_count, target_reruns // 5)


if __name__ == "__main__":
    unittest.main()
