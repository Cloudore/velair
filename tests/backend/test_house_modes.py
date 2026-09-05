"""House Modes coordinator, models, API, entity, and boundary tests."""

from __future__ import annotations

import asyncio
from datetime import datetime, timedelta, timezone
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

house_modes_module = importlib.import_module("custom_components.velair.house_modes")
house_modes_models = importlib.import_module("custom_components.velair.house_modes_models")
house_modes_api = importlib.import_module("custom_components.velair.house_modes_api")
api_module = importlib.import_module("custom_components.velair.api")
storage_module = importlib.import_module("custom_components.velair.storage")
models_module = helpers.models_module
const_module = helpers.const_module

LIVING = "climate.living"
DEN = "climate.den"
MASTER = "climate.master"
ZONES = (DEN, LIVING, MASTER)
PERSON_A = "person.a"
PERSON_B = "person.b"
BLE = "binary_sensor.anyone_ble"
SLEEP = "input_boolean.sleep_mode"
TRAVEL = "input_boolean.travel_mode"
PROJECTOR = "binary_sensor.den_projector"

MIN = timedelta(minutes=1)


def _load_entities_module():
    """Load house_modes_entities.py with the small entity surface it needs."""
    module_names = (
        "homeassistant.components.number",
        "homeassistant.components.sensor",
        "homeassistant.components.switch",
        "homeassistant.helpers.entity",
        "homeassistant.helpers.entity_platform",
        "custom_components.velair.entity",
    )
    previous_modules = {name: sys.modules.get(name) for name in module_names}
    package = sys.modules["custom_components.velair"]
    previous_entry_type = getattr(package, "VelairConfigEntry", None)

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
        number_platform = ModuleType("homeassistant.components.number")
        number_platform.NumberDeviceClass = SimpleNamespace(TEMPERATURE="temperature")
        number_platform.NumberEntity = object
        number_platform.NumberMode = SimpleNamespace(BOX="box")
        sys.modules["homeassistant.components.number"] = number_platform
        sensor_platform = ModuleType("homeassistant.components.sensor")
        sensor_platform.SensorDeviceClass = SimpleNamespace(ENUM="enum")
        sensor_platform.SensorEntity = object
        sys.modules["homeassistant.components.sensor"] = sensor_platform
        switch_platform = ModuleType("homeassistant.components.switch")
        switch_platform.SwitchEntity = object
        sys.modules["homeassistant.components.switch"] = switch_platform
        entity_helper = ModuleType("homeassistant.helpers.entity")
        entity_helper.EntityCategory = SimpleNamespace(CONFIG="config")
        sys.modules["homeassistant.helpers.entity"] = entity_helper
        entity_platform = ModuleType("homeassistant.helpers.entity_platform")
        entity_platform.AddConfigEntryEntitiesCallback = object
        sys.modules["homeassistant.helpers.entity_platform"] = entity_platform
        velair_entity = ModuleType("custom_components.velair.entity")
        velair_entity.VelairEntity = FakeVelairEntity
        sys.modules["custom_components.velair.entity"] = velair_entity
        package.VelairConfigEntry = object
        return importlib.import_module("custom_components.velair.house_modes_entities")
    finally:
        for name, previous in previous_modules.items():
            if previous is None:
                sys.modules.pop(name, None)
            else:
                sys.modules[name] = previous
        if previous_entry_type is None:
            delattr(package, "VelairConfigEntry")
        else:
            package.VelairConfigEntry = previous_entry_type


entities_module = _load_entities_module()


class HouseModesTestCase(unittest.IsolatedAsyncioTestCase):
    """Three cooling zones on a 24 degree schedule with two people at home."""

    def setUp(self) -> None:
        self.hass = FakeHass()
        self.climate = FakeClimateManager()
        self.save_count = 0
        self.timers: list[tuple[object, datetime]] = []
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
                                    "temperature": 24,
                                    "hvac_mode": "cool",
                                }
                            ],
                        },
                        "house_modes": {
                            "away_temperature": 26,
                            "away_deep_temperature": 28 if entity_id != DEN else None,
                            "sleep_temperature": 25 if entity_id == MASTER else 26,
                            "sleep_constraint": "absolute" if entity_id == MASTER else "raise_only",
                            "sleep_fan_mode": "high" if entity_id == MASTER else None,
                            "sleep_minimum_temperature": 22 if entity_id == MASTER else None,
                            "presleep_temperature": 23 if entity_id in (LIVING, MASTER) else None,
                        },
                    }
                    for entity_id in ZONES
                },
                "settings": {
                    "house_modes": {
                        "enabled": True,
                        "presence_entity_ids": [PERSON_A, PERSON_B],
                        "sleep_entity_id": SLEEP,
                        "travel_entity_id": TRAVEL,
                        "presleep_time": "21:00",
                    }
                },
            },
            list(ZONES),
        )
        self.data["zones"][DEN]["occupancy_assist"] = {"blocking_entity_ids": [PROJECTOR]}
        for entity_id in ZONES:
            self._head(entity_id, "cool")
        self.climate.climate_options[MASTER] = {"fan_mode": ["auto", "high"]}
        self._set(PERSON_A, "home", NOW - timedelta(hours=5))
        self._set(PERSON_B, "home", NOW - timedelta(hours=5))
        self._set(SLEEP, "off", NOW - timedelta(hours=5))
        self._set(TRAVEL, "off", NOW - timedelta(hours=5))
        self._set(PROJECTOR, "off", NOW - timedelta(hours=5))
        self._patch_timer()
        self.scheduler = self._make_scheduler()
        self.coordinator = self.scheduler.house_modes
        self._set_time(NOW)

    def tearDown(self) -> None:
        scheduler_module.dt_util.now = lambda: NOW
        house_modes_module.async_track_point_in_time = self._original_timer

    # -- fixture helpers -------------------------------------------------
    def _make_scheduler(self) -> VelairScheduler:
        return VelairScheduler(self.hass, self.data, self.climate, self._async_save)

    def _patch_timer(self) -> None:
        self._original_timer = house_modes_module.async_track_point_in_time

        def track(hass, action, when):
            self.timers.append((action, when))
            return lambda: None

        house_modes_module.async_track_point_in_time = track

    async def _async_save(self) -> None:
        self.save_count += 1

    def _set_time(self, when: datetime) -> None:
        scheduler_module.dt_util.now = lambda: when

    def _set(self, entity_id: str, state: str, changed_at: datetime | None = None, **attributes) -> None:
        namespace = SimpleNamespace(state=state, attributes=dict(attributes))
        if changed_at is not None:
            namespace.last_changed = changed_at
        self.hass.states[entity_id] = namespace

    def _head(self, entity_id: str, state: str, temperature: float = 24) -> None:
        self.hass.states[entity_id] = SimpleNamespace(
            state=state,
            attributes={"temperature": temperature, "current_temperature": 25, "fan_mode": "auto"},
        )

    def _settings(self, **updates) -> None:
        self.data["settings"]["house_modes"] = {
            **self.data["settings"]["house_modes"],
            **updates,
        }

    def _zone(self, entity_id: str, **updates) -> None:
        self.data["zones"][entity_id]["house_modes"] = {
            **self.data["zones"][entity_id]["house_modes"],
            **updates,
        }

    async def _start(self) -> None:
        await self.scheduler.async_start()
        await self._settle()

    async def _settle(self) -> None:
        for _ in range(6):
            await asyncio.sleep(0)

    async def _evaluate(self, when: datetime | None = None) -> None:
        if when is not None:
            self._set_time(when)
        await self.coordinator.async_evaluate()
        await self._settle()

    def _pause(self, entity_id: str, pause_id: str) -> dict | None:
        for reason in self.data["zones"][entity_id].get("pauses", []):
            if reason.get("pause_id") == pause_id:
                return reason
        return None

    def _manual(self, entity_id: str) -> dict | None:
        return self.scheduler._manual_control_status(entity_id, scheduler_module.dt_util.now())

    def _status(self) -> dict:
        return self.coordinator.status()

    def _events(self, name: str) -> list[dict]:
        return [
            payload
            for event_type, payload in self.hass.bus.events
            if event_type == EVENT_VELAIR and payload.get("event") == name
        ]

    def _calls(self, entity_id: str) -> list[tuple]:
        return [call for call in self.climate.calls if call[1] == entity_id]

    def _service_calls(self, domain: str) -> list[tuple]:
        return [call for call in self.hass.services.calls if call[0] == domain]

    def _leave(self, when: datetime) -> None:
        self._set(PERSON_A, "not_home", when)
        self._set(PERSON_B, "not_home", when)

    async def _enter_manual(self, entity_id: str, hvac_mode: str = "cool") -> None:
        self.climate.snapshots[entity_id] = {"hvac_mode": hvac_mode, "temperature": 23.0}
        await self.scheduler.async_enter_manual_adjustment(entity_id)
        await self._settle()

    async def _external_change(self, entity_id: str, previous: str, current: str) -> None:
        self._head(entity_id, current)
        self.climate.snapshots[entity_id] = {"hvac_mode": current, "temperature": 24.0}
        await self.scheduler.async_handle_external_climate_change(
            entity_id,
            changed_fields=["hvac_mode"],
            previous={"hvac_mode": previous},
            current={"hvac_mode": current},
            observed_snapshot={"hvac_mode": current, "temperature": 24.0},
        )
        await self._settle()


