import type {
  ActivityHold,
  ArrivalStage,
  GuardState,
  GuardStatus,
  GuardsGlobalSettings,
  GuardsZoneSettings,
  HoldConstraint,
  HouseModeState,
  HouseModeStatus,
  HouseModesGlobalSettings,
  HouseModesZoneSettings,
  OccupancyAssistSettings,
  OccupancyAssistState,
  OccupancyAssistStatus,
  SetbackStage,
  SleepConstraint,
} from "../../types";
import { isFahrenheit } from "../../domain/temperature-units";

/** Spec limits (§3): three setback stages, two arrival stages. */
export const MAX_SETBACK_STAGES = 3;
export const MAX_ARRIVAL_STAGES = 2;

export const HOLD_CONSTRAINTS: HoldConstraint[] = ["lower_only", "raise_only", "absolute"];
export const SLEEP_CONSTRAINTS: SleepConstraint[] = ["raise_only", "absolute"];

export const OCCUPANCY_ASSIST_STATES: OccupancyAssistState[] = [
  "disabled",
  "unavailable",
  "occupied",
  "arriving_1",
  "comfort",
  "vacant",
  "setback_1",
  "setback_2",
  "setback_3",
  "blocked",
];
export const HOUSE_MODE_STATES: HouseModeState[] = ["home", "away", "away_deep", "travel", "sleep", "disabled"];
export const GUARD_STATES: GuardState[] = ["idle", "off_grace", "snoozed", "recovering", "manual_watch", "activity_hold"];

/**
 * Spec defaults are written in °C. Panels that run in °F get the same
 * defaults converted and rounded to a whole degree, mirroring how
 * `storage.py` migrates stored temperatures between units.
 */
export function defaultTemperature(celsius: number, unit: string | undefined): number {
  return isFahrenheit(unit) ? Math.round((celsius * 9) / 5 + 32) : celsius;
}

export function occupancyAssistSettings(
  raw: Partial<OccupancyAssistSettings> | undefined,
  unit: string | undefined,
): OccupancyAssistSettings {
  const temperature = (celsius: number) => defaultTemperature(celsius, unit);
  const setbackStages = normalizeSetbackStages(raw?.setback_stages);
  const arrivalStages = normalizeArrivalStages(raw?.arrival_stages);
  return {
    enabled: Boolean(raw?.enabled),
    occupancy_entity_id: entityOrNull(raw?.occupancy_entity_id),
    blocking_entity_ids: entityList(raw?.blocking_entity_ids),
    corroboration_entity_ids: entityList(raw?.corroboration_entity_ids),
    setback_stages: setbackStages ?? [
      { after_minutes: 10, temperature: temperature(23) },
      { after_minutes: 30, temperature: temperature(25) },
      { after_minutes: 90, temperature: temperature(26) },
    ],
    setback_hvac_mode: raw && "setback_hvac_mode" in raw ? stringOrNull(raw.setback_hvac_mode) : "cool",
    setback_fan_mode: raw && "setback_fan_mode" in raw ? stringOrNull(raw.setback_fan_mode) : "auto",
    arrival_stages: arrivalStages ?? [
      { after_minutes: 5, temperature: temperature(26) },
      { after_minutes: 10, temperature: null },
    ],
    arrival_exit_grace_minutes: integerOr(raw?.arrival_exit_grace_minutes, 2),
    comfort_temperature: finiteOr(raw?.comfort_temperature, temperature(26)),
    sync_comfort_to_schedule: raw?.sync_comfort_to_schedule === undefined ? true : Boolean(raw.sync_comfort_to_schedule),
  };
}

