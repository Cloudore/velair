"""Occupancy Assist state machine, hold writes, continuity, and boundary tests."""

from __future__ import annotations

import asyncio
from copy import deepcopy
from datetime import timedelta, timezone
import importlib
import sys
from types import ModuleType, SimpleNamespace
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

occupancy_module = importlib.import_module("custom_components.velair.occupancy_assist")
occupancy_models = importlib.import_module(
    "custom_components.velair.occupancy_assist_models"
)
occupancy_api = importlib.import_module("custom_components.velair.occupancy_assist_api")
models_module = helpers.models_module
const_module = helpers.const_module
storage_module = importlib.import_module("custom_components.velair.storage")
api_module = importlib.import_module("custom_components.velair.api")
services_module = importlib.import_module("custom_components.velair.services")

LIVING = "climate.living"
GUEST = "climate.guest"
BLOCKER = "input_boolean.guest_mode"
PHONE = "binary_sensor.guest_phone_present"
SETBACK_ID = occupancy_models.OCCUPANCY_ASSIST_SETBACK_PAUSE_ID
COMFORT_ID = occupancy_models.OCCUPANCY_ASSIST_COMFORT_PAUSE_ID
EVENT_NAME = const_module.EVENT_TYPE_OCCUPANCY_ASSIST_STATE_CHANGED


def _occupancy_id(entity_id: str) -> str:
    return f"binary_sensor.{entity_id.split('.')[1]}_occupied"


def _load_entity_modules():
    """Load the entity modules with the small Home Assistant surface they need."""
    module_names = (
        "homeassistant.components.sensor",
        "homeassistant.components.switch",
        "homeassistant.components.number",
        "homeassistant.helpers.entity",
        "custom_components.velair.entity",
        "custom_components.velair.occupancy_assist_entities",
        "custom_components.velair.occupancy_assist_entities_sensor",
        "custom_components.velair.occupancy_assist_entities_switch",
        "custom_components.velair.occupancy_assist_entities_number",
    )
    previous_modules = {name: sys.modules.get(name) for name in module_names}

    class FakeVelairEntity:
        _attr_has_entity_name = True
        _attr_should_poll = False

        def __init__(self, entry, key: str) -> None:
            self._entry = entry
            self._attr_unique_id = f"{entry.entry_id}_{key}"

        @property
        def scheduler(self):
            return self._entry.runtime_data.scheduler

    try:
        sensor_platform = ModuleType("homeassistant.components.sensor")
        sensor_platform.SensorDeviceClass = SimpleNamespace(ENUM="enum")
        sensor_platform.SensorEntity = object
        sys.modules["homeassistant.components.sensor"] = sensor_platform
        switch_platform = ModuleType("homeassistant.components.switch")
        switch_platform.SwitchEntity = object
        sys.modules["homeassistant.components.switch"] = switch_platform
        number_platform = ModuleType("homeassistant.components.number")
        number_platform.NumberDeviceClass = SimpleNamespace(TEMPERATURE="temperature")
        number_platform.NumberEntity = object
        number_platform.NumberMode = SimpleNamespace(BOX="box")
        sys.modules["homeassistant.components.number"] = number_platform
        entity_helper = ModuleType("homeassistant.helpers.entity")
        entity_helper.EntityCategory = SimpleNamespace(CONFIG="config")
        sys.modules["homeassistant.helpers.entity"] = entity_helper
        velair_entity = ModuleType("custom_components.velair.entity")
        velair_entity.VelairEntity = FakeVelairEntity
        sys.modules["custom_components.velair.entity"] = velair_entity
        for name in module_names[5:]:
            sys.modules.pop(name, None)
        shared = importlib.import_module("custom_components.velair.occupancy_assist_entities")
        return (
            shared,
            importlib.import_module("custom_components.velair.occupancy_assist_entities_sensor"),
            importlib.import_module("custom_components.velair.occupancy_assist_entities_switch"),
            importlib.import_module("custom_components.velair.occupancy_assist_entities_number"),
        )
    finally:
        # Only the Home Assistant stubs are restored; the freshly imported
        # occupancy modules stay resident so the lazy re-exports resolve.
        for name, previous in list(previous_modules.items())[:5]:
            if previous is None:
                sys.modules.pop(name, None)
            else:
                sys.modules[name] = previous


entities_module, sensor_entities, switch_entities, number_entities = _load_entity_modules()