class PresenceTest(HouseModesTestCase):
    """P5 presence semantics."""

    async def test_everyone_home_is_not_empty(self) -> None:
        await self._start()
        status = self._status()
        self.assertEqual(status["state"], "home")
        self.assertFalse(status["presence_empty"])
        self.assertTrue(status["presence_certain"])
        self.assertIsNone(status["empty_since"])
        # Fresh install: the mode moves from the persisted default to home.
        change = self._events("house_mode_changed")[0]
        self.assertEqual((change["previous"], change["state"]), ("disabled", "home"))
        self.assertEqual(change["reason"], "start")

    async def test_all_not_home_is_empty_since_the_last_departure(self) -> None:
        self._set(PERSON_A, "not_home", NOW - timedelta(minutes=50))
        self._set(PERSON_B, "not_home", NOW - timedelta(minutes=20))
        await self._start()
        status = self._status()
        self.assertTrue(status["presence_empty"])
        self.assertEqual(status["empty_since"], (NOW - timedelta(minutes=20)).isoformat())
        self.assertEqual(status["next_stage_at"], (NOW + timedelta(minutes=40)).isoformat())
        self.assertEqual(status["state"], "home")

    async def test_unknown_or_unavailable_tracker_never_makes_the_house_empty(self) -> None:
        for value in ("unknown", "unavailable"):
            with self.subTest(value=value):
                self._set(PERSON_A, "not_home", NOW - timedelta(hours=3))
                self._set(PERSON_B, value, NOW - timedelta(hours=3))
                await self._evaluate()
                status = self._status()
                self.assertFalse(status["presence_empty"])
                self.assertFalse(status["presence_certain"])
                self.assertEqual(self.coordinator._runtime.away_stage, 0)
                self.assertIsNone(self._pause(LIVING, "away_1h"))

    async def test_zone_names_count_as_not_empty_but_not_home(self) -> None:
        self._set(PERSON_A, "not_home", NOW - timedelta(hours=3))
        self._set(PERSON_B, "work", NOW - timedelta(hours=3))
        await self._start()
        self.assertFalse(self._status()["presence_empty"])
        self.assertIsNone(self.coordinator._presence_facts(NOW, self.coordinator.settings()).home_since)

    async def test_no_presence_entities_never_empty(self) -> None:
        self._settings(presence_entity_ids=[])
        await self._start()
        facts = self.coordinator._presence_facts(NOW, self.coordinator.settings())
        self.assertFalse(facts.configured)
        self.assertFalse(facts.empty)

    async def test_corroboration_on_or_unavailable_blocks_empty(self) -> None:
        self._settings(presence_corroboration_entity_ids=[BLE])
        self._leave(NOW - timedelta(hours=2))
        for value, certain in (("on", True), ("unavailable", False)):
            with self.subTest(value=value):
                self._set(BLE, value, NOW - timedelta(hours=2))
                await self._evaluate()
                status = self._status()
                self.assertFalse(status["presence_empty"])
                self.assertEqual(status["presence_certain"], certain)

    async def test_corroboration_quiet_window_delays_and_shifts_empty_since(self) -> None:
        self._settings(presence_corroboration_entity_ids=[BLE])
        self._leave(NOW - timedelta(hours=2))
        self._set(BLE, "off", NOW - timedelta(minutes=10))
        await self._start()
        status = self._status()
        self.assertFalse(status["presence_empty"])
        # A timer is armed for the end of the 15 minute quiet window.
        self.assertIn(NOW + timedelta(minutes=5), [when for _action, when in self.timers])

        await self._evaluate(NOW + timedelta(minutes=5))
        status = self._status()
        self.assertTrue(status["presence_empty"])
        self.assertEqual(status["empty_since"], (NOW + timedelta(minutes=5)).isoformat())

    async def test_missing_last_changed_uses_first_observation_and_persisted_clock(self) -> None:
        self._set(PERSON_A, "not_home")
        self._set(PERSON_B, "not_home")
        await self._start()
        self.assertEqual(self._status()["empty_since"], NOW.isoformat())
        # A restart keeps the persisted clock instead of restarting it.
        restarted = self._make_scheduler()
        self._set_time(NOW + timedelta(minutes=30))
        await restarted.async_start()
        await self._settle()
        self.assertEqual(restarted.house_modes.status()["empty_since"], NOW.isoformat())


class AwayStagingTest(HouseModesTestCase):
    """Stage 1, stage 2, guards, and arrival release."""

    async def test_stage_one_holds_every_eligible_zone_after_away_after_minutes(self) -> None:
        self._leave(NOW - timedelta(minutes=30))
        await self._start()
        self.assertIsNone(self._pause(LIVING, "away_1h"))
        self.assertIn(NOW + timedelta(minutes=30), [when for _action, when in self.timers])

        await self._evaluate(NOW + timedelta(minutes=30))
        for entity_id in ZONES:
            hold = self._pause(entity_id, "away_1h")
            self.assertIsNotNone(hold, entity_id)
            self.assertEqual(hold["action"], "hold")
            self.assertEqual(hold["constraint"], "raise_only")
            self.assertEqual(hold["temperature"], 26.0)
            self.assertEqual(hold["hvac_mode"], "cool")
            self.assertEqual(hold["label"], "away stage 1")
            self.assertIsNone(self._pause(entity_id, "away_6h"))
        self.assertIn(("set_temperature", LIVING, 26.0, True, "cool"), self._calls(LIVING))
        status = self._status()
        self.assertEqual(status["state"], "away")
        self.assertEqual(status["away_stage"], 1)
        self.assertEqual(status["next_stage_at"], (NOW + timedelta(minutes=330)).isoformat())
        change = self._events("house_mode_changed")[-1]
        self.assertEqual((change["previous"], change["state"]), ("home", "away"))
        self.assertEqual(change["reason"], "manual")
        self.assertEqual(
            self.data["settings"]["house_modes_runtime"]["empty_since"],
            (NOW - timedelta(minutes=30)).isoformat(),
        )
        self.assertEqual(self.data["settings"]["house_modes_runtime"]["away_stage"], 1)

    async def test_stage_one_skips_off_head_fresh_manual_blocked_and_unavailable_zones(self) -> None:
        self._head(DEN, "off")
        self._set(PROJECTOR, "on", NOW)
        await self._enter_manual(LIVING)
        self.hass.states[MASTER] = SimpleNamespace(state="unavailable", attributes={})
        self._leave(NOW - timedelta(minutes=61))
        await self._start()

        self.assertIsNone(self._pause(DEN, "away_1h"))
        self.assertIsNone(self._pause(LIVING, "away_1h"))
        self.assertIsNone(self._pause(MASTER, "away_1h"))
        self.assertEqual(self._status()["state"], "away")
        self.assertEqual(
            self._status()["zone_reasons"],
            {DEN: "head_off", LIVING: "manual_fresh", MASTER: "head_unavailable"},
        )

    async def test_blocking_entity_alone_skips_the_zone(self) -> None:
        self._set(PROJECTOR, "on", NOW)
        self._leave(NOW - timedelta(minutes=61))
        await self._start()
        self.assertIsNone(self._pause(DEN, "away_1h"))
        self.assertIsNotNone(self._pause(LIVING, "away_1h"))
        self.assertEqual(self._status()["zone_reasons"][DEN], "blocked")

    async def test_manual_adjustment_older_than_the_guards_lease_is_held(self) -> None:
        self.data["settings"]["guards"] = {"manual_lease_minutes": 10}
        await self._enter_manual(LIVING)
        self._leave(NOW - timedelta(minutes=61))
        # Manual adjustment age is 0 at NOW; lease 10 minutes.
        await self._evaluate(NOW + timedelta(minutes=5))
        self.assertIsNone(self._pause(LIVING, "away_1h"))
        self.assertEqual(self.coordinator._runtime.away_stage, 1)

        # Stage 1 reconciles on every subsequent evaluate, so once the lease
        # expires the zone is picked up without waiting for stage 2.
        await self._evaluate(NOW + timedelta(minutes=15))
        hold = self._pause(LIVING, "away_1h")
        self.assertIsNotNone(hold)
        self.assertEqual(hold["temperature"], 26.0)

    async def test_default_lease_is_thirty_minutes_when_guards_are_absent(self) -> None:
        self.assertEqual(self.coordinator._lease_minutes(), 30)
        self.data["settings"]["guards"] = {"manual_lease_minutes": "garbage"}
        self.assertEqual(self.coordinator._lease_minutes(), 30)

    async def test_stage_two_deep_holds_only_zones_with_a_deep_temperature_and_retries_skips(self) -> None:
        self._head(DEN, "off")
        self._leave(NOW - timedelta(minutes=61))
        await self._start()
        self.assertIsNone(self._pause(DEN, "away_1h"))
        self._head(DEN, "cool")

        await self._evaluate(NOW + timedelta(minutes=300))
        self.assertEqual(self._pause(LIVING, "away_6h")["temperature"], 28.0)
        self.assertEqual(self._pause(LIVING, "away_6h")["label"], "away stage 2")
        self.assertEqual(self._pause(MASTER, "away_6h")["temperature"], 28.0)
        self.assertIsNone(self._pause(DEN, "away_6h"))
        # The zone skipped at stage 1 is retried at stage 2 only.
        self.assertEqual(self._pause(DEN, "away_1h")["temperature"], 26.0)
        status = self._status()
        self.assertEqual(status["state"], "away_deep")
        self.assertEqual(status["away_stage"], 2)
        self.assertIsNone(status["next_stage_at"])
        self.assertIn(("set_temperature", LIVING, 28.0, True, "cool"), self._calls(LIVING))

    async def test_stage_two_disabled_with_zero_minutes(self) -> None:
        self._settings(away_deep_after_minutes=0)
        self._leave(NOW - timedelta(hours=10))
        await self._start()
        self.assertEqual(self.coordinator._runtime.away_stage, 1)
        self.assertIsNone(self._pause(LIVING, "away_6h"))
        self.assertIsNone(self._status()["next_stage_at"])

    async def test_arrival_release_after_arrival_release_minutes(self) -> None:
        self._leave(NOW - timedelta(hours=7))
        await self._start()
        self.assertEqual(self._status()["state"], "away_deep")

        self._set(PERSON_A, "home", NOW)
        await self._evaluate(NOW + timedelta(minutes=1))
        self.assertIsNotNone(self._pause(LIVING, "away_1h"))
        self.assertEqual(self._status()["state"], "away_deep")
        self.assertIn(NOW + timedelta(minutes=3), [when for _action, when in self.timers])

        await self._evaluate(NOW + timedelta(minutes=3))
        for entity_id in ZONES:
            self.assertIsNone(self._pause(entity_id, "away_1h"), entity_id)
            self.assertIsNone(self._pause(entity_id, "away_6h"), entity_id)
        status = self._status()
        self.assertEqual(status["state"], "home")
        self.assertEqual(status["away_stage"], 0)
        self.assertIsNone(status["empty_since"])
        removed = [event for event in self._events("zone_pause_removed") if event["entity_id"] == LIVING]
        self.assertEqual({event["reason"] for event in removed}, {"house_modes_arrival"})
        self.assertIn(("set_temperature", LIVING, 24.0, True, "cool"), self._calls(LIVING))

    async def test_zone_switch_off_releases_its_away_holds(self) -> None:
        self._leave(NOW - timedelta(minutes=61))
        await self._start()
        self.assertIsNotNone(self._pause(LIVING, "away_1h"))
        await self.coordinator.async_update_zone_config(LIVING, {"away_enabled": False})
        self.assertIsNone(self._pause(LIVING, "away_1h"))
        self.assertIsNotNone(self._pause(MASTER, "away_1h"))


