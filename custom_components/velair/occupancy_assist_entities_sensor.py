"""Occupancy Assist state sensor (imported lazily by occupancy_assist_entities)."""

from __future__ import annotations

from typing import TYPE_CHECKING

from homeassistant.components.sensor import SensorDeviceClass, SensorEntity
from homeassistant.core import HomeAssistant

from .config_helpers import get_configured_climate_entities
from .occupancy_assist_entities import (
    STATE_ATTRIBUTE_KEYS,
    STATE_SENSOR_SUFFIX,
    ZoneOccupancyEntity,
    climate_name,
)
from .occupancy_assist_models import OCCUPANCY_ASSIST_STATES

if TYPE_CHECKING:  # pragma: no cover - typing only
    from . import VelairConfigEntry


def build_occupancy_assist_sensors(
    hass: HomeAssistant, entry: VelairConfigEntry
) -> list[SensorEntity]:
    """Build the per-zone Occupancy Assist state sensors."""
    return [
        ZoneOccupancyAssistStateSensor(entry, entity_id, zone_name=climate_name(hass, entity_id))
        for entity_id in get_configured_climate_entities(entry)
    ]


class ZoneOccupancyAssistStateSensor(ZoneOccupancyEntity, SensorEntity):
    """Sensor exposing the Occupancy Assist state machine for one zone."""

    _attr_device_class = SensorDeviceClass.ENUM
    _attr_options = list(OCCUPANCY_ASSIST_STATES)
    _attr_translation_key = "zone_occupancy_assist"

    def __init__(
        self,
        entry: VelairConfigEntry,
        climate_entity_id: str,
        *,
        zone_name: str | None = None,
    ) -> None:
        """Initialize the state sensor."""
        super().__init__(entry, climate_entity_id, STATE_SENSOR_SUFFIX, zone_name=zone_name)

    @property
    def available(self) -> bool:
        """The state sensor is always readable."""
        return True

    @property
    def native_value(self) -> str:
        """Return the current Occupancy Assist state."""
        status = self.scheduler.get_occupancy_assist_status(self._climate_entity_id)
        value = status.get("state")
        return value if isinstance(value, str) else "disabled"

    @property
    def extra_state_attributes(self) -> dict[str, object] | None:
        """Return compact decision context."""
        status = self.scheduler.get_occupancy_assist_status(self._climate_entity_id)
        attributes = {
            key: status.get(key)
            for key in STATE_ATTRIBUTE_KEYS
            if status.get(key) is not None
        }
        return attributes or None
