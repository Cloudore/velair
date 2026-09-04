"""Binary sensor entities for Velair."""

from __future__ import annotations

from homeassistant.components.binary_sensor import BinarySensorEntity
from homeassistant.core import HomeAssistant
from homeassistant.helpers.entity_platform import AddConfigEntryEntitiesCallback

from . import VelairConfigEntry
from .entity import VelairEntity


async def async_setup_entry(
    hass: HomeAssistant,
    entry: VelairConfigEntry,
    async_add_entities: AddConfigEntryEntitiesCallback,
) -> None:
    """Set up Velair binary sensors."""
    async_add_entities(build_humidity_assist_binary_sensors(entry))


def build_humidity_assist_binary_sensors(
    entry: VelairConfigEntry,
) -> list[BinarySensorEntity]:
    """Build the global Humidity Assist compliance sensor."""
    return [HumidityAssistCompliantBinarySensor(entry)]


class HumidityAssistCompliantBinarySensor(VelairEntity, BinarySensorEntity):
    """On when every enabled Humidity Assist zone is at or below its target."""

    _attr_translation_key = "humidity_assist_compliant"

    def __init__(self, entry: VelairConfigEntry) -> None:
        """Initialize the compliance sensor."""
        super().__init__(entry, "humidity_assist_compliant")

    @property
    def is_on(self) -> bool:
        """Return whether every enabled zone is compliant."""
        return bool(getattr(self.scheduler, "humidity_assist_compliant", False))

    @property
    def extra_state_attributes(self) -> dict[str, object]:
        """Return the per-zone compliance summary."""
        statuses = self.scheduler.get_humidity_assist_statuses()
        enabled = {
            entity_id: status
            for entity_id, status in statuses.items()
            if status.get("enabled") and status.get("configured")
        }
        return {
            "zone_count": len(enabled),
            "non_compliant_zones": sorted(
                entity_id
                for entity_id, status in enabled.items()
                if not _zone_compliant(status)
            ),
        }


def _zone_compliant(status: dict) -> bool:
    """Return whether raw and median readings are both at or below target."""
    target = status.get("target")
    raw = status.get("raw")
    median = status.get("median")
    if not all(isinstance(value, int | float) for value in (target, raw, median)):
        return False
    return raw <= target and median <= target
