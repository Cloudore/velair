"""Guards tests: never-off, snooze, manual release, activity holds, entities."""

from __future__ import annotations

import asyncio
from copy import deepcopy
from datetime import timedelta
import importlib
import json
from pathlib import Path
import sys
from types import ModuleType, SimpleNamespace
import unittest
from unittest.mock import AsyncMock, Mock

from . import helpers
from .helpers import (
    ACTION_SET_TEMPERATURE,
    ACTION_TURN_OFF,
    EVENT_VELAIR,
    NOW,
    FakeClimateManager,
    FakeHass,
    VelairScheduler,
    empty_week_schedule,
    normalize_schedule_data,
    scheduler_module,
)

guards_module = importlib.import_module("custom_components.velair.guards")
guards_models = importlib.import_module("custom_components.velair.guards_models")
guards_api = importlib.import_module("custom_components.velair.guards_api")
models_module = helpers.models_module
const_module = helpers.const_module
storage_module = importlib.import_module("custom_components.velair.storage")
api_module = importlib.import_module("custom_components.velair.api")
services_module = importlib.import_module("custom_components.velair.services")

ROOT = Path(__file__).resolve().parents[2]
LANGUAGES = ("de", "en", "es", "fr", "it", "nl", "pl", "pt", "pt-BR", "ru")

KITCHEN = "climate.kitchen"
GUEST = "climate.guest"
OCC_KITCHEN = "binary_sensor.kitchen_occupied"
OCC_GUEST = "binary_sensor.guest_occupied"
COOKING = "input_boolean.cooking"
TRAVEL = "input_boolean.travel"
OWNER_1 = "person.izzat"
OWNER_2 = "person.marianne"
MINUTE = timedelta(minutes=1)


def _load_guards_entities_module():
    """Load guards_entities.py with the Home Assistant surface it needs."""
    module_names = (
        "homeassistant.components.number",
        "homeassistant.components.sensor",
        "homeassistant.components.switch",
        "homeassistant.helpers.entity",
        "homeassistant.helpers.entity_platform",
        "custom_components.velair.entity",
    )
    previous_modules = {name: sys.modules.get(name) for name in module_names}
    previous_entities = sys.modules.pop("custom_components.velair.guards_entities", None)

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
        entity_helper.EntityCategory = SimpleNamespace(CONFIG="config", DIAGNOSTIC="diagnostic")
        sys.modules["homeassistant.helpers.entity"] = entity_helper
        entity_platform = ModuleType("homeassistant.helpers.entity_platform")
        entity_platform.AddConfigEntryEntitiesCallback = object
        sys.modules["homeassistant.helpers.entity_platform"] = entity_platform
        velair_entity = ModuleType("custom_components.velair.entity")
        velair_entity.VelairEntity = FakeVelairEntity
        sys.modules["custom_components.velair.entity"] = velair_entity
        return importlib.import_module("custom_components.velair.guards_entities")
    finally:
        for name, previous in previous_modules.items():
            if previous is None:
                sys.modules.pop(name, None)
            else:
                sys.modules[name] = previous
        if previous_entities is not None and "custom_components.velair.guards_entities" not in sys.modules:
            sys.modules["custom_components.velair.guards_entities"] = previous_entities


entities_module = _load_guards_entities_module()


def _state(state: str, *, changed=None, **attributes) -> SimpleNamespace:
    return SimpleNamespace(
        state=state,
        attributes=attributes,
        last_changed=changed if changed is not None else NOW - timedelta(hours=1),
    )


class GuardsTestCase(unittest.IsolatedAsyncioTestCase):
    """Two cooling zones on all-day schedules with the reference doctrine."""

    zones = (KITCHEN, GUEST)

    def setUp(self) -> None:
        self.hass = FakeHass()
        self.climate = FakeClimateManager()
        self.save_count = 0
        self.data = normalize_schedule_data(
            {
                "zones": {
                    KITCHEN: self._zone(27.0),
                    GUEST: {**self._zone(24.0), "limits": {"min_temperature": 22.0}},
                },
                "settings": {
                    "house_modes": {
                        "presence_entity_ids": [OWNER_1, OWNER_2],
                        "travel_entity_id": TRAVEL,
                    },
                    "guards": {"owner_entity_ids": [OWNER_1, OWNER_2]},
                },
            },
            list(self.zones),
        )
        # House Modes settings are owned by another module: inject them the
        # way that module would persist them (normalization keeps only the
        # keys it knows, so re-add them after normalizing).
        self.data["settings"]["house_modes"] = {
            "presence_entity_ids": [OWNER_1, OWNER_2],
            "travel_entity_id": TRAVEL,
        }
        self.data["zones"][GUEST]["occupancy_assist"] = {
            "occupancy_entity_id": OCC_GUEST,
            "setback_stages": [
                {"after_minutes": 10, "temperature": 23.0},
                {"after_minutes": 30, "temperature": 25.0},
                {"after_minutes": 90, "temperature": 26.0},
            ],
        }
        self.data["zones"][KITCHEN]["occupancy_assist"] = {
            "occupancy_entity_id": OCC_KITCHEN,
            "setback_stages": [{"after_minutes": 10, "temperature": 25.0}],
        }
        self.hass.states[KITCHEN] = _state("cool", temperature=27.0)
        self.hass.states[GUEST] = _state("cool", temperature=24.0)
        self.hass.states[OCC_KITCHEN] = _state("on")
        self.hass.states[OCC_GUEST] = _state("on")
        self.hass.states[OWNER_1] = _state("home")
        self.hass.states[OWNER_2] = _state("home")
        self.hass.states[TRAVEL] = _state("off")
        self.scheduler = VelairScheduler(
            self.hass, self.data, self.climate, self._async_save
        )
        for entity_id in self.zones:
            self.climate.current_hvac_modes[entity_id] = "cool"
            self.climate.hvac_modes[entity_id] = ["off", "heat", "cool"]
        self.guards = self.scheduler._guards
        self._set_time(NOW)

    def tearDown(self) -> None:
        scheduler_module.dt_util.now = lambda: NOW

    @staticmethod
    def _zone(temperature: float) -> dict:
        return {
            "enabled": True,
            "schedule": {
                **empty_week_schedule(),
                "tuesday": [
                    {
                        "start": "00:00",
                        "action": ACTION_SET_TEMPERATURE,
                        "temperature": temperature,
                        "hvac_mode": "cool",
                    }
                ],
            },
            "external_change_policy": {"action": "until_resumed"},
        }

    async def _async_save(self) -> None:
        self.save_count += 1

    def _set_time(self, when) -> None:
        scheduler_module.dt_util.now = lambda: when

    def _settings(self, **updates) -> None:
        self.data["settings"]["guards"] = {**self.data["settings"]["guards"], **updates}

    async def _start(self, when=None) -> None:
        if when is not None:
            self._set_time(when)
        await self.scheduler.async_start()
        await self.guards.async_drain()

    async def _evaluate(self, when=None) -> None:
        if when is not None:
            self._set_time(when)
        await self.guards.async_evaluate()
        await self.guards.async_drain()

    async def _turn_off(self, entity_id: str, *, when=None, previous_mode="cool") -> None:
        """A person turns the head off; Velair yields with until_resumed."""
        if when is not None:
            self._set_time(when)
        now = scheduler_module.dt_util.now()
        attributes = dict(self.hass.states[entity_id].attributes)
        self.hass.states[entity_id] = _state("off", changed=now, **attributes)
        await self.scheduler.async_handle_external_climate_change(
            entity_id,
            changed_fields=["hvac_mode"],
            previous={"hvac_mode": previous_mode},
            current={"hvac_mode": "off"},
        )
        await self.guards.async_drain()

    async def _turn_on(self, entity_id: str, *, when=None, temperature=23.0) -> None:
        """A person turns the head on; the live snapshot is captured."""
        if when is not None:
            self._set_time(when)
        now = scheduler_module.dt_util.now()
        self.climate.snapshots[entity_id] = {"hvac_mode": "cool", "temperature": temperature}
        self.hass.states[entity_id] = _state("cool", changed=now, temperature=temperature)
        await self.scheduler.async_handle_external_climate_change(
            entity_id,
            changed_fields=["hvac_mode"],
            previous={"hvac_mode": "off"},
            current={"hvac_mode": "cool"},
        )
        await self.guards.async_drain()

    async def _adjust(self, entity_id: str, temperature: float, *, when=None) -> None:
        """A person changes the setpoint; Velair enters Manual adjustment."""
        if when is not None:
            self._set_time(when)
        previous = self.hass.states[entity_id].attributes.get("temperature")
        self.hass.states[entity_id] = _state(
            "cool", changed=scheduler_module.dt_util.now(), temperature=temperature
        )
        await self.scheduler.async_handle_external_climate_change(
            entity_id,
            changed_fields=["temperature"],
            previous={"temperature": previous},
            current={"temperature": temperature},
        )
        await self.guards.async_drain()

    def _status(self, entity_id: str) -> dict:
        return self.scheduler.get_guards_status(entity_id)

    def _state_of(self, entity_id: str) -> str:
        return self._status(entity_id)["state"]

    def _pause_ids(self, entity_id: str) -> list[str]:
        return [
            pause["pause_id"]
            for pause in self.data["zones"][entity_id].get("pauses", [])
            if "pause_id" in pause
        ]

    def _pause(self, entity_id: str, pause_id: str) -> dict | None:
        return next(
            (
                pause
                for pause in self.data["zones"][entity_id].get("pauses", [])
                if pause.get("pause_id") == pause_id
            ),
            None,
        )

    def _control_mode(self, entity_id: str) -> str:
        return self.scheduler.get_zone_runtime_statuses()[entity_id]["control_mode"]

    def _delivered(self, entity_id: str) -> list[tuple]:
        return [
            call for call in self.climate.calls
            if call[0] == "set_temperature" and call[1] == entity_id
        ]

    def _events(self, name: str) -> list[dict]:
        return [
            payload
            for event_type, payload in self.hass.bus.events
            if event_type == EVENT_VELAIR and payload.get("event") == name
        ]


