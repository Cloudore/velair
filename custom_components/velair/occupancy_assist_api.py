"""WebSocket command and service handler for Occupancy Assist.

``api.py`` registers the WebSocket command through
``register_occupancy_assist_ws(hass)``; ``services.py`` registers
``velair.set_occupancy_assist`` with ``SET_OCCUPANCY_ASSIST_SCHEMA`` and
``build_set_occupancy_assist_handler(hass)``. Helpers owned by those modules
are imported lazily inside the handlers to avoid import cycles.
"""

from __future__ import annotations

import math
from typing import Any, Callable, Coroutine

import voluptuous as vol

from homeassistant.components import websocket_api
from homeassistant.const import ATTR_ENTITY_ID
from homeassistant.core import HomeAssistant, ServiceCall
from homeassistant.exceptions import HomeAssistantError
from homeassistant.helpers import config_validation as cv

from .const import DOMAIN, HVAC_MODE_OPTIONS
from .occupancy_assist_models import (
    MAX_OCCUPANCY_ASSIST_ARRIVAL_STAGES,
    MAX_OCCUPANCY_ASSIST_EXIT_GRACE_MINUTES,
    MAX_OCCUPANCY_ASSIST_SETBACK_STAGES,
    MAX_OCCUPANCY_ASSIST_STAGE_MINUTES,
)

WS_UPDATE_ZONE_OCCUPANCY_ASSIST = f"{DOMAIN}/update_zone_occupancy_assist"
ERROR_INVALID_OCCUPANCY_ASSIST = "invalid_occupancy_assist"


def _finite_float(value: Any) -> float:
    """Coerce a finite float for stage and comfort temperatures."""
    try:
        number = float(value)
    except (TypeError, ValueError) as err:
        raise vol.Invalid("expected a number") from err
    if not math.isfinite(number):
        raise vol.Invalid("expected a finite number")
    return number


STAGE_SCHEMA = vol.Schema(
    {
        vol.Required("after_minutes"): vol.All(
            vol.Coerce(int), vol.Range(min=0, max=MAX_OCCUPANCY_ASSIST_STAGE_MINUTES)
        ),
        vol.Optional("temperature"): vol.Any(
            None, vol.All(_finite_float, vol.Range(min=-58, max=212))
        ),
    }
)

_OCCUPANCY_ASSIST_FIELDS = {
    vol.Optional("enabled"): cv.boolean,
    vol.Optional("occupancy_entity_id"): vol.Any(None, cv.entity_id),
    vol.Optional("blocking_entity_ids"): vol.All(cv.ensure_list, [cv.entity_id]),
    vol.Optional("corroboration_entity_ids"): vol.All(cv.ensure_list, [cv.entity_id]),
    vol.Optional("setback_stages"): vol.All(
        cv.ensure_list,
        [STAGE_SCHEMA],
        vol.Length(max=MAX_OCCUPANCY_ASSIST_SETBACK_STAGES),
    ),
    vol.Optional("setback_hvac_mode"): vol.Any(None, vol.In(HVAC_MODE_OPTIONS)),
    vol.Optional("setback_fan_mode"): vol.Any(None, cv.string),
    vol.Optional("arrival_stages"): vol.All(
        cv.ensure_list,
        [STAGE_SCHEMA],
        vol.Length(min=1, max=MAX_OCCUPANCY_ASSIST_ARRIVAL_STAGES),
    ),
    vol.Optional("arrival_exit_grace_minutes"): vol.All(
        vol.Coerce(int), vol.Range(min=0, max=MAX_OCCUPANCY_ASSIST_EXIT_GRACE_MINUTES)
    ),
    vol.Optional("comfort_temperature"): vol.All(
        _finite_float, vol.Range(min=-58, max=212)
    ),
    vol.Optional("sync_comfort_to_schedule"): cv.boolean,
}

OCCUPANCY_ASSIST_SCHEMA = vol.Schema(_OCCUPANCY_ASSIST_FIELDS)

SET_OCCUPANCY_ASSIST_SCHEMA = vol.Schema(
    {vol.Required(ATTR_ENTITY_ID): cv.entity_id, **_OCCUPANCY_ASSIST_FIELDS}
)


def register_occupancy_assist_ws(hass: HomeAssistant) -> None:
    """Register the Occupancy Assist WebSocket command."""
    websocket_api.async_register_command(hass, ws_update_zone_occupancy_assist)


@websocket_api.websocket_command(
    {
        vol.Required("type"): WS_UPDATE_ZONE_OCCUPANCY_ASSIST,
        vol.Required(ATTR_ENTITY_ID): cv.entity_id,
        vol.Required("occupancy_assist"): OCCUPANCY_ASSIST_SCHEMA,
    }
)
@websocket_api.async_response
async def ws_update_zone_occupancy_assist(
    hass: HomeAssistant,
    connection: websocket_api.ActiveConnection,
    msg: dict[str, Any],
) -> None:
    """Handle persisted zone Occupancy Assist setting updates."""
    from . import api as velair_api  # noqa: PLC0415 - lazy to avoid an import cycle

    runtime = velair_api._get_runtime(hass)
    if runtime is None:
        connection.send_error(msg["id"], "not_loaded", "Integration is not loaded")
        return

    scheduler = runtime["scheduler"]
    try:
        if velair_api._reject_temperature_migration_mutation(runtime, connection, msg):
            return
        await scheduler.async_update_zone_occupancy_assist(
            msg[ATTR_ENTITY_ID],
            msg["occupancy_assist"],
        )
    except ValueError as err:
        connection.send_error(msg["id"], ERROR_INVALID_OCCUPANCY_ASSIST, str(err))
        return

    connection.send_result(msg["id"], velair_api._build_schedule_response(runtime))


def build_set_occupancy_assist_handler(
    hass: HomeAssistant,
) -> Callable[[ServiceCall], Coroutine[Any, Any, None]]:
    """Return the ``velair.set_occupancy_assist`` service handler."""

    async def async_set_occupancy_assist(call: ServiceCall) -> None:
        from . import services as velair_services  # noqa: PLC0415 - lazy import

        scheduler = velair_services._get_scheduler(hass)
        entity_id = call.data[ATTR_ENTITY_ID]
        velair_services._ensure_managed_entity(scheduler, entity_id)
        updates = {
            key: value for key, value in call.data.items() if key != ATTR_ENTITY_ID
        }
        try:
            await scheduler.async_update_zone_occupancy_assist(entity_id, updates)
        except ValueError as err:
            raise HomeAssistantError(str(err)) from err

    return async_set_occupancy_assist
