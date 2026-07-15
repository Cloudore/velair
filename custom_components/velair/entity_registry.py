"""Entity registry maintenance for Velair."""

from __future__ import annotations

from homeassistant.config_entries import ConfigEntry
from homeassistant.core import HomeAssistant
from homeassistant.helpers import entity_registry as er

from .const import DOMAIN, ZONE_SENSOR_UNIQUE_ID_SUFFIXES


def cleanup_entity_registry(
    hass: HomeAssistant,
    entry: ConfigEntry,
    climate_entities: list[str],
) -> None:
    """Remove retired controls and sensors for climates no longer managed."""
    registry = er.async_get(hass)
    expected_zone_unique_ids = {
        _zone_sensor_unique_id(entry.entry_id, entity_id, suffix)
        for entity_id in climate_entities
        for suffix in ZONE_SENSOR_UNIQUE_ID_SUFFIXES
    }
    zone_prefix = f"{entry.entry_id}_climate_"
    zone_suffixes = tuple(
        f"_{suffix}"
        for suffix in ZONE_SENSOR_UNIQUE_ID_SUFFIXES
    )

    for entity_id, registry_entry in list(registry.entities.items()):
        if (
            registry_entry.config_entry_id != entry.entry_id
            or registry_entry.platform != DOMAIN
        ):
            continue

        unique_id = registry_entry.unique_id
        if (
            entity_id.startswith("sensor.")
            and unique_id.startswith(zone_prefix)
            and unique_id.endswith(zone_suffixes)
            and unique_id not in expected_zone_unique_ids
        ):
            registry.async_remove(entity_id)

    legacy_select = registry.async_get_entity_id(
        "select",
        DOMAIN,
        f"{entry.entry_id}_scheduler_mode",
    )
    if legacy_select is not None:
        registry.async_remove(legacy_select)


def _zone_sensor_unique_id(
    entry_id: str,
    climate_entity_id: str,
    suffix: str,
) -> str:
    """Return the deterministic unique ID for one zone sensor."""
    zone_key = climate_entity_id.replace(".", "_")
    return f"{entry_id}_{zone_key}_{suffix}"