class NeverOffTest(GuardsTestCase):
    """Grace, cancellation, recovery, travel and start-up detection."""

    async def test_grace_then_recovery_holds_raise_only_and_resumes_automatic(self) -> None:
        await self._start()
        self.assertEqual(self._state_of(GUEST), "idle")

        await self._turn_off(GUEST)

        self.assertEqual(self._control_mode(GUEST), "manual")
        self.assertEqual(self._state_of(GUEST), "off_grace")
        status = self._status(GUEST)
        self.assertEqual(status["grace_ends_at"], (NOW + 10 * MINUTE).isoformat())
        self.assertEqual(status["next_transition_at"], (NOW + 10 * MINUTE).isoformat())
        self.assertEqual(status["previous_target"], 24.0)
        started = self._events("never_off_grace_started")
        self.assertEqual(len(started), 1)
        self.assertEqual(started[0]["entity_id"], GUEST)
        self.assertEqual(started[0]["grace_minutes"], 10)
        self.assertEqual(started[0]["grace_ends_at"], (NOW + 10 * MINUTE).isoformat())
        self.assertEqual(started[0]["previous_target"], 24.0)
        self.assertEqual(started[0]["previous_hvac_mode"], "cool")
        self.assertEqual(started[0]["snooze_minutes"], 1440)
        self.assertEqual(self._delivered(GUEST), [])

        await self._evaluate(NOW + 9 * MINUTE)
        self.assertEqual(self._state_of(GUEST), "off_grace")
        self.assertEqual(self._delivered(GUEST), [])

        await self._evaluate(NOW + 10 * MINUTE)

        hold = self._pause(GUEST, "neveroff_recover")
        self.assertIsNotNone(hold)
        # max(previous target 24, setback stage 3 26, minimum 22)
        self.assertEqual(hold["temperature"], 26.0)
        self.assertEqual(hold["constraint"], "raise_only")
        self.assertEqual(hold["hvac_mode"], "cool")
        self.assertEqual(hold["action"], "hold")
        self.assertEqual(self._control_mode(GUEST), "automatic")
        self.assertNotIn("velair.manual_adjustment", self._pause_ids(GUEST))
        # Velair delivers the hold with ensure_on: the mode goes first.
        self.assertEqual(self._delivered(GUEST), [("set_temperature", GUEST, 26.0, True, "cool")])
        self.assertEqual(self._state_of(GUEST), "recovering")
        self.assertIsNone(self._status(GUEST)["grace_ends_at"])
        recovered = self._events("never_off_recovered")
        self.assertEqual(len(recovered), 1)
        self.assertEqual(recovered[0]["temperature"], 26.0)
        self.assertEqual(recovered[0]["hvac_mode"], "cool")
        self.assertEqual(recovered[0]["constraint"], "raise_only")
        self.assertEqual(recovered[0]["pause_id"], "neveroff_recover")
        self.assertEqual(recovered[0]["previous_target"], 24.0)
        self.assertEqual(
            self.data["settings"]["guards_runtime"][GUEST]["last_action"], "recovered"
        )
        self.assertGreaterEqual(self.save_count, 1)

    async def test_recovery_uses_the_previous_target_when_it_is_the_warmest(self) -> None:
        await self._start()
        self.hass.states[GUEST] = _state("cool", temperature=28.0)

        await self._turn_off(GUEST)
        await self._evaluate(NOW + 10 * MINUTE)

        self.assertEqual(self._pause(GUEST, "neveroff_recover")["temperature"], 28.0)

    async def test_recovery_falls_back_to_the_minimum_temperature(self) -> None:
        del self.data["zones"][KITCHEN]["occupancy_assist"]
        self.data["zones"][KITCHEN]["limits"]["min_temperature"] = 21.0
        self.hass.states[KITCHEN] = _state("cool")  # no setpoint attribute
        await self._start()

        await self._turn_off(KITCHEN)
        await self._evaluate(NOW + 10 * MINUTE)

        hold = self._pause(KITCHEN, "neveroff_recover")
        self.assertEqual(hold["temperature"], 21.0)
        # raise_only keeps the warmer schedule target.
        self.assertEqual(self._delivered(KITCHEN), [("set_temperature", KITCHEN, 27.0, True, "cool")])

    async def test_recovery_without_any_temperature_only_resumes_automatic_control(self) -> None:
        del self.data["zones"][KITCHEN]["occupancy_assist"]
        self.hass.states[KITCHEN] = _state("cool")
        await self._start()

        await self._turn_off(KITCHEN)
        await self._evaluate(NOW + 10 * MINUTE)

        self.assertIsNone(self._pause(KITCHEN, "neveroff_recover"))
        self.assertEqual(self._control_mode(KITCHEN), "automatic")
        self.assertEqual(self._delivered(KITCHEN), [("set_temperature", KITCHEN, 27.0, True, "cool")])
        self.assertIsNone(self._events("never_off_recovered")[0]["temperature"])

    async def test_grace_is_cancelled_when_the_head_comes_back_on(self) -> None:
        await self._start()
        await self._turn_off(GUEST)
        self.assertEqual(self._state_of(GUEST), "off_grace")

        await self._turn_on(GUEST, when=NOW + 3 * MINUTE)

        self.assertIsNone(self._status(GUEST)["grace_ends_at"])
        self.assertEqual(self._status(GUEST)["last_action"], "grace_cancelled_head_on")
        # The person's manual adjustment keeps protecting the new setting.
        self.assertEqual(self._state_of(GUEST), "manual_watch")
        await self._evaluate(NOW + 15 * MINUTE)
        self.assertIsNone(self._pause(GUEST, "neveroff_recover"))
        self.assertEqual(self._events("never_off_recovered"), [])

    async def test_travel_blocks_the_relight_until_travel_ends(self) -> None:
        self.hass.states[TRAVEL] = _state("on")
        await self._start()
        await self._turn_off(GUEST)

        await self._evaluate(NOW + 10 * MINUTE)
        self.assertEqual(self._state_of(GUEST), "off_grace")
        self.assertIsNone(self._pause(GUEST, "neveroff_recover"))
        self.assertEqual(self._delivered(GUEST), [])

        self.hass.states[TRAVEL] = _state("off", changed=NOW + 40 * MINUTE)
        await self._evaluate(NOW + 40 * MINUTE)
        self.assertEqual(self._state_of(GUEST), "recovering")
        self.assertEqual(self._pause(GUEST, "neveroff_recover")["temperature"], 26.0)

    async def test_travel_is_ignored_when_respect_travel_is_off(self) -> None:
        self._settings(never_off_respect_travel=False)
        self.hass.states[TRAVEL] = _state("on")
        await self._start()
        await self._turn_off(GUEST)

        await self._evaluate(NOW + 10 * MINUTE)
        self.assertEqual(self._state_of(GUEST), "recovering")

    async def test_travel_off_freeze_cancels_the_grace(self) -> None:
        await self._start()
        await self._turn_off(GUEST)
        await self.scheduler.async_pause_zone(GUEST, action="none", pause_id="travel_off")
        await self.guards.async_drain()

        await self._evaluate(NOW + 10 * MINUTE)
        self.assertIsNone(self._status(GUEST)["grace_ends_at"])
        self.assertEqual(self._status(GUEST)["last_action"], "grace_cancelled_travel_off")
        self.assertIsNone(self._pause(GUEST, "neveroff_recover"))

    async def test_head_found_off_at_start_gets_a_fresh_grace(self) -> None:
        self.hass.states[GUEST] = _state("off", changed=NOW - timedelta(hours=3), temperature=24.0)

        await self._start()

        self.assertEqual(self._state_of(GUEST), "off_grace")
        self.assertEqual(self._status(GUEST)["grace_ends_at"], (NOW + 10 * MINUTE).isoformat())
        started = self._events("never_off_grace_started")
        self.assertEqual(started[0]["previous_target"], 24.0)
        self.assertIsNone(started[0]["previous_hvac_mode"])

        await self._evaluate(NOW + 10 * MINUTE)
        hold = self._pause(GUEST, "neveroff_recover")
        self.assertEqual(hold["temperature"], 26.0)
        self.assertNotIn("hvac_mode", hold)
        # No previous mode: the climate manager picks the first supported mode.
        self.assertEqual(self._delivered(GUEST), [("set_temperature", GUEST, 26.0, True, "cool")])

    async def test_head_found_off_at_start_while_snoozed_or_travel_frozen_is_left_alone(self) -> None:
        for pause_id in ("neveroff_snooze", "travel_off"):
            with self.subTest(pause_id=pause_id):
                self.setUp()
                self.hass.states[GUEST] = _state("off", temperature=24.0)
                self.data["zones"][GUEST]["pauses"] = [
                    {
                        "started_at": (NOW - MINUTE).isoformat(),
                        "action": "none",
                        "pause_id": pause_id,
                        "until": (NOW + timedelta(days=1)).isoformat(),
                    }
                ]
                self.data["zones"][GUEST]["override"] = {
                    "type": "pause",
                    "action": "none",
                    "started_at": (NOW - MINUTE).isoformat(),
                }
                await self._start()
                self.assertIsNone(self._status(GUEST)["grace_ends_at"])
                self.assertEqual(self._events("never_off_grace_started"), [])
                self.assertEqual(
                    self._state_of(GUEST),
                    "snoozed" if pause_id == "neveroff_snooze" else "idle",
                )

    async def test_velair_turn_off_block_does_not_start_a_grace(self) -> None:
        self.data["zones"][GUEST]["schedule"]["tuesday"] = [
            {"start": "00:00", "action": ACTION_TURN_OFF}
        ]
        self.hass.states[GUEST] = _state("off", temperature=24.0)

        await self._start()

        self.assertEqual(self._state_of(GUEST), "idle")
        self.assertEqual(self._events("never_off_grace_started"), [])

    async def test_disabled_zone_or_module_never_arms_a_grace(self) -> None:
        self.data["zones"][GUEST]["guards"] = {"never_off_enabled": False}
        await self._start()
        await self._turn_off(GUEST)
        self.assertEqual(self._events("never_off_grace_started"), [])
        self.assertEqual(self._state_of(GUEST), "manual_watch")

        self._settings(enabled=False)
        await self.scheduler.async_update_settings({"guards": self.data["settings"]["guards"]})
        await self.guards.async_drain()
        await self._turn_off(KITCHEN)
        self.assertEqual(self._events("never_off_grace_started"), [])
        self.assertEqual(self._state_of(KITCHEN), "idle")
        self.assertEqual(self._control_mode(KITCHEN), "manual")

    async def test_unavailable_head_keeps_the_grace_pending(self) -> None:
        await self._start()
        await self._turn_off(GUEST)
        self.hass.states[GUEST] = _state("unavailable", changed=NOW + 2 * MINUTE)

        await self._evaluate(NOW + 10 * MINUTE)
        self.assertEqual(self._state_of(GUEST), "off_grace")
        self.assertIsNone(self._pause(GUEST, "neveroff_recover"))

        self.hass.states[GUEST] = _state("off", changed=NOW + 12 * MINUTE, temperature=24.0)
        await self._evaluate(NOW + 12 * MINUTE)
        self.assertEqual(self._state_of(GUEST), "recovering")

    async def test_failed_relight_is_retried_after_another_grace(self) -> None:
        await self._start()
        await self._turn_off(GUEST)
        await self._evaluate(NOW + 10 * MINUTE)
        self.assertEqual(self._state_of(GUEST), "recovering")

        # The device never reported on: no new grace while the relight is fresh.
        await self._evaluate(NOW + 15 * MINUTE)
        self.assertEqual(len(self._events("never_off_grace_started")), 1)

        await self._evaluate(NOW + 20 * MINUTE)
        self.assertEqual(len(self._events("never_off_grace_started")), 2)
        self.assertEqual(self._state_of(GUEST), "off_grace")


