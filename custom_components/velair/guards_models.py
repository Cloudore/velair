"""Data models for the Guards module.

Guards own three families of rules: never-off recovery (a head that a
person turned off comes back on after a grace period unless snoozed),
release of a Manual adjustment once documented evidence says nobody wants
it any more, and activity holds (an ``on`` entity keeps a zone at a
lower-only target). This file holds the TypedDicts, defaults and tolerant
normalizers; ``models.py`` only gains ``NotRequired`` fields and an import.
"""

from __future__ import annotations

from datetime import datetime
from math import isfinite
import re
from typing import Any, TypedDict

from .const import (
    HOLD_CONSTRAINT_LOWER_ONLY,
    HOLD_CONSTRAINT_OPTIONS,
    HVAC_MODE_OPTIONS,
    MANUAL_CONTROL_PAUSE_ID,
    MAX_HOLD_LABEL_LENGTH,
    MAX_PAUSE_ID_LENGTH,
    PAUSE_ID_PATTERN,
)
from .temperature import absolute_temperature

GUARDS_STATE_IDLE = "idle"
GUARDS_STATE_OFF_GRACE = "off_grace"
GUARDS_STATE_SNOOZED = "snoozed"
GUARDS_STATE_RECOVERING = "recovering"
GUARDS_STATE_MANUAL_WATCH = "manual_watch"
GUARDS_STATE_ACTIVITY_HOLD = "activity_hold"
GUARDS_STATE_FLOOR_HOLD = "floor_hold"
GUARDS_STATES = (
    GUARDS_STATE_IDLE,
    GUARDS_STATE_OFF_GRACE,
    GUARDS_STATE_SNOOZED,
    GUARDS_STATE_RECOVERING,
    GUARDS_STATE_MANUAL_WATCH,
    GUARDS_STATE_ACTIVITY_HOLD,
    GUARDS_STATE_FLOOR_HOLD,
)

# Pause ids from the cross-module contract (home policy spec, section 7).
PAUSE_ID_NEVER_OFF_SNOOZE = "neveroff_snooze"
PAUSE_ID_NEVER_OFF_RECOVER = "neveroff_recover"
PAUSE_ID_WATCHDOG = "watchdog"
PAUSE_ID_TRAVEL_OFF = "travel_off"
PAUSE_ID_FLOOR = "floor"

# Rule (c) outcome when every owner is away and the setpoint sits below the floor.
BELOW_MINIMUM_ACTION_RELEASE = "release"
BELOW_MINIMUM_ACTION_FLOOR_HOLD = "floor_hold"
BELOW_MINIMUM_ACTIONS = (BELOW_MINIMUM_ACTION_RELEASE, BELOW_MINIMUM_ACTION_FLOOR_HOLD)
DEFAULT_ACTIVITY_PAUSE_ID = "activity"

DEFAULT_GUARDS_NEVER_OFF_GRACE_MINUTES = 10
DEFAULT_GUARDS_NEVER_OFF_SNOOZE_MINUTES = 1440
DEFAULT_GUARDS_NEVER_OFF_SNOOZE_RELEASE_VACANT_MINUTES = 30
DEFAULT_GUARDS_MANUAL_LEASE_MINUTES = 30
DEFAULT_GUARDS_MANUAL_RELEASE_VACANT_MINUTES = 60
DEFAULT_GUARDS_OWNER_AWAY_MINUTES = 4
DEFAULT_ACTIVITY_RELEASE_DELAY_MINUTES = 10
DEFAULT_ACTIVITY_HVAC_MODE = "cool"
MAX_ACTIVITY_HOLDS = 10
MAX_SNOOZE_MINUTES = 10080

GUARDS_MINUTE_SETTINGS: dict[str, tuple[int, int, int]] = {
    # field: (default, minimum, maximum)
    "never_off_grace_minutes": (DEFAULT_GUARDS_NEVER_OFF_GRACE_MINUTES, 1, 1440),
    "never_off_snooze_minutes": (
        DEFAULT_GUARDS_NEVER_OFF_SNOOZE_MINUTES,
        1,
        MAX_SNOOZE_MINUTES,
    ),
    "never_off_snooze_release_vacant_minutes": (
        DEFAULT_GUARDS_NEVER_OFF_SNOOZE_RELEASE_VACANT_MINUTES,
        1,
        1440,
    ),
    "manual_lease_minutes": (DEFAULT_GUARDS_MANUAL_LEASE_MINUTES, 0, 1440),
    "manual_release_vacant_minutes": (
        DEFAULT_GUARDS_MANUAL_RELEASE_VACANT_MINUTES,
        1,
        1440,
    ),
    "owner_away_minutes": (DEFAULT_GUARDS_OWNER_AWAY_MINUTES, 0, 1440),
}
GUARDS_BOOLEAN_SETTINGS: dict[str, bool] = {
    "enabled": True,
    "never_off_enabled": True,
    "never_off_respect_travel": True,
    "manual_release_enabled": True,
    "manual_release_on_travel": True,
    "manual_release_below_minimum": True,
}


