"""Number entities for Velair."""

from __future__ import annotations

from homeassistant.components.number import (
    NumberDeviceClass,
    NumberEntity,
    NumberMode,
)
from homeassistant.const import UnitOfTemperature
from homeassistant.core import HomeAssistant
from homeassistant.helpers.entity import EntityCategory
from homeassistant.helpers.entity_platform import AddConfigEntryEntitiesCallback

from . import VelairConfigEntry
from .config_helpers import get_configured_climate_entities
from .entity import VelairEntity
from .house_modes_entities import build_house_modes_numbers
from .guards_entities import build_guards_number_entities
from .models import (
    HUMIDITY_ASSIST_MEASURE_DEW_POINT,
    normalize_humidity_assist_settings,
)

ZONE_LIMIT_BOUNDS = ("min", "max")


async def async_setup_entry(
    hass: HomeAssistant,
    entry: VelairConfigEntry,
    async_add_entities: AddConfigEntryEntitiesCallback,
) -> None:
    """Set up the per-zone temperature limit numbers."""
    climate_entities = get_configured_climate_entities(entry)
    temperature_unit = _entry_temperature_unit(hass, entry)
    async_add_entities(
        ZoneTemperatureLimitNumber(
            entry,
            entity_id,
            bound,
            temperature_unit=temperature_unit,
            zone_name=_climate_name(hass, entity_id),
        )
        for entity_id in climate_entities
        for bound in ZONE_LIMIT_BOUNDS
    )
    async_add_entities(build_humidity_assist_number_entities(hass, entry))
    async_add_entities(build_house_modes_numbers(hass, entry))
    async_add_entities(build_guards_number_entities(hass, entry))

class ZoneTemperatureLimitNumber(VelairEntity, NumberEntity):
    """Editable setpoint floor or ceiling enforced on every Velair delivery.

    Setting the minimum number to the climate's own minimum, or the maximum
    number to the climate's own maximum, clears that limit again.
    """

    _attr_device_class = NumberDeviceClass.TEMPERATURE
    _attr_entity_category = EntityCategory.CONFIG
    _attr_mode = NumberMode.BOX

    def __init__(
        self,
        entry: VelairConfigEntry,
        climate_entity_id: str,
        bound: str,
        *,
        temperature_unit: str = UnitOfTemperature.CELSIUS,
        zone_name: str | None = None,
    ) -> None:
        """Initialize one limit number for a managed climate."""
        if bound not in ZONE_LIMIT_BOUNDS:
            raise ValueError(f"Unsupported zone limit bound: {bound}")
        self._climate_entity_id = climate_entity_id
        self._bound = bound
        self._attr_translation_key = f"zone_{bound}_temperature_limit"
        self._attr_native_unit_of_measurement = temperature_unit
        zone_key = climate_entity_id.replace(".", "_")
        super().__init__(entry, f"{zone_key}_{bound}_temperature_limit")
        self._attr_translation_placeholders = {
            "zone": zone_name or climate_entity_id
        }

    @property
    def available(self) -> bool:
        """Hide unit-bound limits while scheduler data is blocked."""
        return not bool(
            getattr(self.scheduler, "temperature_migration_blocked", False)
        )

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
        if self._attr_native_unit_of_measurement == UnitOfTemperature.FAHRENHEIT:
            return 1.0
        return 0.5

    @property
    def native_value(self) -> float:
        """Return the stored limit, or the climate bound when no limit is set."""
        limit = self._stored_limit()
        if limit is not None:
            return limit
        minimum, maximum = self.scheduler.get_temperature_limits(
            self._climate_entity_id
        )
        return minimum if self._bound == "min" else maximum

    @property
    def extra_state_attributes(self) -> dict[str, str | bool]:
        """Expose whether a limit is currently enforced."""
        return {
            "climate_entity_id": self._climate_entity_id,
            "limit_active": self._stored_limit() is not None,
        }

    async def async_set_native_value(self, value: float) -> None:
        """Persist the limit; the climate's own bound clears it."""
        minimum, maximum = self.scheduler.get_temperature_limits(
            self._climate_entity_id
        )
        if self._bound == "min":
            stored = None if value <= minimum + 0.000001 else float(value)
        else:
            stored = None if value >= maximum - 0.000001 else float(value)
        await self.scheduler.async_update_zone_limits(
            self._climate_entity_id,
            {f"{self._bound}_temperature": stored},
        )

    def _stored_limit(self) -> float | None:
        """Return the persisted limit for this bound."""
        limits = self.scheduler.get_zone_limits(self._climate_entity_id)
        return limits[f"{self._bound}_temperature"]


