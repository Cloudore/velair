"""Persistent notification helpers for zone temperature limits."""

from __future__ import annotations

import logging

from homeassistant.core import HomeAssistant

from .const import DOMAIN

_LOGGER = logging.getLogger(__name__)


def notification_id(entity_id: str) -> str:
    """Return the stable notification identifier for one climate entity."""
    safe_entity_id = entity_id.replace(".", "_")
    return f"{DOMAIN}_zone_limit_{safe_entity_id}"


async def async_notify_zone_limit(
    hass: HomeAssistant,
    entity_id: str,
    *,
    requested: str,
    applied: str,
    limits: str,
) -> bool:
    """Create or replace the persistent notification for an active zone limit."""
    try:
        await hass.services.async_call(
            "persistent_notification",
            "create",
            {
                "notification_id": notification_id(entity_id),
                "title": "Velair zone temperature limit applied",
                "message": (
                    f"The temperature limits configured for `{entity_id}` changed a "
                    f"target Velair delivered. It requested {requested}; the zone "
                    f"limits are {limits}, so Velair applied {applied}. Adjust the "
                    "schedule or the limits in Settings if this is not intended. "
                    "[Open Velair](/velair)."
                ),
            },
            blocking=True,
        )
    except Exception:  # Notification availability must not block climate control.
        _LOGGER.exception(
            "Unable to create the zone temperature-limit notification for %s",
            entity_id,
        )
        return False
    return True


async def async_dismiss_zone_limit_notification(
    hass: HomeAssistant,
    entity_id: str,
) -> bool:
    """Dismiss a zone temperature-limit notification once targets fit again."""
    try:
        await hass.services.async_call(
            "persistent_notification",
            "dismiss",
            {"notification_id": notification_id(entity_id)},
            blocking=True,
        )
    except Exception:  # A stale notice must not block climate delivery.
        _LOGGER.exception(
            "Unable to dismiss the zone temperature-limit notification for %s",
            entity_id,
        )
        return False
    return True
