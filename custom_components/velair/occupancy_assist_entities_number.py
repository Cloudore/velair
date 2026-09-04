"""Occupancy Assist stage and comfort numbers (imported lazily by occupancy_assist_entities)."""

from __future__ import annotations

from typing import TYPE_CHECKING, Any

from homeassistant.components.number import (
    NumberDeviceClass,
    NumberEntity,
    NumberMode,
)
from homeassistant.core import HomeAssistant
from homeassistant.helpers.entity import EntityCategory

from .config_helpers import get_configured_climate_entities
from .occupancy_assist_entities import (
    ARRIVAL_KIND,
    SETBACK_KIND,
    ZoneOccupancyEntity,
    ZoneTemperatureBoundsMixin,
    climate_name,
    stage_update,
)
from .occupancy_assist_models import (
    MAX_OCCUPANCY_ASSIST_ARRIVAL_STAGES,
    MAX_OCCUPANCY_ASSIST_SETBACK_STAGES,
    MAX_OCCUPANCY_ASSIST_STAGE_MINUTES,
)

if TYPE_CHECKING:  # pragma: no cover - typing only
    from . import VelairConfigEntry


def build_occupancy_assist_numbers(
    hass: HomeAssistant, entry: VelairConfigEntry
) -> list[NumberEntity]:
    """Build the per-zone stage and comfort numbers."""
    entities: list[NumberEntity] = []
    for entity_id in get_configured_climate_entities(entry):
        zone_name = climate_name(hass, entity_id)
        for index in range(1, MAX_OCCUPANCY_ASSIST_SETBACK_STAGES + 1):
            entities.append(
                ZoneOccupancyStageMinutesNumber(
                    entry, entity_id, SETBACK_KIND, index, zone_name=zone_name
                )
            )
            entities.append(
                ZoneOccupancyStageTemperatureNumber(
                    entry, entity_id, SETBACK_KIND, index, zone_name=zone_name
                )
            )
        for index in range(1, MAX_OCCUPANCY_ASSIST_ARRIVAL_STAGES + 1):
            entities.append(
                ZoneOccupancyStageMinutesNumber(
                    entry, entity_id, ARRIVAL_KIND, index, zone_name=zone_name
                )
            )
        entities.append(
            ZoneOccupancyStageTemperatureNumber(
                entry, entity_id, ARRIVAL_KIND, 1, zone_name=zone_name
            )
        )
        entities.append(
            ZoneOccupancyComfortTemperatureNumber(entry, entity_id, zone_name=zone_name)
        )
    return entities


class _ZoneOccupancyStageNumber(ZoneOccupancyEntity, NumberEntity):
    """Shared stage lookup and update for stage numbers."""

    _attr_mode = NumberMode.BOX
    _field: str = "after_minutes"

    def __init__(
        self,
        entry: VelairConfigEntry,
        climate_entity_id: str,
        kind: str,
        index: int,
        *,
        zone_name: str | None = None,
    ) -> None:
        if kind not in (SETBACK_KIND, ARRIVAL_KIND):
            raise ValueError(f"Unsupported stage kind: {kind}")
        self._kind = kind
        self._index = index
        self._attr_translation_key = f"zone_{kind}_{index}_{self._field_label}"
        super().__init__(
            entry,
            climate_entity_id,
            f"occupancy_{kind}_{index}_{self._field_label}",
            zone_name=zone_name,
        )

    @property
    def _field_label(self) -> str:
        return "minutes" if self._field == "after_minutes" else "temperature"

    def _stage(self) -> dict[str, Any] | None:
        stages = self._config().get(f"{self._kind}_stages") or []
        if self._index <= len(stages):
            return dict(stages[self._index - 1])
        return None

    @property
    def native_value(self) -> float | None:
        """Return the stored stage value, or None when the stage does not exist."""
        stage = self._stage()
        if stage is None:
            return None
        value = stage.get(self._field)
        return float(value) if isinstance(value, int | float) else None

    async def async_set_native_value(self, value: float) -> None:
        """Persist the stage value, creating missing earlier stages from defaults."""
        await self._async_update(
            stage_update(self._config(), self._kind, self._index, self._field, value)
        )


class ZoneOccupancyStageMinutesNumber(_ZoneOccupancyStageNumber):
    """Minutes before one setback or arrival stage applies."""

    _attr_entity_category = EntityCategory.CONFIG
    _attr_native_unit_of_measurement = "min"
    _attr_native_min_value = 0.0
    _attr_native_max_value = float(MAX_OCCUPANCY_ASSIST_STAGE_MINUTES)
    _attr_native_step = 1.0
    _field = "after_minutes"

    async def async_set_native_value(self, value: float) -> None:
        """Persist whole minutes."""
        await self._async_update(
            stage_update(
                self._config(), self._kind, self._index, self._field, int(round(value))
            )
        )


class ZoneOccupancyStageTemperatureNumber(
    ZoneTemperatureBoundsMixin, _ZoneOccupancyStageNumber
):
    """Temperature held by one setback or arrival stage."""

    _attr_device_class = NumberDeviceClass.TEMPERATURE
    _field = "temperature"


class ZoneOccupancyComfortTemperatureNumber(
    ZoneTemperatureBoundsMixin, ZoneOccupancyEntity, NumberEntity
):
    """The zone's comfort temperature (synced to its schedule when enabled)."""

    _attr_device_class = NumberDeviceClass.TEMPERATURE
    _attr_mode = NumberMode.BOX
    _attr_translation_key = "zone_comfort_temperature"

    def __init__(
        self,
        entry: VelairConfigEntry,
        climate_entity_id: str,
        *,
        zone_name: str | None = None,
    ) -> None:
        """Initialize the comfort number."""
        super().__init__(
            entry, climate_entity_id, "occupancy_comfort_temperature", zone_name=zone_name
        )

    @property
    def native_value(self) -> float | None:
        """Return the stored comfort temperature."""
        value = self._config().get("comfort_temperature")
        return float(value) if isinstance(value, int | float) else None

    @property
    def extra_state_attributes(self) -> dict[str, object]:
        """Expose whether the value is mirrored into the schedule."""
        return {
            "climate_entity_id": self._climate_entity_id,
            "sync_comfort_to_schedule": bool(
                self._config().get("sync_comfort_to_schedule", True)
            ),
        }

    async def async_set_native_value(self, value: float) -> None:
        """Persist the comfort temperature (Dial Sync writes the schedule)."""
        await self._async_update({"comfort_temperature": float(value)})