class SnoozeTest(GuardsTestCase):
    """The snooze service, manual turn-on and vacancy / house-empty release."""

    async def test_snooze_service_creates_the_timed_freeze_and_clears_the_manual(self) -> None:
        await self._start()
        await self._turn_off(GUEST)
        self.assertEqual(self._control_mode(GUEST), "manual")

        await self.scheduler.async_snooze_off(GUEST)
        await self.guards.async_drain()

        snooze = self._pause(GUEST, "neveroff_snooze")
        self.assertEqual(snooze["action"], "none")
        self.assertEqual(snooze["until"], (NOW + timedelta(minutes=1440)).isoformat())
        self.assertEqual(self._control_mode(GUEST), "automatic")
        self.assertEqual(self._pause_ids(GUEST), ["neveroff_snooze"])
        self.assertEqual(self._state_of(GUEST), "snoozed")
        self.assertIsNone(self._status(GUEST)["grace_ends_at"])
        self.assertEqual(self._status(GUEST)["snooze_until"], snooze["until"])
        snoozed = self._events("never_off_snoozed")
        self.assertEqual(len(snoozed), 1)
        self.assertEqual(snoozed[0]["duration_minutes"], 1440)
        self.assertEqual(snoozed[0]["snooze_until"], snooze["until"])
        self.assertEqual(snoozed[0]["source"], "service")

        await self._evaluate(NOW + 20 * MINUTE)
        self.assertIsNone(self._pause(GUEST, "neveroff_recover"))
        self.assertEqual(self._delivered(GUEST), [])
        self.assertEqual(self._state_of(GUEST), "snoozed")

    async def test_snooze_accepts_an_explicit_duration_and_rejects_bad_ones(self) -> None:
        await self._start()
        await self._turn_off(GUEST)

        await self.scheduler.async_snooze_off(GUEST, 120)
        self.assertEqual(
            self._pause(GUEST, "neveroff_snooze")["until"],
            (NOW + timedelta(minutes=120)).isoformat(),
        )
        self.assertEqual(self._events("never_off_snoozed")[0]["duration_minutes"], 120)
        with self.assertRaises(ValueError):
            await self.scheduler.async_snooze_off(GUEST, 0)
        with self.assertRaises(ValueError):
            await self.scheduler.async_snooze_off("climate.unknown")

    async def test_snoozed_head_turned_on_by_hand_releases_the_snooze_and_enters_manual(self) -> None:
        await self._start()
        await self._turn_off(GUEST)
        await self.scheduler.async_snooze_off(GUEST)
        await self.guards.async_drain()
        self.climate.calls.clear()

        await self._turn_on(GUEST, when=NOW + 30 * MINUTE, temperature=23.0)

        self.assertEqual(self._pause_ids(GUEST), ["velair.manual_adjustment"])
        self.assertEqual(self._control_mode(GUEST), "manual")
        # The schedule is not re-delivered over the person's setting.
        self.assertEqual(self._delivered(GUEST), [])
        self.assertIn(("restore_state", GUEST, {"hvac_mode": "cool", "temperature": 23.0}), self.climate.calls)
        self.assertEqual(self._state_of(GUEST), "manual_watch")
        self.assertEqual(self._status(GUEST)["last_action"], "snooze_released_by_person")

    async def test_snoozed_head_turned_on_after_a_recovery_drops_the_recovery_hold_first(self) -> None:
        await self._start()
        await self._turn_off(GUEST)
        await self._evaluate(NOW + 10 * MINUTE)
        await self._turn_off(GUEST, when=NOW + 20 * MINUTE)
        await self.scheduler.async_snooze_off(GUEST)
        await self.guards.async_drain()
        self.assertEqual(sorted(self._pause_ids(GUEST)), ["neveroff_recover", "neveroff_snooze"])
        self.climate.calls.clear()

        await self._turn_on(GUEST, when=NOW + 40 * MINUTE, temperature=23.0)

        self.assertEqual(self._pause_ids(GUEST), ["velair.manual_adjustment"])
        self.assertEqual(self._delivered(GUEST), [])

    async def test_vacancy_releases_snooze_and_watchdog_per_zone(self) -> None:
        await self._start()
        for entity_id in (GUEST, KITCHEN):
            await self._turn_off(entity_id)
            await self.scheduler.async_snooze_off(entity_id)
        await self.scheduler.async_pause_zone(
            GUEST, action="hold", pause_id="watchdog", temperature=28.0, constraint="raise_only"
        )
        await self.guards.async_drain()
        self.climate.calls.clear()
        self.hass.states[OCC_GUEST] = _state("off", changed=NOW + MINUTE)

        await self._evaluate(NOW + 30 * MINUTE)
        self.assertEqual(sorted(self._pause_ids(GUEST)), ["neveroff_snooze", "watchdog"])
        self.assertEqual(self._status(GUEST)["next_transition_at"], (NOW + 31 * MINUTE).isoformat())

        await self._evaluate(NOW + 31 * MINUTE)
        self.assertEqual(self._pause_ids(GUEST), [])
        self.assertEqual(self._delivered(GUEST), [("set_temperature", GUEST, 24.0, True, "cool")])
        self.assertEqual(self._status(GUEST)["last_action"], "snooze_released_vacant")
        # The kitchen is still occupied: its snooze stays.
        self.assertEqual(self._pause_ids(KITCHEN), ["neveroff_snooze"])
        self.assertEqual(self._delivered(KITCHEN), [])

    async def test_house_empty_releases_snoozes_everywhere(self) -> None:
        await self._start()
        for entity_id in (GUEST, KITCHEN):
            await self._turn_off(entity_id)
            await self.scheduler.async_snooze_off(entity_id)
        await self.guards.async_drain()
        self.hass.states[OWNER_1] = _state("not_home", changed=NOW + MINUTE)
        self.hass.states[OWNER_2] = _state("not_home", changed=NOW + 2 * MINUTE)

        await self._evaluate(NOW + 31 * MINUTE)
        self.assertEqual(self._pause_ids(GUEST), ["neveroff_snooze"])
        self.assertEqual(self._pause_ids(KITCHEN), ["neveroff_snooze"])

        await self._evaluate(NOW + 32 * MINUTE)
        self.assertEqual(self._pause_ids(GUEST), [])
        self.assertEqual(self._pause_ids(KITCHEN), [])
        self.assertEqual(self._status(KITCHEN)["last_action"], "snooze_released_house_empty")

    async def test_uncertain_occupancy_or_presence_never_releases_a_snooze(self) -> None:
        await self._start()
        await self._turn_off(GUEST)
        await self.scheduler.async_snooze_off(GUEST)
        await self.guards.async_drain()
        self.hass.states[OCC_GUEST] = _state("unavailable", changed=NOW - timedelta(hours=5))
        self.hass.states[OWNER_1] = _state("not_home", changed=NOW - timedelta(hours=5))
        self.hass.states[OWNER_2] = _state("unknown", changed=NOW - timedelta(hours=5))

        await self._evaluate(NOW + timedelta(hours=6))
        self.assertEqual(self._pause_ids(GUEST), ["neveroff_snooze"])

        # No occupancy entity and no presence entities: no vacancy evidence at all.
        del self.data["zones"][GUEST]["occupancy_assist"]
        self.data["settings"]["house_modes"]["presence_entity_ids"] = []
        await self._evaluate(NOW + timedelta(hours=12))
        self.assertEqual(self._pause_ids(GUEST), ["neveroff_snooze"])


