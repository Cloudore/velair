"""WebSocket commands, schemas and payload helpers for the Guards module.

``api.py`` only adds one-line hooks: ``register_guards_ws(hass)``, the
``guards`` key on ``velair/update_settings`` (merged through
``merge_guards_settings``) and the status payload built by
``guards_status_payload``.
"""

from __future__ import annotations

import math
from typing import Any

import voluptuous as vol

from homeassistant.components import websocket_api
from homeassistant.const import ATTR_ENTITY_ID
from homeassistant.core import HomeAssistant
from homeassistant.helpers import config_validation as cv

from .const import DOMAIN, HOLD_CONSTRAINT_OPTIONS, HVAC_MODE_OPTIONS
from .guards_models import (
    GUARDS_BOOLEAN_SETTINGS,
    GUARDS_MINUTE_SETTINGS,
    MAX_ACTIVITY_HOLDS,
    MAX_SNOOZE_MINUTES,
    normalize_guards_settings,
)


def _finite_float(value: Any) -> float:
    number = float(value)
    if not math.isfinite(number):
        raise vol.Invalid("must be a finite number")
    return number


GUARDS_ACTIVITY_HOLD_SCHEMA = vol.Schema(
    {
        vol.Required("entity_id"): cv.entity_id,
        vol.Required("temperature"): vol.All(_finite_float, vol.Range(min=-58, max=212)),
        vol.Optional("constraint"): vol.In(HOLD_CONSTRAINT_OPTIONS),
        vol.Optional("hvac_mode"): vol.Any(None, vol.In(HVAC_MODE_OPTIONS)),
        vol.Optional("release_delay_minutes"): vol.All(
            vol.Coerce(int), vol.Range(min=0, max=1440)
        ),
        vol.Optional("pause_id"): cv.string,
        vol.Optional("label"): vol.Any(None, cv.string),
    }
)

GUARDS_ZONE_SCHEMA = vol.Schema(
    {
        vol.Optional("never_off_enabled"): bool,
        vol.Optional("activity_holds"): vol.All(
            cv.ensure_list,
            [GUARDS_ACTIVITY_HOLD_SCHEMA],
            vol.Length(max=MAX_ACTIVITY_HOLDS),
        ),
    }
)

GUARDS_SETTINGS_SCHEMA = vol.Schema(
    {
        **{vol.Optional(key): bool for key in GUARDS_BOOLEAN_SETTINGS},
        **{
            vol.Optional(key): vol.All(
                vol.Coerce(int), vol.Range(min=minimum, max=maximum)
            )
            for key, (_default, minimum, maximum) in GUARDS_MINUTE_SETTINGS.items()
        },
        vol.Optional("owner_entity_ids"): vol.All(cv.ensure_list, [cv.entity_id]),
    }
)

SNOOZE_OFF_SCHEMA = vol.Schema(
    {
        vol.Required(ATTR_ENTITY_ID): cv.entity_id,
        vol.Optional("duration_minutes"): vol.All(
            vol.Coerce(int), vol.Range(min=1, max=MAX_SNOOZE_MINUTES)
        ),
    }
)


def register_guards_ws(hass: HomeAssistant) -> None:
    """Register the Guards WebSocket commands."""
    websocket_api.async_register_command(hass, ws_update_zone_guards)


def merge_guards_settings(runtime: dict[str, Any], updates: dict[str, Any]) -> dict[str, Any]:
    """Merge a partial ``guards`` update over the stored global parameters."""
    settings = runtime["storage"].data.get("settings", {})
    current = settings.get("guards") if isinstance(settings, dict) else None
    return {**(current if isinstance(current, dict) else {}), **updates}


def guards_status_payload(scheduler: Any) -> dict[str, Any]:
    """Return the ``guards`` section of the schedule response."""
    if getattr(scheduler, "temperature_migration_blocked", False):
        return {}
    return getattr(scheduler, "get_guards_statuses", lambda: {})()


def guards_settings_payload(settings: Any) -> dict[str, Any]:
    """Return normalized global Guards parameters for panels."""
    return dict(
        normalize_guards_settings(
            settings.get("guards") if isinstance(settings, dict) else None
        )
    )


@websocket_api.websocket_command(
    {
        vol.Required("type"): f"{DOMAIN}/update_zone_guards",
        vol.Required(ATTR_ENTITY_ID): cv.entity_id,
        vol.Required("guards"): GUARDS_ZONE_SCHEMA,
    }
)
@websocket_api.async_response
async def ws_update_zone_guards(
    hass: HomeAssistant,
    connection: websocket_api.ActiveConnection,
    msg: dict[str, Any],
) -> None:
    """Handle persisted zone Guards setting updates."""
    from . import api as velair_api  # Late import: api.py registers this module.

    runtime = velair_api._get_runtime(hass)
    if runtime is None:
        connection.send_error(msg["id"], "not_loaded", "Integration is not loaded")
        return

    scheduler = runtime["scheduler"]
    try:
        if velair_api._reject_temperature_migration_mutation(runtime, connection, msg):
            return
        await scheduler.async_update_zone_guards(msg[ATTR_ENTITY_ID], msg["guards"])
    except ValueError as err:
        connection.send_error(msg["id"], "invalid_guards", str(err))
        return

    connection.send_result(msg["id"], velair_api._build_schedule_response(runtime))
