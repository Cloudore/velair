"""Data models, defaults, and normalizers for Occupancy Assist.

Occupancy Assist stores one configuration per managed climate under
``zones[entity_id]["occupancy_assist"]`` and a small runtime record per zone
under the scheduler data key ``occupancy_assist_runtime`` (restart
continuity). Everything here is tolerant: unknown keys are dropped, missing
keys are defaulted, and corrupt values fall back to safe defaults.

This module intentionally imports nothing from ``models.py`` so the latter
can import it without a cycle.
"""

from __future__ import annotations

from math import isfinite
from typing import Any, Callable, NotRequired, TypedDict

from .const import HVAC_MODE_OPTIONS
from .temperature import absolute_temperature

OCCUPANCY_ASSIST_SETBACK_PAUSE_ID = "velair_occupancy_setback"
OCCUPANCY_ASSIST_COMFORT_PAUSE_ID = "comfort"
# Pause ids released when the arrival final stage is reached (spec §3.4 / §7),
# in order; ``comfort`` is released last so the schedule returns.
OCCUPANCY_ASSIST_ARRIVAL_RELEASE_PAUSE_IDS = (
    OCCUPANCY_ASSIST_SETBACK_PAUSE_ID,
    "away_1h",
    "away_6h",
    "neveroff_recover",
    "presleep",
)

MAX_OCCUPANCY_ASSIST_SETBACK_STAGES = 3
MAX_OCCUPANCY_ASSIST_ARRIVAL_STAGES = 2
MAX_OCCUPANCY_ASSIST_STAGE_MINUTES = 1440
MAX_OCCUPANCY_ASSIST_EXIT_GRACE_MINUTES = 10080

DEFAULT_OCCUPANCY_ASSIST_SETBACK_STAGES: tuple[tuple[int, float], ...] = (
    (10, 23.0),
    (30, 25.0),
    (90, 26.0),
)
DEFAULT_OCCUPANCY_ASSIST_ARRIVAL_STAGES: tuple[tuple[int, float | None], ...] = (
    (5, 26.0),
    (10, None),
)
DEFAULT_OCCUPANCY_ASSIST_SETBACK_HVAC_MODE = "cool"
DEFAULT_OCCUPANCY_ASSIST_SETBACK_FAN_MODE = "auto"
DEFAULT_OCCUPANCY_ASSIST_ARRIVAL_EXIT_GRACE_MINUTES = 2
DEFAULT_OCCUPANCY_ASSIST_COMFORT_TEMPERATURE = 26.0

OCCUPANCY_ASSIST_STATE_DISABLED = "disabled"
OCCUPANCY_ASSIST_STATE_UNAVAILABLE = "unavailable"
OCCUPANCY_ASSIST_STATE_OCCUPIED = "occupied"
OCCUPANCY_ASSIST_STATE_ARRIVING_1 = "arriving_1"
OCCUPANCY_ASSIST_STATE_COMFORT = "comfort"
OCCUPANCY_ASSIST_STATE_VACANT = "vacant"
OCCUPANCY_ASSIST_STATE_SETBACK_1 = "setback_1"
OCCUPANCY_ASSIST_STATE_SETBACK_2 = "setback_2"
OCCUPANCY_ASSIST_STATE_SETBACK_3 = "setback_3"
OCCUPANCY_ASSIST_STATE_BLOCKED = "blocked"
OCCUPANCY_ASSIST_STATES = (
    OCCUPANCY_ASSIST_STATE_DISABLED,
    OCCUPANCY_ASSIST_STATE_UNAVAILABLE,
    OCCUPANCY_ASSIST_STATE_OCCUPIED,
    OCCUPANCY_ASSIST_STATE_ARRIVING_1,
    OCCUPANCY_ASSIST_STATE_COMFORT,
    OCCUPANCY_ASSIST_STATE_VACANT,
    OCCUPANCY_ASSIST_STATE_SETBACK_1,
    OCCUPANCY_ASSIST_STATE_SETBACK_2,
    OCCUPANCY_ASSIST_STATE_SETBACK_3,
    OCCUPANCY_ASSIST_STATE_BLOCKED,
)

# Stored temperature keys converted between °C and °F with the other absolute
# temperatures (see storage.py) and snapped to the climate target grid.
OCCUPANCY_ASSIST_STAGE_LISTS = ("setback_stages", "arrival_stages")
OCCUPANCY_ASSIST_ABSOLUTE_TEMPERATURE_KEYS = ("comfort_temperature",)