class ManualReleaseTest(GuardsTestCase):
    """Rules (a) vacancy, (b) travel and (c) owners away below the floor."""

    async def test_vacancy_releases_the_manual_once_the_lease_has_passed(self) -> None:
        await self._start()
        self.hass.states[OCC_GUEST] = _state("off", changed=NOW - 70 * MINUTE)
        await self._adjust(GUEST, 22.0)
        self.assertEqual(self._control_mode(GUEST), "manual")
        self.assertEqual(self._state_of(GUEST), "manual_watch")
        self.assertEqual(self._status(GUEST)["manual_since"], NOW.isoformat())
        self.assertEqual(self._status(GUEST)["manual_release_at"], (NOW + 30 * MINUTE).isoformat())
        self.climate.calls.clear()

        await self._evaluate(NOW + 29 * MINUTE)
        self.assertEqual(self._control_mode(GUEST), "manual")

        await self._evaluate(NOW + 30 * MINUTE)
        self.assertEqual(self._control_mode(GUEST), "automatic")
        self.assertEqual(self._delivered(GUEST), [("set_temperature", GUEST, 24.0, True, "cool")])
        released = self._events("manual_hold_released")
        self.assertEqual(len(released), 1)
        self.assertEqual(released[0]["entity_id"], GUEST)
        self.assertEqual(released[0]["reason"], "vacant")
        self.assertEqual(released[0]["manual_since"], NOW.isoformat())
        self.assertEqual(released[0]["age_minutes"], 30.0)
        self.assertEqual(self._state_of(GUEST), "idle")

    async def test_vacancy_shorter_than_the_setting_waits_for_the_vacancy_clock(self) -> None:
        await self._start()
        await self._adjust(GUEST, 22.0)
        self.hass.states[OCC_GUEST] = _state("off", changed=NOW + 5 * MINUTE)

        await self._evaluate(NOW + 40 * MINUTE)
        self.assertEqual(self._control_mode(GUEST), "manual")
        self.assertEqual(self._status(GUEST)["manual_release_at"], (NOW + 65 * MINUTE).isoformat())

        await self._evaluate(NOW + 65 * MINUTE)
        self.assertEqual(self._control_mode(GUEST), "automatic")

    async def test_uncertain_or_missing_occupancy_never_releases_the_manual(self) -> None:
        await self._start()
        await self._adjust(GUEST, 22.0)
        await self._adjust(KITCHEN, 22.0)
        self.hass.states[OCC_GUEST] = _state("unavailable", changed=NOW - timedelta(hours=9))
        del self.data["zones"][KITCHEN]["occupancy_assist"]

        await self._evaluate(NOW + timedelta(hours=8))
        self.assertEqual(self._control_mode(GUEST), "manual")
        self.assertEqual(self._control_mode(KITCHEN), "manual")
        self.assertIsNone(self._status(KITCHEN)["manual_release_at"])
        self.assertEqual(self._events("manual_hold_released"), [])

    async def test_travel_releases_manuals_older_than_the_lease(self) -> None:
        await self._start()
        await self._adjust(GUEST, 22.0)
        self.hass.states[TRAVEL] = _state("on", changed=NOW + 5 * MINUTE)

        await self._evaluate(NOW + 20 * MINUTE)
        self.assertEqual(self._control_mode(GUEST), "manual")
        self.assertEqual(self._status(GUEST)["manual_release_at"], (NOW + 30 * MINUTE).isoformat())

        await self._evaluate(NOW + 30 * MINUTE)
        self.assertEqual(self._control_mode(GUEST), "automatic")
        self.assertEqual(self._events("manual_hold_released")[0]["reason"], "travel")

    async def test_manual_made_during_travel_is_not_released_by_travel(self) -> None:
        self.hass.states[TRAVEL] = _state("on", changed=NOW - timedelta(hours=1))
        await self._start()
        await self._adjust(GUEST, 22.0)

        await self._evaluate(NOW + timedelta(hours=2))
        self.assertEqual(self._control_mode(GUEST), "manual")
        self.assertEqual(self._events("manual_hold_released"), [])

    async def test_travel_rule_respects_its_switch_and_uncertain_travel_state(self) -> None:
        await self._start()
        await self._adjust(GUEST, 22.0)
        self.hass.states[TRAVEL] = _state("unknown", changed=NOW + 5 * MINUTE)
        await self._evaluate(NOW + 40 * MINUTE)
        self.assertEqual(self._control_mode(GUEST), "manual")

        self._settings(manual_release_on_travel=False)
        self.hass.states[TRAVEL] = _state("on", changed=NOW + 5 * MINUTE)
        await self._evaluate(NOW + 41 * MINUTE)
        self.assertEqual(self._control_mode(GUEST), "manual")

    async def test_owners_away_with_a_setpoint_below_the_floor_releases_the_manual(self) -> None:
        await self._start()
        await self._adjust(GUEST, 21.0)  # floor 22, tolerance 0.31
        self.hass.states[OWNER_1] = _state("not_home", changed=NOW + MINUTE)
        self.hass.states[OWNER_2] = _state("not_home", changed=NOW + MINUTE)

        await self._evaluate(NOW + 5 * MINUTE)
        self.assertEqual(self._control_mode(GUEST), "manual")
        self.assertEqual(self._status(GUEST)["manual_release_at"], (NOW + 30 * MINUTE).isoformat())

        await self._evaluate(NOW + 30 * MINUTE)
        self.assertEqual(self._control_mode(GUEST), "automatic")
        self.assertEqual(self._events("manual_hold_released")[0]["reason"], "below_minimum")
        # Velair re-applies its own target, clamped by the zone limits.
        self.assertEqual(self._delivered(GUEST)[-1], ("set_temperature", GUEST, 24.0, True, "cool"))

    async def test_owner_rule_needs_all_owners_away_for_the_configured_minutes(self) -> None:
        await self._start()
        await self._adjust(GUEST, 21.0)
        self.hass.states[OWNER_1] = _state("not_home", changed=NOW + MINUTE)
        self.hass.states[OWNER_2] = _state("not_home", changed=NOW + 40 * MINUTE)

        await self._evaluate(NOW + 42 * MINUTE)
        self.assertEqual(self._control_mode(GUEST), "manual")
        self.assertEqual(self._status(GUEST)["manual_release_at"], (NOW + 44 * MINUTE).isoformat())

        await self._evaluate(NOW + 44 * MINUTE)
        self.assertEqual(self._control_mode(GUEST), "automatic")

    async def test_owner_rule_p5_and_boundary_cases(self) -> None:
        cases = (
            ("setpoint_inside_tolerance", 21.8, ("not_home", "not_home"), [OWNER_1, OWNER_2], True),
            ("owner_unavailable", 21.0, ("not_home", "unavailable"), [OWNER_1, OWNER_2], True),
            ("owner_home", 21.0, ("home", "not_home"), [OWNER_1, OWNER_2], True),
            ("no_owners_configured", 21.0, ("not_home", "not_home"), [], True),
            ("rule_disabled", 21.0, ("not_home", "not_home"), [OWNER_1, OWNER_2], False),
        )
        for name, setpoint, states, owners, rule_enabled in cases:
            with self.subTest(case=name):
                self.setUp()
                self._settings(owner_entity_ids=owners, manual_release_below_minimum=rule_enabled)
                await self._start()
                await self._adjust(GUEST, setpoint)
                self.hass.states[OWNER_1] = _state(states[0], changed=NOW + MINUTE)
                self.hass.states[OWNER_2] = _state(states[1], changed=NOW + MINUTE)
                await self._evaluate(NOW + timedelta(hours=3))
                self.assertEqual(self._control_mode(GUEST), "manual")
                self.assertEqual(self._events("manual_hold_released"), [])

    async def test_manual_release_can_be_disabled_globally(self) -> None:
        self._settings(manual_release_enabled=False)
        await self._start()
        self.hass.states[OCC_GUEST] = _state("off", changed=NOW - timedelta(hours=2))
        await self._adjust(GUEST, 22.0)

        await self._evaluate(NOW + timedelta(hours=2))
        self.assertEqual(self._control_mode(GUEST), "manual")
        self.assertEqual(self._state_of(GUEST), "idle")


