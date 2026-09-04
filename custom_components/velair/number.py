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