def _entry_temperature_unit(hass: HomeAssistant, entry: VelairConfigEntry) -> str:
    """Return the unit Velair stores thermal values in for this entry."""
    storage = getattr(getattr(entry, "runtime_data", None), "storage", None)
    unit = getattr(storage, "effective_temperature_unit", None)
    if unit in (UnitOfTemperature.CELSIUS, UnitOfTemperature.FAHRENHEIT):
        return unit
    configured_unit = getattr(
        getattr(getattr(hass, "config", None), "units", None),
        "temperature_unit",
        None,
    )
    if configured_unit in (
        UnitOfTemperature.CELSIUS,
        UnitOfTemperature.FAHRENHEIT,
    ):
        return configured_unit
    return UnitOfTemperature.CELSIUS


def _climate_name(hass: HomeAssistant, entity_id: str) -> str:
    """Return a readable climate name for entity translation placeholders."""
    state = hass.states.get(entity_id)
    attributes = getattr(state, "attributes", {}) if state is not None else {}
    friendly_name = attributes.get("friendly_name")
    if isinstance(friendly_name, str) and friendly_name:
        return friendly_name
    return entity_id


HUMIDITY_ASSIST_GLOBAL_NUMBERS: tuple[tuple[str, str, float, float, float], ...] = (
    # (field, kind, min, max, step); kind is "delta" or "minutes" or "count"
    ("start_buffer", "delta", 0.0, 10.0, 0.1),
    ("stop_buffer", "delta", 0.0, 10.0, 0.1),
    ("min_on_minutes", "minutes", 1, 240, 1),
    ("max_on_minutes", "minutes", 1, 720, 1),
    ("min_off_minutes", "minutes", 0, 720, 1),
    ("max_simultaneous_pulses", "count", 1, 50, 1),
    ("emergency_margin_priority", "delta", 0.0, 10.0, 0.1),
    ("emergency_margin_standard", "delta", 0.0, 10.0, 0.1),
    ("median_window_minutes", "minutes", 1, 240, 1),
    ("initial_pull_down_window_minutes", "minutes", 0, 1440, 1),
    ("initial_pull_down_max_run_minutes", "minutes", 1, 720, 1),
    ("initial_pull_down_target_offset", "delta", 0.0, 10.0, 0.1),
)


def build_humidity_assist_number_entities(
    hass: HomeAssistant,
    entry: VelairConfigEntry,
) -> list[NumberEntity]:
    """Build per-zone target numbers and global Humidity Assist parameters."""
    entities: list[NumberEntity] = []
    for entity_id in get_configured_climate_entities(entry):
        entities.append(
            ZoneHumidityTargetNumber(
                entry,
                entity_id,
                zone_name=_climate_name(hass, entity_id),
            )
        )
    entities.extend(
        HumidityAssistParameterNumber(entry, field, kind, minimum, maximum, step)
        for field, kind, minimum, maximum, step in HUMIDITY_ASSIST_GLOBAL_NUMBERS
    )
    return entities


