"""Generated Home Assistant entities for House Modes.

Builders are called with one line each from ``sensor.py``, ``switch.py``, and
``number.py``. Entity names follow the Humidity Assist idiom so Home Assistant
derives ``sensor.velair_house_mode``, ``switch.velair_house_modes``,
``switch.velair_<zone>_away_setback``, ``number.velair_<zone>_away_temperature``
and friends from the translated names.
"""

from __future__ import annotations

from types import SimpleNamespace
from typing import Any

from homeassistant.const import UnitOfTemperature
from homeassistant.core import HomeAssistant

# Each Home Assistant platform imports this module on its own, so a missing
# sibling platform (only possible outside a full Home Assistant runtime) must
# not break the platform that is loading.
try:
    from homeassistant.components.number import NumberDeviceClass, NumberEntity, NumberMode
except ImportError:  # pragma: no cover - platform stubs in unit tests
    NumberDeviceClass = SimpleNamespace(TEMPERATURE="temperature")
    NumberEntity = object
    NumberMode = SimpleNamespace(BOX="box")
try:
    from homeassistant.components.sensor import SensorDeviceClass, SensorEntity
except ImportError:  # pragma: no cover - platform stubs in unit tests
    SensorDeviceClass = SimpleNamespace(ENUM="enum")
    SensorEntity = object
try:
    from homeassistant.components.switch import SwitchEntity
except ImportError:  # pragma: no cover - platform stubs in unit tests
    SwitchEntity = object
try:
    from homeassistant.helpers.entity import EntityCategory
except ImportError:  # pragma: no cover - platform stubs in unit tests
    EntityCategory = SimpleNamespace(CONFIG="config")
_ENTITY_CATEGORY_CONFIG = getattr(EntityCategory, "CONFIG", "config")

from . import VelairConfigEntry
from .config_helpers import get_configured_climate_entities
from .entity import VelairEntity
from .house_modes_models import HOUSE_MODE_STATES

# (field, kind, min, max, step); kind is "minutes" or "temperature"
HOUSE_MODES_GLOBAL_NUMBERS: tuple[tuple[str, str, float, float, float], ...] = (
    ("away_after_minutes", "minutes", 1, 1440, 1),
    ("away_deep_after_minutes", "minutes", 0, 2880, 1),
    ("arrival_release_minutes", "minutes", 0, 120, 1),
    ("travel_park_temperature", "temperature", -58, 212, 0.5),
)
GLOBAL_NUMBER_KEYS = {
    "away_after_minutes": "house_away_after_minutes",
    "away_deep_after_minutes": "house_away_deep_after_minutes",
    "arrival_release_minutes": "house_arrival_release_minutes",
    "travel_park_temperature": "travel_park_temperature",
}

# (field, optional): optional numbers clear to None at the climate's minimum bound.
HOUSE_MODES_ZONE_NUMBERS: tuple[tuple[str, bool], ...] = (
    ("away_temperature", False),
    ("away_deep_temperature", True),
    ("sleep_temperature", False),
    ("sleep_minimum_temperature", True),
    ("presleep_temperature", True),
)
HOUSE_MODES_ZONE_SWITCHES: tuple[tuple[str, str], ...] = (
    # (field, unique-id suffix / translation key suffix)
    ("away_enabled", "away_setback"),
    ("sleep_enabled", "sleep_hold"),
)

STATUS_ATTRIBUTE_KEYS = (
    "sleeping",
    "away_stage",
    "presence_empty",
    "presence_certain",
    "empty_since",
    "next_stage_at",
    "travel_since",
    "sleep_since",
    "zones_parked",
    "zones_frozen",
    "zones_away",
    "zones_sleeping",
    "zones_presleep",
    "next_evaluation_at",
    "last_action",
    "last_action_at",
)


def build_house_modes_sensors(
    hass: HomeAssistant, entry: VelairConfigEntry
) -> list[SensorEntity]:
    """Build the global house mode sensor."""
    return [HouseModeSensor(entry)]


def build_house_modes_switches(
    hass: HomeAssistant, entry: VelairConfigEntry
) -> list[SwitchEntity]:
    """Build the master switch and the per-zone away/sleep switches."""
    entities: list[SwitchEntity] = [HouseModesSwitch(entry)]
    for entity_id in get_configured_climate_entities(entry):
        zone_name = _climate_name(hass, entity_id)
        for field, suffix in HOUSE_MODES_ZONE_SWITCHES:
            entities.append(
                ZoneHouseModesSwitch(entry, entity_id, field, suffix, zone_name=zone_name)
            )
    return entities


def build_house_modes_numbers(
    hass: HomeAssistant, entry: VelairConfigEntry
) -> list[NumberEntity]:
    """Build the per-zone temperatures and the global timing/park numbers."""
    entities: list[NumberEntity] = []
    for entity_id in get_configured_climate_entities(entry):
        zone_name = _climate_name(hass, entity_id)
        for field, optional in HOUSE_MODES_ZONE_NUMBERS:
            entities.append(
                ZoneHouseModesNumber(entry, entity_id, field, optional, zone_name=zone_name)
            )
    entities.extend(
        HouseModesParameterNumber(entry, field, kind, minimum, maximum, step)
        for field, kind, minimum, maximum, step in HOUSE_MODES_GLOBAL_NUMBERS
    )
    return entities


