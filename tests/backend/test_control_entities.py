"""Control entity behavior tests."""

from __future__ import annotations

import importlib
import sys
from types import ModuleType, SimpleNamespace
import unittest
from unittest.mock import AsyncMock

from . import helpers


def _load_switch_module():
    """Load switch.py with the small Home Assistant entity surface it needs."""
    module_names = (
        "homeassistant.components.switch",
        "homeassistant.helpers.entity_platform",
        "custom_components.velair.entity",
    )
    previous_modules = {
        name: sys.modules.get(name)
        for name in module_names
    }
    package = sys.modules["custom_components.velair"]
    previous_entry_type = getattr(package, "VelairConfigEntry", None)

    class FakeVelairEntity:
        def __init__(self, entry, key: str) -> None:
            self._entry = entry
            self._attr_unique_id = f"{entry.entry_id}_{key}"

        @property
        def scheduler(self):
            return self._entry.runtime_data.scheduler

    try:
        switch_platform = ModuleType("homeassistant.components.switch")
        switch_platform.SwitchEntity = object
        sys.modules["homeassistant.components.switch"] = switch_platform

        entity_platform = ModuleType("homeassistant.helpers.entity_platform")
        entity_platform.AddConfigEntryEntitiesCallback = object
        sys.modules["homeassistant.helpers.entity_platform"] = entity_platform

        velair_entity = ModuleType("custom_components.velair.entity")
        velair_entity.VelairEntity = FakeVelairEntity
        sys.modules["custom_components.velair.entity"] = velair_entity

        package.VelairConfigEntry = object
        return importlib.import_module("custom_components.velair.switch")
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


def _load_number_module():
    """Load number.py with the small Home Assistant entity surface it needs."""
    module_names = (
        "homeassistant.components.number",
        "homeassistant.helpers.entity",
        "homeassistant.helpers.entity_platform",
        "custom_components.velair.entity",
    )
    previous_modules = {
        name: sys.modules.get(name)
        for name in module_names
    }
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
        return importlib.import_module("custom_components.velair.number")
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


switch_module = _load_switch_module()
number_module = _load_number_module()


class AutomaticSchedulingSwitchTest(unittest.IsolatedAsyncioTestCase):
    """Verify the only writable entity maps cleanly to stop and resume."""

    async def test_switch_stops_indefinitely_and_resumes_current_schedule(self) -> None:
        scheduler = SimpleNamespace(
            mode=helpers.MODE_AUTO,
            temperature_migration_blocked=False,
            async_set_mode=AsyncMock(),
        )
        entry = SimpleNamespace(
            entry_id="entry",
            runtime_data=SimpleNamespace(scheduler=scheduler),
        )
        entity = switch_module.AutomaticSchedulingSwitch(entry)

        self.assertTrue(entity.available)
        self.assertTrue(entity.is_on)
        await entity.async_turn_off()
        scheduler.async_set_mode.assert_awaited_once_with(helpers.MODE_PAUSED)

        scheduler.async_set_mode.reset_mock()
        scheduler.mode = helpers.MODE_PAUSED
        self.assertFalse(entity.is_on)
        await entity.async_turn_on()
        scheduler.async_set_mode.assert_awaited_once_with(
            helpers.MODE_AUTO,
            apply_current_schedule=True,
        )

        scheduler.temperature_migration_blocked = True
        self.assertFalse(entity.available)

    def test_platforms_include_the_native_mode_select(self) -> None:
        self.assertEqual(
            helpers.const_module.PLATFORMS,
            ("sensor", "select", "switch", "number"),
        )