class GuardsActivityHoldData(TypedDict):
    """One activity hold: an ``on`` entity keeps the zone at a target."""

    entity_id: str
    temperature: float
    constraint: str
    hvac_mode: str | None
    release_delay_minutes: int
    pause_id: str
    label: str | None


class GuardsZoneData(TypedDict):
    """Stored per-zone Guards settings."""

    never_off_enabled: bool
    manual_release_below_minimum_action: str
    activity_holds: list[GuardsActivityHoldData]


class GuardsSettingsData(TypedDict):
    """Stored global Guards parameters."""

    enabled: bool
    never_off_enabled: bool
    never_off_grace_minutes: int
    never_off_snooze_minutes: int
    never_off_snooze_release_vacant_minutes: int
    never_off_respect_travel: bool
    manual_release_enabled: bool
    manual_lease_minutes: int
    manual_release_vacant_minutes: int
    manual_release_on_travel: bool
    owner_entity_ids: list[str]
    owner_away_minutes: int
    manual_release_below_minimum: bool


class GuardsRuntimeData(TypedDict, total=False):
    """Persisted Guards runtime for restart continuity (ISO timestamps)."""

    state: str
    grace_started_at: str | None
    grace_ends_at: str | None
    previous_target: float | None
    previous_hvac_mode: str | None
    relight_requested_at: str | None
    snooze_started_at: str | None
    floor_since: str | None
    floor_manual_since: str | None
    floor_manual_active: bool
    last_action: str | None
    last_action_at: str | None


def normalize_guards_zone_data(raw_data: Any) -> GuardsZoneData:
    """Normalize stored per-zone Guards settings tolerantly."""
    data = raw_data if isinstance(raw_data, dict) else {}
    raw_holds = data.get("activity_holds")
    holds: list[GuardsActivityHoldData] = []
    if isinstance(raw_holds, list):
        for raw_hold in raw_holds:
            hold = normalize_activity_hold(raw_hold)
            if hold is not None:
                holds.append(hold)
            if len(holds) >= MAX_ACTIVITY_HOLDS:
                break
    action = data.get("manual_release_below_minimum_action")
    if action not in BELOW_MINIMUM_ACTIONS:
        action = BELOW_MINIMUM_ACTION_RELEASE
    return {
        "never_off_enabled": bool(data.get("never_off_enabled", True)),
        "manual_release_below_minimum_action": str(action),
        "activity_holds": holds,
    }


def normalize_activity_hold(raw_hold: Any) -> GuardsActivityHoldData | None:
    """Return one valid activity hold or None when it cannot act."""
    if not isinstance(raw_hold, dict):
        return None
    entity_id = _normalize_optional_entity_id(raw_hold.get("entity_id"))
    temperature = _optional_finite_float(raw_hold.get("temperature"))
    if entity_id is None or temperature is None or not -58 <= temperature <= 212:
        return None
    constraint = raw_hold.get("constraint")
    if constraint not in HOLD_CONSTRAINT_OPTIONS:
        constraint = HOLD_CONSTRAINT_LOWER_ONLY
    hvac_mode: str | None = raw_hold.get("hvac_mode", DEFAULT_ACTIVITY_HVAC_MODE)
    if hvac_mode is not None and hvac_mode not in HVAC_MODE_OPTIONS:
        hvac_mode = DEFAULT_ACTIVITY_HVAC_MODE
    pause_id = _normalize_pause_id(raw_hold.get("pause_id"))
    label = raw_hold.get("label")
    if not isinstance(label, str) or not label.strip():
        label = None
    else:
        label = label.strip()[:MAX_HOLD_LABEL_LENGTH]
    return {
        "entity_id": entity_id,
        "temperature": float(temperature),
        "constraint": str(constraint),
        "hvac_mode": hvac_mode,
        "release_delay_minutes": _normalize_int(
            raw_hold.get("release_delay_minutes"),
            DEFAULT_ACTIVITY_RELEASE_DELAY_MINUTES,
            minimum=0,
            maximum=1440,
        ),
        "pause_id": pause_id,
        "label": label,
    }


def normalize_guards_settings(raw_data: Any) -> GuardsSettingsData:
    """Normalize the global Guards parameters tolerantly."""
    data = raw_data if isinstance(raw_data, dict) else {}
    settings: dict[str, Any] = {}
    for key, default in GUARDS_BOOLEAN_SETTINGS.items():
        settings[key] = bool(data.get(key, default))
    for key, (default, minimum, maximum) in GUARDS_MINUTE_SETTINGS.items():
        settings[key] = _normalize_int(
            data.get(key), default, minimum=minimum, maximum=maximum
        )
    settings["owner_entity_ids"] = _normalize_entity_id_list(
        data.get("owner_entity_ids")
    )
    return {
        "enabled": settings["enabled"],
        "never_off_enabled": settings["never_off_enabled"],
        "never_off_grace_minutes": settings["never_off_grace_minutes"],
        "never_off_snooze_minutes": settings["never_off_snooze_minutes"],
        "never_off_snooze_release_vacant_minutes": settings[
            "never_off_snooze_release_vacant_minutes"
        ],
        "never_off_respect_travel": settings["never_off_respect_travel"],
        "manual_release_enabled": settings["manual_release_enabled"],
        "manual_lease_minutes": settings["manual_lease_minutes"],
        "manual_release_vacant_minutes": settings["manual_release_vacant_minutes"],
        "manual_release_on_travel": settings["manual_release_on_travel"],
        "owner_entity_ids": settings["owner_entity_ids"],
        "owner_away_minutes": settings["owner_away_minutes"],
        "manual_release_below_minimum": settings["manual_release_below_minimum"],
    }