export function houseModesGlobalSettings(
  raw: Partial<HouseModesGlobalSettings> | undefined,
  unit: string | undefined,
): HouseModesGlobalSettings {
  return {
    presence_entity_ids: entityList(raw?.presence_entity_ids),
    presence_corroboration_entity_ids: entityList(raw?.presence_corroboration_entity_ids),
    presence_corroboration_quiet_minutes: integerOr(raw?.presence_corroboration_quiet_minutes, 15),
    away_after_minutes: integerOr(raw?.away_after_minutes, 60),
    away_deep_after_minutes: integerOr(raw?.away_deep_after_minutes, 360),
    arrival_release_minutes: integerOr(raw?.arrival_release_minutes, 3),
    sleep_entity_id: entityOrNull(raw?.sleep_entity_id),
    presleep_time: raw && "presleep_time" in raw ? timeOrNull(raw.presleep_time) : "21:00",
    presleep_duration_minutes: integerOr(raw?.presleep_duration_minutes, 240),
    travel_entity_id: entityOrNull(raw?.travel_entity_id),
    travel_park_temperature: finiteOr(raw?.travel_park_temperature, defaultTemperature(29, unit)),
    travel_park_hvac_mode: raw && "travel_park_hvac_mode" in raw ? stringOrNull(raw.travel_park_hvac_mode) : "cool",
    travel_park_fan_mode: raw && "travel_park_fan_mode" in raw ? stringOrNull(raw.travel_park_fan_mode) : "auto",
    travel_freeze_off_heads: booleanOr(raw?.travel_freeze_off_heads, true),
    travel_enable_humidity_assist: booleanOr(raw?.travel_enable_humidity_assist, true),
    travel_auto_exit_on_arrival: booleanOr(raw?.travel_auto_exit_on_arrival, false),
  };
}

export function houseModesZoneSettings(
  raw: Partial<HouseModesZoneSettings> | undefined,
  unit: string | undefined,
): HouseModesZoneSettings {
  return {
    away_enabled: booleanOr(raw?.away_enabled, true),
    away_temperature: finiteOr(raw?.away_temperature, defaultTemperature(26, unit)),
    away_deep_temperature: finiteOrNull(raw?.away_deep_temperature),
    sleep_enabled: booleanOr(raw?.sleep_enabled, true),
    sleep_temperature: finiteOr(raw?.sleep_temperature, defaultTemperature(26, unit)),
    sleep_constraint: raw?.sleep_constraint === "absolute" ? "absolute" : "raise_only",
    sleep_fan_mode: stringOrNull(raw?.sleep_fan_mode),
    sleep_minimum_temperature: finiteOrNull(raw?.sleep_minimum_temperature),
    presleep_temperature: finiteOrNull(raw?.presleep_temperature),
    travel_park_enabled: booleanOr(raw?.travel_park_enabled, true),
  };
}

export function guardsGlobalSettings(raw: Partial<GuardsGlobalSettings> | undefined): GuardsGlobalSettings {
  return {
    never_off_enabled: booleanOr(raw?.never_off_enabled, true),
    never_off_grace_minutes: integerOr(raw?.never_off_grace_minutes, 10),
    never_off_snooze_minutes: integerOr(raw?.never_off_snooze_minutes, 1440),
    never_off_snooze_release_vacant_minutes: integerOr(raw?.never_off_snooze_release_vacant_minutes, 30),
    never_off_respect_travel: booleanOr(raw?.never_off_respect_travel, true),
    manual_release_enabled: booleanOr(raw?.manual_release_enabled, true),
    manual_lease_minutes: integerOr(raw?.manual_lease_minutes, 30),
    manual_release_vacant_minutes: integerOr(raw?.manual_release_vacant_minutes, 60),
    manual_release_on_travel: booleanOr(raw?.manual_release_on_travel, true),
    owner_entity_ids: entityList(raw?.owner_entity_ids),
    owner_away_minutes: integerOr(raw?.owner_away_minutes, 4),
    manual_release_below_minimum: booleanOr(raw?.manual_release_below_minimum, true),
  };
}

export function guardsZoneSettings(
  raw: Partial<GuardsZoneSettings> | undefined,
  unit: string | undefined,
): GuardsZoneSettings {
  return {
    never_off_enabled: booleanOr(raw?.never_off_enabled, true),
    manual_release_below_minimum_action: raw?.manual_release_below_minimum_action === "floor_hold" ? "floor_hold" : "release",
    activity_holds: Array.isArray(raw?.activity_holds)
      ? raw.activity_holds.map((hold) => activityHold(hold, unit))
      : [],
  };
}

