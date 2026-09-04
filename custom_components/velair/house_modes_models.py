"""Data models, defaults, and tolerant normalizers for House Modes.

This module deliberately imports nothing from ``models.py`` so the main model
module can import it for the ``NotRequired`` zone and settings sections
without a circular import. Temperatures are stored in the runtime unit like
every other Velair thermal field; the normalizers take the unit so absent
keys default to the reference values converted into that unit.
"""

from __future__ import annotations

from datetime import datetime
from math import isfinite
import re
from typing import Any, TypedDict

from .const import (
    HOLD_CONSTRAINT_OPTIONS,
    HOLD_CONSTRAINT_RAISE_ONLY,
    HVAC_MODE_OPTIONS,
)
from .temperature import CELSIUS, absolute_temperature

# Reference-home defaults (Celsius).
DEFAULT_HOUSE_MODES_ENABLED = False
DEFAULT_AWAY_AFTER_MINUTES = 60
DEFAULT_AWAY_DEEP_AFTER_MINUTES = 360
DEFAULT_ARRIVAL_RELEASE_MINUTES = 3
DEFAULT_PRESENCE_CORROBORATION_QUIET_MINUTES = 15
DEFAULT_PRESLEEP_TIME = "21:00"
DEFAULT_PRESLEEP_DURATION_MINUTES = 240
DEFAULT_TRAVEL_PARK_TEMPERATURE_C = 29.0
DEFAULT_TRAVEL_PARK_HVAC_MODE = "cool"
DEFAULT_TRAVEL_PARK_FAN_MODE = "auto"
DEFAULT_TRAVEL_FREEZE_OFF_HEADS = True
DEFAULT_TRAVEL_ENABLE_HUMIDITY_ASSIST = True
DEFAULT_TRAVEL_AUTO_EXIT_ON_ARRIVAL = False
DEFAULT_AWAY_TEMPERATURE_C = 26.0
DEFAULT_SLEEP_TEMPERATURE_C = 26.0
DEFAULT_SLEEP_CONSTRAINT = HOLD_CONSTRAINT_RAISE_ONLY
DEFAULT_SETBACK_HVAC_MODE = "cool"
DEFAULT_SETBACK_FAN_MODE = "auto"
DEFAULT_MANUAL_LEASE_MINUTES = 30
TRAVEL_RECHECK_MINUTES = 30

MAX_AWAY_AFTER_MINUTES = 1440
MAX_AWAY_DEEP_AFTER_MINUTES = 2880
MAX_ARRIVAL_RELEASE_MINUTES = 120
MAX_CORROBORATION_QUIET_MINUTES = 1440
MAX_PRESLEEP_DURATION_MINUTES = 1440

PAUSE_ID_AWAY_1H = "away_1h"
PAUSE_ID_AWAY_6H = "away_6h"
PAUSE_ID_SLEEP = "sleep"
PAUSE_ID_PRESLEEP = "presleep"
PAUSE_ID_TRAVEL_PARK = "travel_park"
PAUSE_ID_TRAVEL_OFF = "travel_off"
HOUSE_MODES_PAUSE_IDS = (
    PAUSE_ID_AWAY_1H,
    PAUSE_ID_AWAY_6H,
    PAUSE_ID_SLEEP,
    PAUSE_ID_PRESLEEP,
    PAUSE_ID_TRAVEL_PARK,
    PAUSE_ID_TRAVEL_OFF,
)

HOUSE_MODE_HOME = "home"
HOUSE_MODE_AWAY = "away"
HOUSE_MODE_AWAY_DEEP = "away_deep"
HOUSE_MODE_TRAVEL = "travel"
HOUSE_MODE_SLEEP = "sleep"
HOUSE_MODE_DISABLED = "disabled"
HOUSE_MODE_STATES = (
    HOUSE_MODE_HOME,
    HOUSE_MODE_AWAY,
    HOUSE_MODE_AWAY_DEEP,
    HOUSE_MODE_TRAVEL,
    HOUSE_MODE_SLEEP,
    HOUSE_MODE_DISABLED,
)

