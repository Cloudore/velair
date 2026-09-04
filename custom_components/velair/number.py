"""Number entities for Velair."""

from __future__ import annotations

from homeassistant.components.number import NumberEntity, NumberMode
from homeassistant.const import UnitOfTemperature
from homeassistant.core import HomeAssistant
from homeassistant.helpers.entity import EntityCategory
from homeassistant.helpers.entity_platform import AddConfigEntryEntitiesCallback

from . import VelairConfigEntry
from .config_helpers import get_configured_climate_entities
from .entity import VelairEntity
from .models import (
    HUMIDITY_ASSIST_MEASURE_DEW_POINT,
    normalize_humidity_assist_settings,
)

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


async def async_setup_entry(
    hass: HomeAssistant,
    entry: VelairConfigEntry,
    async_add_entities: AddConfigEntryEntitiesCallback,
) -> None:
    """Set up Velair number entities."""
    async_add_entities(build_humidity_assist_number_entities(hass, entry))


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


def _climate_name(hass: HomeAssistant, entity_id: str) -> str:
    """Return a readable climate name for entity translation placeholders."""
    states = getattr(hass, "states", None)
    state = states.get(entity_id) if states is not None else None
    attributes = getattr(state, "attributes", {}) if state is not None else {}
    friendly_name = attributes.get("friendly_name")
    if isinstance(friendly_name, str) and friendly_name:
        return friendly_name
    return entity_id