class ActivityHoldTest(GuardsTestCase):
    """The generalized cooking rule."""

    async def _configure_cooking(self, **overrides) -> None:
        await self.scheduler.async_update_zone_guards(
            KITCHEN,
            {"activity_holds": [{"entity_id": COOKING, "temperature": 25.0, **overrides}]},
        )
        await self.guards.async_drain()

    async def test_activity_hold_engages_and_releases_after_the_delay(self) -> None:
        self.hass.states[COOKING] = _state("off")
        await self._start()
        await self._configure_cooking()
        self.assertEqual(self._pause_ids(KITCHEN), [])

        self.hass.states[COOKING] = _state("on", changed=NOW)
        await self._evaluate(NOW)

        hold = self._pause(KITCHEN, "activity")
        self.assertEqual(hold["temperature"], 25.0)
        self.assertEqual(hold["constraint"], "lower_only")
        self.assertEqual(hold["hvac_mode"], "cool")
        self.assertEqual(self._delivered(KITCHEN), [("set_temperature", KITCHEN, 25.0, True, "cool")])
        self.assertEqual(self._state_of(KITCHEN), "activity_hold")
        self.assertEqual(self._status(KITCHEN)["activity_entity_id"], COOKING)
        engaged = self._events("activity_hold_changed")
        self.assertEqual(len(engaged), 1)
        self.assertEqual(engaged[0]["activity_entity_id"], COOKING)
        self.assertEqual(engaged[0]["pause_id"], "activity")
        self.assertTrue(engaged[0]["active"])
        self.assertEqual(engaged[0]["temperature"], 25.0)
        self.assertEqual(engaged[0]["constraint"], "lower_only")
        self.assertFalse(engaged[0]["resumed_automatic"])

        # Staying on re-evaluates without re-engaging or re-delivering.
        await self._evaluate(NOW + 5 * MINUTE)
        self.assertEqual(len(self._events("activity_hold_changed")), 1)
        self.assertEqual(len(self._delivered(KITCHEN)), 1)

        self.hass.states[COOKING] = _state("off", changed=NOW + 20 * MINUTE)
        await self._evaluate(NOW + 25 * MINUTE)
        self.assertEqual(self._pause_ids(KITCHEN), ["activity"])
        self.assertEqual(self._status(KITCHEN)["next_transition_at"], (NOW + 30 * MINUTE).isoformat())

        await self._evaluate(NOW + 30 * MINUTE)
        self.assertEqual(self._pause_ids(KITCHEN), [])
        self.assertEqual(self._delivered(KITCHEN)[-1], ("set_temperature", KITCHEN, 27.0, True, "cool"))
        self.assertEqual(self._state_of(KITCHEN), "idle")
        released = self._events("activity_hold_changed")[-1]
        self.assertFalse(released["active"])
        self.assertFalse(released["resumed_automatic"])

    async def test_release_resumes_automatic_control_only_after_the_lease(self) -> None:
        self.hass.states[COOKING] = _state("off")
        await self._start()
        await self._configure_cooking(release_delay_minutes=5)
        await self._adjust(KITCHEN, 22.0)
        self.hass.states[COOKING] = _state("on", changed=NOW + MINUTE)
        await self._evaluate(NOW + MINUTE)
        self.assertEqual(sorted(self._pause_ids(KITCHEN)), ["activity", "velair.manual_adjustment"])

        # Younger than the lease: the person's value survives the release.
        self.hass.states[COOKING] = _state("off", changed=NOW + 10 * MINUTE)
        await self._evaluate(NOW + 15 * MINUTE)
        self.assertEqual(self._pause_ids(KITCHEN), ["velair.manual_adjustment"])
        self.assertEqual(self._control_mode(KITCHEN), "manual")
        self.assertFalse(self._events("activity_hold_changed")[-1]["resumed_automatic"])

        # Older than the lease: the release also returns the zone to Velair.
        self.hass.states[COOKING] = _state("on", changed=NOW + 40 * MINUTE)
        await self._evaluate(NOW + 40 * MINUTE)
        self.hass.states[COOKING] = _state("off", changed=NOW + 45 * MINUTE)
        await self._evaluate(NOW + 50 * MINUTE)
        self.assertEqual(self._pause_ids(KITCHEN), [])
        self.assertEqual(self._control_mode(KITCHEN), "automatic")
        self.assertTrue(self._events("activity_hold_changed")[-1]["resumed_automatic"])

    async def test_unavailable_activity_entity_keeps_the_hold(self) -> None:
        self.hass.states[COOKING] = _state("on", changed=NOW)
        await self._start()
        await self._configure_cooking()
        self.assertEqual(self._pause_ids(KITCHEN), ["activity"])

        self.hass.states[COOKING] = _state("unavailable", changed=NOW + MINUTE)
        await self._evaluate(NOW + timedelta(hours=1))
        self.assertEqual(self._pause_ids(KITCHEN), ["activity"])

    async def test_configuration_validation_and_custom_fields(self) -> None:
        await self._start()
        with self.assertRaisesRegex(ValueError, "between"):
            await self._configure_cooking(temperature=60.0)
        with self.assertRaisesRegex(ValueError, "entity_id"):
            await self.scheduler.async_update_zone_guards(
                KITCHEN, {"activity_holds": [{"temperature": 25.0}]}
            )
        config = await self.scheduler.async_update_zone_guards(
            KITCHEN,
            {
                "never_off_enabled": False,
                "activity_holds": [
                    {
                        "entity_id": COOKING,
                        "temperature": 25.3,
                        "constraint": "absolute",
                        "hvac_mode": None,
                        "release_delay_minutes": 3,
                        "pause_id": "cooking",
                        "label": "Cooking",
                    }
                ],
            },
        )
        self.assertFalse(config["never_off_enabled"])
        hold = config["activity_holds"][0]
        self.assertEqual(hold["pause_id"], "cooking")
        self.assertIsNone(hold["hvac_mode"])
        self.assertEqual(self.scheduler.get_guards_config(KITCHEN), config)
        self.hass.states[COOKING] = _state("on", changed=NOW)
        await self._evaluate(NOW)
        pause = self._pause(KITCHEN, "cooking")
        self.assertEqual(pause["temperature"], 25.5)  # snapped to the 0.5 step
        self.assertEqual(pause["constraint"], "absolute")
        self.assertEqual(pause["label"], "Cooking")