HOUSE_MODES_ZONE_TEMPERATURE_KEYS = (
    "away_temperature",
    "away_deep_temperature",
    "sleep_temperature",
    "sleep_minimum_temperature",
    "presleep_temperature",
)
HOUSE_MODES_SETTINGS_TEMPERATURE_KEYS = ("travel_park_temperature",)

_TIME_PATTERN = re.compile(r"^(?P<hour>[01]?\d|2[0-3]):(?P<minute>[0-5]\d)$")


class HouseModesSettingsData(TypedDict):
    """Stored global House Modes parameters."""

    enabled: bool
    presence_entity_ids: list[str]
    presence_corroboration_entity_ids: list[str]
    presence_corroboration_quiet_minutes: int
    away_after_minutes: int
    away_deep_after_minutes: int
    arrival_release_minutes: int
    sleep_entity_id: str | None
    presleep_time: str | None
    presleep_duration_minutes: int
    travel_entity_id: str | None
    travel_park_temperature: float
    travel_park_hvac_mode: str | None
    travel_park_fan_mode: str | None
    travel_freeze_off_heads: bool
    travel_enable_humidity_assist: bool
    travel_auto_exit_on_arrival: bool


class HouseModesZoneData(TypedDict):
    """Stored House Modes settings for one climate zone."""

    away_enabled: bool
    away_temperature: float
    away_deep_temperature: float | None
    sleep_enabled: bool
    sleep_temperature: float
    sleep_constraint: str
    sleep_fan_mode: str | None
    sleep_minimum_temperature: float | None
    presleep_temperature: float | None
    travel_park_enabled: bool


class HouseModesSavedMinimum(TypedDict):
    """The zone minimum replaced while asleep and the value written in its place."""

    saved: float | None
    applied: float | None


class HouseModesRuntimeData(TypedDict, total=False):
    """Persisted House Modes runtime for restart continuity."""

    state: str
    sleeping: bool
    sleep_since: str | None
    travel_active: bool
    travel_since: str | None
    empty_since: str | None
    away_stage: int
    presleep_applied_on: str | None
    saved_minimums: dict[str, HouseModesSavedMinimum]
    humidity_assist_enabled_zones: list[str]
    last_action: str | None
    last_action_at: str | None