class SleepTest(HouseModesTestCase):
    """Sleep on/off with constraints, fan mode, and the minimum swap."""

    async def test_sleep_on_holds_zones_and_swaps_the_master_minimum(self) -> None:
        await self._start()
        self._set(SLEEP, "on", NOW)
        await self._evaluate()

        living = self._pause(LIVING, "sleep")
        self.assertEqual(living["constraint"], "raise_only")
        self.assertEqual(living["temperature"], 26.0)
        self.assertNotIn("fan_mode", living)
        master = self._pause(MASTER, "sleep")
        self.assertEqual(master["constraint"], "absolute")
        self.assertEqual(master["temperature"], 25.0)
        self.assertEqual(master["fan_mode"], "high")
        self.assertEqual(master["hvac_mode"], "cool")
        self.assertEqual(master["label"], "sleep")
        # Schedule 24, raise_only 26 -> 26 delivered; absolute 25 -> 25 with fan.
        self.assertIn(("set_temperature", LIVING, 26.0, True, "cool"), self._calls(LIVING))
        master_calls = [call for call in self._calls(MASTER) if call[0] == "set_temperature"]
        self.assertEqual(master_calls[-1][2], 25.0)
        self.assertEqual(master_calls[-1][5]["fan_mode"], "high")
        self.assertEqual(self.scheduler.get_zone_limits(MASTER)["min_temperature"], 22.0)
        self.assertIsNone(self.scheduler.get_zone_limits(LIVING)["min_temperature"])
        runtime = self.data["settings"]["house_modes_runtime"]
        self.assertEqual(runtime["saved_minimums"], {MASTER: {"saved": None, "applied": 22.0}})
        self.assertTrue(runtime["sleeping"])
        self.assertEqual(runtime["sleep_since"], NOW.isoformat())
        status = self._status()
        self.assertEqual(status["state"], "sleep")
        self.assertTrue(status["sleeping"])
        self.assertEqual(status["zones_sleeping"], [DEN, LIVING, MASTER])
        change = self._events("house_mode_changed")[-1]
        self.assertEqual((change["previous"], change["state"], change["sleeping"]), ("home", "sleep", True))

    async def test_sleep_off_releases_holds_and_restores_the_saved_minimum(self) -> None:
        await self.scheduler.async_update_zone_limits(MASTER, {"min_temperature": 20.0})
        await self._start()
        self._set(SLEEP, "on", NOW)
        await self._evaluate()
        self.assertEqual(self.scheduler.get_zone_limits(MASTER)["min_temperature"], 22.0)

        self._set(SLEEP, "off", NOW + timedelta(hours=8))
        await self._evaluate(NOW + timedelta(hours=8))
        for entity_id in ZONES:
            self.assertIsNone(self._pause(entity_id, "sleep"), entity_id)
        self.assertEqual(self.scheduler.get_zone_limits(MASTER)["min_temperature"], 20.0)
        self.assertEqual(self.data["settings"]["house_modes_runtime"]["saved_minimums"], {})
        self.assertFalse(self._status()["sleeping"])
        self.assertEqual(self._status()["state"], "home")

    async def test_minimum_changed_by_hand_while_asleep_is_kept(self) -> None:
        await self._start()
        self._set(SLEEP, "on", NOW)
        await self._evaluate()
        await self.scheduler.async_update_zone_limits(MASTER, {"min_temperature": 21.0})

        self._set(SLEEP, "off", NOW + timedelta(hours=8))
        await self._evaluate(NOW + timedelta(hours=8))
        self.assertEqual(self.scheduler.get_zone_limits(MASTER)["min_temperature"], 21.0)

    async def test_sleep_skips_zones_in_manual_adjustment_and_releases_presleep(self) -> None:
        await self._start()
        await self._enter_manual(DEN)
        await self.scheduler.async_pause_zone(
            LIVING, action="hold", pause_id="presleep", temperature=23.0, constraint="lower_only"
        )
        self._set(SLEEP, "on", NOW)
        await self._evaluate()
        self.assertIsNone(self._pause(DEN, "sleep"))
        self.assertEqual(self._status()["zone_reasons"][DEN], "manual")
        self.assertIsNone(self._pause(LIVING, "presleep"))
        self.assertIsNotNone(self._pause(LIVING, "sleep"))

    async def test_unavailable_sleep_entity_holds_the_current_state(self) -> None:
        await self._start()
        self._set(SLEEP, "unknown", NOW)
        await self._evaluate()
        self.assertFalse(self._status()["sleeping"])

        self._set(SLEEP, "on", NOW)
        await self._evaluate()
        self.assertTrue(self._status()["sleeping"])
        self._set(SLEEP, "unavailable", NOW + MIN)
        await self._evaluate(NOW + MIN)
        self.assertTrue(self._status()["sleeping"])
        self.assertIsNotNone(self._pause(LIVING, "sleep"))

    async def test_sleep_combined_with_away_is_reported_as_an_attribute(self) -> None:
        self._leave(NOW - timedelta(minutes=61))
        self._set(SLEEP, "on", NOW - timedelta(minutes=61))
        await self._start()
        status = self._status()
        self.assertEqual(status["state"], "away")
        self.assertTrue(status["sleeping"])

    async def test_zone_sleep_switch_off_releases_and_restores(self) -> None:
        await self._start()
        self._set(SLEEP, "on", NOW)
        await self._evaluate()
        await self.coordinator.async_update_zone_config(MASTER, {"sleep_enabled": False})
        self.assertIsNone(self._pause(MASTER, "sleep"))
        self.assertIsNone(self.scheduler.get_zone_limits(MASTER)["min_temperature"])
        self.assertIsNotNone(self._pause(LIVING, "sleep"))

    async def test_sleep_temperature_change_while_asleep_updates_the_hold(self) -> None:
        await self._start()
        self._set(SLEEP, "on", NOW)
        await self._evaluate()
        await self.coordinator.async_update_zone_config(LIVING, {"sleep_temperature": 27.0})
        self.assertEqual(self._pause(LIVING, "sleep")["temperature"], 27.0)