class ContinuityAndUnitsTest(GuardsTestCase):
    """Restart continuity, Fahrenheit and storage conversion."""

    async def test_restart_continues_the_grace_from_persisted_timestamps(self) -> None:
        await self._start()
        await self._turn_off(GUEST)
        runtime = self.data["settings"]["guards_runtime"][GUEST]
        self.assertEqual(runtime["state"], "off_grace")
        self.assertEqual(runtime["grace_ends_at"], (NOW + 10 * MINUTE).isoformat())
        self.assertEqual(runtime["previous_target"], 24.0)
        persisted = models_module.serialize_schedule_data(deepcopy(self.data))
        self.assertEqual(persisted["settings"]["guards_runtime"][GUEST]["previous_hvac_mode"], "cool")

        restarted_hass = FakeHass()
        restarted_hass.states.update(self.hass.states)
        restarted_climate = FakeClimateManager()
        restarted_data = normalize_schedule_data(persisted, list(self.zones))
        # Keys owned by the parallel modules are re-injected the way their
        # normalizers would keep them.
        restarted_data["zones"][GUEST]["occupancy_assist"] = deepcopy(
            self.data["zones"][GUEST]["occupancy_assist"]
        )
        restarted_data["settings"]["house_modes"] = deepcopy(self.data["settings"]["house_modes"])
        restarted = VelairScheduler(
            restarted_hass,
            restarted_data,
            restarted_climate,
            self._async_save,
        )
        for entity_id in self.zones:
            restarted_climate.hvac_modes[entity_id] = ["off", "heat", "cool"]
        guards = restarted._guards
        self.assertEqual(guards.status(GUEST)["state"], "off_grace")
        self.assertEqual(guards.status(GUEST)["grace_ends_at"], (NOW + 10 * MINUTE).isoformat())

        self._set_time(NOW + 4 * MINUTE)
        await restarted.async_start()
        await guards.async_drain()
        # Still inside the original grace: no new grace, no relight yet.
        self.assertEqual(guards.status(GUEST)["state"], "off_grace")
        self.assertEqual(
            [e for _t, e in restarted_hass.bus.events if e.get("event") == "never_off_grace_started"],
            [],
        )

        self._set_time(NOW + 10 * MINUTE)
        await guards.async_evaluate()
        await guards.async_drain()
        self.assertEqual(guards.status(GUEST)["state"], "recovering")
        self.assertEqual(
            next(p for p in restarted_data["zones"][GUEST]["pauses"] if p.get("pause_id") == "neveroff_recover")["temperature"],
            26.0,
        )
        self.assertIn(("set_temperature", GUEST, 26.0, True, "cool"), restarted_climate.calls)

    async def test_fahrenheit_below_minimum_tolerance_and_recovery(self) -> None:
        self.climate.temperature_unit = lambda entity_id: "°F"
        for entity_id in self.zones:
            self.climate.limits[entity_id] = (60.0, 90.0)
        self.data["zones"][GUEST]["limits"]["min_temperature"] = 68.0
        self.data["zones"][GUEST]["schedule"]["tuesday"][0]["temperature"] = 75.0
        self.data["zones"][GUEST]["occupancy_assist"]["setback_stages"][-1]["temperature"] = 79.0
        self.hass.states[GUEST] = _state("cool", temperature=75.0)
        await self._start()
        self.hass.states[OWNER_1] = _state("not_home", changed=NOW - timedelta(hours=1))
        self.hass.states[OWNER_2] = _state("not_home", changed=NOW - timedelta(hours=1))

        # 0.31 C is 0.558 F: 67.6 is inside the tolerance below 68.
        await self._adjust(GUEST, 67.6)
        await self._evaluate(NOW + 30 * MINUTE)
        self.assertEqual(self._control_mode(GUEST), "manual")

        await self.scheduler.async_resume_automatic_control(GUEST)
        await self.guards.async_drain()
        await self._adjust(GUEST, 67.3, when=NOW + 31 * MINUTE)
        await self._evaluate(NOW + 61 * MINUTE)
        self.assertEqual(self._control_mode(GUEST), "automatic")
        self.assertEqual(self._events("manual_hold_released")[0]["reason"], "below_minimum")

        self.hass.states[GUEST] = _state("cool", temperature=75.0, changed=NOW + 62 * MINUTE)
        await self._turn_off(GUEST, when=NOW + 62 * MINUTE)
        await self._evaluate(NOW + 72 * MINUTE)
        self.assertEqual(self._pause(GUEST, "neveroff_recover")["temperature"], 79.0)

    def test_storage_converts_activity_hold_and_runtime_temperatures(self) -> None:
        data = {
            "zones": {
                KITCHEN: {
                    "guards": {
                        "never_off_enabled": True,
                        "activity_holds": [{"entity_id": COOKING, "temperature": 25.0}],
                    }
                }
            },
            "settings": {
                "guards": {"never_off_grace_minutes": 10},
                "guards_runtime": {KITCHEN: {"state": "off_grace", "previous_target": 24.0}},
            },
        }
        storage_module._convert_scheduler_temperatures(data, "°C", "°F")

        self.assertAlmostEqual(
            data["zones"][KITCHEN]["guards"]["activity_holds"][0]["temperature"], 77.0
        )
        self.assertAlmostEqual(
            data["settings"]["guards_runtime"][KITCHEN]["previous_target"], 75.2
        )
        self.assertEqual(data["settings"]["guards"]["never_off_grace_minutes"], 10)

    async def test_stop_clears_timers_and_listeners(self) -> None:
        original_timer = guards_module.async_track_point_in_time
        original_tracker = guards_module.async_track_state_change_event
        timer = Mock(return_value=Mock())
        tracker = Mock(return_value=Mock())
        guards_module.async_track_point_in_time = timer
        guards_module.async_track_state_change_event = tracker
        self.addCleanup(setattr, guards_module, "async_track_point_in_time", original_timer)
        self.addCleanup(setattr, guards_module, "async_track_state_change_event", original_tracker)
        self.hass.states[COOKING] = _state("off")
        await self._start()
        await self.scheduler.async_update_zone_guards(
            KITCHEN, {"activity_holds": [{"entity_id": COOKING, "temperature": 25.0}]}
        )
        await self.guards.async_drain()
        self.assertEqual(
            sorted(tracker.call_args.args[1]),
            sorted([KITCHEN, GUEST, OCC_KITCHEN, OCC_GUEST, COOKING, TRAVEL, OWNER_1, OWNER_2]),
        )

        await self._turn_off(GUEST)
        self.assertIn(NOW + 10 * MINUTE, [call.args[2] for call in timer.call_args_list])
        self.assertIsNotNone(self.guards._runtime(GUEST).unsub_timer)

        await self.scheduler.async_stop()
        self.assertFalse(self.guards._started)
        self.assertIsNone(self.guards._runtime(GUEST).unsub_timer)
        tracker.return_value.assert_called()