def normalize_house_modes_settings(
    raw_data: Any, unit: str = CELSIUS
) -> HouseModesSettingsData:
    """Normalize the global House Modes parameters tolerantly."""
    data = raw_data if isinstance(raw_data, dict) else {}
    hvac_mode = data.get("travel_park_hvac_mode", DEFAULT_TRAVEL_PARK_HVAC_MODE)
    if hvac_mode is not None and hvac_mode not in HVAC_MODE_OPTIONS:
        hvac_mode = DEFAULT_TRAVEL_PARK_HVAC_MODE
    return {
        "enabled": bool(data.get("enabled", DEFAULT_HOUSE_MODES_ENABLED)),
        "presence_entity_ids": _entity_id_list(data.get("presence_entity_ids")),
        "presence_corroboration_entity_ids": _entity_id_list(
            data.get("presence_corroboration_entity_ids")
        ),
        "presence_corroboration_quiet_minutes": _int(
            data.get("presence_corroboration_quiet_minutes"),
            DEFAULT_PRESENCE_CORROBORATION_QUIET_MINUTES,
            minimum=0,
            maximum=MAX_CORROBORATION_QUIET_MINUTES,
        ),
        "away_after_minutes": _int(
            data.get("away_after_minutes"),
            DEFAULT_AWAY_AFTER_MINUTES,
            minimum=1,
            maximum=MAX_AWAY_AFTER_MINUTES,
        ),
        "away_deep_after_minutes": _int(
            data.get("away_deep_after_minutes"),
            DEFAULT_AWAY_DEEP_AFTER_MINUTES,
            minimum=0,
            maximum=MAX_AWAY_DEEP_AFTER_MINUTES,
        ),
        "arrival_release_minutes": _int(
            data.get("arrival_release_minutes"),
            DEFAULT_ARRIVAL_RELEASE_MINUTES,
            minimum=0,
            maximum=MAX_ARRIVAL_RELEASE_MINUTES,
        ),
        "sleep_entity_id": _optional_entity_id(data.get("sleep_entity_id")),
        "presleep_time": normalize_presleep_time(
            data.get("presleep_time", DEFAULT_PRESLEEP_TIME)
        ),
        "presleep_duration_minutes": _int(
            data.get("presleep_duration_minutes"),
            DEFAULT_PRESLEEP_DURATION_MINUTES,
            minimum=1,
            maximum=MAX_PRESLEEP_DURATION_MINUTES,
        ),
        "travel_entity_id": _optional_entity_id(data.get("travel_entity_id")),
        "travel_park_temperature": _temperature(
            data.get("travel_park_temperature"),
            absolute_temperature(DEFAULT_TRAVEL_PARK_TEMPERATURE_C, CELSIUS, unit),
        ),
        "travel_park_hvac_mode": hvac_mode,
        "travel_park_fan_mode": _optional_string(
            data.get("travel_park_fan_mode", DEFAULT_TRAVEL_PARK_FAN_MODE)
        ),
        "travel_freeze_off_heads": bool(
            data.get("travel_freeze_off_heads", DEFAULT_TRAVEL_FREEZE_OFF_HEADS)
        ),
        "travel_enable_humidity_assist": bool(
            data.get(
                "travel_enable_humidity_assist",
                DEFAULT_TRAVEL_ENABLE_HUMIDITY_ASSIST,
            )
        ),
        "travel_auto_exit_on_arrival": bool(
            data.get("travel_auto_exit_on_arrival", DEFAULT_TRAVEL_AUTO_EXIT_ON_ARRIVAL)
        ),
    }


def normalize_house_modes_data(raw_data: Any, unit: str = CELSIUS) -> HouseModesZoneData:
    """Normalize stored per-zone House Modes settings tolerantly."""
    data = raw_data if isinstance(raw_data, dict) else {}
    constraint = data.get("sleep_constraint", DEFAULT_SLEEP_CONSTRAINT)
    if constraint not in HOLD_CONSTRAINT_OPTIONS:
        constraint = DEFAULT_SLEEP_CONSTRAINT
    return {
        "away_enabled": bool(data.get("away_enabled", True)),
        "away_temperature": _temperature(
            data.get("away_temperature"),
            absolute_temperature(DEFAULT_AWAY_TEMPERATURE_C, CELSIUS, unit),
        ),
        "away_deep_temperature": _optional_temperature(
            data.get("away_deep_temperature")
        ),
        "sleep_enabled": bool(data.get("sleep_enabled", True)),
        "sleep_temperature": _temperature(
            data.get("sleep_temperature"),
            absolute_temperature(DEFAULT_SLEEP_TEMPERATURE_C, CELSIUS, unit),
        ),
        "sleep_constraint": str(constraint),
        "sleep_fan_mode": _optional_string(data.get("sleep_fan_mode")),
        "sleep_minimum_temperature": _optional_temperature(
            data.get("sleep_minimum_temperature")
        ),
        "presleep_temperature": _optional_temperature(data.get("presleep_temperature")),
        "travel_park_enabled": bool(data.get("travel_park_enabled", True)),
    }