class PreSleepTest(HouseModesTestCase):
    """The once-a-day timed lower-only hold."""

    async def test_presleep_applies_timed_lower_only_holds_at_presleep_time(self) -> None:
        await self._start()
        self.assertIn(NOW + timedelta(hours=3), [when for _action, when in self.timers])

        await self._evaluate(NOW + timedelta(hours=3))
        living = self._pause(LIVING, "presleep")
        self.assertEqual(living["constraint"], "lower_only")
        self.assertEqual(living["temperature"], 23.0)
        self.assertEqual(living["until"], (NOW + timedelta(hours=7)).isoformat())
        self.assertEqual(living["label"], "pre-sleep")
        self.assertIsNotNone(self._pause(MASTER, "presleep"))
        self.assertIsNone(self._pause(DEN, "presleep"))
        self.assertIn(("set_temperature", LIVING, 23.0, True, "cool"), self._calls(LIVING))
        self.assertEqual(self.data["settings"]["house_modes_runtime"]["presleep_applied_on"], "2026-05-19")
        self.assertEqual(self._status()["zones_presleep"], [LIVING, MASTER])

        added = len([e for e in self._events("zone_pause_added") if e.get("pause_id") == "presleep"])
        await self._evaluate(NOW + timedelta(hours=3, minutes=5))
        self.assertEqual(
            len([e for e in self._events("zone_pause_added") if e.get("pause_id") == "presleep"]),
            added,
        )

    async def test_presleep_skips_while_travel_empty_or_asleep(self) -> None:
        for setup in ("travel", "empty", "sleep"):
            with self.subTest(setup=setup):
                self.setUp()
                if setup == "travel":
                    self._set(TRAVEL, "on", NOW)
                elif setup == "empty":
                    self._leave(NOW - timedelta(minutes=5))
                else:
                    self._set(SLEEP, "on", NOW)
                await self._start()
                await self._evaluate(NOW + timedelta(hours=3))
                self.assertIsNone(self._pause(LIVING, "presleep"))
                self.assertEqual(self._status()["last_action"], "pre-sleep skipped")

    async def test_presleep_skips_zones_in_manual_adjustment(self) -> None:
        await self._start()
        await self._enter_manual(LIVING)
        await self._evaluate(NOW + timedelta(hours=3))
        self.assertIsNone(self._pause(LIVING, "presleep"))
        self.assertIsNotNone(self._pause(MASTER, "presleep"))

    async def test_presleep_disabled_with_null_time(self) -> None:
        self._settings(presleep_time=None)
        await self._start()
        await self._evaluate(NOW + timedelta(hours=3))
        self.assertIsNone(self._pause(LIVING, "presleep"))

    async def test_restart_inside_the_window_applies_the_remaining_duration(self) -> None:
        self._set_time(NOW + timedelta(hours=4))
        await self._start()
        living = self._pause(LIVING, "presleep")
        self.assertIsNotNone(living)
        self.assertEqual(living["until"], (NOW + timedelta(hours=7)).isoformat())


class TravelTest(HouseModesTestCase):
    """Travel entry, re-check, exit, freeze, and Humidity Assist."""

    def _configure_humidity(self, entity_id: str, enabled: bool = False) -> None:
        self.data["zones"][entity_id]["humidity_assist"] = {
            **self.data["zones"][entity_id]["humidity_assist"],
            "enabled": enabled,
            "sensor_entity_id": f"sensor.{entity_id.split('.')[1]}_dew_point",
            "target": 22.0,
            "pulse_temperature": 24.0,
        }
        self.hass.states[f"sensor.{entity_id.split('.')[1]}_dew_point"] = SimpleNamespace(
            state="21.0", attributes={"unit_of_measurement": "°C"}
        )

    def _humidity_enabled(self, entity_id: str) -> bool:
        return bool(self.data["zones"][entity_id]["humidity_assist"]["enabled"])

    async def test_travel_entry_parks_when_empty_and_freezes_off_heads_in_manual(self) -> None:
        self._configure_humidity(LIVING)
        self._configure_humidity(MASTER, enabled=True)
        await self._start()
        await self._enter_manual(DEN, hvac_mode="off")
        self._head(DEN, "off")
        self._leave(NOW - timedelta(minutes=5))
        self._set(TRAVEL, "on", NOW)
        await self._evaluate()

        frozen = self._pause(DEN, "travel_off")
        self.assertEqual(frozen["action"], "none")
        self.assertNotIn("until", frozen)
        self.assertIsNone(self._pause(DEN, "travel_park"))
        for entity_id in (LIVING, MASTER):
            park = self._pause(entity_id, "travel_park")
            self.assertEqual(park["constraint"], "raise_only")
            self.assertEqual(park["temperature"], 29.0)
            self.assertEqual(park["hvac_mode"], "cool")
            self.assertEqual(park["label"], "travel park")
        self.assertIn(("set_temperature", LIVING, 29.0, True, "cool"), self._calls(LIVING))
        parked = self._events("house_zone_parked")
        self.assertEqual(
            [(e["entity_id"], e["pause_id"], e["action"], e["temperature"], e["reason"]) for e in parked],
            [
                (DEN, "travel_off", "none", None, "travel_started"),
                (LIVING, "travel_park", "hold", 29.0, "travel_started"),
                (MASTER, "travel_park", "hold", 29.0, "travel_started"),
            ],
        )
        self.assertTrue(self._humidity_enabled(LIVING))
        self.assertTrue(self._humidity_enabled(MASTER))
        self.assertEqual(
            self.data["settings"]["house_modes_runtime"]["humidity_assist_enabled_zones"],
            [LIVING],
        )
        status = self._status()
        self.assertEqual(status["state"], "travel")
        self.assertEqual(status["zones_parked"], [LIVING, MASTER])
        self.assertEqual(status["zones_frozen"], [DEN])
        self.assertEqual(status["travel_since"], NOW.isoformat())
        self.assertTrue(self.data["settings"]["house_modes_runtime"]["travel_active"])
        self.assertIn(NOW + timedelta(minutes=30), [when for _action, when in self.timers])

    async def test_off_head_without_manual_adjustment_is_parked_not_frozen(self) -> None:
        await self._start()
        self._head(DEN, "off")
        self._leave(NOW - timedelta(minutes=5))
        self._set(TRAVEL, "on", NOW)
        await self._evaluate()
        self.assertIsNone(self._pause(DEN, "travel_off"))
        self.assertIsNotNone(self._pause(DEN, "travel_park"))

    async def test_freeze_disabled_leaves_off_heads_alone(self) -> None:
        self._settings(travel_freeze_off_heads=False)
        await self._start()
        await self._enter_manual(DEN, hvac_mode="off")
        self._head(DEN, "off")
        self._leave(NOW - timedelta(minutes=5))
        self._set(TRAVEL, "on", NOW)
        await self._evaluate()
        self.assertIsNone(self._pause(DEN, "travel_off"))
        self.assertIsNone(self._pause(DEN, "travel_park"))

    async def test_travel_recheck_parks_when_empty_and_lifts_when_someone_is_home(self) -> None:
        await self._start()
        self._set(TRAVEL, "on", NOW)
        await self._evaluate()
        self.assertIsNone(self._pause(LIVING, "travel_park"))
        self.assertEqual(self._status()["state"], "travel")

        self._leave(NOW + MIN)
        await self._evaluate(NOW + MIN)
        self.assertIsNotNone(self._pause(LIVING, "travel_park"))
        self.assertEqual(self._events("house_zone_parked")[-1]["reason"], "travel_recheck")

        self._set(PERSON_A, "home", NOW + 2 * MIN)
        await self._evaluate(NOW + 2 * MIN)
        self.assertIsNone(self._pause(LIVING, "travel_park"))

        # Uncertain presence keeps whatever is in place (P5).
        self._leave(NOW + 3 * MIN)
        await self._evaluate(NOW + 3 * MIN)
        self.assertIsNotNone(self._pause(LIVING, "travel_park"))
        self._set(PERSON_A, "unknown", NOW + 4 * MIN)
        await self._evaluate(NOW + 4 * MIN)
        self.assertIsNotNone(self._pause(LIVING, "travel_park"))

    async def test_travel_suspends_away_staging_but_state_reports_travel(self) -> None:
        self._leave(NOW - timedelta(minutes=61))
        await self._start()
        self.assertEqual(self._status()["state"], "away")
        self._set(TRAVEL, "on", NOW)
        await self._evaluate()
        self.assertEqual(self._status()["state"], "travel")
        self.assertIsNotNone(self._pause(LIVING, "away_1h"))
        self.assertIsNotNone(self._pause(LIVING, "travel_park"))
        await self._evaluate(NOW + timedelta(hours=6))
        self.assertIsNone(self._pause(LIVING, "away_6h"))

    async def test_travel_exit_releases_park_keeps_off_freeze_and_disables_humidity_assist(self) -> None:
        self._configure_humidity(LIVING)
        self._configure_humidity(MASTER, enabled=True)
        await self._start()
        await self._enter_manual(DEN, hvac_mode="off")
        self._head(DEN, "off")
        await self._enter_manual(MASTER, hvac_mode="off")
        self._head(MASTER, "off")
        self._leave(NOW - timedelta(minutes=5))
        self._set(TRAVEL, "on", NOW)
        await self._evaluate()
        self.assertIsNotNone(self._pause(DEN, "travel_off"))
        self.assertIsNotNone(self._pause(MASTER, "travel_off"))
        self.assertIsNotNone(self._pause(LIVING, "travel_park"))

        # Master came back on through a non-observed path; den is still off.
        self._head(MASTER, "cool")
        self._set(TRAVEL, "off", NOW + timedelta(days=3))
        await self._evaluate(NOW + timedelta(days=3))
        self.assertIsNone(self._pause(LIVING, "travel_park"))
        self.assertIsNotNone(self._pause(DEN, "travel_off"))
        self.assertIsNone(self._pause(MASTER, "travel_off"))
        self.assertFalse(self._humidity_enabled(LIVING))
        self.assertTrue(self._humidity_enabled(MASTER))
        status = self._status()
        # Three days empty: away staging resumes at stage 2 right away.
        self.assertEqual(status["state"], "away_deep")
        self.assertIsNotNone(self._pause(LIVING, "away_6h"))
        self.assertIsNone(status["travel_since"])
        self.assertFalse(self.data["settings"]["house_modes_runtime"]["travel_active"])

    async def test_external_off_to_on_releases_travel_off_and_enters_manual_adjustment(self) -> None:
        await self._start()
        await self._enter_manual(DEN, hvac_mode="off")
        self._head(DEN, "off")
        self._leave(NOW - timedelta(minutes=5))
        self._set(TRAVEL, "on", NOW)
        await self._evaluate()
        self.assertIsNotNone(self._pause(DEN, "travel_off"))
        # Guards released the manual adjustment; only the freeze remains.
        await self.scheduler.async_resume_automatic_control(DEN)
        self.assertIsNone(self._manual(DEN))
        self.assertIsNotNone(self._pause(DEN, "travel_off"))

        await self._external_change(DEN, "off", "cool")
        self.assertIsNone(self._pause(DEN, "travel_off"))
        self.assertIsNotNone(self._manual(DEN))
        self.assertEqual(self._manual(DEN)["source"], "explicit")
        self.assertEqual(self._status()["zones_frozen"], [])

    async def test_external_off_to_on_with_manual_still_active_only_releases_the_freeze(self) -> None:
        await self._start()
        await self._enter_manual(DEN, hvac_mode="off")
        self._head(DEN, "off")
        self._leave(NOW - timedelta(minutes=5))
        self._set(TRAVEL, "on", NOW)
        await self._evaluate()

        await self._external_change(DEN, "off", "cool")
        self.assertIsNone(self._pause(DEN, "travel_off"))
        self.assertIsNotNone(self._manual(DEN))

    async def test_on_to_off_during_travel_freezes_after_manual_adjustment(self) -> None:
        self.data["zones"][LIVING]["external_change_policy"] = {
            "action": "until_resumed",
            "duration_minutes": 120,
        }
        await self._start()
        self._leave(NOW - timedelta(minutes=5))
        self._set(TRAVEL, "on", NOW)
        await self._evaluate()
        self.assertIsNotNone(self._pause(LIVING, "travel_park"))

        await self._external_change(LIVING, "cool", "off")
        self.assertIsNotNone(self._manual(LIVING))
        self.assertIsNotNone(self._pause(LIVING, "travel_off"))
        self.assertEqual(self._events("house_zone_parked")[-1]["reason"], "head_turned_off")
        self.assertEqual(self._status()["zones_frozen"], [LIVING])

    async def test_on_to_off_with_keep_automatic_policy_is_not_frozen(self) -> None:
        await self._start()
        self._leave(NOW - timedelta(minutes=5))
        self._set(TRAVEL, "on", NOW)
        await self._evaluate()
        await self._external_change(LIVING, "cool", "off")
        self.assertIsNone(self._manual(LIVING))
        self.assertIsNone(self._pause(LIVING, "travel_off"))

    async def test_on_to_off_outside_travel_is_ignored(self) -> None:
        self.data["zones"][LIVING]["external_change_policy"] = {
            "action": "until_resumed",
            "duration_minutes": 120,
        }
        await self._start()
        await self._external_change(LIVING, "cool", "off")
        self.assertIsNotNone(self._manual(LIVING))
        self.assertIsNone(self._pause(LIVING, "travel_off"))

    async def test_auto_exit_turns_the_travel_entity_off_on_arrival(self) -> None:
        self._settings(travel_auto_exit_on_arrival=True)
        self._leave(NOW - timedelta(minutes=5))
        self._set(TRAVEL, "on", NOW)
        await self._start()
        self.assertEqual(self._status()["state"], "travel")

        self._set(PERSON_A, "home", NOW + MIN)
        self.coordinator._handle_state_change(
            SimpleNamespace(
                data={
                    "entity_id": PERSON_A,
                    "old_state": SimpleNamespace(state="not_home"),
                    "new_state": SimpleNamespace(state="home"),
                }
            )
        )
        await self._settle()
        self.assertIn(
            ("homeassistant", "turn_off", {"entity_id": TRAVEL}, True),
            self.hass.services.calls,
        )
        self.assertEqual(self._status()["last_action"], f"travel auto-exit: {PERSON_A} arrived")

    async def test_auto_exit_disabled_does_not_call_any_service(self) -> None:
        self._leave(NOW - timedelta(minutes=5))
        self._set(TRAVEL, "on", NOW)
        await self._start()
        self.coordinator._handle_state_change(
            SimpleNamespace(
                data={
                    "entity_id": PERSON_A,
                    "old_state": SimpleNamespace(state="not_home"),
                    "new_state": SimpleNamespace(state="home"),
                }
            )
        )
        await self._settle()
        self.assertEqual(self._service_calls("homeassistant"), [])

    async def test_only_the_configured_travel_entity_is_ever_called(self) -> None:
        self._settings(travel_auto_exit_on_arrival=True, travel_entity_id=None)
        await self._start()
        self.coordinator._handle_state_change(
            SimpleNamespace(
                data={
                    "entity_id": PERSON_A,
                    "old_state": SimpleNamespace(state="not_home"),
                    "new_state": SimpleNamespace(state="home"),
                }
            )
        )
        await self._settle()
        self.assertEqual(self._service_calls("homeassistant"), [])


