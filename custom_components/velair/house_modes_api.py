"""WebSocket commands and response helpers for House Modes."""

from __future__ import annotations

from copy import deepcopy
import math
from typing import Any

import voluptuous as vol

from homeassistant.components import websocket_api
from homeassistant.const import ATTR_ENTITY_ID
from homeassistant.core import HomeAssistant
from homeassistant.helpers import config_validation as cv

from .const import DOMAIN, HOLD_CONSTRAINT_OPTIONS, HVAC_MODE_OPTIONS
from .house_modes_models import (
    DEFAULT_AWAY_TEMPERATURE_C,
    DEFAULT_SLEEP_TEMPERATURE_C,
    DEFAULT_TRAVEL_PARK_TEMPERATURE_C,
    MAX_ARRIVAL_RELEASE_MINUTES,
    MAX_AWAY_AFTER_MINUTES,
    MAX_AWAY_DEEP_AFTER_MINUTES,
    MAX_CORROBORATION_QUIET_MINUTES,
    MAX_PRESLEEP_DURATION_MINUTES,
    normalize_house_modes_data,
    normalize_house_modes_settings,
)
from .temperature import CELSIUS, absolute_temperature

SETTINGS_KEY = "house_modes"
STATUS_KEY = "house_mode"
ERROR_INVALID_HOUSE_MODES = "invalid_house_modes"


def _finite_float(value: Any) -> float:
    number = float(value)
    if not math.isfinite(number):
        raise vol.Invalid("must be a finite number")
    return number


_OPTIONAL_TEMPERATURE = vol.Any(
    None, vol.All(_finite_float, vol.Range(min=-58, max=212))
)

HOUSE_MODES_SETTINGS_SCHEMA = vol.Schema(
    {
        vol.Optional("enabled"): bool,
        vol.Optional("presence_entity_ids"): vol.All(cv.ensure_list, [cv.entity_id]),
        vol.Optional("presence_corroboration_entity_ids"): vol.All(
            cv.ensure_list, [cv.entity_id]
        ),
        vol.Optional("presence_corroboration_quiet_minutes"): vol.All(
            vol.Coerce(int), vol.Range(min=0, max=MAX_CORROBORATION_QUIET_MINUTES)
        ),
        vol.Optional("away_after_minutes"): vol.All(
            vol.Coerce(int), vol.Range(min=1, max=MAX_AWAY_AFTER_MINUTES)
        ),
        vol.Optional("away_deep_after_minutes"): vol.All(
            vol.Coerce(int), vol.Range(min=0, max=MAX_AWAY_DEEP_AFTER_MINUTES)
        ),
        vol.Optional("arrival_release_minutes"): vol.All(
            vol.Coerce(int), vol.Range(min=0, max=MAX_ARRIVAL_RELEASE_MINUTES)
        ),
        vol.Optional("sleep_entity_id"): vol.Any(None, cv.entity_id),
        vol.Optional("presleep_time"): vol.Any(None, cv.string),
        vol.Optional("presleep_duration_minutes"): vol.All(
            vol.Coerce(int), vol.Range(min=1, max=MAX_PRESLEEP_DURATION_MINUTES)
        ),
        vol.Optional("travel_entity_id"): vol.Any(None, cv.entity_id),
        vol.Optional("travel_park_temperature"): vol.All(
            _finite_float, vol.Range(min=-58, max=212)
        ),
        vol.Optional("travel_park_hvac_mode"): vol.Any(None, vol.In(HVAC_MODE_OPTIONS)),
        vol.Optional("travel_park_fan_mode"): vol.Any(None, cv.string),
        vol.Optional("travel_freeze_off_heads"): bool,
        vol.Optional("travel_enable_humidity_assist"): bool,
        vol.Optional("travel_auto_exit_on_arrival"): bool,
    }
)

HOUSE_MODES_ZONE_SCHEMA = vol.Schema(
    {
        vol.Optional("away_enabled"): bool,
        vol.Optional("away_temperature"): vol.All(
            _finite_float, vol.Range(min=-58, max=212)
        ),
        vol.Optional("away_deep_temperature"): _OPTIONAL_TEMPERATURE,
        vol.Optional("sleep_enabled"): bool,
        vol.Optional("sleep_temperature"): vol.All(
            _finite_float, vol.Range(min=-58, max=212)
        ),
        vol.Optional("sleep_constraint"): vol.In(HOLD_CONSTRAINT_OPTIONS),
        vol.Optional("sleep_fan_mode"): vol.Any(None, cv.string),
        vol.Optional("sleep_minimum_temperature"): _OPTIONAL_TEMPERATURE,
        vol.Optional("presleep_temperature"): _OPTIONAL_TEMPERATURE,
        vol.Optional("travel_park_enabled"): bool,
    }
)