def normalize_house_modes_runtime_data(raw_data: Any) -> HouseModesRuntimeData:
    """Normalize the persisted runtime record; garbage becomes the idle record."""
    data = raw_data if isinstance(raw_data, dict) else {}
    state = data.get("state")
    saved: dict[str, HouseModesSavedMinimum] = {}
    raw_saved = data.get("saved_minimums")
    if isinstance(raw_saved, dict):
        for entity_id, record in raw_saved.items():
            if not isinstance(entity_id, str) or not isinstance(record, dict):
                continue
            saved[entity_id] = {
                "saved": _optional_temperature(record.get("saved")),
                "applied": _optional_temperature(record.get("applied")),
            }
    return {
        "state": state if state in HOUSE_MODE_STATES else HOUSE_MODE_DISABLED,
        "sleeping": bool(data.get("sleeping", False)),
        "sleep_since": _timestamp(data.get("sleep_since")),
        "travel_active": bool(data.get("travel_active", False)),
        "travel_since": _timestamp(data.get("travel_since")),
        "empty_since": _timestamp(data.get("empty_since")),
        "away_stage": _int(data.get("away_stage"), 0, minimum=0, maximum=2),
        "presleep_applied_on": _date_string(data.get("presleep_applied_on")),
        "saved_minimums": saved,
        "humidity_assist_enabled_zones": _entity_id_list(
            data.get("humidity_assist_enabled_zones")
        ),
        "last_action": _optional_string(data.get("last_action")),
        "last_action_at": _timestamp(data.get("last_action_at")),
    }


def convert_house_modes_temperatures(
    mapping: Any, keys: tuple[str, ...], source: str, target: str
) -> None:
    """Convert the listed absolute temperatures of one stored mapping in place.

    Called from ``storage.py``'s unit migration with the zone and settings
    temperature key tuples above; ``None`` values and non-dicts are left alone.
    """
    if not isinstance(mapping, dict):
        return
    for key in keys:
        value = mapping.get(key)
        if isinstance(value, (int, float)) and not isinstance(value, bool):
            mapping[key] = round(absolute_temperature(value, source, target), 6)


def normalize_presleep_time(value: Any) -> str | None:
    """Return a canonical ``HH:MM`` wall time or ``None`` when disabled/invalid."""
    if value is None or isinstance(value, bool):
        return None
    if not isinstance(value, str):
        return None
    match = _TIME_PATTERN.match(value.strip())
    if match is None:
        return None
    return f"{int(match['hour']):02d}:{int(match['minute']):02d}"


def _int(value: Any, fallback: int, *, minimum: int, maximum: int) -> int:
    if isinstance(value, bool):
        return fallback
    try:
        number = int(value)
    except (TypeError, ValueError):
        return fallback
    return max(minimum, min(number, maximum))


def _temperature(value: Any, fallback: float) -> float:
    number = _optional_temperature(value)
    return fallback if number is None else number


def _optional_temperature(value: Any) -> float | None:
    if value is None or isinstance(value, bool):
        return None
    try:
        number = float(value)
    except (TypeError, ValueError):
        return None
    if not isfinite(number) or number < -58 or number > 212:
        return None
    return number


def _optional_string(value: Any) -> str | None:
    if not isinstance(value, str):
        return None
    text = value.strip()
    return text or None


def _optional_entity_id(value: Any) -> str | None:
    text = _optional_string(value)
    if text is None or "." not in text or " " in text:
        return None
    return text


def _entity_id_list(value: Any) -> list[str]:
    if isinstance(value, str):
        value = [value]
    if not isinstance(value, (list, tuple)):
        return []
    result: list[str] = []
    for item in value:
        entity_id = _optional_entity_id(item)
        if entity_id is not None and entity_id not in result:
            result.append(entity_id)
    return result


def _timestamp(value: Any) -> str | None:
    if not isinstance(value, str) or not value:
        return None
    try:
        datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError:
        return None
    return value


def _date_string(value: Any) -> str | None:
    if not isinstance(value, str) or not value:
        return None
    try:
        datetime.strptime(value, "%Y-%m-%d")
    except ValueError:
        return None
    return value