class _HouseModesEntity(VelairEntity):
    """Shared helpers for House Modes entities."""

    @property
    def available(self) -> bool:
        """Hide unit-bound configuration while scheduler data is blocked."""
        return not bool(getattr(self.scheduler, "temperature_migration_blocked", False))

    @property
    def _coordinator(self):
        return self.scheduler.house_modes


class HouseModeSensor(_HouseModesEntity, SensorEntity):
    """Sensor exposing the whole-home mode."""

    _attr_device_class = SensorDeviceClass.ENUM
    _attr_options = list(HOUSE_MODE_STATES)
    _attr_translation_key = "house_mode"

    def __init__(self, entry: VelairConfigEntry) -> None:
        """Initialize the sensor."""
        super().__init__(entry, "house_mode")

    @property
    def available(self) -> bool:
        """The mode sensor is always readable."""
        return True

    @property
    def native_value(self) -> str:
        """Return the current house mode."""
        value = self._coordinator.status().get("state")
        return value if isinstance(value, str) else "disabled"

    @property
    def extra_state_attributes(self) -> dict[str, Any] | None:
        """Return the presence, sleep, and travel context."""
        status = self._coordinator.status()
        attributes = {
            key: status.get(key)
            for key in STATUS_ATTRIBUTE_KEYS
            if status.get(key) is not None
        }
        return attributes or None


class HouseModesSwitch(_HouseModesEntity, SwitchEntity):
    """Master switch enabling House Modes."""

    _attr_translation_key = "house_modes"

    def __init__(self, entry: VelairConfigEntry) -> None:
        """Initialize the master switch."""
        super().__init__(entry, "house_modes")

    @property
    def is_on(self) -> bool:
        """Return whether House Modes is enabled."""
        return bool(self._coordinator.settings().get("enabled", False))

    async def async_turn_on(self, **kwargs) -> None:
        """Enable House Modes."""
        await self._coordinator.async_update_settings({"enabled": True})

    async def async_turn_off(self, **kwargs) -> None:
        """Disable House Modes and release its holds."""
        await self._coordinator.async_update_settings({"enabled": False})


class ZoneHouseModesSwitch(_HouseModesEntity, SwitchEntity):
    """Per-zone away setback or sleep hold switch."""

    def __init__(
        self,
        entry: VelairConfigEntry,
        climate_entity_id: str,
        field: str,
        suffix: str,
        *,
        zone_name: str | None = None,
    ) -> None:
        """Initialize one zone switch."""
        self._climate_entity_id = climate_entity_id
        self._field = field
        zone_key = climate_entity_id.replace(".", "_")
        super().__init__(entry, f"{zone_key}_{suffix}")
        self._attr_translation_key = f"zone_{suffix}"
        self._attr_translation_placeholders = {"zone": zone_name or climate_entity_id}

    @property
    def is_on(self) -> bool:
        """Return the configured boolean field."""
        return bool(self._coordinator.zone_config(self._climate_entity_id).get(self._field))

    @property
    def extra_state_attributes(self) -> dict[str, str]:
        """Expose the managed climate."""
        return {"climate_entity_id": self._climate_entity_id}

    async def async_turn_on(self, **kwargs) -> None:
        """Set the field to true."""
        await self._coordinator.async_update_zone_config(
            self._climate_entity_id, {self._field: True}
        )

    async def async_turn_off(self, **kwargs) -> None:
        """Set the field to false."""
        await self._coordinator.async_update_zone_config(
            self._climate_entity_id, {self._field: False}
        )