def register_house_modes_ws(hass: HomeAssistant) -> None:
    """Register the House Modes WebSocket commands (called from ``api.py``)."""
    websocket_api.async_register_command(hass, ws_update_zone_house_modes)


@websocket_api.websocket_command(
    {
        vol.Required("type"): f"{DOMAIN}/update_zone_house_modes",
        vol.Required(ATTR_ENTITY_ID): cv.entity_id,
        vol.Required(SETTINGS_KEY): HOUSE_MODES_ZONE_SCHEMA,
    }
)
@websocket_api.async_response
async def ws_update_zone_house_modes(
    hass: HomeAssistant,
    connection: websocket_api.ActiveConnection,
    msg: dict[str, Any],
) -> None:
    """Handle persisted per-zone House Modes setting updates."""
    from .api import _build_schedule_response, _get_runtime, _reject_temperature_migration_mutation

    runtime = _get_runtime(hass)
    if runtime is None:
        connection.send_error(msg["id"], "not_loaded", "Integration is not loaded")
        return
    try:
        if _reject_temperature_migration_mutation(runtime, connection, msg):
            return
        await runtime["scheduler"].house_modes.async_update_zone_config(
            msg[ATTR_ENTITY_ID], msg[SETTINGS_KEY]
        )
    except ValueError as err:
        connection.send_error(msg["id"], ERROR_INVALID_HOUSE_MODES, str(err))
        return
    connection.send_result(msg["id"], _build_schedule_response(runtime))


def merge_house_modes_settings(runtime: dict[str, Any], updates: dict[str, Any]) -> dict[str, Any]:
    """Merge a ``velair/update_settings`` ``house_modes`` object into the stored one."""
    current_settings = runtime["storage"].data.get("settings", {})
    current = (
        current_settings.get(SETTINGS_KEY) if isinstance(current_settings, dict) else None
    )
    return {**(current if isinstance(current, dict) else {}), **updates}


def house_modes_settings_payload(runtime: dict[str, Any]) -> dict[str, Any]:
    """Return the normalized global settings for the schedule response."""
    scheduler = runtime.get("scheduler")
    coordinator = getattr(scheduler, "house_modes", None)
    if coordinator is not None:
        try:
            return dict(coordinator.settings())
        except Exception:  # pragma: no cover - defensive
            pass
    storage = runtime.get("storage")
    stored = getattr(storage, "data", {}) or {}
    settings = stored.get("settings", {}) if isinstance(stored, dict) else {}
    unit = getattr(storage, "effective_temperature_unit", CELSIUS)
    return dict(
        normalize_house_modes_settings(
            settings.get(SETTINGS_KEY) if isinstance(settings, dict) else None, unit
        )
    )


def house_modes_status_payload(runtime: dict[str, Any]) -> dict[str, Any]:
    """Return the runtime status (``house_mode``) for the schedule response."""
    scheduler = runtime.get("scheduler")
    if getattr(scheduler, "temperature_migration_blocked", False):
        return {}
    coordinator = getattr(scheduler, "house_modes", None)
    if coordinator is None:
        return {}
    try:
        return coordinator.status()
    except Exception:  # pragma: no cover - defensive
        return {}


def export_zone_house_modes(zone: dict[str, Any]) -> dict[str, Any]:
    """Return the portable per-zone House Modes section."""
    return deepcopy(zone.get(SETTINGS_KEY, {}))


def hydrate_house_modes_portable_defaults(
    sections: dict[str, Any], source_unit: str
) -> None:
    """Fill absent House Modes temperatures with source-unit defaults before conversion."""
    settings = sections.get("settings")
    if isinstance(settings, dict) and isinstance(settings.get(SETTINGS_KEY), dict):
        settings[SETTINGS_KEY].setdefault(
            "travel_park_temperature",
            absolute_temperature(DEFAULT_TRAVEL_PARK_TEMPERATURE_C, CELSIUS, source_unit),
        )
    zones = sections.get("zones")
    if not isinstance(zones, dict):
        return
    for zone in zones.values():
        if not isinstance(zone, dict) or not isinstance(zone.get(SETTINGS_KEY), dict):
            continue
        house_modes = zone[SETTINGS_KEY]
        house_modes.setdefault(
            "away_temperature",
            absolute_temperature(DEFAULT_AWAY_TEMPERATURE_C, CELSIUS, source_unit),
        )
        house_modes.setdefault(
            "sleep_temperature",
            absolute_temperature(DEFAULT_SLEEP_TEMPERATURE_C, CELSIUS, source_unit),
        )
        zone[SETTINGS_KEY] = dict(normalize_house_modes_data(house_modes, source_unit))