class MasterSwitchTest(HouseModesTestCase):
    """Disabling releases everything; enabling re-evaluates."""

    async def test_disabling_releases_holds_restores_minimums_and_reports_disabled(self) -> None:
        self._leave(NOW - timedelta(minutes=61))
        self._set(SLEEP, "on", NOW - timedelta(hours=1))
        await self._start()
        self.assertIsNotNone(self._pause(LIVING, "away_1h"))
        self.assertEqual(self.scheduler.get_zone_limits(MASTER)["min_temperature"], 22.0)

        await self.coordinator.async_update_settings({"enabled": False})
        await self._settle()
        for entity_id in ZONES:
            for pause_id in house_modes_models.HOUSE_MODES_PAUSE_IDS:
                self.assertIsNone(self._pause(entity_id, pause_id), (entity_id, pause_id))
        self.assertIsNone(self.scheduler.get_zone_limits(MASTER)["min_temperature"])
        status = self._status()
        self.assertEqual(status["state"], "disabled")
        self.assertFalse(status["sleeping"])
        self.assertEqual(self._events("house_mode_changed")[-1]["state"], "disabled")
        self.assertEqual(self.coordinator._tracked_entities, ())

        await self.coordinator.async_update_settings({"enabled": True})
        await self._settle()
        self.assertEqual(self._status()["state"], "away")
        self.assertIsNotNone(self._pause(LIVING, "away_1h"))
        self.assertTrue(self._status()["sleeping"])

    async def test_default_master_switch_is_off_like_humidity_assist(self) -> None:
        self.assertFalse(house_modes_models.normalize_house_modes_settings(None)["enabled"])