export function activityHold(raw: Partial<ActivityHold> | undefined, unit: string | undefined): ActivityHold {
  return {
    entity_id: typeof raw?.entity_id === "string" ? raw.entity_id : "",
    temperature: finiteOr(raw?.temperature, defaultTemperature(25, unit)),
    constraint: HOLD_CONSTRAINTS.includes(raw?.constraint as HoldConstraint) ? (raw?.constraint as HoldConstraint) : "lower_only",
    hvac_mode: raw && "hvac_mode" in raw ? stringOrNull(raw.hvac_mode) : "cool",
    release_delay_minutes: integerOr(raw?.release_delay_minutes, 10),
    pause_id: typeof raw?.pause_id === "string" && raw.pause_id.trim() ? raw.pause_id.trim() : "activity",
    label: typeof raw?.label === "string" ? raw.label : "",
  };
}

export function occupancyAssistStatus(
  statuses: Record<string, OccupancyAssistStatus> | undefined,
  entityId: string,
  settings: OccupancyAssistSettings,
): OccupancyAssistStatus {
  const status = statuses?.[entityId];
  if (status && OCCUPANCY_ASSIST_STATES.includes(status.state)) {
    return status;
  }
  return { state: settings.enabled ? "unavailable" : "disabled" };
}

/** `house_mode` may arrive as the sensor state string or as the full status object. */
export function houseModeStatus(raw: HouseModeStatus | HouseModeState | string | null | undefined): HouseModeStatus {
  if (typeof raw === "string") {
    return { state: HOUSE_MODE_STATES.includes(raw as HouseModeState) ? (raw as HouseModeState) : "disabled" };
  }
  if (raw && typeof raw === "object" && HOUSE_MODE_STATES.includes(raw.state)) {
    return raw;
  }
  return { state: "disabled" };
}

export function guardStatus(statuses: Record<string, GuardStatus> | undefined, entityId: string): GuardStatus {
  const status = statuses?.[entityId];
  return status && GUARD_STATES.includes(status.state) ? status : { state: "idle" };
}

export function occupancyStateLabelKey(state: OccupancyAssistState | string | undefined): string {
  switch (state) {
    case "unavailable": return "presenceOccupancyStateUnavailable";
    case "occupied": return "presenceOccupancyStateOccupied";
    case "arriving_1": return "presenceOccupancyStateArriving";
    case "comfort": return "presenceOccupancyStateComfort";
    case "vacant": return "presenceOccupancyStateVacant";
    case "setback_1": return "presenceOccupancyStateSetback1";
    case "setback_2": return "presenceOccupancyStateSetback2";
    case "setback_3": return "presenceOccupancyStateSetback3";
    case "blocked": return "presenceOccupancyStateBlocked";
    default: return "presenceOccupancyStateDisabled";
  }
}

export function houseModeLabelKey(state: HouseModeState | string | undefined): string {
  switch (state) {
    case "home": return "presenceHouseModeHome";
    case "away": return "presenceHouseModeAway";
    case "away_deep": return "presenceHouseModeAwayDeep";
    case "travel": return "presenceHouseModeTravel";
    case "sleep": return "presenceHouseModeSleep";
    default: return "presenceHouseModeDisabled";
  }
}

export function guardStateLabelKey(state: GuardState | string | undefined): string {
  switch (state) {
    case "off_grace": return "presenceGuardStateOffGrace";
    case "snoozed": return "presenceGuardStateSnoozed";
    case "recovering": return "presenceGuardStateRecovering";
    case "manual_watch": return "presenceGuardStateManualWatch";
    case "activity_hold": return "presenceGuardStateActivityHold";
    case "floor_hold": return "presenceGuardStateFloorHold";
    default: return "presenceGuardStateIdle";
  }
}

export function holdConstraintLabelKey(constraint: HoldConstraint | string): string {
  switch (constraint) {
    case "absolute": return "presenceConstraintAbsolute";
    case "lower_only": return "presenceConstraintLowerOnly";
    default: return "presenceConstraintRaiseOnly";
  }
}

export type StageValidationError =
  | { index: number; code: "minutes_order" | "minutes_positive" | "temperature_missing" };

/**
 * Setback stages must have strictly ascending, positive minutes and a
 * temperature on every row (P2: an empty room only gets warmer, so the
 * backend folds them as raise-only holds; the UI only guards the ordering).
 */
export function validateSetbackStages(stages: SetbackStage[]): StageValidationError | undefined {
  let previous = 0;
  for (const [index, stage] of stages.entries()) {
    if (!Number.isFinite(stage.after_minutes) || stage.after_minutes <= 0) {
      return { index, code: "minutes_positive" };
    }
    if (stage.after_minutes <= previous) {
      return { index, code: "minutes_order" };
    }
    if (!Number.isFinite(stage.temperature)) {
      return { index, code: "temperature_missing" };
    }
    previous = stage.after_minutes;
  }
  return undefined;
}