class OccupancyAssistTestCase(unittest.IsolatedAsyncioTestCase):
    """Shared fixture: two cooling zones on a 22 degree comfort schedule."""

    zones = (LIVING, GUEST)

    def setUp(self) -> None:
        self.hass = FakeHass()
        self.climate = FakeClimateManager()
        self.climate.climate_options[GUEST] = {"fan_mode": ["auto", "high"]}
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
                                    "temperature": 22,
                                    "hvac_mode": "cool",
                                }
                            ],
                        },
                        "occupancy_assist": {
                            "enabled": True,
                            "occupancy_entity_id": _occupancy_id(entity_id),
                            "setback_stages": [
                                {"after_minutes": 10, "temperature": 23},
                                {"after_minutes": 30, "temperature": 25},
                                {"after_minutes": 90, "temperature": 26},
                            ],
                            "arrival_stages": [
                                {"after_minutes": 5, "temperature": 24},
                                {"after_minutes": 10, "temperature": None},
                            ],
                            "comfort_temperature": 22,
                            "setback_hvac_mode": "cool",
                            "setback_fan_mode": "auto",
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
                attributes={"temperature": 22, "current_temperature": 24, "fan_mode": "auto"},
            )
            self._occupancy(entity_id, "off")
        self.scheduler = VelairScheduler(
            self.hass,
            self.data,
            self.climate,
            self._async_save,
        )
        self.coordinator = self.scheduler._occupancy_assist
        self._set_time(NOW)

    def tearDown(self) -> None:
        scheduler_module.dt_util.now = lambda: NOW

    async def _async_save(self) -> None:
        self.save_count += 1

    def _set_time(self, when) -> None:
        scheduler_module.dt_util.now = lambda: when

    def _entity(self, entity_id: str, value: str, *, minutes_ago: float = 0, when=None) -> None:
        changed = when if when is not None else NOW - timedelta(minutes=minutes_ago)
        self.hass.states[entity_id] = SimpleNamespace(
            state=value, attributes={}, last_changed=changed
        )

    def _occupancy(self, entity_id: str, value: str, *, minutes_ago: float = 0, when=None) -> None:
        self._entity(_occupancy_id(entity_id), value, minutes_ago=minutes_ago, when=when)

    def _config(self, entity_id: str, **updates) -> None:
        self.data["zones"][entity_id]["occupancy_assist"] = {
            **self.data["zones"][entity_id]["occupancy_assist"],
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

    def _status(self, entity_id: str) -> dict:
        return self.coordinator.status(entity_id)

    def _state(self, entity_id: str) -> str:
        return self._status(entity_id)["state"]

    def _holds(self, entity_id: str) -> dict[str, dict]:
        return {
            reason["pause_id"]: reason
            for reason in self.data["zones"][entity_id].get("pauses", [])
            if "pause_id" in reason
        }

    def _calls(self, entity_id: str) -> list[tuple]:
        return [
            call for call in self.climate.calls
            if call[0] == "set_temperature" and call[1] == entity_id
        ]

    def _events(self, name: str = EVENT_NAME, entity_id: str | None = None) -> list[dict]:
        return [
            payload
            for event_type, payload in self.hass.bus.events
            if event_type == EVENT_VELAIR
            and payload.get("event") == name
            and (entity_id is None or payload.get("entity_id") == entity_id)
        ]

    async def _seed_hold(self, entity_id: str, pause_id: str, temperature: float, constraint: str = "raise_only") -> None:
        await self.scheduler.async_pause_zone(
            entity_id,
            action="hold",
            pause_id=pause_id,
            temperature=temperature,
            constraint=constraint,
        )


class StateMachineTest(OccupancyAssistTestCase):
    """One test per branch of the spec §3 state machine."""

    async def test_unavailable_source_applies_and_releases_nothing(self) -> None:
        await self._seed_hold(GUEST, SETBACK_ID, 26.0)
        await self._seed_hold(LIVING, COMFORT_ID, 24.0, "lower_only")
        self._entity(_occupancy_id(GUEST), "unavailable")
        self._entity(_occupancy_id(LIVING), "unknown")
        calls_before = len(self.climate.calls)
        await self._start()

        self.assertEqual(self._state(GUEST), "unavailable")
        self.assertEqual(self._state(LIVING), "unavailable")
        self.assertEqual(self._status(GUEST)["reason"], "source_unavailable")
        self.assertIn(SETBACK_ID, self._holds(GUEST))
        self.assertIn(COMFORT_ID, self._holds(LIVING))
        self.assertEqual(len(self.climate.calls), calls_before)
        self.assertIsNone(self._status(GUEST)["next_stage_at"])

        # A missing source entity is uncertain too.
        del self.hass.states[_occupancy_id(GUEST)]
        await self._evaluate(NOW + timedelta(minutes=200))
        self.assertEqual(self._state(GUEST), "unavailable")
        self.assertIn(SETBACK_ID, self._holds(GUEST))

    async def test_vacant_before_the_first_stage_only_arms_a_timer(self) -> None:
        self._occupancy(GUEST, "off", minutes_ago=5)
        await self._start()

        status = self._status(GUEST)
        self.assertEqual(status["state"], "vacant")
        self.assertEqual(status["vacant_since"], (NOW - timedelta(minutes=5)).isoformat())
        self.assertIsNone(status["occupied_since"])
        self.assertEqual(status["next_stage_at"], (NOW + timedelta(minutes=5)).isoformat())
        self.assertEqual(status["next_temperature"], 23.0)
        self.assertEqual(self._holds(GUEST), {})
        self.assertEqual(self._calls(GUEST), [])
        change = self._events(entity_id=GUEST)[0]
        self.assertEqual(change["previous"], "disabled")
        self.assertEqual(change["state"], "vacant")
        self.assertEqual(change["reason"], "vacant")

    async def test_setback_stage_1_writes_a_raise_only_hold(self) -> None:
        self._occupancy(GUEST, "off", minutes_ago=10)
        await self._start()

        self.assertEqual(self._state(GUEST), "setback_1")
        hold = self._holds(GUEST)[SETBACK_ID]
        self.assertEqual(hold["action"], "hold")
        self.assertEqual(hold["constraint"], "raise_only")
        self.assertEqual(hold["temperature"], 23.0)
        self.assertEqual(hold["hvac_mode"], "cool")
        self.assertEqual(hold["fan_mode"], "auto")
        self.assertEqual(hold["label"], "setback stage 1")
        delivered = self._calls(GUEST)[-1]
        self.assertEqual((delivered[2], delivered[3], delivered[4]), (23.0, True, "cool"))
        status = self._status(GUEST)
        self.assertEqual(status["stage"], 1)
        self.assertEqual(status["hold_temperature"], 23.0)
        self.assertEqual(status["last_action"], "setback_hold")
        self.assertEqual(status["last_action_at"], NOW.isoformat())
        self.assertEqual(status["next_stage_at"], (NOW + timedelta(minutes=20)).isoformat())
        self.assertEqual(status["next_temperature"], 25.0)
        change = self._events(entity_id=GUEST)[0]
        self.assertEqual(
            {key: change[key] for key in ("previous", "state", "stage", "temperature", "reason")},
            {"previous": "disabled", "state": "setback_1", "stage": 1, "temperature": 23.0, "reason": "setback_stage"},
        )
        self.assertEqual(self.data["occupancy_assist_runtime"][GUEST]["state"], "setback_1")
        self.assertGreaterEqual(self.save_count, 1)
        # No climate service was called directly; only the hold pipeline delivered.
        self.assertTrue(all(call[0] == "set_temperature" for call in self.climate.calls))

    async def test_later_stages_update_the_same_hold_in_place(self) -> None:
        self._occupancy(GUEST, "off", minutes_ago=10)
        await self._start()
        started_at = self._holds(GUEST)[SETBACK_ID]["started_at"]

        await self._evaluate(NOW + timedelta(minutes=20))
        self.assertEqual(self._state(GUEST), "setback_2")
        self.assertEqual(len(self.data["zones"][GUEST]["pauses"]), 1)
        hold = self._holds(GUEST)[SETBACK_ID]
        self.assertEqual(hold["temperature"], 25.0)
        self.assertEqual(hold["label"], "setback stage 2")
        self.assertEqual(hold["started_at"], started_at)

        await self._evaluate(NOW + timedelta(minutes=80))
        self.assertEqual(self._state(GUEST), "setback_3")
        self.assertEqual(self._holds(GUEST)[SETBACK_ID]["temperature"], 26.0)
        self.assertIsNone(self._status(GUEST)["next_stage_at"])
        self.assertEqual(
            [event["state"] for event in self._events(entity_id=GUEST)],
            ["setback_1", "setback_2", "setback_3"],
        )

    async def test_a_stage_never_lowers_an_existing_setback(self) -> None:
        self._occupancy(GUEST, "off", minutes_ago=90)
        await self._start()
        self.assertEqual(self._holds(GUEST)[SETBACK_ID]["temperature"], 26.0)

        # A one-minute visit, then vacant again for ten minutes.
        self._occupancy(GUEST, "on", when=NOW + timedelta(minutes=1))
        await self._evaluate(NOW + timedelta(minutes=2))
        self.assertEqual(self._state(GUEST), "occupied")
        self.assertIn(SETBACK_ID, self._holds(GUEST))

        self._occupancy(GUEST, "off", when=NOW + timedelta(minutes=3))
        await self._evaluate(NOW + timedelta(minutes=13))
        self.assertEqual(self._state(GUEST), "setback_1")
        hold = self._holds(GUEST)[SETBACK_ID]
        self.assertEqual(hold["temperature"], 26.0)
        self.assertEqual(hold["label"], "setback stage 1")
        self.assertEqual(self._status(GUEST)["next_temperature"], 26.0)

    async def test_blocking_entity_prevents_new_stages_but_keeps_existing(self) -> None:
        self._config(GUEST, blocking_entity_ids=[BLOCKER])
        self._entity(BLOCKER, "on")
        self._occupancy(GUEST, "off", minutes_ago=10)
        await self._start()

        self.assertEqual(self._state(GUEST), "blocked")
        self.assertEqual(self._status(GUEST)["blocked_by"], BLOCKER)
        self.assertEqual(self._holds(GUEST), {})
        self.assertEqual(self._events(entity_id=GUEST)[-1]["reason"], "blocking_entity")

        self._entity(BLOCKER, "off")
        await self._evaluate(NOW + timedelta(minutes=1))
        self.assertEqual(self._state(GUEST), "setback_1")
        self.assertEqual(self._holds(GUEST)[SETBACK_ID]["temperature"], 23.0)

        self._entity(BLOCKER, "on")
        await self._evaluate(NOW + timedelta(minutes=25))
        self.assertEqual(self._state(GUEST), "blocked")
        self.assertEqual(self._status(GUEST)["stage"], 1)
        self.assertEqual(self._holds(GUEST)[SETBACK_ID]["temperature"], 23.0)

        self._entity(BLOCKER, "off")
        await self._evaluate(NOW + timedelta(minutes=26))
        self.assertEqual(self._state(GUEST), "setback_2")
        self.assertEqual(self._holds(GUEST)[SETBACK_ID]["temperature"], 25.0)

    async def test_arrival_requires_corroboration_when_configured(self) -> None:
        self._config(GUEST, corroboration_entity_ids=[PHONE])
        self._occupancy(GUEST, "on", minutes_ago=10)
        self._entity(PHONE, "off")
        await self._start()

        status = self._status(GUEST)
        self.assertEqual(status["state"], "occupied")
        self.assertEqual(status["reason"], "awaiting_corroboration")
        self.assertIsNone(status["next_stage_at"])
        self.assertFalse(status["corroborated"])
        self.assertEqual(self._holds(GUEST), {})

        self._entity(PHONE, "on", minutes_ago=3)
        await self._evaluate(NOW)
        status = self._status(GUEST)
        self.assertEqual(status["state"], "occupied")
        self.assertTrue(status["corroborated"])
        self.assertEqual(status["next_stage_at"], (NOW + timedelta(minutes=2)).isoformat())

        await self._evaluate(NOW + timedelta(minutes=2))
        self.assertEqual(self._state(GUEST), "arriving_1")
        self.assertEqual(self._holds(GUEST)[COMFORT_ID]["temperature"], 24.0)

    async def test_arrival_stage_1_holds_lower_only_and_leaves_the_setback(self) -> None:
        self._occupancy(GUEST, "off", minutes_ago=90)
        await self._start()
        self.assertEqual(self._holds(GUEST)[SETBACK_ID]["temperature"], 26.0)

        self._occupancy(GUEST, "on", when=NOW)
        await self._evaluate(NOW + timedelta(minutes=1))
        status = self._status(GUEST)
        self.assertEqual(status["state"], "occupied")
        self.assertEqual(status["occupied_since"], NOW.isoformat())
        self.assertEqual(status["next_stage_at"], (NOW + timedelta(minutes=5)).isoformat())
        self.assertEqual(status["next_temperature"], 24.0)

        await self._evaluate(NOW + timedelta(minutes=5))
        self.assertEqual(self._state(GUEST), "arriving_1")
        holds = self._holds(GUEST)
        self.assertEqual(holds[SETBACK_ID]["temperature"], 26.0)
        comfort = holds[COMFORT_ID]
        self.assertEqual(comfort["constraint"], "lower_only")
        self.assertEqual(comfort["temperature"], 24.0)
        self.assertEqual(comfort["label"], "arrival stage 1")
        self.assertNotIn("hvac_mode", comfort)
        # Fold: schedule 22 -> raise_only 26 -> lower_only 24.
        self.assertEqual(self._calls(GUEST)[-1][2], 24.0)
        status = self._status(GUEST)
        self.assertEqual(status["stage"], 1)
        self.assertEqual(status["next_stage_at"], (NOW + timedelta(minutes=10)).isoformat())
        self.assertIsNone(status["next_temperature"])
        change = self._events(entity_id=GUEST)[-1]
        self.assertEqual(
            (change["state"], change["stage"], change["temperature"], change["reason"]),
            ("arriving_1", 1, 24.0, "arrival_stage"),
        )

    async def test_arrival_final_stage_releases_listed_pause_ids_then_comfort(self) -> None:
        self._occupancy(GUEST, "off", minutes_ago=90)
        await self._start()
        await self._seed_hold(GUEST, "away_1h", 27.0)
        await self._seed_hold(GUEST, "away_6h", 28.0)
        await self._seed_hold(GUEST, "neveroff_recover", 26.0)
        await self._seed_hold(GUEST, "presleep", 21.0, "lower_only")
        await self._seed_hold(GUEST, "sleep", 25.0)
        self._occupancy(GUEST, "on", when=NOW)
        await self._evaluate(NOW + timedelta(minutes=5))
        self.assertIn(COMFORT_ID, self._holds(GUEST))
        self.hass.bus.events.clear()

        await self._evaluate(NOW + timedelta(minutes=10))
        self.assertEqual(self._state(GUEST), "comfort")
        self.assertEqual(set(self._holds(GUEST)), {"sleep"})
        removed = [
            event["pause_id"]
            for event in self._events("zone_pause_removed", GUEST)
        ]
        self.assertEqual(
            removed,
            [SETBACK_ID, "away_1h", "away_6h", "neveroff_recover", "presleep", COMFORT_ID],
        )
        self.assertTrue(all(
            event["reason"] == "occupancy_assist"
            for event in self._events("zone_pause_removed", GUEST)
        ))
        status = self._status(GUEST)
        self.assertIsNone(status["stage"])
        self.assertTrue(status["arrival_released"])
        self.assertEqual(status["last_action"], "arrival_released")
        change = self._events(entity_id=GUEST)[-1]
        self.assertEqual(
            (change["previous"], change["state"], change["stage"], change["temperature"], change["reason"]),
            ("arriving_1", "comfort", None, None, "arrival_complete"),
        )
        # The remaining foreign hold is delivered again; nothing else changes later.
        self.assertEqual(self._calls(GUEST)[-1][2], 25.0)
        self.hass.bus.events.clear()
        await self._evaluate(NOW + timedelta(minutes=30))
        self.assertEqual(self._events("zone_pause_removed", GUEST), [])
        self.assertEqual(self._events(entity_id=GUEST), [])

    async def test_arrival_final_stage_restores_the_schedule_without_foreign_holds(self) -> None:
        self._occupancy(GUEST, "off", minutes_ago=90)
        await self._start()
        self._occupancy(GUEST, "on", when=NOW)
        await self._evaluate(NOW + timedelta(minutes=10))

        self.assertEqual(self._state(GUEST), "comfort")
        self.assertEqual(self._holds(GUEST), {})
        applied = [
            event for event in self._events("climate_target_applied", GUEST)
            if event.get("source") == "zone_resumed"
        ]
        self.assertEqual(applied[-1]["temperature"], 22)
        self.assertEqual(self._calls(GUEST)[-1][2], 22.0)

    async def test_exit_grace_keeps_the_comfort_hold_then_releases_it(self) -> None:
        self._occupancy(GUEST, "off", minutes_ago=90)
        await self._start()
        self._occupancy(GUEST, "on", when=NOW)
        await self._evaluate(NOW + timedelta(minutes=5))
        self.assertIn(COMFORT_ID, self._holds(GUEST))

        self._occupancy(GUEST, "off", when=NOW + timedelta(minutes=6))
        await self._evaluate(NOW + timedelta(minutes=7))
        status = self._status(GUEST)
        self.assertEqual(status["state"], "arriving_1")
        self.assertEqual(status["reason"], "exit_grace")
        self.assertIn(COMFORT_ID, self._holds(GUEST))
        self.assertEqual(status["next_stage_at"], (NOW + timedelta(minutes=8)).isoformat())

        await self._evaluate(NOW + timedelta(minutes=8))
        status = self._status(GUEST)
        self.assertEqual(status["state"], "vacant")
        self.assertNotIn(COMFORT_ID, self._holds(GUEST))
        self.assertEqual(self._holds(GUEST)[SETBACK_ID]["temperature"], 26.0)
        self.assertEqual(status["last_action"], "comfort_released")
        # The standing setback returns.
        self.assertEqual(self._calls(GUEST)[-1][2], 26.0)
        self.assertEqual(status["next_stage_at"], (NOW + timedelta(minutes=16)).isoformat())

        await self._evaluate(NOW + timedelta(minutes=16))
        self.assertEqual(self._state(GUEST), "setback_1")
        self.assertEqual(self._holds(GUEST)[SETBACK_ID]["temperature"], 26.0)

    async def test_disable_releases_both_owned_holds(self) -> None:
        self._occupancy(GUEST, "off", minutes_ago=10)
        await self._start()
        await self._seed_hold(GUEST, COMFORT_ID, 24.0, "lower_only")
        self.assertEqual(set(self._holds(GUEST)), {SETBACK_ID, COMFORT_ID})

        config = await self.scheduler.async_update_zone_occupancy_assist(
            GUEST, {"enabled": False}
        )
        await asyncio.sleep(0)

        self.assertFalse(config["enabled"])
        self.assertEqual(self._holds(GUEST), {})
        status = self._status(GUEST)
        self.assertEqual(status["state"], "disabled")
        self.assertEqual(status["last_action"], "disabled_released")
        self.assertIsNone(status["stage"])
        self.assertEqual(self._calls(GUEST)[-1][2], 22.0)
        self.assertEqual(self._events(entity_id=GUEST)[-1]["state"], "disabled")
        self.assertEqual(self.data["occupancy_assist_runtime"][GUEST]["state"], "disabled")
        # LIVING keeps running (its source went off at NOW, so it is still counting).
        self.assertEqual(self._state(LIVING), "vacant")

    async def test_manual_adjustment_blocks_application_and_release(self) -> None:
        self.climate.snapshots[GUEST] = {"hvac_mode": "cool", "temperature": 21.0}
        await self._start()
        await self.scheduler.async_enter_manual_adjustment(GUEST)
        await asyncio.sleep(0)
        self._occupancy(GUEST, "off", minutes_ago=10)
        await self._evaluate(NOW)

        status = self._status(GUEST)
        self.assertEqual(status["state"], "setback_1")
        self.assertEqual(status["stage"], 1)
        self.assertEqual(status["blocked_by"], "manual")
        self.assertNotIn(SETBACK_ID, self._holds(GUEST))

        await self.scheduler.async_resume_automatic_control(GUEST)
        await asyncio.sleep(0)
        await self._evaluate(NOW + timedelta(minutes=1))
        self.assertIsNone(self._status(GUEST)["blocked_by"])
        self.assertEqual(self._holds(GUEST)[SETBACK_ID]["temperature"], 23.0)

        # The final arrival release is deferred the same way.
        await self._seed_hold(GUEST, "away_1h", 27.0)
        await self.scheduler.async_enter_manual_adjustment(GUEST)
        await asyncio.sleep(0)
        self._occupancy(GUEST, "on", when=NOW + timedelta(minutes=2))
        await self._evaluate(NOW + timedelta(minutes=12))
        self.assertEqual(self._state(GUEST), "comfort")
        self.assertEqual(self._status(GUEST)["blocked_by"], "manual")
        self.assertIn("away_1h", self._holds(GUEST))
        self.assertIn(SETBACK_ID, self._holds(GUEST))
        self.assertFalse(self._status(GUEST)["arrival_released"])

        await self.scheduler.async_resume_automatic_control(GUEST)
        await asyncio.sleep(0)
        await self._evaluate(NOW + timedelta(minutes=13))
        self.assertNotIn("away_1h", self._holds(GUEST))
        self.assertNotIn(SETBACK_ID, self._holds(GUEST))
        self.assertTrue(self._status(GUEST)["arrival_released"])

    async def test_scheduler_paused_and_freeze_pause_block_writes(self) -> None:
        self.data["zones"][LIVING]["pauses"] = [
            {"started_at": NOW.isoformat(), "action": "none", "pause_id": "travel_off"}
        ]
        self.data["zones"][LIVING]["override"] = {"type": "pause", "action": "none"}
        self._occupancy(LIVING, "off", minutes_ago=10)
        self._occupancy(GUEST, "off", minutes_ago=10)
        await self._start()
        self.assertEqual(self._status(LIVING)["blocked_by"], "pause")
        self.assertNotIn(SETBACK_ID, self._holds(LIVING))
        self.assertIn(SETBACK_ID, self._holds(GUEST))

        await self.scheduler.async_set_mode("paused")
        await asyncio.sleep(0)
        self._occupancy(GUEST, "off", minutes_ago=30)
        await self._evaluate(NOW)
        self.assertEqual(self._status(GUEST)["blocked_by"], "scheduler_paused")
        self.assertEqual(self._state(GUEST), "setback_2")
        self.assertEqual(self._holds(GUEST)[SETBACK_ID]["temperature"], 23.0)

    async def test_disabled_zone_or_missing_entity_reports_disabled(self) -> None:
        self._config(GUEST, occupancy_entity_id=None)
        self.data["zones"][LIVING]["enabled"] = False
        await self._start()
        self.assertEqual(self._state(GUEST), "disabled")
        self.assertEqual(self._status(GUEST)["reason"], "no_occupancy_entity")
        self.assertFalse(self._status(GUEST)["configured"])
        self.assertEqual(self._state(LIVING), "disabled")
        self.assertEqual(self._status(LIVING)["reason"], "zone_disabled")
        self.assertEqual(self.climate.calls, [])


class ComfortSyncTest(OccupancyAssistTestCase):
    """Dial Sync: the comfort temperature is the zone's default schedule."""

    async def test_comfort_temperature_change_writes_the_weekly_schedule(self) -> None:
        await self._start()
        config = await self.scheduler.async_update_zone_occupancy_assist(
            GUEST, {"comfort_temperature": 24}
        )
        await asyncio.sleep(0)

        self.assertEqual(config["comfort_temperature"], 24.0)
        expected = [
            {
                "start": "00:00",
                "action": ACTION_SET_TEMPERATURE,
                "temperature": 24.0,
                "hvac_mode": "cool",
                "fan_mode": "auto",
            }
        ]
        for weekday in models_module.WEEKDAYS:
            self.assertEqual(self.data["zones"][GUEST]["schedule"][weekday], expected)
        # The other zone's schedule is untouched.
        self.assertEqual(self.data["zones"][LIVING]["schedule"]["monday"], [])
        self.assertEqual(self.data["zones"][LIVING]["schedule"]["tuesday"][0]["temperature"], 22)

    async def test_setback_modes_are_part_of_the_synced_block(self) -> None:
        await self._start()
        await self.scheduler.async_update_zone_occupancy_assist(
            LIVING, {"comfort_temperature": 23, "setback_hvac_mode": None, "setback_fan_mode": None}
        )
        block = self.data["zones"][LIVING]["schedule"]["sunday"][0]
        self.assertEqual(block, {"start": "00:00", "action": ACTION_SET_TEMPERATURE, "temperature": 23.0})

    async def test_sync_disabled_keeps_the_hand_authored_schedule(self) -> None:
        self._config(GUEST, sync_comfort_to_schedule=False)
        await self._start()
        before = deepcopy(self.data["zones"][GUEST]["schedule"])
        await self.scheduler.async_update_zone_occupancy_assist(
            GUEST, {"comfort_temperature": 24}
        )
        self.assertEqual(self.data["zones"][GUEST]["schedule"], before)
        self.assertEqual(self._status(GUEST)["comfort_temperature"], 24.0)

        # Turning the sync on writes the schedule once.
        await self.scheduler.async_update_zone_occupancy_assist(
            GUEST, {"sync_comfort_to_schedule": True}
        )
        self.assertEqual(self.data["zones"][GUEST]["schedule"]["monday"][0]["temperature"], 24.0)

    async def test_unchanged_comfort_does_not_rewrite_the_schedule(self) -> None:
        await self._start()
        before = deepcopy(self.data["zones"][GUEST]["schedule"])
        await self.scheduler.async_update_zone_occupancy_assist(
            GUEST, {"arrival_exit_grace_minutes": 4}
        )
        self.assertEqual(self.data["zones"][GUEST]["schedule"], before)


class ContinuityTest(OccupancyAssistTestCase):
    """Restart continuity, timers, listeners, and status projection."""

    def _restart(self, when):
        persisted = models_module.serialize_schedule_data(deepcopy(self.data))
        restarted_hass = FakeHass()
        restarted_hass.states.update(self.hass.states)
        restarted_climate = FakeClimateManager()
        restarted_climate.climate_options[GUEST] = {"fan_mode": ["auto", "high"]}
        restarted = VelairScheduler(
            restarted_hass,
            normalize_schedule_data(persisted, list(self.zones)),
            restarted_climate,
            self._async_save,
        )
        self._set_time(when)
        return restarted, restarted_hass, restarted_climate

    async def test_restart_continues_from_the_source_last_changed(self) -> None:
        self._occupancy(GUEST, "off", minutes_ago=10)
        await self._start()
        self.assertEqual(self._state(GUEST), "setback_1")

        restarted, restarted_hass, restarted_climate = self._restart(NOW + timedelta(minutes=25))
        coordinator = restarted._occupancy_assist
        self.assertEqual(coordinator.status(GUEST)["state"], "setback_1")
        await restarted.async_start()
        await asyncio.sleep(0)

        status = coordinator.status(GUEST)
        self.assertEqual(status["state"], "setback_2")
        self.assertEqual(status["vacant_since"], (NOW - timedelta(minutes=10)).isoformat())
        holds = {
            reason["pause_id"]: reason
            for reason in restarted._data["zones"][GUEST]["pauses"]
        }
        self.assertEqual(holds[SETBACK_ID]["temperature"], 25.0)
        change = [
            payload for event_type, payload in restarted_hass.bus.events
            if payload.get("event") == EVENT_NAME and payload["entity_id"] == GUEST
        ][0]
        self.assertEqual((change["previous"], change["state"]), ("setback_1", "setback_2"))
        self.assertEqual([call[2] for call in restarted_climate.calls if call[1] == GUEST], [25.0])

    async def test_restart_does_not_repeat_the_arrival_release(self) -> None:
        self._occupancy(GUEST, "on", minutes_ago=20)
        await self._start()
        self.assertEqual(self._state(GUEST), "comfort")
        self.assertTrue(self.data["occupancy_assist_runtime"][GUEST]["arrival_released"])
        await self._seed_hold(GUEST, "away_1h", 27.0)

        restarted, restarted_hass, _climate = self._restart(NOW + timedelta(minutes=5))
        await restarted.async_start()
        await asyncio.sleep(0)

        coordinator = restarted._occupancy_assist
        self.assertEqual(coordinator.status(GUEST)["state"], "comfort")
        self.assertTrue(coordinator.status(GUEST)["arrival_released"])
        pause_ids = [reason["pause_id"] for reason in restarted._data["zones"][GUEST]["pauses"]]
        self.assertEqual(pause_ids, ["away_1h"])
        self.assertEqual(
            [payload for _type, payload in restarted_hass.bus.events if payload.get("event") == EVENT_NAME and payload["entity_id"] == GUEST],
            [],
        )

    async def test_timers_track_the_next_boundary_and_stop_cancels_them(self) -> None:
        armed: list[tuple] = []
        cancelled: list[object] = []

        def fake_track(hass, action, when):
            armed.append((action, when))
            return lambda: cancelled.append(when)

        original = occupancy_module.async_track_point_in_utc_time
        occupancy_module.async_track_point_in_utc_time = fake_track
        self.addCleanup(setattr, occupancy_module, "async_track_point_in_utc_time", original)
        self._occupancy(GUEST, "off", minutes_ago=5)
        self._occupancy(LIVING, "on", minutes_ago=1)
        await self._start()

        self.assertEqual(
            sorted(when for _action, when in armed),
            sorted([
                (NOW + timedelta(minutes=5)).astimezone(timezone.utc),
                (NOW + timedelta(minutes=4)).astimezone(timezone.utc),
            ]),
        )
        # Re-evaluating without a boundary change keeps the timer armed.
        await self._evaluate(NOW + timedelta(minutes=1))
        self.assertEqual(len(armed), 2)
        # Firing the guest timer moves to stage 1 and arms stage 2.
        guest_action = next(action for action, when in armed if when == (NOW + timedelta(minutes=5)).astimezone(timezone.utc))
        self._set_time(NOW + timedelta(minutes=5))
        guest_action(NOW + timedelta(minutes=5))
        await asyncio.sleep(0)
        await asyncio.sleep(0)
        self.assertEqual(self._state(GUEST), "setback_1")
        self.assertIn((NOW + timedelta(minutes=25)).astimezone(timezone.utc), [when for _a, when in armed])

        await self.scheduler.async_stop()
        expected_live = {
            (NOW + timedelta(minutes=25)).astimezone(timezone.utc),
            (NOW + timedelta(minutes=4)).astimezone(timezone.utc),
        }
        self.assertTrue(expected_live <= set(cancelled))
        self.assertTrue(all(
            runtime.unsub_timer is None for runtime in self.coordinator._zones.values()
        ))

    async def test_state_change_listener_tracks_every_input_and_refreshes(self) -> None:
        tracked: list[tuple] = []
        unsubscribed: list[int] = []

        def fake_track(hass, entity_ids, handler):
            tracked.append((list(entity_ids), handler))
            return lambda: unsubscribed.append(len(tracked))

        original = occupancy_module.async_track_state_change_event
        occupancy_module.async_track_state_change_event = fake_track
        self.addCleanup(setattr, occupancy_module, "async_track_state_change_event", original)
        self._config(GUEST, blocking_entity_ids=[BLOCKER], corroboration_entity_ids=[PHONE])
        self._config(LIVING, enabled=False)
        await self._start()

        entity_ids, handler = tracked[-1]
        self.assertEqual(entity_ids, sorted([_occupancy_id(GUEST), BLOCKER, PHONE]))

        self._occupancy(GUEST, "off", minutes_ago=10)
        handler(SimpleNamespace(data={"entity_id": _occupancy_id(GUEST)}))
        await asyncio.sleep(0)
        await asyncio.sleep(0)
        self.assertEqual(self._state(GUEST), "setback_1")

        # Untracked entities are ignored; listeners are rebuilt on config changes.
        handler(SimpleNamespace(data={"entity_id": "sensor.other"}))
        await asyncio.sleep(0)
        await self.scheduler.async_update_zone_occupancy_assist(LIVING, {"enabled": True})
        self.assertEqual(
            tracked[-1][0],
            sorted([_occupancy_id(GUEST), _occupancy_id(LIVING), BLOCKER, PHONE]),
        )
        self.assertTrue(unsubscribed)
        await self.scheduler.async_stop()
        self.assertEqual(self.coordinator._tracked_entities, ())

    async def test_status_payload_and_unit_change_refresh(self) -> None:
        self._occupancy(GUEST, "off", minutes_ago=10)
        await self._start()
        status = self.scheduler.get_occupancy_assist_status(GUEST)
        for key in (
            "state", "enabled", "configured", "reason", "occupancy_entity_id",
            "occupied_since", "vacant_since", "stage", "next_stage_at",
            "next_temperature", "blocked_by", "hold_temperature", "last_action",
            "last_action_at", "comfort_temperature", "sync_comfort_to_schedule",
        ):
            self.assertIn(key, status)
        self.assertEqual(status["occupancy_entity_id"], _occupancy_id(GUEST))
        self.assertTrue(status["configured"])
        self.assertEqual(set(self.scheduler.get_occupancy_assist_statuses()), set(self.zones))
        self.assertEqual(self.scheduler.get_occupancy_assist_config(GUEST)["comfort_temperature"], 22.0)

        self.scheduler.handle_temperature_unit_change()
        await asyncio.sleep(0)
        await asyncio.sleep(0)
        self.assertEqual(self._state(GUEST), "setback_1")


class FahrenheitTest(OccupancyAssistTestCase):
    """Unit handling for stage temperatures and stored conversion."""

    async def test_fahrenheit_installation_holds_in_fahrenheit(self) -> None:
        self.climate.temperature_unit = lambda entity_id: "°F"
        self.climate.limits[GUEST] = (50.0, 95.0)
        self._config(LIVING, enabled=False)
        self.data["zones"][GUEST]["schedule"]["tuesday"][0]["temperature"] = 72.0
        self._config(
            GUEST,
            setback_stages=[
                {"after_minutes": 10, "temperature": 73.4},
                {"after_minutes": 30, "temperature": 77.0},
                {"after_minutes": 90, "temperature": 78.8},
            ],
            arrival_stages=[{"after_minutes": 5, "temperature": 75.0}, {"after_minutes": 10, "temperature": None}],
            comfort_temperature=72.0,
        )
        self._occupancy(GUEST, "off", minutes_ago=10)
        await self._start()

        # 73.4 snaps to the climate's 0.5 step, and the same value is compared
        # on the next evaluation so nothing is rewritten.
        self.assertEqual(self._holds(GUEST)[SETBACK_ID]["temperature"], 73.5)
        self.assertEqual(self._calls(GUEST)[-1][2], 73.5)
        calls = len(self.climate.calls)
        await self._evaluate(NOW + timedelta(minutes=1))
        self.assertEqual(len(self.climate.calls), calls)
        self.assertEqual(self._status(GUEST)["hold_temperature"], 73.5)

    def test_storage_converts_stage_and_comfort_temperatures(self) -> None:
        data = {
            "zones": {
                GUEST: {
                    "occupancy_assist": {
                        "setback_stages": [
                            {"after_minutes": 10, "temperature": 23.0},
                            {"after_minutes": 30, "temperature": 25.0},
                        ],
                        "arrival_stages": [
                            {"after_minutes": 5, "temperature": 24.0},
                            {"after_minutes": 10, "temperature": None},
                        ],
                        "comfort_temperature": 22.0,
                        "arrival_exit_grace_minutes": 2,
                    }
                },
                LIVING: {"occupancy_assist": "garbage"},
            }
        }
        storage_module._convert_scheduler_temperatures(data, "°C", "°F")

        guest = data["zones"][GUEST]["occupancy_assist"]
        self.assertAlmostEqual(guest["setback_stages"][0]["temperature"], 73.4)
        self.assertAlmostEqual(guest["setback_stages"][1]["temperature"], 77.0)
        self.assertAlmostEqual(guest["arrival_stages"][0]["temperature"], 75.2)
        self.assertIsNone(guest["arrival_stages"][1]["temperature"])
        self.assertAlmostEqual(guest["comfort_temperature"], 71.6)
        self.assertEqual(guest["arrival_exit_grace_minutes"], 2)
        self.assertEqual(data["zones"][LIVING]["occupancy_assist"], "garbage")

    def test_snap_helper_visits_every_stored_temperature(self) -> None:
        zone = {
            "occupancy_assist": {
                "setback_stages": [{"after_minutes": 10, "temperature": 23.3}],
                "arrival_stages": [{"after_minutes": 5, "temperature": 24.2}, {"after_minutes": 10, "temperature": None}],
                "comfort_temperature": 22.1,
            }
        }

        def snap(mapping, key):
            if isinstance(mapping.get(key), (int, float)):
                mapping[key] = round(mapping[key] * 2) / 2

        occupancy_models.snap_occupancy_assist_temperatures(zone, snap)
        config = zone["occupancy_assist"]
        self.assertEqual(config["setback_stages"][0]["temperature"], 23.5)
        self.assertEqual(config["arrival_stages"][0]["temperature"], 24.0)
        self.assertIsNone(config["arrival_stages"][1]["temperature"])
        self.assertEqual(config["comfort_temperature"], 22.0)


class NormalizationTest(unittest.TestCase):
    """Tolerant normalization of garbage configuration and runtime records."""

    def test_zone_config_repairs_garbage_and_defaults_missing_keys(self) -> None:
        normalize = occupancy_models.normalize_occupancy_assist_data
        defaults = normalize(None)
        self.assertEqual(
            defaults,
            {
                "enabled": False,
                "occupancy_entity_id": None,
                "blocking_entity_ids": [],
                "corroboration_entity_ids": [],
                "setback_stages": [
                    {"after_minutes": 10, "temperature": 23.0},
                    {"after_minutes": 30, "temperature": 25.0},
                    {"after_minutes": 90, "temperature": 26.0},
                ],
                "setback_hvac_mode": "cool",
                "setback_fan_mode": "auto",
                "arrival_stages": [
                    {"after_minutes": 5, "temperature": 26.0},
                    {"after_minutes": 10, "temperature": None},
                ],
                "arrival_exit_grace_minutes": 2,
                "comfort_temperature": 26.0,
                "sync_comfort_to_schedule": True,
            },
        )
        repaired = normalize(
            {
                "enabled": "yes",
                "occupancy_entity_id": "  ",
                "blocking_entity_ids": "input_boolean.one",
                "corroboration_entity_ids": ["bad", "binary_sensor.a", "binary_sensor.a", 3],
                "setback_stages": [
                    {"after_minutes": 90, "temperature": 26},
                    {"after_minutes": "10", "temperature": 23},
                    {"after_minutes": 30},
                    {"after_minutes": 200, "temperature": 500},
                    {"after_minutes": 300, "temperature": 27},
                    {"after_minutes": 400, "temperature": 28},
                ],
                "setback_hvac_mode": "warp",
                "setback_fan_mode": "  ",
                "arrival_stages": [
                    {"after_minutes": 10, "temperature": 25},
                    {"after_minutes": 5, "temperature": 24},
                    {"after_minutes": 20, "temperature": None},
                ],
                "arrival_exit_grace_minutes": -5,
                "comfort_temperature": "nan",
                "sync_comfort_to_schedule": 0,
                "unknown": True,
            }
        )
        self.assertTrue(repaired["enabled"])
        self.assertIsNone(repaired["occupancy_entity_id"])
        self.assertEqual(repaired["blocking_entity_ids"], ["input_boolean.one"])
        self.assertEqual(repaired["corroboration_entity_ids"], ["binary_sensor.a"])
        self.assertEqual(
            repaired["setback_stages"],
            [
                {"after_minutes": 10, "temperature": 23.0},
                {"after_minutes": 90, "temperature": 26.0},
                {"after_minutes": 300, "temperature": 27.0},
            ],
        )
        self.assertIsNone(repaired["setback_hvac_mode"])
        self.assertIsNone(repaired["setback_fan_mode"])
        # Sorted, capped at two, and the last stage always releases.
        self.assertEqual(
            repaired["arrival_stages"],
            [{"after_minutes": 5, "temperature": 24.0}, {"after_minutes": 10, "temperature": None}],
        )
        self.assertEqual(repaired["arrival_exit_grace_minutes"], 0)
        self.assertEqual(repaired["comfort_temperature"], 26.0)
        self.assertFalse(repaired["sync_comfort_to_schedule"])
        self.assertNotIn("unknown", repaired)
        # An explicit empty setback ladder is honoured; an empty arrival ladder is not.
        self.assertEqual(normalize({"setback_stages": []})["setback_stages"], [])
        self.assertEqual(len(normalize({"arrival_stages": []})["arrival_stages"]), 2)

    def test_runtime_records_drop_unknown_zones_and_bad_values(self) -> None:
        records = occupancy_models.normalize_occupancy_assist_runtime_data(
            {
                GUEST: {
                    "state": "setback_2",
                    "stage": "2",
                    "applied_stage": 2,
                    "arrival_released": 1,
                    "vacant_since": NOW.isoformat(),
                    "occupied_since": 5,
                    "last_action": " ",
                    "last_action_at": None,
                },
                LIVING: {"state": "bogus"},
                "climate.unknown": {"state": "comfort"},
                "climate.bad": "nope",
            },
            [GUEST, LIVING],
        )
        self.assertEqual(set(records), {GUEST, LIVING})
        self.assertEqual(records[GUEST]["state"], "setback_2")
        self.assertEqual(records[GUEST]["stage"], 2)
        self.assertTrue(records[GUEST]["arrival_released"])
        self.assertEqual(records[GUEST]["vacant_since"], NOW.isoformat())
        self.assertIsNone(records[GUEST]["occupied_since"])
        self.assertIsNone(records[GUEST]["last_action"])
        self.assertEqual(records[LIVING]["state"], "disabled")

    def test_schedule_data_round_trips_occupancy_assist_sections(self) -> None:
        data = normalize_schedule_data(
            {
                "zones": {GUEST: {"occupancy_assist": {"enabled": True, "occupancy_entity_id": "binary_sensor.x"}}},
                "occupancy_assist_runtime": {GUEST: {"state": "vacant"}, "climate.gone": {"state": "comfort"}},
            },
            [GUEST, LIVING],
        )
        self.assertTrue(data["zones"][GUEST]["occupancy_assist"]["enabled"])
        self.assertFalse(data["zones"][LIVING]["occupancy_assist"]["enabled"])
        self.assertEqual(set(data["occupancy_assist_runtime"]), {GUEST})
        serialized = models_module.serialize_schedule_data(data)
        self.assertEqual(serialized["occupancy_assist_runtime"], data["occupancy_assist_runtime"])
        self.assertIn("occupancy_assist", serialized["zones"][GUEST])
        self.assertIn(
            "occupancy_assist_state",
            const_module.ZONE_ENTITY_UNIQUE_ID_SUFFIXES,
        )
        for suffix in const_module.ZONE_OCCUPANCY_ASSIST_UNIQUE_ID_SUFFIXES:
            self.assertIn(suffix, const_module.ZONE_ENTITY_UNIQUE_ID_SUFFIXES)


class ValidationTest(OccupancyAssistTestCase):
    """Scheduler-level validation of per-zone updates."""

    async def test_updates_reject_invalid_configuration(self) -> None:
        update = self.scheduler.async_update_zone_occupancy_assist
        self._config(GUEST, enabled=False, occupancy_entity_id=None)
        with self.assertRaisesRegex(ValueError, "occupancy entity"):
            await update(GUEST, {"enabled": True})
        with self.assertRaisesRegex(ValueError, "ascending"):
            await update(GUEST, {"setback_stages": [{"after_minutes": 30, "temperature": 25}, {"after_minutes": 10, "temperature": 23}]})
        with self.assertRaisesRegex(ValueError, "at most"):
            await update(GUEST, {"setback_stages": [{"after_minutes": m, "temperature": 23} for m in (1, 2, 3, 4)]})
        with self.assertRaisesRegex(ValueError, "needs a temperature"):
            await update(GUEST, {"setback_stages": [{"after_minutes": 10}]})
        with self.assertRaisesRegex(ValueError, "release to the schedule"):
            await update(GUEST, {"arrival_stages": [{"after_minutes": 5, "temperature": 24}]})
        with self.assertRaisesRegex(ValueError, "between"):
            await update(GUEST, {"comfort_temperature": 60})
        with self.assertRaisesRegex(ValueError, "between"):
            await update(GUEST, {"setback_stages": [{"after_minutes": 10, "temperature": 2}]})
        with self.assertRaisesRegex(ValueError, "does not support"):
            await update(GUEST, {"setback_hvac_mode": "dry"})
        with self.assertRaisesRegex(ValueError, "not managed"):
            await update("climate.nope", {"enabled": True})
        # Nothing was persisted by the rejected updates.
        self.assertFalse(self.data["zones"][GUEST]["occupancy_assist"]["enabled"])
        self.assertEqual(self.data["zones"][GUEST]["occupancy_assist"]["comfort_temperature"], 22.0)

    async def test_valid_update_persists_and_starts_the_zone(self) -> None:
        self._config(GUEST, enabled=False)
        await self._start()
        self.assertEqual(self._state(GUEST), "disabled")
        self._occupancy(GUEST, "off", minutes_ago=10)
        saves = self.save_count

        config = await self.scheduler.async_update_zone_occupancy_assist(
            GUEST,
            {
                "enabled": True,
                "blocking_entity_ids": [BLOCKER],
                "setback_stages": [{"after_minutes": 10, "temperature": 23.5}],
                "arrival_stages": [{"after_minutes": 3, "temperature": None}],
            },
        )
        await asyncio.sleep(0)

        self.assertTrue(config["enabled"])
        self.assertEqual(config["blocking_entity_ids"], [BLOCKER])
        self.assertEqual(config["setback_stages"], [{"after_minutes": 10, "temperature": 23.5}])
        self.assertEqual(config["arrival_stages"], [{"after_minutes": 3, "temperature": None}])
        self.assertEqual(self.data["zones"][GUEST]["occupancy_assist"], config)
        self.assertGreater(self.save_count, saves)
        self.assertEqual(self._state(GUEST), "setback_1")
        self.assertEqual(self._holds(GUEST)[SETBACK_ID]["temperature"], 23.5)


class ServiceAndApiTest(unittest.IsolatedAsyncioTestCase):
    """Service registration/forwarding and WebSocket handler."""

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
            async_update_zone_occupancy_assist=AsyncMock(),
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

    async def test_set_service_forwards_fields_and_maps_errors(self) -> None:
        await services_module.async_setup_services(self.hass)
        handler, schema = self.services.handlers[
            (const_module.DOMAIN, const_module.SERVICE_SET_OCCUPANCY_ASSIST)
        ]
        self.assertIs(schema, occupancy_api.SET_OCCUPANCY_ASSIST_SCHEMA)
        await handler(
            SimpleNamespace(
                data={
                    "entity_id": GUEST,
                    "enabled": True,
                    "occupancy_entity_id": "binary_sensor.guest",
                    "comfort_temperature": 24,
                }
            )
        )
        self.scheduler.ensure_managed_entity.assert_called_with(GUEST)
        self.scheduler.async_update_zone_occupancy_assist.assert_awaited_once_with(
            GUEST,
            {"enabled": True, "occupancy_entity_id": "binary_sensor.guest", "comfort_temperature": 24},
        )
        self.scheduler.async_update_zone_occupancy_assist.side_effect = ValueError("needs an entity")
        with self.assertRaisesRegex(services_module.HomeAssistantError, "needs an entity"):
            await handler(SimpleNamespace(data={"entity_id": GUEST, "enabled": True}))
        await services_module.async_unload_services(self.hass)
        self.assertIn(
            (const_module.DOMAIN, const_module.SERVICE_SET_OCCUPANCY_ASSIST),
            self.services.removed,
        )

    async def test_ws_update_zone_occupancy_assist_forwards_and_reports_errors(self) -> None:
        runtime = {
            "scheduler": self.scheduler,
            "storage": SimpleNamespace(temperature_migration_required=False, data={"settings": {}}),
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

        await occupancy_api.ws_update_zone_occupancy_assist(
            SimpleNamespace(),
            connection,
            {
                "id": 7,
                "type": "velair/update_zone_occupancy_assist",
                "entity_id": GUEST,
                "occupancy_assist": {"enabled": True, "comfort_temperature": 24},
            },
        )
        self.scheduler.async_update_zone_occupancy_assist.assert_awaited_once_with(
            GUEST, {"enabled": True, "comfort_temperature": 24}
        )
        connection.send_result.assert_called_once_with(7, {"ok": True})

        self.scheduler.async_update_zone_occupancy_assist.side_effect = ValueError("bad stages")
        await occupancy_api.ws_update_zone_occupancy_assist(
            SimpleNamespace(),
            connection,
            {
                "id": 8,
                "type": "velair/update_zone_occupancy_assist",
                "entity_id": GUEST,
                "occupancy_assist": {"setback_stages": []},
            },
        )
        connection.send_error.assert_called_once_with(8, "invalid_occupancy_assist", "bad stages")

        api_module._get_runtime = lambda _hass: None
        await occupancy_api.ws_update_zone_occupancy_assist(
            SimpleNamespace(), connection, {"id": 9, "entity_id": GUEST, "occupancy_assist": {}}
        )
        connection.send_error.assert_called_with(9, "not_loaded", "Integration is not loaded")

    def test_ws_command_is_registered_by_api_setup(self) -> None:
        registered: list = []
        websocket_api = sys.modules["homeassistant.components.websocket_api"]
        original = websocket_api.async_register_command
        websocket_api.async_register_command = lambda hass, command: registered.append(command)
        self.addCleanup(setattr, websocket_api, "async_register_command", original)
        hass = SimpleNamespace(data={})
        api_module.async_setup_api(hass)
        self.assertIn(occupancy_api.ws_update_zone_occupancy_assist, registered)
        self.assertEqual(
            occupancy_api.WS_UPDATE_ZONE_OCCUPANCY_ASSIST, "velair/update_zone_occupancy_assist"
        )

    def test_schedule_response_and_export_include_occupancy_assist(self) -> None:
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
                get_humidity_assist_statuses=lambda: {},
                humidity_assist_compliant=False,
                get_occupancy_assist_statuses=lambda: {GUEST: {"state": "vacant"}},
                get_zone_runtime_statuses=lambda: {},
            ),
            "storage": SimpleNamespace(data=data),
        }
        response = api_module._build_schedule_response(runtime)
        self.assertEqual(response["occupancy_assist"], {GUEST: {"state": "vacant"}})
        self.assertIn("occupancy_assist", response["zones"][GUEST])
        exported = api_module._export_zones(data["zones"])
        self.assertEqual(
            exported[GUEST]["occupancy_assist"], data["zones"][GUEST]["occupancy_assist"]
        )
        runtime["scheduler"].temperature_migration_blocked = True
        self.assertEqual(api_module._build_schedule_response(runtime)["occupancy_assist"], {})