class ZoneHouseModesNumber(_HouseModesEntity, NumberEntity):
    """Per-zone House Modes temperature.

    Optional temperatures (deep away, sleep minimum, pre-sleep) are cleared by
    setting the number to the climate's own minimum target, mirroring the zone
    limit numbers.
    """

    _attr_device_class = NumberDeviceClass.TEMPERATURE
    _attr_entity_category = _ENTITY_CATEGORY_CONFIG
    _attr_mode = NumberMode.BOX

    def __init__(
        self,
        entry: VelairConfigEntry,
        climate_entity_id: str,
        field: str,
        optional: bool,
        *,
        zone_name: str | None = None,
    ) -> None:
        """Initialize one zone temperature number."""
        self._climate_entity_id = climate_entity_id
        self._field = field
        self._optional = optional
        zone_key = climate_entity_id.replace(".", "_")
        super().__init__(entry, f"{zone_key}_{field}")
        self._attr_translation_key = f"zone_{field}"
        self._attr_translation_placeholders = {"zone": zone_name or climate_entity_id}

    @property
    def native_unit_of_measurement(self) -> str:
        """Return the climate's runtime unit."""
        return _climate_unit(self.scheduler, self._climate_entity_id)

    @property
    def native_min_value(self) -> float:
        """Return the climate's own minimum target."""
        return self.scheduler.get_temperature_limits(self._climate_entity_id)[0]

    @property
    def native_max_value(self) -> float:
        """Return the climate's own maximum target."""
        return self.scheduler.get_temperature_limits(self._climate_entity_id)[1]

    @property
    def native_step(self) -> float:
        """Return the climate's published target step, or a unit-aware default."""
        step = self.scheduler.get_temperature_step(self._climate_entity_id)
        if step is not None:
            return step
        return 1.0 if self.native_unit_of_measurement == UnitOfTemperature.FAHRENHEIT else 0.5

    @property
    def native_value(self) -> float | None:
        """Return the stored temperature, or the minimum bound when cleared."""
        value = self._coordinator.zone_config(self._climate_entity_id).get(self._field)
        if isinstance(value, int | float):
            return float(value)
        return self.native_min_value if self._optional else None

    @property
    def extra_state_attributes(self) -> dict[str, Any]:
        """Expose whether an optional temperature is active."""
        value = self._coordinator.zone_config(self._climate_entity_id).get(self._field)
        attributes: dict[str, Any] = {"climate_entity_id": self._climate_entity_id}
        if self._optional:
            attributes["active"] = value is not None
        return attributes

    async def async_set_native_value(self, value: float) -> None:
        """Persist the temperature; the minimum bound clears an optional one."""
        stored: float | None = float(value)
        if self._optional and value <= self.native_min_value + 0.000001:
            stored = None
        await self._coordinator.async_update_zone_config(
            self._climate_entity_id, {self._field: stored}
        )


class HouseModesParameterNumber(_HouseModesEntity, NumberEntity):
    """Global House Modes timing or travel park number."""

    _attr_entity_category = _ENTITY_CATEGORY_CONFIG
    _attr_mode = NumberMode.BOX

    def __init__(
        self,
        entry: VelairConfigEntry,
        field: str,
        kind: str,
        minimum: float,
        maximum: float,
        step: float,
    ) -> None:
        """Initialize one global parameter number."""
        key = GLOBAL_NUMBER_KEYS[field]
        super().__init__(entry, key)
        self._field = field
        self._kind = kind
        self._attr_translation_key = key
        self._attr_native_min_value = float(minimum)
        self._attr_native_max_value = float(maximum)
        self._attr_native_step = float(step)
        if kind == "temperature":
            self._attr_device_class = NumberDeviceClass.TEMPERATURE

    @property
    def native_unit_of_measurement(self) -> str | None:
        """Return minutes or the climate unit."""
        if self._kind == "minutes":
            return "min"
        climates = get_configured_climate_entities(self._entry)
        return _climate_unit(self.scheduler, climates[0] if climates else None)

    @property
    def native_min_value(self) -> float:
        """Return the climate range floor for the park temperature."""
        if self._kind == "temperature":
            return _climate_bounds(self.scheduler, self._entry)[0]
        return self._attr_native_min_value

    @property
    def native_max_value(self) -> float:
        """Return the climate range ceiling for the park temperature."""
        if self._kind == "temperature":
            return _climate_bounds(self.scheduler, self._entry)[1]
        return self._attr_native_max_value

    @property
    def native_value(self) -> float | None:
        """Return the stored parameter."""
        value = self._coordinator.settings().get(self._field)
        return float(value) if isinstance(value, int | float) else None

    async def async_set_native_value(self, value: float) -> None:
        """Persist a new global parameter."""
        next_value = int(round(value)) if self._kind == "minutes" else float(value)
        await self._coordinator.async_update_settings({self._field: next_value})


def _climate_unit(scheduler, entity_id: str | None) -> str:
    """Return the runtime temperature unit for one climate or the default."""
    manager = getattr(scheduler, "_climate_manager", None)
    unit_getter = getattr(manager, "temperature_unit", None)
    if entity_id is not None and callable(unit_getter):
        try:
            unit = unit_getter(entity_id)
        except Exception:  # pragma: no cover - defensive
            unit = None
        if unit in (UnitOfTemperature.CELSIUS, UnitOfTemperature.FAHRENHEIT):
            return unit
    return UnitOfTemperature.CELSIUS


def _climate_bounds(scheduler, entry: VelairConfigEntry) -> tuple[float, float]:
    """Return the widest target range over the managed climates."""
    limits = [
        scheduler.get_temperature_limits(entity_id)
        for entity_id in get_configured_climate_entities(entry)
    ]
    if not limits:
        return -58.0, 212.0
    return min(low for low, _high in limits), max(high for _low, high in limits)


def _climate_name(hass: HomeAssistant, entity_id: str) -> str:
    """Return a readable climate name for entity translation placeholders."""
    states = getattr(hass, "states", None)
    state = states.get(entity_id) if states is not None else None
    attributes = getattr(state, "attributes", {}) if state is not None else {}
    friendly_name = attributes.get("friendly_name")
    if isinstance(friendly_name, str) and friendly_name:
        return friendly_name
    return entity_id