/**
 * Arrival stages: ascending positive minutes; only the last row may release
 * to the schedule (temperature `null`).
 */
export function validateArrivalStages(stages: ArrivalStage[]): StageValidationError | undefined {
  let previous = 0;
  for (const [index, stage] of stages.entries()) {
    if (!Number.isFinite(stage.after_minutes) || stage.after_minutes <= 0) {
      return { index, code: "minutes_positive" };
    }
    if (stage.after_minutes <= previous) {
      return { index, code: "minutes_order" };
    }
    const last = index === stages.length - 1;
    if (stage.temperature === null && !last) {
      return { index, code: "temperature_missing" };
    }
    if (stage.temperature !== null && !Number.isFinite(stage.temperature)) {
      return { index, code: "temperature_missing" };
    }
    previous = stage.after_minutes;
  }
  return undefined;
}

export function stageValidationLabelKey(error: StageValidationError): string {
  switch (error.code) {
    case "minutes_order": return "presenceStageErrorOrder";
    case "minutes_positive": return "presenceStageErrorMinutes";
    default: return "presenceStageErrorTemperature";
  }
}

/** Suggest the next setback row: +30 min and +1° over the last row. */
export function nextSetbackStage(stages: SetbackStage[], unit: string | undefined, maxTemperature: number): SetbackStage {
  const last = stages[stages.length - 1];
  const step = isFahrenheit(unit) ? 2 : 1;
  if (!last) {
    return { after_minutes: 10, temperature: defaultTemperature(23, unit) };
  }
  return {
    after_minutes: last.after_minutes + 30,
    temperature: Math.min(maxTemperature, last.temperature + step),
  };
}

export function nextArrivalStage(stages: ArrivalStage[]): ArrivalStage {
  const last = stages[stages.length - 1];
  return { after_minutes: last ? last.after_minutes + 5 : 5, temperature: null };
}

function normalizeSetbackStages(raw: unknown): SetbackStage[] | undefined {
  if (!Array.isArray(raw)) {
    return undefined;
  }
  return raw
    .filter((stage): stage is Partial<SetbackStage> => Boolean(stage) && typeof stage === "object")
    .slice(0, MAX_SETBACK_STAGES)
    .map((stage) => ({
      after_minutes: integerOr(stage.after_minutes, 0),
      temperature: finiteOr(stage.temperature, Number.NaN),
    }));
}

function normalizeArrivalStages(raw: unknown): ArrivalStage[] | undefined {
  if (!Array.isArray(raw)) {
    return undefined;
  }
  return raw
    .filter((stage): stage is Partial<ArrivalStage> => Boolean(stage) && typeof stage === "object")
    .slice(0, MAX_ARRIVAL_STAGES)
    .map((stage) => ({
      after_minutes: integerOr(stage.after_minutes, 0),
      temperature: finiteOrNull(stage.temperature),
    }));
}

function entityList(value: unknown): string[] {
  return Array.isArray(value)
    ? [...new Set(value.filter((entry): entry is string => typeof entry === "string" && Boolean(entry.trim())))]
    : [];
}

function entityOrNull(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function stringOrNull(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function timeOrNull(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }
  const match = value.trim().match(/^(\d{1,2}):(\d{2})(?::\d{2})?$/);
  if (!match) {
    return null;
  }
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours > 23 || minutes > 59) {
    return null;
  }
  return `${String(hours).padStart(2, "0")}:${match[2]}`;
}

function booleanOr(value: unknown, fallback: boolean): boolean {
  return typeof value === "boolean" ? value : fallback;
}

function finiteOrNull(value: unknown): number | null {
  const number = Number(value);
  return value !== null && value !== undefined && value !== "" && Number.isFinite(number) ? number : null;
}

function finiteOr(value: unknown, fallback: number): number {
  const number = Number(value);
  return value !== null && value !== undefined && value !== "" && Number.isFinite(number) ? number : fallback;
}

function integerOr(value: unknown, fallback: number): number {
  const number = Number(value);
  return value !== null && value !== undefined && value !== "" && Number.isFinite(number) ? Math.round(number) : fallback;
}