class EntityTest(unittest.IsolatedAsyncioTestCase):
    """Generated sensor, switch and numbers."""

    def setUp(self) -> None:
        self.settings = {"guards": {"never_off_grace_minutes": 15, "enabled": True}}
        self.status = {
            "state": "off_grace",
            "grace_ends_at": "2026-09-04T21:10:00+02:00",
            "snooze_until": None,
            "manual_since": "2026-09-04T20:00:00+02:00",
            "manual_release_at": None,
            "activity_entity_id": None,
            "pause_ids": ["velair.manual_adjustment"],
            "last_action": "grace_started",
        }
        self.scheduler = SimpleNamespace(
            temperature_migration_blocked=False,
            get_guards_status=lambda entity_id: dict(self.status),
            async_update_settings=AsyncMock(),
        )
        self.entry = SimpleNamespace(
            entry_id="entry",
            data={"climate_entities": [GUEST, KITCHEN]},
            options={},
            runtime_data=SimpleNamespace(
                scheduler=self.scheduler,
                storage=SimpleNamespace(data={"settings": self.settings}),
            ),
        )
        self.hass = SimpleNamespace(
            states={GUEST: SimpleNamespace(attributes={"friendly_name": "Guest room"})}
        )

    def test_sensor_reports_state_and_compact_attributes(self) -> None:
        sensors = entities_module.build_guards_sensor_entities(self.hass, self.entry)
        self.assertEqual(
            [sensor._attr_unique_id for sensor in sensors],
            ["entry_climate_guest_guard_state", "entry_climate_kitchen_guard_state"],
        )
        sensor = sensors[0]
        self.assertEqual(sensor._attr_translation_key, "zone_guard")
        self.assertEqual(sensor._attr_translation_placeholders, {"zone": "Guest room"})
        self.assertEqual(sensors[1]._attr_translation_placeholders, {"zone": KITCHEN})
        self.assertEqual(sensor._attr_device_class, "enum")
        self.assertEqual(
            sensor._attr_options,
            ["idle", "off_grace", "snoozed", "recovering", "manual_watch", "activity_hold"],
        )
        self.assertEqual(sensor.native_value, "off_grace")
        self.assertEqual(
            sensor.extra_state_attributes,
            {
                "grace_ends_at": "2026-09-04T21:10:00+02:00",
                "manual_since": "2026-09-04T20:00:00+02:00",
                "pause_ids": ["velair.manual_adjustment"],
                "last_action": "grace_started",
                "climate_entity_id": GUEST,
            },
        )
        self.assertIn("guard_state", const_module.ZONE_SENSOR_UNIQUE_ID_SUFFIXES)
        self.assertIn("guard_state", const_module.ZONE_ENTITY_UNIQUE_ID_SUFFIXES)
        self.assertTrue(sensor.available)
        self.scheduler.temperature_migration_blocked = True
        self.assertFalse(sensor.available)
        self.status = {}
        self.assertEqual(sensor.native_value, "idle")

    async def test_switch_toggles_the_master_setting(self) -> None:
        switches = entities_module.build_guards_switch_entities(self.hass, self.entry)
        self.assertEqual(len(switches), 1)
        switch = switches[0]
        self.assertEqual(switch._attr_unique_id, "entry_guards_enabled")
        self.assertEqual(switch._attr_translation_key, "guards")
        self.assertTrue(switch.is_on)

        await switch.async_turn_off()
        self.scheduler.async_update_settings.assert_awaited_once_with(
            {"guards": {"never_off_grace_minutes": 15, "enabled": False}}
        )
        self.settings["guards"]["enabled"] = False
        self.assertFalse(switch.is_on)
        self.scheduler.async_update_settings.reset_mock()
        await switch.async_turn_on()
        self.scheduler.async_update_settings.assert_awaited_once_with(
            {"guards": {"never_off_grace_minutes": 15, "enabled": True}}
        )

    async def test_numbers_expose_the_four_parameters(self) -> None:
        numbers = entities_module.build_guards_number_entities(self.hass, self.entry)
        self.assertEqual(
            [number._attr_unique_id for number in numbers],
            [
                "entry_guards_never_off_grace_minutes",
                "entry_guards_never_off_snooze_minutes",
                "entry_guards_manual_lease_minutes",
                "entry_guards_manual_release_vacant_minutes",
            ],
        )
        grace = numbers[0]
        self.assertEqual(grace._attr_translation_key, "guards_never_off_grace_minutes")
        self.assertEqual(grace._attr_native_unit_of_measurement, "min")
        self.assertEqual(grace._attr_entity_category, "config")
        self.assertEqual(grace._attr_mode, "box")
        self.assertEqual(grace._attr_native_min_value, 1.0)
        self.assertEqual(grace._attr_native_max_value, 1440.0)
        self.assertEqual(grace.native_value, 15.0)
        self.assertEqual(numbers[1].native_value, 1440.0)
        self.assertEqual(numbers[2].native_value, 30.0)
        self.assertEqual(numbers[3].native_value, 60.0)

        await numbers[2].async_set_native_value(45.4)
        self.scheduler.async_update_settings.assert_awaited_once_with(
            {"guards": {"never_off_grace_minutes": 15, "enabled": True, "manual_lease_minutes": 45}}
        )

    def test_translations_cover_every_entity_and_state(self) -> None:
        for language in LANGUAGES:
            with self.subTest(language=language):
                translation = json.loads(
                    (ROOT / "custom_components" / "velair" / "translations" / f"{language}.json")
                    .read_text(encoding="utf-8")
                )
                entity = translation["entity"]
                self.assertEqual(
                    set(entity["sensor"]["zone_guard"]["state"]),
                    set(guards_models.GUARDS_STATES),
                )
                self.assertIn("{zone}", entity["sensor"]["zone_guard"]["name"])
                self.assertIn("guards", entity["switch"])
                for field, _minimum, _maximum in entities_module.GUARDS_GLOBAL_NUMBERS:
                    self.assertIn(f"guards_{field}", entity["number"])


class ServiceAndApiTest(unittest.IsolatedAsyncioTestCase):
    """Service registration/forwarding and WebSocket handlers."""

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
            async_snooze_off=AsyncMock(),
            async_update_zone_guards=AsyncMock(return_value={"never_off_enabled": True}),
            async_update_settings=AsyncMock(),
            ensure_managed_entity=Mock(),
            set_temperature_migration_blocked=Mock(),
            temperature_migration_blocked=False,
        )
        self.services = self._ServiceRegistry()
        self.runtime = {
            "scheduler": self.scheduler,
            "storage": SimpleNamespace(
                temperature_migration_required=False,
                data={"settings": {"guards": {"manual_lease_minutes": 20, "owner_entity_ids": [OWNER_1]}}},
            ),
            "operation_active": None,
            "operation_recovery": None,
            "entry": SimpleNamespace(options={}),
        }
        self.hass = SimpleNamespace(services=self.services, data={const_module.DOMAIN: {"entry": self.runtime}})

    async def test_snooze_off_service_forwards_and_maps_errors(self) -> None:
        await services_module.async_setup_services(self.hass)
        handler, _schema = self.services.handlers[(const_module.DOMAIN, const_module.SERVICE_SNOOZE_OFF)]

        await handler(SimpleNamespace(data={"entity_id": GUEST}))
        await handler(SimpleNamespace(data={"entity_id": GUEST, "duration_minutes": 90}))
        self.assertEqual(
            [call.args for call in self.scheduler.async_snooze_off.await_args_list],
            [(GUEST, None), (GUEST, 90)],
        )
        self.scheduler.async_snooze_off.side_effect = ValueError("nope")
        with self.assertRaisesRegex(services_module.HomeAssistantError, "nope"):
            await handler(SimpleNamespace(data={"entity_id": GUEST}))
        await services_module.async_unload_services(self.hass)
        self.assertIn((const_module.DOMAIN, const_module.SERVICE_SNOOZE_OFF), self.services.removed)

    async def test_ws_update_zone_guards_forwards_and_reports_errors(self) -> None:
        original_get_runtime = api_module._get_runtime
        original_build = api_module._build_schedule_response
        api_module._get_runtime = lambda _hass: self.runtime
        api_module._build_schedule_response = lambda _runtime: {"ok": True}
        self.addCleanup(setattr, api_module, "_get_runtime", original_get_runtime)
        self.addCleanup(setattr, api_module, "_build_schedule_response", original_build)
        connection = SimpleNamespace(send_result=Mock(), send_error=Mock())
        payload = {"never_off_enabled": False, "activity_holds": [{"entity_id": COOKING, "temperature": 25}]}

        await guards_api.ws_update_zone_guards(
            SimpleNamespace(),
            connection,
            {"id": 7, "type": "velair/update_zone_guards", "entity_id": KITCHEN, "guards": payload},
        )
        self.scheduler.async_update_zone_guards.assert_awaited_once_with(KITCHEN, payload)
        connection.send_result.assert_called_once_with(7, {"ok": True})

        self.scheduler.async_update_zone_guards.side_effect = ValueError("bad hold")
        await guards_api.ws_update_zone_guards(
            SimpleNamespace(),
            connection,
            {"id": 8, "type": "velair/update_zone_guards", "entity_id": KITCHEN, "guards": {}},
        )
        connection.send_error.assert_called_once_with(8, "invalid_guards", "bad hold")

        api_module._get_runtime = lambda _hass: None
        await guards_api.ws_update_zone_guards(SimpleNamespace(), connection, {"id": 9, "guards": {}})
        connection.send_error.assert_called_with(9, "not_loaded", "Integration is not loaded")

    async def test_ws_update_settings_merges_guards_parameters(self) -> None:
        original_get_runtime = api_module._get_runtime
        original_build = api_module._build_schedule_response
        api_module._get_runtime = lambda _hass: self.runtime
        api_module._build_schedule_response = lambda _runtime: {"ok": True}
        self.addCleanup(setattr, api_module, "_get_runtime", original_get_runtime)
        self.addCleanup(setattr, api_module, "_build_schedule_response", original_build)
        connection = SimpleNamespace(send_result=Mock(), send_error=Mock())

        await api_module.ws_update_settings(
            SimpleNamespace(),
            connection,
            {"id": 3, "type": "velair/update_settings", "guards": {"never_off_grace_minutes": 5}},
        )
        self.scheduler.async_update_settings.assert_awaited_once_with(
            {
                "guards": {
                    "manual_lease_minutes": 20,
                    "owner_entity_ids": [OWNER_1],
                    "never_off_grace_minutes": 5,
                }
            }
        )

    def test_schedule_response_and_export_include_guards(self) -> None:
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
                get_guards_statuses=lambda: {GUEST: {"state": "idle"}},
                humidity_assist_compliant=False,
                get_zone_runtime_statuses=lambda: {},
            ),
            "storage": SimpleNamespace(data=data),
        }
        response = api_module._build_schedule_response(runtime)
        self.assertEqual(response["guards"], {GUEST: {"state": "idle"}})
        self.assertIn("guards", response["settings"])
        self.assertEqual(response["settings"]["guards_runtime"], {})
        self.assertIn("guards", response["zones"][GUEST])
        self.assertIn("guards", api_module._export_zones(data["zones"])[GUEST])
        runtime["scheduler"].temperature_migration_blocked = True
        self.assertEqual(api_module._build_schedule_response(runtime)["guards"], {})