class EntityTest(unittest.IsolatedAsyncioTestCase):
    """Generated sensor, switch, and number entities."""

    def setUp(self) -> None:
        self.config = occupancy_models.normalize_occupancy_assist_data(
            {
                "enabled": True,
                "occupancy_entity_id": "binary_sensor.guest",
                "setback_stages": [
                    {"after_minutes": 10, "temperature": 23},
                    {"after_minutes": 30, "temperature": 25},
                ],
                "comfort_temperature": 22,
            }
        )
        self.status = {
            "state": "setback_1",
            "occupancy_entity_id": "binary_sensor.guest",
            "occupied_since": None,
            "vacant_since": "2026-05-19T17:50:00+00:00",
            "stage": 1,
            "next_stage_at": "2026-05-19T18:20:00+00:00",
            "next_temperature": 25.0,
            "blocked_by": None,
            "hold_temperature": 23.0,
            "last_action": "setback_hold",
            "last_action_at": "2026-05-19T18:00:00+00:00",
            "reason": "setback_stage",
            "error": None,
        }
        self.scheduler = SimpleNamespace(
            get_occupancy_assist_status=lambda entity_id: dict(self.status),
            get_occupancy_assist_config=lambda entity_id: dict(self.config),
            async_update_zone_occupancy_assist=AsyncMock(),
            get_temperature_limits=lambda entity_id: (16.0, 30.0),
            get_temperature_step=lambda entity_id: 0.5,
            _climate_manager=SimpleNamespace(temperature_unit=lambda entity_id: "°C"),
            temperature_migration_blocked=False,
        )
        self.entry = SimpleNamespace(
            entry_id="entry",
            data={"climate_entities": [GUEST]},
            options={},
            runtime_data=SimpleNamespace(scheduler=self.scheduler),
        )
        self.hass = SimpleNamespace(
            states={GUEST: SimpleNamespace(attributes={"friendly_name": "Guest room"})}
        )

    def test_lazy_builders_are_exposed_by_the_entities_module(self) -> None:
        self.assertIs(
            entities_module.build_occupancy_assist_numbers,
            number_entities.build_occupancy_assist_numbers,
        )
        with self.assertRaises(AttributeError):
            entities_module.does_not_exist  # noqa: B018

    def test_state_sensor_reports_status_and_attributes(self) -> None:
        (sensor,) = sensor_entities.build_occupancy_assist_sensors(self.hass, self.entry)
        self.assertEqual(sensor._attr_unique_id, "entry_climate_guest_occupancy_assist_state")
        self.assertEqual(sensor._attr_translation_key, "zone_occupancy_assist")
        self.assertEqual(sensor._attr_translation_placeholders, {"zone": "Guest room"})
        self.assertEqual(sensor._attr_options, list(occupancy_models.OCCUPANCY_ASSIST_STATES))
        self.assertEqual(sensor.native_value, "setback_1")
        self.assertTrue(sensor.available)
        self.assertEqual(
            sensor.extra_state_attributes,
            {
                "occupancy_entity_id": "binary_sensor.guest",
                "vacant_since": "2026-05-19T17:50:00+00:00",
                "stage": 1,
                "next_stage_at": "2026-05-19T18:20:00+00:00",
                "next_temperature": 25.0,
                "last_action": "setback_hold",
                "last_action_at": "2026-05-19T18:00:00+00:00",
                "reason": "setback_stage",
                "hold_temperature": 23.0,
            },
        )
        self.status = {"state": "disabled"}
        self.assertEqual(sensor.native_value, "disabled")
        self.assertIsNone(sensor.extra_state_attributes)

    async def test_switch_reflects_and_updates_enabled(self) -> None:
        (switch,) = switch_entities.build_occupancy_assist_switches(self.hass, self.entry)
        self.assertEqual(switch._attr_unique_id, "entry_climate_guest_occupancy_assist_enabled")
        self.assertEqual(switch._attr_translation_key, "zone_occupancy_assist")
        self.assertTrue(switch.is_on)
        await switch.async_turn_off()
        await switch.async_turn_on()
        self.assertEqual(
            [call.args for call in self.scheduler.async_update_zone_occupancy_assist.await_args_list],
            [(GUEST, {"enabled": False}), (GUEST, {"enabled": True})],
        )
        self.scheduler.temperature_migration_blocked = True
        self.assertFalse(switch.available)

    async def test_numbers_cover_every_stage_and_the_comfort_dial(self) -> None:
        numbers = number_entities.build_occupancy_assist_numbers(self.hass, self.entry)
        by_key = {number._attr_translation_key: number for number in numbers}
        self.assertEqual(
            sorted(by_key),
            sorted([
                "zone_setback_1_minutes", "zone_setback_1_temperature",
                "zone_setback_2_minutes", "zone_setback_2_temperature",
                "zone_setback_3_minutes", "zone_setback_3_temperature",
                "zone_arrival_1_minutes", "zone_arrival_2_minutes",
                "zone_arrival_1_temperature", "zone_comfort_temperature",
            ]),
        )
        self.assertEqual(
            sorted(number._attr_unique_id.removeprefix("entry_climate_guest_") for number in numbers),
            sorted(const_module.ZONE_OCCUPANCY_ASSIST_UNIQUE_ID_SUFFIXES[1:]),
        )
        self.assertEqual(by_key["zone_setback_1_minutes"].native_value, 10.0)
        self.assertEqual(by_key["zone_setback_1_minutes"]._attr_native_unit_of_measurement, "min")
        self.assertEqual(by_key["zone_setback_2_temperature"].native_value, 25.0)
        self.assertEqual(by_key["zone_setback_2_temperature"].native_unit_of_measurement, "°C")
        self.assertEqual(by_key["zone_setback_2_temperature"].native_min_value, 16.0)
        self.assertEqual(by_key["zone_setback_2_temperature"].native_max_value, 30.0)
        self.assertEqual(by_key["zone_setback_2_temperature"].native_step, 0.5)
        self.assertIsNone(by_key["zone_setback_3_minutes"].native_value)
        self.assertEqual(by_key["zone_arrival_1_temperature"].native_value, 26.0)
        self.assertEqual(by_key["zone_arrival_2_minutes"].native_value, 10.0)
        comfort = by_key["zone_comfort_temperature"]
        self.assertEqual(comfort.native_value, 22.0)
        self.assertEqual(
            comfort.extra_state_attributes,
            {"climate_entity_id": GUEST, "sync_comfort_to_schedule": True},
        )

        await by_key["zone_setback_2_minutes"].async_set_native_value(45.4)
        await by_key["zone_setback_3_temperature"].async_set_native_value(26.5)
        await by_key["zone_arrival_1_temperature"].async_set_native_value(25.0)
        await comfort.async_set_native_value(23.0)
        calls = [call.args for call in self.scheduler.async_update_zone_occupancy_assist.await_args_list]
        self.assertEqual(
            calls[0],
            (GUEST, {"setback_stages": [
                {"after_minutes": 10, "temperature": 23.0},
                {"after_minutes": 45, "temperature": 25.0},
            ]}),
        )
        self.assertEqual(
            calls[1],
            (GUEST, {"setback_stages": [
                {"after_minutes": 10, "temperature": 23.0},
                {"after_minutes": 30, "temperature": 25.0},
                {"after_minutes": 90, "temperature": 26.5},
            ]}),
        )
        self.assertEqual(
            calls[2],
            (GUEST, {"arrival_stages": [
                {"after_minutes": 5, "temperature": 25.0},
                {"after_minutes": 10, "temperature": None},
            ]}),
        )
        self.assertEqual(calls[3], (GUEST, {"comfort_temperature": 23.0}))

    def test_stage_update_appends_a_release_stage_after_the_last_arrival_temperature(self) -> None:
        config = {"arrival_stages": [{"after_minutes": 5, "temperature": None}]}
        self.assertEqual(
            entities_module.stage_update(config, "arrival", 1, "temperature", 24.0),
            {"arrival_stages": [
                {"after_minutes": 5, "temperature": 24.0},
                {"after_minutes": 10, "temperature": None},
            ]},
        )
        self.assertEqual(
            entities_module.stage_update({"setback_stages": []}, "setback", 3, "after_minutes", 120),
            {"setback_stages": [
                {"after_minutes": 10, "temperature": 23.0},
                {"after_minutes": 30, "temperature": 25.0},
                {"after_minutes": 120, "temperature": 26.0},
            ]},
        )
        with self.assertRaises(ValueError):
            number_entities.ZoneOccupancyStageMinutesNumber(self.entry, GUEST, "bogus", 1)


class RerunCoalescingTest(OccupancyAssistTestCase):
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
