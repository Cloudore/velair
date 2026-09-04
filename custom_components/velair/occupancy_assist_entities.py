"""Home Assistant entities generated for Occupancy Assist.

Per managed climate: one enum state sensor, one enable switch, and the
stage/comfort numbers listed in the home policy spec §3. The platform modules
import ``build_occupancy_assist_sensors`` / ``_switches`` / ``_numbers`` from
this module; each builder lives in a sibling module that imports only its own
Home Assistant platform, and is re-exported lazily so importing the number
platform never pulls the sensor or switch platform in.
"""

from __future__ import annotations

from typing import TYPE_CHECKING, Any

from homeassistant.const import UnitOfTemperature
from homeassistant.core import HomeAssistant

from .entity import VelairEntity
from .occupancy_assist_models import (
    DEFAULT_OCCUPANCY_ASSIST_ARRIVAL_STAGES,
    DEFAULT_OCCUPANCY_ASSIST_SETBACK_STAGES,
)

if TYPE_CHECKING:  # pragma: no cover - typing only
    from . import VelairConfigEntry

STATE_SENSOR_SUFFIX = "occupancy_assist_state"
SWITCH_SUFFIX = "occupancy_assist_enabled"
SETBACK_KIND = "setback"
ARRIVAL_KIND = "arrival"

STATE_ATTRIBUTE_KEYS = (
    "occupancy_entity_id",
    "occupied_since",
    "vacant_since",
    "stage",
    "next_stage_at",
    "next_temperature",
    "blocked_by",
    "last_action",
    "last_action_at",
    "reason",
    "hold_temperature",
)

_LAZY_BUILDERS = {
    "build_occupancy_assist_sensors": "occupancy_assist_entities_sensor",
    "build_occupancy_assist_switches": "occupancy_assist_entities_switch",
    "build_occupancy_assist_numbers": "occupancy_assist_entities_number",
}


def __getattr__(name: str) -> Any:
    """Resolve the platform builders lazily (PEP 562)."""
    module_name = _LAZY_BUILDERS.get(name)
    if module_name is None:
        raise AttributeError(name)
    from importlib import import_module  # noqa: PLC0415

    return getattr(import_module(f"{__package__}.{module_name}"), name)


class ZoneOccupancyEntity(VelairEntity):
    """Shared plumbing for entities bound to one zone's configuration."""

    def __init__(
        self,
        entry: VelairConfigEntry,
        climate_entity_id: str,
        suffix: str,
        *,
        zone_name: str | None = None,
    ) -> None:
        self._climate_entity_id = climate_entity_id
        zone_key = climate_entity_id.replace(".", "_")
        super().__init__(entry, f"{zone_key}_{suffix}")
        self._attr_translation_placeholders = {"zone": zone_name or climate_entity_id}

    @property
    def available(self) -> bool:
        """Hide unit-bound configuration while scheduler data is blocked."""
        return not bool(getattr(self.scheduler, "temperature_migration_blocked", False))

    def _config(self) -> dict[str, Any]:
        return dict(self.scheduler.get_occupancy_assist_config(self._climate_entity_id))

    async def _async_update(self, updates: dict[str, Any]) -> None:
        await self.scheduler.async_update_zone_occupancy_assist(
            self._climate_entity_id, updates
        )


class ZoneTemperatureBoundsMixin:
    """Climate-unit temperature bounds shared by the temperature numbers."""

    @property
    def native_unit_of_measurement(self) -> str:
        """Return the climate's runtime unit."""
        return climate_unit(self.scheduler, self._climate_entity_id)

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
        """Return the climate's published step, or a unit-aware default."""
        step = self.scheduler.get_temperature_step(self._climate_entity_id)
        if step is not None:
            return step
        if self.native_unit_of_measurement == UnitOfTemperature.FAHRENHEIT:
            return 1.0
        return 0.5


def stage_update(
    config: dict[str, Any], kind: str, index: int, field: str, value: Any
) -> dict[str, Any]:
    """Return the ``<kind>_stages`` update that sets one field of one stage.

    Missing earlier stages are created from the defaults so a dashboard can
    fill in stage 3 of a two-stage ladder. Setting the temperature of the
    last arrival stage appends a release stage after it, because the last
    arrival stage always releases to the schedule.
    """
    key = f"{kind}_stages"
    stages = [dict(stage) for stage in (config.get(key) or [])]
    defaults = (
        DEFAULT_OCCUPANCY_ASSIST_SETBACK_STAGES
        if kind == SETBACK_KIND
        else DEFAULT_OCCUPANCY_ASSIST_ARRIVAL_STAGES
    )
    while len(stages) < index:
        position = len(stages)
        if position < len(defaults) and (
            not stages or defaults[position][0] > stages[-1]["after_minutes"]
        ):
            minutes, temperature = defaults[position]
        else:
            minutes = (stages[-1]["after_minutes"] + 30) if stages else 0
            temperature = (
                None
                if kind == ARRIVAL_KIND
                else (stages[-1]["temperature"] if stages else defaults[0][1])
            )
        stages.append({"after_minutes": minutes, "temperature": temperature})
    stages[index - 1][field] = value
    if kind == ARRIVAL_KIND and field == "temperature" and index == len(stages):
        stages.append(
            {"after_minutes": stages[-1]["after_minutes"] + 5, "temperature": None}
        )
    return {key: stages}


def climate_unit(scheduler, entity_id: str | None) -> str:
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


def climate_name(hass: HomeAssistant, entity_id: str) -> str:
    """Return a readable climate name for entity translation placeholders."""
    states = getattr(hass, "states", None)
    state = states.get(entity_id) if states is not None else None
    attributes = getattr(state, "attributes", {}) if state is not None else {}
    friendly_name = attributes.get("friendly_name")
    if isinstance(friendly_name, str) and friendly_name:
        return friendly_name
    return entity_id