class ZoneTemperatureLimitNumberTest(unittest.IsolatedAsyncioTestCase):
    """Verify the per-zone limit numbers round-trip through the scheduler."""

    def setUp(self) -> None:
        self.limits = {"min_temperature": None, "max_temperature": None}
        self.scheduler = SimpleNamespace(
            temperature_migration_blocked=False,
            get_temperature_limits=lambda entity_id: (5.0, 35.0),
            get_temperature_step=lambda entity_id: 0.5,
            get_zone_limits=lambda entity_id: dict(self.limits),
            async_update_zone_limits=AsyncMock(),
        )
        self.entry = SimpleNamespace(
            entry_id="entry",
            runtime_data=SimpleNamespace(
                scheduler=self.scheduler,
                storage=SimpleNamespace(effective_temperature_unit="°C"),
            ),
        )
        self.minimum = number_module.ZoneTemperatureLimitNumber(
            self.entry, "climate.salon", "min", temperature_unit="°C", zone_name="Salon"
        )
        self.maximum = number_module.ZoneTemperatureLimitNumber(
            self.entry, "climate.salon", "max", temperature_unit="°C", zone_name="Salon"
        )

    def test_entities_use_deterministic_ids_and_device_bounds(self) -> None:
        self.assertEqual(
            self.minimum._attr_unique_id, "entry_climate_salon_min_temperature_limit"
        )
        self.assertEqual(
            self.maximum._attr_unique_id, "entry_climate_salon_max_temperature_limit"
        )
        self.assertEqual(self.minimum._attr_translation_key, "zone_min_temperature_limit")
        self.assertEqual(self.maximum._attr_translation_key, "zone_max_temperature_limit")
        self.assertEqual(self.minimum._attr_translation_placeholders, {"zone": "Salon"})
        self.assertEqual(self.minimum._attr_device_class, "temperature")
        self.assertEqual(self.minimum._attr_mode, "box")
        self.assertEqual(self.minimum._attr_entity_category, "config")
        self.assertEqual(self.minimum._attr_native_unit_of_measurement, "°C")
        self.assertEqual(self.minimum.native_min_value, 5.0)
        self.assertEqual(self.minimum.native_max_value, 35.0)
        self.assertEqual(self.minimum.native_step, 0.5)
        self.assertTrue(self.minimum.available)
        self.scheduler.temperature_migration_blocked = True
        self.assertFalse(self.minimum.available)

    def test_native_value_falls_back_to_the_device_bound_without_a_limit(self) -> None:
        self.assertEqual(self.minimum.native_value, 5.0)
        self.assertEqual(self.maximum.native_value, 35.0)
        self.assertFalse(self.minimum.extra_state_attributes["limit_active"])

        self.limits = {"min_temperature": 21.0, "max_temperature": 24.0}

        self.assertEqual(self.minimum.native_value, 21.0)
        self.assertEqual(self.maximum.native_value, 24.0)
        self.assertTrue(self.maximum.extra_state_attributes["limit_active"])
        self.assertEqual(
            self.maximum.extra_state_attributes["climate_entity_id"], "climate.salon"
        )

    async def test_setting_a_value_updates_only_that_bound(self) -> None:
        await self.minimum.async_set_native_value(21)
        self.scheduler.async_update_zone_limits.assert_awaited_once_with(
            "climate.salon", {"min_temperature": 21.0}
        )
        self.scheduler.async_update_zone_limits.reset_mock()

        await self.maximum.async_set_native_value(24)
        self.scheduler.async_update_zone_limits.assert_awaited_once_with(
            "climate.salon", {"max_temperature": 24.0}
        )

    async def test_device_bound_clears_the_limit(self) -> None:
        await self.minimum.async_set_native_value(5)
        self.scheduler.async_update_zone_limits.assert_awaited_once_with(
            "climate.salon", {"min_temperature": None}
        )
        self.scheduler.async_update_zone_limits.reset_mock()

        await self.maximum.async_set_native_value(35)
        self.scheduler.async_update_zone_limits.assert_awaited_once_with(
            "climate.salon", {"max_temperature": None}
        )

    def test_step_falls_back_per_unit_when_the_climate_has_none(self) -> None:
        self.scheduler.get_temperature_step = lambda entity_id: None
        self.assertEqual(self.minimum.native_step, 0.5)
        fahrenheit = number_module.ZoneTemperatureLimitNumber(
            self.entry, "climate.salon", "min", temperature_unit="°F"
        )
        self.assertEqual(fahrenheit.native_step, 1.0)
        self.assertEqual(fahrenheit._attr_translation_placeholders, {"zone": "climate.salon"})

    async def test_setup_creates_two_numbers_per_managed_climate(self) -> None:
        added: list = []
        hass = SimpleNamespace(
            states={
                "climate.salon": SimpleNamespace(attributes={"friendly_name": "Salon"}),
            },
            config=SimpleNamespace(units=SimpleNamespace(temperature_unit="°C")),
        )
        self.entry.data = {"climate_entities": ["climate.salon", "climate.bedroom"]}
        self.entry.options = {}
        hass.states = {
            key: SimpleNamespace(attributes=value)
            for key, value in {
                "climate.salon": {"friendly_name": "Salon"},
            }.items()
        }
        hass.states = _FakeStates(hass.states)

        await number_module.async_setup_entry(hass, self.entry, added.extend)

        self.assertEqual(
            [entity._attr_unique_id for entity in added],
            [
                "entry_climate_salon_min_temperature_limit",
                "entry_climate_salon_max_temperature_limit",
                "entry_climate_bedroom_min_temperature_limit",
                "entry_climate_bedroom_max_temperature_limit",
            ],
        )
        self.assertEqual(
            [entity._attr_translation_placeholders["zone"] for entity in added],
            ["Salon", "Salon", "climate.bedroom", "climate.bedroom"],
        )
        self.assertEqual(added[0]._attr_native_unit_of_measurement, "°C")

    def test_number_translations_exist_in_every_language(self) -> None:
        import json
        from pathlib import Path

        root = Path(__file__).resolve().parents[2]
        for language in ("de", "en", "es", "fr", "it", "nl", "pl", "pt", "pt-BR", "ru"):
            with self.subTest(language=language):
                translation = json.loads(
                    (root / "custom_components" / "velair" / "translations" / f"{language}.json")
                    .read_text(encoding="utf-8")
                )
                numbers = translation["entity"]["number"]
                self.assertEqual(
                    set(numbers),
                    {"zone_min_temperature_limit", "zone_max_temperature_limit"},
                )
                for key in numbers:
                    self.assertIn("{zone}", numbers[key]["name"])


class _FakeStates(dict):
    """Minimal state registry with the ``get`` used by number setup."""


if __name__ == "__main__":
    unittest.main()