class RestartContinuityTest(HouseModesTestCase):
    """Persisted runtime survives a scheduler rebuild."""

    async def test_runtime_is_restored_without_reapplying_or_releasing(self) -> None:
        self._leave(NOW - timedelta(minutes=61))
        self._set(SLEEP, "on", NOW - timedelta(minutes=30))
        await self._start()
        self.assertEqual(self._status()["state"], "away")
        self.assertTrue(self._status()["sleeping"])
        runtime = self.data["settings"]["house_modes_runtime"]
        self.assertEqual(runtime["state"], "away")
        self.assertEqual(runtime["sleep_since"], NOW.isoformat())
        added_before = len(self._events("zone_pause_added"))

        restarted = self._make_scheduler()
        coordinator = restarted.house_modes
        self.assertEqual(coordinator._runtime.away_stage, 1)
        self.assertTrue(coordinator._runtime.sleeping)
        self.assertEqual(coordinator._runtime.saved_minimums, {MASTER: {"saved": None, "applied": 22.0}})
        self._set_time(NOW + timedelta(minutes=10))
        await restarted.async_start()
        await self._settle()
        self.assertEqual(len(self._events("zone_pause_added")), added_before)
        self.assertIsNotNone(self._pause(LIVING, "away_1h"))
        self.assertIsNotNone(self._pause(MASTER, "sleep"))
        self.assertEqual(coordinator.status()["state"], "away")

        # The missed stage 2 applies right after a restart inside the window.
        self._set_time(NOW + timedelta(hours=6))
        await coordinator.async_evaluate()
        await self._settle()
        self.assertIsNotNone(self._pause(LIVING, "away_6h"))
        self.assertEqual(coordinator.status()["state"], "away_deep")

        # Waking after the restart still restores the swapped minimum.
        self._set(SLEEP, "off", NOW + timedelta(hours=7))
        await coordinator.async_evaluate()
        await self._settle()
        self.assertIsNone(self._pause(MASTER, "sleep"))
        self.assertIsNone(restarted.get_zone_limits(MASTER)["min_temperature"])

    async def test_restart_reapplies_a_sleep_hold_that_was_lost_without_clearing_sleeping(self) -> None:
        """Reproduces a real incident: an outage (or a config-entry option like
        apply_active_schedule_on_startup) can clear a zone's persisted hold
        without clearing the coordinator's own `sleeping` flag. Previously
        sleep was only (re-)applied on the off-to-on transition, so a zone in
        this state stayed unheld for the rest of the night. It must now be
        picked up on the very next evaluate, restart included."""
        self._set(SLEEP, "on", NOW)
        await self._start()
        self.assertIsNotNone(self._pause(MASTER, "sleep"))
        self.assertIsNotNone(self._pause(LIVING, "sleep"))
        self.assertEqual(self.scheduler.get_zone_limits(MASTER)["min_temperature"], 22.0)

        # Simulate the hold being lost while `sleeping` stays true in storage.
        self.data["zones"][MASTER]["pauses"] = []
        self.data["zones"][LIVING]["pauses"] = []
        self.data["settings"]["house_modes_runtime"]["saved_minimums"] = {}
        self.scheduler._data["zones"][MASTER]["limits"]["min_temperature"] = None

        restarted = self._make_scheduler()
        self.assertTrue(restarted.house_modes._runtime.sleeping)
        self.assertIsNone(self._pause(MASTER, "sleep"))  # confirms the hold is really gone
        await restarted.async_start()
        await self._settle()

        self.assertIsNotNone(self._pause(MASTER, "sleep"))
        self.assertIsNotNone(self._pause(LIVING, "sleep"))
        self.assertEqual(restarted.get_zone_limits(MASTER)["min_temperature"], 22.0)
        # sleep_since must not have been reset by the reconciliation pass.
        self.assertEqual(
            self.data["settings"]["house_modes_runtime"]["sleep_since"], NOW.isoformat()
        )

    async def test_zone_manual_when_sleep_started_gets_the_hold_once_manual_ends(self) -> None:
        """The other half of the same incident: a zone that was in a manual
        adjustment at the exact moment sleep engaged used to miss the hold
        permanently, since only the on/off transition ever applied it."""
        await self._enter_manual(DEN)
        self._set(SLEEP, "on", NOW)
        await self._start()
        self.assertIsNone(self._pause(DEN, "sleep"))
        self.assertEqual(self._status()["zone_reasons"][DEN], "manual")

        await self.scheduler.async_resume_automatic_control(DEN)
        await self._evaluate(NOW + timedelta(minutes=1))

        self.assertIsNotNone(self._pause(DEN, "sleep"))
        self.assertNotIn(DEN, self._status().get("zone_reasons", {}))

    async def test_travel_runtime_survives_restart(self) -> None:
        self._leave(NOW - timedelta(minutes=5))
        self._set(TRAVEL, "on", NOW - timedelta(minutes=5))
        await self._start()
        restarted = self._make_scheduler()
        self.assertTrue(restarted.house_modes._runtime.travel_active)
        parked_before = len(self._events("house_zone_parked"))
        await restarted.async_start()
        await self._settle()
        self.assertEqual(len(self._events("house_zone_parked")), parked_before)
        self.assertEqual(restarted.house_modes.status()["state"], "travel")

    async def test_stop_clears_listeners_and_timers(self) -> None:
        await self._start()
        self.assertNotEqual(self.coordinator._tracked_entities, ())
        await self.scheduler.async_stop()
        self.assertEqual(self.coordinator._tracked_entities, ())
        self.assertIsNone(self.coordinator._timer_due_at)
        self.assertFalse(self.coordinator._started)


class FahrenheitTest(HouseModesTestCase):
    """Unit-aware defaults, holds, and storage conversion."""

    async def test_fahrenheit_defaults_and_holds(self) -> None:
        self.climate.temperature_unit = lambda entity_id: "°F"
        for entity_id in ZONES:
            self.climate.limits[entity_id] = (60.0, 90.0)
            self.climate.steps[entity_id] = 0.1
            self.data["zones"][entity_id]["schedule"]["tuesday"][0]["temperature"] = 75.0
            self.data["zones"][entity_id].pop("house_modes")
        self.data["settings"]["house_modes"] = {
            "enabled": True,
            "presence_entity_ids": [PERSON_A, PERSON_B],
            "travel_entity_id": TRAVEL,
        }
        settings = self.coordinator.settings()
        self.assertAlmostEqual(settings["travel_park_temperature"], 84.2)
        config = self.coordinator.zone_config(LIVING)
        self.assertAlmostEqual(config["away_temperature"], 78.8)
        self.assertAlmostEqual(config["sleep_temperature"], 78.8)

        self._leave(NOW - timedelta(minutes=61))
        await self._start()
        self.assertAlmostEqual(self._pause(LIVING, "away_1h")["temperature"], 78.8)
        self._set(TRAVEL, "on", NOW)
        await self._evaluate()
        self.assertAlmostEqual(self._pause(LIVING, "travel_park")["temperature"], 84.2)

    def test_storage_converts_house_modes_temperatures(self) -> None:
        data = {
            "zones": {
                LIVING: {
                    "house_modes": {
                        "away_temperature": 26.0,
                        "away_deep_temperature": None,
                        "sleep_temperature": 25.0,
                        "sleep_minimum_temperature": 22.0,
                        "presleep_temperature": 23.0,
                        "away_enabled": True,
                    }
                }
            },
            "settings": {"house_modes": {"travel_park_temperature": 29.0, "away_after_minutes": 60}},
        }
        storage_module._convert_scheduler_temperatures(data, "°C", "°F")
        zone = data["zones"][LIVING]["house_modes"]
        self.assertAlmostEqual(zone["away_temperature"], 78.8)
        self.assertIsNone(zone["away_deep_temperature"])
        self.assertAlmostEqual(zone["sleep_temperature"], 77.0)
        self.assertAlmostEqual(zone["sleep_minimum_temperature"], 71.6)
        self.assertAlmostEqual(zone["presleep_temperature"], 73.4)
        self.assertTrue(zone["away_enabled"])
        self.assertAlmostEqual(data["settings"]["house_modes"]["travel_park_temperature"], 84.2)
        self.assertEqual(data["settings"]["house_modes"]["away_after_minutes"], 60)

    def test_portable_defaults_are_hydrated_in_the_source_unit(self) -> None:
        sections = {
            "settings": {"house_modes": {"away_after_minutes": 45}},
            "zones": {LIVING: {"house_modes": {"away_enabled": False}}, DEN: {}},
        }
        house_modes_api.hydrate_house_modes_portable_defaults(sections, "°F")
        self.assertAlmostEqual(sections["settings"]["house_modes"]["travel_park_temperature"], 84.2)
        self.assertAlmostEqual(sections["zones"][LIVING]["house_modes"]["away_temperature"], 78.8)
        self.assertFalse(sections["zones"][LIVING]["house_modes"]["away_enabled"])
        self.assertNotIn("house_modes", sections["zones"][DEN])