class NormalizationTest(unittest.TestCase):
    """Tolerant normalization of garbage configuration."""

    def test_zone_config_repairs_garbage(self) -> None:
        normalized = guards_models.normalize_guards_zone_data(
            {
                "never_off_enabled": 0,
                "activity_holds": [
                    {"entity_id": COOKING, "temperature": "25", "constraint": "sideways",
                     "hvac_mode": "warp", "release_delay_minutes": -5, "pause_id": "velair.manual_adjustment",
                     "label": "  x" * 60},
                    {"entity_id": "nodot", "temperature": 25},
                    {"entity_id": COOKING},
                    "garbage",
                ],
            }
        )
        self.assertFalse(normalized["never_off_enabled"])
        self.assertEqual(len(normalized["activity_holds"]), 1)
        hold = normalized["activity_holds"][0]
        self.assertEqual(hold["temperature"], 25.0)
        self.assertEqual(hold["constraint"], "lower_only")
        self.assertEqual(hold["hvac_mode"], "cool")
        self.assertEqual(hold["release_delay_minutes"], 0)
        self.assertEqual(hold["pause_id"], "activity")
        self.assertEqual(len(hold["label"]), 64)
        self.assertEqual(
            guards_models.normalize_guards_zone_data("garbage"),
            {"never_off_enabled": True, "activity_holds": []},
        )

    def test_settings_repair_garbage_and_defaults(self) -> None:
        settings = guards_models.normalize_guards_settings(
            {
                "enabled": "",
                "never_off_grace_minutes": "x",
                "never_off_snooze_minutes": 99999,
                "manual_lease_minutes": -3,
                "owner_entity_ids": [OWNER_1, "nodot", OWNER_1, 4],
                "owner_away_minutes": True,
            }
        )
        self.assertFalse(settings["enabled"])
        self.assertEqual(settings["never_off_grace_minutes"], 10)
        self.assertEqual(settings["never_off_snooze_minutes"], 10080)
        self.assertEqual(settings["manual_lease_minutes"], 0)
        self.assertEqual(settings["owner_entity_ids"], [OWNER_1])
        self.assertEqual(settings["owner_away_minutes"], 4)
        self.assertEqual(
            guards_models.normalize_guards_settings(None),
            {
                "enabled": True,
                "never_off_enabled": True,
                "never_off_grace_minutes": 10,
                "never_off_snooze_minutes": 1440,
                "never_off_snooze_release_vacant_minutes": 30,
                "never_off_respect_travel": True,
                "manual_release_enabled": True,
                "manual_lease_minutes": 30,
                "manual_release_vacant_minutes": 60,
                "manual_release_on_travel": True,
                "owner_entity_ids": [],
                "owner_away_minutes": 4,
                "manual_release_below_minimum": True,
            },
        )

    def test_runtime_records_drop_unknown_zones_and_bad_timestamps(self) -> None:
        records = guards_models.normalize_guards_runtime_data(
            {
                GUEST: {
                    "state": "off_grace",
                    "grace_started_at": "not a date",
                    "grace_ends_at": NOW.isoformat(),
                    "previous_target": "24.5",
                    "previous_hvac_mode": "cool",
                    "last_action": "grace_started",
                },
                KITCHEN: {"state": "bogus", "grace_started_at": NOW.isoformat()},
                "climate.unknown": {"state": "off_grace"},
            },
            [GUEST, KITCHEN],
        )
        self.assertEqual(set(records), {GUEST, KITCHEN})
        self.assertEqual(records[GUEST]["state"], "off_grace")
        self.assertIsNone(records[GUEST]["grace_started_at"])
        self.assertEqual(records[GUEST]["grace_ends_at"], NOW.isoformat())
        self.assertEqual(records[GUEST]["previous_target"], 24.5)
        self.assertEqual(records[KITCHEN]["state"], "idle")
        # A start without an end is meaningless: both are dropped.
        self.assertIsNone(records[KITCHEN]["grace_started_at"])

    def test_schedule_data_round_trips_guards_sections(self) -> None:
        data = normalize_schedule_data(
            {
                "zones": {GUEST: {"guards": {"never_off_enabled": False}}},
                "settings": {
                    "guards": {"manual_lease_minutes": 12},
                    "guards_runtime": {GUEST: {"state": "snoozed"}, "climate.other": {}},
                },
            },
            [GUEST, KITCHEN],
        )
        self.assertFalse(data["zones"][GUEST]["guards"]["never_off_enabled"])
        self.assertTrue(data["zones"][KITCHEN]["guards"]["never_off_enabled"])
        self.assertEqual(data["settings"]["guards"]["manual_lease_minutes"], 12)
        self.assertEqual(set(data["settings"]["guards_runtime"]), {GUEST})
        serialized = models_module.serialize_schedule_data(data)
        self.assertEqual(serialized["settings"]["guards_runtime"][GUEST]["state"], "snoozed")
        self.assertIn("guards", serialized["zones"][GUEST])


class DocsTest(unittest.TestCase):
    """The user guide and the event contract stay in place."""

    def test_guide_is_linked_and_offers_the_snooze_automation(self) -> None:
        guide = (ROOT / "docs" / "user" / "guards.md").read_text(encoding="utf-8")
        index = (ROOT / "docs" / "README.md").read_text(encoding="utf-8")
        events = (ROOT / "docs" / "user" / "automation-events.md").read_text(encoding="utf-8")
        services = (ROOT / "custom_components" / "velair" / "services.yaml").read_text(encoding="utf-8")

        self.assertIn("user/guards.md", index)
        self.assertIn("event: never_off_grace_started", guide)
        self.assertIn("action: velair.snooze_off", guide)
        self.assertIn("Keep off 24 h", guide)
        self.assertRegex(services, r"(?m)^snooze_off:$")
        for event_name in (
            "never_off_grace_started",
            "never_off_recovered",
            "never_off_snoozed",
            "manual_hold_released",
            "activity_hold_changed",
        ):
            self.assertEqual(events.count(f"event: {event_name}\n"), 1)
            self.assertIn(f"`{event_name}`", guide)


if __name__ == "__main__":
    unittest.main()