class OccupancyAssistStage(TypedDict):
    """One timed stage: after ``after_minutes`` hold ``temperature``."""

    after_minutes: int
    temperature: float | None


class OccupancyAssistData(TypedDict):
    """Stored Occupancy Assist settings for one climate zone."""

    enabled: bool
    occupancy_entity_id: str | None
    blocking_entity_ids: list[str]
    corroboration_entity_ids: list[str]
    setback_stages: list[OccupancyAssistStage]
    setback_hvac_mode: str | None
    setback_fan_mode: str | None
    arrival_stages: list[OccupancyAssistStage]
    arrival_exit_grace_minutes: int
    comfort_temperature: float
    sync_comfort_to_schedule: bool


class OccupancyAssistRuntimeData(TypedDict, total=False):
    """Persisted Occupancy Assist runtime record for restart continuity."""

    state: str
    stage: int | None
    applied_stage: int | None
    arrival_released: bool
    occupied_since: str | None
    vacant_since: str | None
    last_action: str | None
    last_action_at: str | None


def normalize_occupancy_assist_data(raw_data: Any) -> OccupancyAssistData:
    """Normalize stored per-zone Occupancy Assist settings tolerantly."""
    data = raw_data if isinstance(raw_data, dict) else {}
    setback_stages = normalize_occupancy_assist_stages(
        data.get("setback_stages"),
        default=DEFAULT_OCCUPANCY_ASSIST_SETBACK_STAGES,
        max_stages=MAX_OCCUPANCY_ASSIST_SETBACK_STAGES,
        require_temperature=True,
        allow_empty=True,
    )
    arrival_stages = normalize_occupancy_assist_stages(
        data.get("arrival_stages"),
        default=DEFAULT_OCCUPANCY_ASSIST_ARRIVAL_STAGES,
        max_stages=MAX_OCCUPANCY_ASSIST_ARRIVAL_STAGES,
        require_temperature=False,
        allow_empty=False,
    )
    # The last arrival stage always releases to the schedule.
    arrival_stages[-1]["temperature"] = None
    comfort = _optional_finite_float(data.get("comfort_temperature"))
    if comfort is None or not -58 <= comfort <= 212:
        comfort = DEFAULT_OCCUPANCY_ASSIST_COMFORT_TEMPERATURE
    return {
        "enabled": bool(data.get("enabled", False)),
        "occupancy_entity_id": _optional_entity_id(data.get("occupancy_entity_id")),
        "blocking_entity_ids": _entity_id_list(data.get("blocking_entity_ids")),
        "corroboration_entity_ids": _entity_id_list(
            data.get("corroboration_entity_ids")
        ),
        "setback_stages": setback_stages,
        "setback_hvac_mode": _optional_hvac_mode(
            data.get("setback_hvac_mode", DEFAULT_OCCUPANCY_ASSIST_SETBACK_HVAC_MODE)
        ),
        "setback_fan_mode": _optional_text(
            data.get("setback_fan_mode", DEFAULT_OCCUPANCY_ASSIST_SETBACK_FAN_MODE)
        ),
        "arrival_stages": arrival_stages,
        "arrival_exit_grace_minutes": _bounded_int(
            data.get("arrival_exit_grace_minutes"),
            DEFAULT_OCCUPANCY_ASSIST_ARRIVAL_EXIT_GRACE_MINUTES,
            minimum=0,
            maximum=MAX_OCCUPANCY_ASSIST_EXIT_GRACE_MINUTES,
        ),
        "comfort_temperature": comfort,
        "sync_comfort_to_schedule": bool(data.get("sync_comfort_to_schedule", True)),
    }


def normalize_occupancy_assist_stages(
    raw_stages: Any,
    *,
    default: tuple[tuple[int, float | None], ...],
    max_stages: int,
    require_temperature: bool,
    allow_empty: bool,
) -> list[OccupancyAssistStage]:
    """Normalize one ascending stage ladder.

    A missing or non-list value yields the default ladder. Items without a
    usable ``after_minutes`` (or, when required, without a temperature) are
    dropped. Stages are sorted by minutes and capped at ``max_stages``.
    """
    if not isinstance(raw_stages, list):
        return [_stage(minutes, temperature) for minutes, temperature in default]
    stages: list[OccupancyAssistStage] = []
    for item in raw_stages:
        if not isinstance(item, dict):
            continue
        minutes = _optional_int(item.get("after_minutes"))
        if minutes is None:
            continue
        minutes = max(0, min(minutes, MAX_OCCUPANCY_ASSIST_STAGE_MINUTES))
        temperature = _optional_finite_float(item.get("temperature"))
        if temperature is not None and not -58 <= temperature <= 212:
            temperature = None
        if temperature is None and require_temperature:
            continue
        stages.append(_stage(minutes, temperature))
    stages.sort(key=lambda stage: stage["after_minutes"])
    stages = stages[:max_stages]
    if not stages and not allow_empty:
        return [_stage(minutes, temperature) for minutes, temperature in default]
    return stages