class ConfigurationTest(HouseModesTestCase):
    """Validation and normalization."""

    async def test_zone_temperature_outside_the_climate_range_is_rejected(self) -> None:
        with self.assertRaisesRegex(ValueError, "away_temperature must be between"):
            await self.coordinator.async_update_zone_config(LIVING, {"away_temperature": 60})
        with self.assertRaisesRegex(ValueError, "must be a number"):
            await self.coordinator.async_update_zone_config(LIVING, {"sleep_temperature": "warm"})
        with self.assertRaisesRegex(ValueError, "not managed"):
            await self.coordinator.async_update_zone_config("climate.nope", {"away_enabled": False})

    async def test_zone_update_merges_and_persists(self) -> None:
        await self._start()
        saves = self.save_count
        config = await self.coordinator.async_update_zone_config(
            LIVING, {"away_deep_temperature": None, "sleep_fan_mode": "low"}
        )
        self.assertIsNone(config["away_deep_temperature"])
        self.assertEqual(config["sleep_fan_mode"], "low")
        self.assertEqual(config["away_temperature"], 26.0)
        self.assertEqual(self.data["zones"][LIVING]["house_modes"], config)
        self.assertGreater(self.save_count, saves)

    async def test_settings_update_validates_and_re_evaluates(self) -> None:
        await self._start()
        with self.assertRaisesRegex(ValueError, "presleep_time"):
            await self.coordinator.async_update_settings({"presleep_time": "9pm"})
        with self.assertRaisesRegex(ValueError, "travel_park_temperature"):
            await self.coordinator.async_update_settings({"travel_park_temperature": 99})
        settings = await self.coordinator.async_update_settings(
            {"away_after_minutes": 10, "presleep_time": "22:30"}
        )
        self.assertEqual(settings["away_after_minutes"], 10)
        self.assertEqual(settings["presleep_time"], "22:30")
        self.assertEqual(self.data["settings"]["house_modes"]["away_after_minutes"], 10)
        self.assertEqual(self.data["settings"]["house_modes"]["presence_entity_ids"], [PERSON_A, PERSON_B])
        self._leave(NOW - timedelta(minutes=15))
        await self._evaluate()
        self.assertIsNotNone(self._pause(LIVING, "away_1h"))

    def test_settings_normalization_repairs_garbage(self) -> None:
        settings = house_modes_models.normalize_house_modes_settings(
            {
                "enabled": "yes",
                "presence_entity_ids": "person.solo",
                "presence_corroboration_entity_ids": ["bad", "binary_sensor.ok", "binary_sensor.ok"],
                "away_after_minutes": 0,
                "away_deep_after_minutes": -5,
                "arrival_release_minutes": "x",
                "sleep_entity_id": "nope",
                "presleep_time": "25:00",
                "presleep_duration_minutes": 100000,
                "travel_park_temperature": 9999,
                "travel_park_hvac_mode": "warp",
                "travel_park_fan_mode": "  ",
                "travel_auto_exit_on_arrival": 1,
            }
        )
        self.assertTrue(settings["enabled"])
        self.assertEqual(settings["presence_entity_ids"], ["person.solo"])
        self.assertEqual(settings["presence_corroboration_entity_ids"], ["binary_sensor.ok"])
        self.assertEqual(settings["away_after_minutes"], 1)
        self.assertEqual(settings["away_deep_after_minutes"], 0)
        self.assertEqual(settings["arrival_release_minutes"], 3)
        self.assertIsNone(settings["sleep_entity_id"])
        self.assertIsNone(settings["presleep_time"])
        self.assertEqual(settings["presleep_duration_minutes"], 1440)
        self.assertEqual(settings["travel_park_temperature"], 29.0)
        self.assertEqual(settings["travel_park_hvac_mode"], "cool")
        self.assertIsNone(settings["travel_park_fan_mode"])
        self.assertTrue(settings["travel_auto_exit_on_arrival"])
        defaults = house_modes_models.normalize_house_modes_settings(None)
        self.assertEqual(defaults["presleep_time"], "21:00")
        self.assertEqual(defaults["travel_park_fan_mode"], "auto")
        self.assertTrue(defaults["travel_freeze_off_heads"])
        self.assertTrue(defaults["travel_enable_humidity_assist"])
        self.assertEqual(house_modes_models.normalize_presleep_time("7:05"), "07:05")
        self.assertIsNone(house_modes_models.normalize_presleep_time("7:5"))
        self.assertIsNone(house_modes_models.normalize_presleep_time(True))

    def test_zone_normalization_repairs_garbage(self) -> None:
        config = house_modes_models.normalize_house_modes_data(
            {
                "away_enabled": 0,
                "away_temperature": "hot",
                "away_deep_temperature": 500,
                "sleep_constraint": "sideways",
                "sleep_fan_mode": 3,
                "sleep_minimum_temperature": "22",
                "presleep_temperature": True,
                "unknown": "dropped",
            }
        )
        self.assertEqual(
            config,
            {
                "away_enabled": False,
                "away_temperature": 26.0,
                "away_deep_temperature": None,
                "sleep_enabled": True,
                "sleep_temperature": 26.0,
                "sleep_constraint": "raise_only",
                "sleep_fan_mode": None,
                "sleep_minimum_temperature": 22.0,
                "presleep_temperature": None,
                "travel_park_enabled": True,
            },
        )

    def test_runtime_normalization_and_schedule_data_round_trip(self) -> None:
        record = house_modes_models.normalize_house_modes_runtime_data(
            {
                "state": "flying",
                "sleeping": 1,
                "sleep_since": "not a date",
                "travel_since": NOW.isoformat(),
                "away_stage": 7,
                "presleep_applied_on": "2026-13-01",
                "saved_minimums": {MASTER: {"saved": None, "applied": "22"}, "bad": "x"},
                "humidity_assist_enabled_zones": [LIVING, "junk"],
            }
        )
        self.assertEqual(record["state"], "disabled")
        self.assertTrue(record["sleeping"])
        self.assertIsNone(record["sleep_since"])
        self.assertEqual(record["travel_since"], NOW.isoformat())
        self.assertEqual(record["away_stage"], 2)
        self.assertIsNone(record["presleep_applied_on"])
        self.assertEqual(record["saved_minimums"], {MASTER: {"saved": None, "applied": 22.0}})
        self.assertEqual(record["humidity_assist_enabled_zones"], [LIVING])

        data = normalize_schedule_data(
            {
                "zones": {LIVING: {"house_modes": {"away_enabled": False, "bogus": 1}}},
                "settings": {
                    "house_modes": {"away_after_minutes": 12},
                    "house_modes_runtime": {"state": "travel", "travel_active": True},
                },
            },
            [LIVING, DEN],
        )
        self.assertFalse(data["zones"][LIVING]["house_modes"]["away_enabled"])
        self.assertNotIn("bogus", data["zones"][LIVING]["house_modes"])
        self.assertNotIn("house_modes", data["zones"][DEN])
        self.assertEqual(data["settings"]["house_modes"]["away_after_minutes"], 12)
        self.assertEqual(data["settings"]["house_modes_runtime"]["state"], "travel")
        serialized = models_module.serialize_schedule_data(data)
        self.assertEqual(serialized["settings"]["house_modes_runtime"]["state"], "travel")
        untouched = normalize_schedule_data({}, [LIVING])
        self.assertNotIn("house_modes", untouched["settings"])
        self.assertNotIn("house_modes", untouched["zones"][LIVING])

    def test_zone_unique_id_suffixes_are_registered_for_cleanup(self) -> None:
        for suffix in (
            "away_temperature",
            "away_deep_temperature",
            "sleep_temperature",
            "sleep_minimum_temperature",
            "presleep_temperature",
            "away_setback",
            "sleep_hold",
        ):
            self.assertIn(suffix, const_module.ZONE_ENTITY_UNIQUE_ID_SUFFIXES)


class ApiTest(unittest.IsolatedAsyncioTestCase):
    """WebSocket forwarding, settings merge, and response payloads."""

    def setUp(self) -> None:
        self.coordinator = SimpleNamespace(
            async_update_zone_config=AsyncMock(return_value={}),
            settings=lambda: {"enabled": True, "away_after_minutes": 60},
            status=lambda: {"state": "home", "zones": {}},
        )
        self.scheduler = SimpleNamespace(
            house_modes=self.coordinator,
            set_temperature_migration_blocked=Mock(),
            temperature_migration_blocked=False,
            async_update_settings=AsyncMock(),
        )
        self.runtime = {
            "scheduler": self.scheduler,
            "storage": SimpleNamespace(
                temperature_migration_required=False,
                data={"settings": {"house_modes": {"presence_entity_ids": [PERSON_A], "away_after_minutes": 60}}},
            ),
            "operation_active": None,
            "operation_recovery": None,
            "entry": SimpleNamespace(options={}),
        }
        self._original_get_runtime = api_module._get_runtime
        self._original_build = api_module._build_schedule_response
        api_module._get_runtime = lambda _hass: self.runtime
        api_module._build_schedule_response = lambda _runtime: {"ok": True}
        self.addCleanup(setattr, api_module, "_get_runtime", self._original_get_runtime)
        self.addCleanup(setattr, api_module, "_build_schedule_response", self._original_build)
        self.connection = SimpleNamespace(send_result=Mock(), send_error=Mock())

    async def test_ws_update_zone_house_modes_forwards_and_reports_errors(self) -> None:
        await house_modes_api.ws_update_zone_house_modes(
            SimpleNamespace(),
            self.connection,
            {
                "id": 7,
                "type": "velair/update_zone_house_modes",
                "entity_id": LIVING,
                "house_modes": {"sleep_constraint": "absolute", "away_deep_temperature": 28},
            },
        )
        self.coordinator.async_update_zone_config.assert_awaited_once_with(
            LIVING, {"sleep_constraint": "absolute", "away_deep_temperature": 28}
        )
        self.connection.send_result.assert_called_once_with(7, {"ok": True})

        self.coordinator.async_update_zone_config.side_effect = ValueError("too hot")
        await house_modes_api.ws_update_zone_house_modes(
            SimpleNamespace(),
            self.connection,
            {"id": 8, "type": "velair/update_zone_house_modes", "entity_id": LIVING, "house_modes": {}},
        )
        self.connection.send_error.assert_called_once_with(8, "invalid_house_modes", "too hot")

    async def test_ws_update_settings_merges_house_modes(self) -> None:
        await api_module.ws_update_settings(
            SimpleNamespace(),
            self.connection,
            {"id": 9, "type": "velair/update_settings", "house_modes": {"away_after_minutes": 45}},
        )
        self.scheduler.async_update_settings.assert_awaited_once_with(
            {"house_modes": {"presence_entity_ids": [PERSON_A], "away_after_minutes": 45}}
        )

    def test_schedule_response_includes_house_modes_sections(self) -> None:
        data = normalize_schedule_data(
            {"zones": {LIVING: {"house_modes": {"away_enabled": False}}}}, [LIVING]
        )
        runtime = {
            "entry": SimpleNamespace(
                options={},
                data={"climate_entities": [LIVING]},
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
                get_zone_runtime_statuses=lambda: {},
                house_modes=self.coordinator,
            ),
            "storage": SimpleNamespace(data=data),
        }
        response = self._original_build(runtime)
        self.assertEqual(response["house_mode"]["state"], "home")
        self.assertEqual(response["settings"]["house_modes"]["away_after_minutes"], 60)
        self.assertFalse(response["zones"][LIVING]["house_modes"]["away_enabled"])
        exported = api_module._export_zones(data["zones"])
        self.assertFalse(exported[LIVING]["house_modes"]["away_enabled"])

    def test_status_payload_is_empty_while_migration_is_blocked(self) -> None:
        self.scheduler.temperature_migration_blocked = True
        self.assertEqual(house_modes_api.house_modes_status_payload(self.runtime), {})

    def test_registration_hook_is_wired(self) -> None:
        source = (helpers.ROOT / "custom_components" / "velair" / "api.py").read_text(encoding="utf-8")
        self.assertIn("register_house_modes_ws(hass)", source)
        self.assertIn('vol.Optional("house_modes"): HOUSE_MODES_SETTINGS_SCHEMA', source)