class ZoneHumidityTargetNumber(VelairEntity, NumberEntity):
    """Number exposing the Humidity Assist target for one zone."""

    _attr_mode = NumberMode.BOX
    _attr_native_step = 0.1
    _attr_translation_key = "zone_humidity_target"

    def __init__(
        self,
        entry: VelairConfigEntry,
        climate_entity_id: str,
        *,
        zone_name: str | None = None,
    ) -> None:
        """Initialize the target number."""
        self._climate_entity_id = climate_entity_id
        zone_key = climate_entity_id.replace(".", "_")
        super().__init__(entry, f"{zone_key}_humidity_target")
        self._attr_translation_placeholders = {
            "zone": zone_name or climate_entity_id
        }

    @property
    def available(self) -> bool:
        """Hide unit-bound configuration while scheduler data is blocked."""
        return not bool(
            getattr(self.scheduler, "temperature_migration_blocked", False)
        )

    def _config(self) -> dict:
        return dict(self.scheduler.get_humidity_assist_config(self._climate_entity_id))

    @property
    def native_unit_of_measurement(self) -> str:
        """Return the climate unit for dew points or percent for humidity."""
        config = self._config()
        if config.get("measure") == HUMIDITY_ASSIST_MEASURE_DEW_POINT:
            return _climate_unit(self.scheduler, self._climate_entity_id)
        return "%"

    @property
    def native_min_value(self) -> float:
        """Return the lowest accepted target."""
        config = self._config()
        if config.get("measure") == HUMIDITY_ASSIST_MEASURE_DEW_POINT:
            return (
                32.0
                if _climate_unit(self.scheduler, self._climate_entity_id)
                == UnitOfTemperature.FAHRENHEIT
                else 0.0
            )
        return 0.0

    @property
    def native_max_value(self) -> float:
        """Return the highest accepted target."""
        config = self._config()
        if config.get("measure") == HUMIDITY_ASSIST_MEASURE_DEW_POINT:
            return (
                104.0
                if _climate_unit(self.scheduler, self._climate_entity_id)
                == UnitOfTemperature.FAHRENHEIT
                else 40.0
            )
        return 100.0

    @property
    def native_value(self) -> float | None:
        """Return the configured target."""
        value = self._config().get("target")
        return float(value) if isinstance(value, int | float) else None

    async def async_set_native_value(self, value: float) -> None:
        """Persist a new target."""
        await self.scheduler.async_update_zone_humidity_assist(
            self._climate_entity_id, {"target": float(value)}
        )


class HumidityAssistParameterNumber(VelairEntity, NumberEntity):
    """Number exposing one shared Humidity Assist parameter."""

    _attr_entity_category = EntityCategory.CONFIG
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
        super().__init__(entry, f"humidity_assist_{field}")
        self._field = field
        self._kind = kind
        self._attr_translation_key = f"humidity_assist_{field}"
        self._attr_native_min_value = float(minimum)
        self._attr_native_max_value = float(maximum)
        self._attr_native_step = float(step)

    @property
    def available(self) -> bool:
        """Hide unit-bound configuration while scheduler data is blocked."""
        return not bool(
            getattr(self.scheduler, "temperature_migration_blocked", False)
        )

    @property
    def native_unit_of_measurement(self) -> str | None:
        """Return a unit for temperature deltas and minutes."""
        if self._kind == "delta":
            climates = get_configured_climate_entities(self._entry)
            return _climate_unit(self.scheduler, climates[0] if climates else None)
        if self._kind == "minutes":
            return "min"
        return None

    @property
    def native_value(self) -> float | None:
        """Return the stored parameter."""
        settings = normalize_humidity_assist_settings(
            self._entry.runtime_data.storage.data.get("settings", {}).get(
                "humidity_assist"
            )
        )
        value = settings.get(self._field)
        return float(value) if isinstance(value, int | float) else None

    async def async_set_native_value(self, value: float) -> None:
        """Persist a new global parameter."""
        current = self._entry.runtime_data.storage.data.get("settings", {}).get(
            "humidity_assist"
        )
        next_value = int(round(value)) if self._kind in ("minutes", "count") else float(value)
        await self.scheduler.async_update_settings(
            {
                "humidity_assist": {
                    **(current if isinstance(current, dict) else {}),
                    self._field: next_value,
                }
            }
        )


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
