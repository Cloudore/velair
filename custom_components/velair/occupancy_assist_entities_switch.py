"""Occupancy Assist enable switch (imported lazily by occupancy_assist_entities)."""

from __future__ import annotations

from typing import TYPE_CHECKING

from homeassistant.components.switch import SwitchEntity
from homeassistant.core import HomeAssistant

from .config_helpers import get_configured_climate_entities
from .occupancy_assist_entities import SWITCH_SUFFIX, ZoneOccupancyEntity, climate_name

if TYPE_CHECKING:  # pragma: no cover - typing only
    from . import VelairConfigEntry


def build_occupancy_assist_switches(
    hass: HomeAssistant, entry: VelairConfigEntry
) -> list[SwitchEntity]:
    """Build the per-zone Occupancy Assist enable switches."""
    return [
        ZoneOccupancyAssistSwitch(entry, entity_id, zone_name=climate_name(hass, entity_id))
        for entity_id in get_configured_climate_entities(entry)
    ]


class ZoneOccupancyAssistSwitch(ZoneOccupancyEntity, SwitchEntity):
    """Switch enabling Occupancy Assist for one zone."""

    _attr_translation_key = "zone_occupancy_assist"

    def __init__(
        self,
        entry: VelairConfigEntry,
        climate_entity_id: str,
        *,
        zone_name: str | None = None,
    ) -> None:
        """Initialize the enable switch."""
        super().__init__(entry, climate_entity_id, SWITCH_SUFFIX, zone_name=zone_name)

    @property
    def is_on(self) -> bool:
        """Return whether the zone is enabled."""
        return bool(self._config().get("enabled", False))

    async def async_turn_on(self, **kwargs) -> None:
        """Enable the zone."""
        await self._async_update({"enabled": True})

    async def async_turn_off(self, **kwargs) -> None:
        """Disable the zone; its holds are released."""
        await self._async_update({"enabled": False})