def normalize_guards_runtime_data(
    raw_data: Any,
    climate_entities: list[str],
) -> dict[str, GuardsRuntimeData]:
    """Normalize persisted Guards runtime records per managed climate."""
    data = raw_data if isinstance(raw_data, dict) else {}
    configured = set(climate_entities)
    runtime: dict[str, GuardsRuntimeData] = {}
    for entity_id, raw_record in data.items():
        if entity_id not in configured or not isinstance(raw_record, dict):
            continue
        state = raw_record.get("state")
        record: GuardsRuntimeData = {
            "state": state if state in GUARDS_STATES else GUARDS_STATE_IDLE,
        }
        for key in (
            "grace_started_at",
            "grace_ends_at",
            "relight_requested_at",
            "last_action_at",
            "snooze_started_at",
            "floor_since",
            "floor_manual_since",
        ):
            value = raw_record.get(key)
            record[key] = (
                value
                if isinstance(value, str) and _parse_datetime(value) is not None
                else None
            )
        record["previous_target"] = _optional_finite_float(
            raw_record.get("previous_target")
        )
        hvac_mode = raw_record.get("previous_hvac_mode")
        record["previous_hvac_mode"] = (
            hvac_mode if isinstance(hvac_mode, str) and hvac_mode.strip() else None
        )
        last_action = raw_record.get("last_action")
        record["last_action"] = (
            last_action if isinstance(last_action, str) and last_action.strip() else None
        )
        record["floor_manual_active"] = bool(raw_record.get("floor_manual_active", False))
        if record["grace_ends_at"] is None:
            record["grace_started_at"] = None
        runtime[entity_id] = record
    return runtime


def convert_guards_zone_temperatures(guards: Any, source: str, target: str) -> None:
    """Convert the absolute temperatures of a zone's activity holds in place."""
    if not isinstance(guards, dict):
        return
    holds = guards.get("activity_holds")
    if not isinstance(holds, list):
        return
    for hold in holds:
        if isinstance(hold, dict) and isinstance(hold.get("temperature"), (int, float)):
            hold["temperature"] = round(
                absolute_temperature(hold["temperature"], source, target), 6
            )


def convert_guards_runtime_temperatures(runtime: Any, source: str, target: str) -> None:
    """Convert the persisted previous targets of the Guards runtime in place."""
    if not isinstance(runtime, dict):
        return
    for record in runtime.values():
        if isinstance(record, dict) and isinstance(
            record.get("previous_target"), (int, float)
        ):
            record["previous_target"] = round(
                absolute_temperature(record["previous_target"], source, target), 6
            )


def _normalize_pause_id(value: Any) -> str:
    if (
        isinstance(value, str)
        and value != MANUAL_CONTROL_PAUSE_ID
        and 0 < len(value) <= MAX_PAUSE_ID_LENGTH
        and re.fullmatch(PAUSE_ID_PATTERN, value) is not None
    ):
        return value
    return DEFAULT_ACTIVITY_PAUSE_ID


def _normalize_entity_id_list(value: Any) -> list[str]:
    if not isinstance(value, list):
        return []
    result: list[str] = []
    for item in value:
        entity_id = _normalize_optional_entity_id(item)
        if entity_id is not None and entity_id not in result:
            result.append(entity_id)
    return result


def _normalize_optional_entity_id(value: Any) -> str | None:
    if not isinstance(value, str):
        return None
    entity_id = value.strip()
    if not entity_id or "." not in entity_id:
        return None
    return entity_id


def _normalize_int(value: Any, fallback: int, *, minimum: int, maximum: int) -> int:
    if isinstance(value, bool):
        return fallback
    try:
        number = int(value)
    except (TypeError, ValueError):
        return fallback
    return max(minimum, min(number, maximum))


def _optional_finite_float(value: Any) -> float | None:
    if value is None or isinstance(value, bool):
        return None
    try:
        number = float(value)
    except (TypeError, ValueError):
        return None
    return number if isfinite(number) else None


def _parse_datetime(value: str) -> datetime | None:
    try:
        return datetime.fromisoformat(value)
    except ValueError:
        if value.endswith("Z"):
            try:
                return datetime.fromisoformat(f"{value[:-1]}+00:00")
            except ValueError:
                return None
        return None