class EntityTest(unittest.IsolatedAsyncioTestCase):
    """Generated sensor, switches, and numbers."""

    def setUp(self) -> None:
        self.settings = {
            "enabled": True,
            "away_after_minutes": 60,
            "away_deep_after_minutes": 360,
            "arrival_release_minutes": 3,
            "travel_park_temperature": 29.0,
        }
        self.zone = {
            "away_enabled": True,
            "sleep_enabled": False,
            "away_temperature": 26.0,
            "away_deep_temperature": None,
            "sleep_temperature": 25.0,
            "sleep_minimum_temperature": 22.0,
            "presleep_temperature": None,
        }
        self.status = {
            "state": "away",
            "sleeping": True,
            "away_stage": 1,
            "presence_empty": True,
            "presence_certain": True,
            "empty_since": "2026-05-19T17:00:00+00:00",
            "next_stage_at": "2026-05-19T23:00:00+00:00",
            "travel_since": None,
            "sleep_since": "2026-05-19T17:30:00+00:00",
            "zones_parked": [],
            "zones_frozen": [],
            "zones_away": [LIVING],
            "zones_sleeping": [LIVING],
            "zones_presleep": [],
            "next_evaluation_at": None,
            "last_action": "away stage 1 applied",
            "last_action_at": "2026-05-19T18:00:00+00:00",
        }
        self.coordinator = SimpleNamespace(
            status=lambda: dict(self.status),
            settings=lambda: dict(self.settings),
            zone_config=lambda entity_id: dict(self.zone),
            async_update_settings=AsyncMock(),
            async_update_zone_config=AsyncMock(),
        )
        self.scheduler = SimpleNamespace(
            house_modes=self.coordinator,
            temperature_migration_blocked=False,
            get_temperature_limits=lambda entity_id: (16.0, 30.0),
            get_temperature_step=lambda entity_id: 0.5,
            _climate_manager=SimpleNamespace(temperature_unit=lambda entity_id: "°C"),
        )
        self.entry = SimpleNamespace(
            entry_id="entry",
            data={"climate_entities": [LIVING]},
            options={},
            runtime_data=SimpleNamespace(scheduler=self.scheduler),
        )
        self.hass = SimpleNamespace(
            states={LIVING: SimpleNamespace(attributes={"friendly_name": "Living"})}
        )

    def test_sensor_reports_state_and_attributes(self) -> None:
        (sensor,) = entities_module.build_house_modes_sensors(self.hass, self.entry)
        self.assertEqual(sensor._attr_unique_id, "entry_house_mode")
        self.assertEqual(sensor._attr_translation_key, "house_mode")
        self.assertEqual(sensor._attr_options, ["home", "away", "away_deep", "travel", "sleep", "disabled"])
        self.assertEqual(sensor.native_value, "away")
        attributes = sensor.extra_state_attributes
        self.assertTrue(attributes["sleeping"])
        self.assertEqual(attributes["zones_away"], [LIVING])
        self.assertEqual(attributes["empty_since"], "2026-05-19T17:00:00+00:00")
        self.assertNotIn("travel_since", attributes)
        self.assertTrue(sensor.available)

    async def test_switches_map_to_settings_and_zone_fields(self) -> None:
        switches = entities_module.build_house_modes_switches(self.hass, self.entry)
        self.assertEqual(
            [switch._attr_unique_id for switch in switches],
            ["entry_house_modes", "entry_climate_living_away_setback", "entry_climate_living_sleep_hold"],
        )
        master, away, sleep = switches
        self.assertEqual(master._attr_translation_key, "house_modes")
        self.assertEqual(away._attr_translation_key, "zone_away_setback")
        self.assertEqual(away._attr_translation_placeholders, {"zone": "Living"})
        self.assertTrue(master.is_on)
        self.assertTrue(away.is_on)
        self.assertFalse(sleep.is_on)
        await master.async_turn_off()
        self.coordinator.async_update_settings.assert_awaited_once_with({"enabled": False})
        await sleep.async_turn_on()
        self.coordinator.async_update_zone_config.assert_awaited_once_with(LIVING, {"sleep_enabled": True})
        self.scheduler.temperature_migration_blocked = True
        self.assertFalse(away.available)

    async def test_numbers_expose_zone_temperatures_and_clear_optional_ones(self) -> None:
        numbers = entities_module.build_house_modes_numbers(self.hass, self.entry)
        self.assertEqual(
            [number._attr_unique_id for number in numbers],
            [
                "entry_climate_living_away_temperature",
                "entry_climate_living_away_deep_temperature",
                "entry_climate_living_sleep_temperature",
                "entry_climate_living_sleep_minimum_temperature",
                "entry_climate_living_presleep_temperature",
                "entry_house_away_after_minutes",
                "entry_house_away_deep_after_minutes",
                "entry_house_arrival_release_minutes",
                "entry_travel_park_temperature",
            ],
        )
        away, deep, sleep, minimum, presleep, after, deep_after, release, park = numbers
        self.assertEqual(away._attr_translation_key, "zone_away_temperature")
        self.assertEqual(away.native_value, 26.0)
        self.assertEqual(away.native_unit_of_measurement, "°C")
        self.assertEqual((away.native_min_value, away.native_max_value, away.native_step), (16.0, 30.0, 0.5))
        self.assertEqual(away._attr_device_class, "temperature")
        self.assertEqual(away._attr_entity_category, "config")
        # Optional values fall back to the climate minimum and report inactive.
        self.assertEqual(deep.native_value, 16.0)
        self.assertFalse(deep.extra_state_attributes["active"])
        self.assertEqual(minimum.native_value, 22.0)
        self.assertTrue(minimum.extra_state_attributes["active"])
        await deep.async_set_native_value(16.0)
        self.coordinator.async_update_zone_config.assert_awaited_with(LIVING, {"away_deep_temperature": None})
        await presleep.async_set_native_value(23.0)
        self.coordinator.async_update_zone_config.assert_awaited_with(LIVING, {"presleep_temperature": 23.0})
        await sleep.async_set_native_value(16.0)
        self.coordinator.async_update_zone_config.assert_awaited_with(LIVING, {"sleep_temperature": 16.0})

        self.assertEqual(after._attr_translation_key, "house_away_after_minutes")
        self.assertEqual(after.native_unit_of_measurement, "min")
        self.assertEqual(after.native_value, 60.0)
        self.assertEqual(deep_after.native_max_value, 2880.0)
        self.assertEqual(release.native_value, 3.0)
        await after.async_set_native_value(45.4)
        self.coordinator.async_update_settings.assert_awaited_with({"away_after_minutes": 45})
        self.assertEqual(park._attr_translation_key, "travel_park_temperature")
        self.assertEqual(park.native_unit_of_measurement, "°C")
        self.assertEqual((park.native_min_value, park.native_max_value), (16.0, 30.0))
        self.assertEqual(park._attr_device_class, "temperature")
        await park.async_set_native_value(28.0)
        self.coordinator.async_update_settings.assert_awaited_with({"travel_park_temperature": 28.0})

    def test_translations_cover_every_generated_entity_in_every_language(self) -> None:
        import json

        root = helpers.ROOT / "custom_components" / "velair" / "translations"
        for language in ("de", "en", "es", "fr", "it", "nl", "pl", "pt", "pt-BR", "ru"):
            with self.subTest(language=language):
                translation = json.loads((root / f"{language}.json").read_text(encoding="utf-8"))
                entity = translation["entity"]
                self.assertEqual(
                    set(entity["sensor"]["house_mode"]["state"]),
                    set(house_modes_models.HOUSE_MODE_STATES),
                )
                for key in ("house_modes", "zone_away_setback", "zone_sleep_hold"):
                    self.assertIn(key, entity["switch"])
                for key in (
                    "zone_away_temperature",
                    "zone_away_deep_temperature",
                    "zone_sleep_temperature",
                    "zone_sleep_minimum_temperature",
                    "zone_presleep_temperature",
                    "house_away_after_minutes",
                    "house_away_deep_after_minutes",
                    "house_arrival_release_minutes",
                    "travel_park_temperature",
                ):
                    self.assertIn(key, entity["number"])
                for key in ("zone_away_setback", "zone_sleep_hold"):
                    self.assertIn("{zone}", entity["switch"][key]["name"])


class RerunCoalescingTest(HouseModesTestCase):
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
