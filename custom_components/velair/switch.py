"""Switch entities for Velair."""

from __future__ import annotations

from homeassistant.components.switch import SwitchEntity
from homeassistant.core import HomeAssistant
from homeassistant.helpers.entity_platform import AddConfigEntryEntitiesCallback

from . import VelairConfigEntry
from .config_helpers import get_configured_climate_entities
from .const import MODE_AUTO, MODE_PAUSED
from .entity import VelairEntity


async def async_setup_entry(
    hass: HomeAssistant,
    entry: VelairConfigEntry,
    async_add_entities: AddConfigEntryEntitiesCallback,
) -> None:
    """Set up Velair switches."""
    entities: list[SwitchEntity] = [AutomaticSchedulingSwitch(entry)]
    entities.extend(_humidity_assist_switches(hass, entry))
    async_add_entities(entities)


def _humidity_assist_switches(
    hass: HomeAssistant,
    entry: VelairConfigEntry,
) -> list[SwitchEntity]:
    """Build the per-zone Humidity Assist switches."""
    entities: list[SwitchEntity] = []
    for entity_id in get_configured_climate_entities(entry):
        zone_name = _climate_name(hass, entity_id)
        entities.append(
            ZoneHumidityAssistSwitch(entry, entity_id, zone_name=zone_name)
        )
        entities.append(
            ZoneHumidityPrioritySwitch(entry, entity_id, zone_name=zone_name)
        )
    return entities


class AutomaticSchedulingSwitch(VelairEntity, SwitchEntity):
    """Switch controlling automatic schedule execution."""

    _attr_translation_key = "automatic_scheduling"

    def __init__(self, entry: VelairConfigEntry) -> None:
        """Initialize the switch."""
        super().__init__(entry, "schedule_enabled")

    @property
    def is_on(self) -> bool:
        """Return whether automatic scheduling is enabled."""
        return self.scheduler.mode == MODE_AUTO

    @property
    def available(self) -> bool:
        """Return whether scheduler controls are safe to use."""
        return not self.scheduler.temperature_migration_blocked

    async def async_turn_on(self, **kwargs) -> None:
        """Enable automatic scheduling."""
        await self.scheduler.async_set_mode(MODE_AUTO, apply_current_schedule=True)

    async def async_turn_off(self, **kwargs) -> None:
        """Pause automatic scheduling indefinitely."""
        await self.scheduler.async_set_mode(MODE_PAUSED)


class _ZoneHumidityAssistSwitch(VelairEntity, SwitchEntity):
    """Base switch bound to one zone's Humidity Assist configuration."""

    _field: str = "enabled"

    def __init__(
        self,
        entry: VelairConfigEntry,
        climate_entity_id: str,
        key: str,
        *,
        zone_name: str | None = None,
    ) -> None:
        """Initialize a zone switch."""
        self._climate_entity_id = climate_entity_id
        zone_key = climate_entity_id.replace(".", "_")
        super().__init__(entry, f"{zone_key}_{key}")
        self._attr_translation_placeholders = {
            "zone": zone_name or climate_entity_id
        }

    @property
    def available(self) -> bool:
        """Hide unit-bound configuration while scheduler data is blocked."""
        return not bool(
            getattr(self.scheduler, "temperature_migration_blocked", False)
        )

    @property
    def is_on(self) -> bool:
        """Return the configured boolean field."""
        config = self.scheduler.get_humidity_assist_config(self._climate_entity_id)
        return bool(config.get(self._field, False))

    async def async_turn_on(self, **kwargs) -> None:
        """Set the field to true."""
        await self.scheduler.async_update_zone_humidity_assist(
            self._climate_entity_id, {self._field: True}
        )

    async def async_turn_off(self, **kwargs) -> None:
        """Set the field to false."""
        await self.scheduler.async_update_zone_humidity_assist(
            self._climate_entity_id, {self._field: False}
        )


class ZoneHumidityAssistSwitch(_ZoneHumidityAssistSwitch):
    """Switch enabling Humidity Assist for one zone."""

    _attr_translation_key = "zone_humidity_assist"
    _field = "enabled"

    def __init__(
        self,
        entry: VelairConfigEntry,
        climate_entity_id: str,
        *,
        zone_name: str | None = None,
    ) -> None:
        """Initialize the enable switch."""
        super().__init__(
            entry, climate_entity_id, "humidity_assist_enabled", zone_name=zone_name
        )


class ZoneHumidityPrioritySwitch(_ZoneHumidityAssistSwitch):
    """Switch marking one zone as a Humidity Assist priority room."""

    _attr_translation_key = "zone_humidity_priority"
    _field = "priority"

    def __init__(
        self,
        entry: VelairConfigEntry,
        climate_entity_id: str,
        *,
        zone_name: str | None = None,
    ) -> None:
        """Initialize the priority switch."""
        super().__init__(
            entry, climate_entity_id, "humidity_priority", zone_name=zone_name
        )


def _climate_name(hass: HomeAssistant, entity_id: str) -> str:
    """Return a readable climate name for entity translation placeholders."""
    states = getattr(hass, "states", None)
    state = states.get(entity_id) if states is not None else None
    attributes = getattr(state, "attributes", {}) if state is not None else {}
    friendly_name = attributes.get("friendly_name")
    if isinstance(friendly_name, str) and friendly_name:
        return friendly_name
    return entity_id