def normalize_occupancy_assist_runtime_data(
    raw_data: Any,
    climate_entities: list[str],
) -> dict[str, OccupancyAssistRuntimeData]:
    """Normalize persisted runtime records per managed climate."""
    data = raw_data if isinstance(raw_data, dict) else {}
    configured = set(climate_entities)
    runtime: dict[str, OccupancyAssistRuntimeData] = {}
    for entity_id, raw_record in data.items():
        if entity_id not in configured or not isinstance(raw_record, dict):
            continue
        state = raw_record.get("state")
        record: OccupancyAssistRuntimeData = {
            "state": (
                state
                if state in OCCUPANCY_ASSIST_STATES
                else OCCUPANCY_ASSIST_STATE_DISABLED
            ),
            "stage": _optional_int(raw_record.get("stage")),
            "applied_stage": _optional_int(raw_record.get("applied_stage")),
            "arrival_released": bool(raw_record.get("arrival_released", False)),
        }
        for key in ("occupied_since", "vacant_since", "last_action_at"):
            value = raw_record.get(key)
            record[key] = value if isinstance(value, str) and value else None
        action = raw_record.get("last_action")
        record["last_action"] = (
            action if isinstance(action, str) and action.strip() else None
        )
        runtime[entity_id] = record
    return runtime


def convert_occupancy_assist_temperatures(
    zone: Any, source: str, target: str
) -> None:
    """Convert the stored stage and comfort temperatures of one zone in place."""
    if not isinstance(zone, dict):
        return
    data = zone.get("occupancy_assist")
    if not isinstance(data, dict):
        return
    for key in OCCUPANCY_ASSIST_ABSOLUTE_TEMPERATURE_KEYS:
        if isinstance(data.get(key), (int, float)) and not isinstance(data.get(key), bool):
            data[key] = round(absolute_temperature(data[key], source, target), 6)
    for key in OCCUPANCY_ASSIST_STAGE_LISTS:
        stages = data.get(key)
        if not isinstance(stages, list):
            continue
        for stage in stages:
            if not isinstance(stage, dict):
                continue
            temperature = stage.get("temperature")
            if isinstance(temperature, (int, float)) and not isinstance(temperature, bool):
                stage["temperature"] = round(
                    absolute_temperature(temperature, source, target), 6
                )


def snap_occupancy_assist_temperatures(
    zone: Any, snap_target: Callable[[Any, str], None]
) -> None:
    """Snap the stored stage and comfort temperatures to the climate grid."""
    if not isinstance(zone, dict):
        return
    data = zone.get("occupancy_assist")
    if not isinstance(data, dict):
        return
    for key in OCCUPANCY_ASSIST_ABSOLUTE_TEMPERATURE_KEYS:
        snap_target(data, key)
    for key in OCCUPANCY_ASSIST_STAGE_LISTS:
        stages = data.get(key)
        if not isinstance(stages, list):
            continue
        for stage in stages:
            snap_target(stage, "temperature")


def _stage(minutes: int, temperature: float | None) -> OccupancyAssistStage:
    return {"after_minutes": int(minutes), "temperature": temperature}


def _optional_entity_id(value: Any) -> str | None:
    if not isinstance(value, str):
        return None
    entity_id = value.strip()
    if not entity_id or "." not in entity_id:
        return None
    return entity_id


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


def _optional_hvac_mode(value: Any) -> str | None:
    if not isinstance(value, str):
        return None
    mode = value.strip()
    return mode if mode in HVAC_MODE_OPTIONS else None


def _optional_text(value: Any) -> str | None:
    if not isinstance(value, str):
        return None
    text = value.strip()
    return text or None


def _optional_int(value: Any) -> int | None:
    if value is None or isinstance(value, bool):
        return None
    try:
        number = float(value)
    except (TypeError, ValueError):
        return None
    if not isfinite(number):
        return None
    return int(round(number))


def _bounded_int(value: Any, fallback: int, *, minimum: int, maximum: int) -> int:
    number = _optional_int(value)
    if number is None:
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
