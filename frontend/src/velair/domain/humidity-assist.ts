import type {
  HomeAssistant,
  HumidityAssistGlobalSettings,
  HumidityAssistMeasure,
  HumidityAssistSettings,
  HumidityAssistState,
  HumidityAssistStatus,
} from "../types";
import { isFahrenheit } from "./temperature-units";

export const HUMIDITY_ASSIST_STATES: HumidityAssistState[] = [
  "disabled",
  "unavailable",
  "blocked_manual",
  "blocked_gate",
  "waiting",
  "pulsing",
  "resting",
];

export const HUMIDITY_ASSIST_MEASURES: HumidityAssistMeasure[] = ["dew_point", "relative_humidity"];
export const HUMIDITY_ASSIST_PULSE_MODES = ["cool", "dry"] as const;

export type HumidityParameterKind = "delta" | "minutes" | "count";

export type HumidityParameterDefinition = {
  field: keyof Omit<HumidityAssistGlobalSettings, "gate_entity_id">;
  kind: HumidityParameterKind;
  labelKey: string;
  helpKey: string;
  min: number;
  max: number;
  step: number;
};

export const HUMIDITY_PARAMETERS: HumidityParameterDefinition[] = [
  { field: "start_buffer", kind: "delta", labelKey: "humidityStartBuffer", helpKey: "humidityStartBufferHelp", min: 0, max: 10, step: 0.1 },
  { field: "stop_buffer", kind: "delta", labelKey: "humidityStopBuffer", helpKey: "humidityStopBufferHelp", min: 0, max: 10, step: 0.1 },
  { field: "min_on_minutes", kind: "minutes", labelKey: "humidityMinOn", helpKey: "humidityMinOnHelp", min: 1, max: 240, step: 1 },
  { field: "max_on_minutes", kind: "minutes", labelKey: "humidityMaxOn", helpKey: "humidityMaxOnHelp", min: 1, max: 720, step: 1 },
  { field: "min_off_minutes", kind: "minutes", labelKey: "humidityMinOff", helpKey: "humidityMinOffHelp", min: 0, max: 720, step: 1 },
  { field: "max_simultaneous_pulses", kind: "count", labelKey: "humidityMaxSimultaneous", helpKey: "humidityMaxSimultaneousHelp", min: 1, max: 50, step: 1 },
  { field: "emergency_margin_priority", kind: "delta", labelKey: "humidityEmergencyMarginPriority", helpKey: "humidityEmergencyMarginPriorityHelp", min: 0, max: 10, step: 0.1 },
  { field: "emergency_margin_standard", kind: "delta", labelKey: "humidityEmergencyMarginStandard", helpKey: "humidityEmergencyMarginStandardHelp", min: 0, max: 10, step: 0.1 },
  { field: "median_window_minutes", kind: "minutes", labelKey: "humidityMedianWindow", helpKey: "humidityMedianWindowHelp", min: 1, max: 240, step: 1 },
  { field: "initial_pull_down_window_minutes", kind: "minutes", labelKey: "humidityPullDownWindow", helpKey: "humidityPullDownWindowHelp", min: 0, max: 1440, step: 1 },
  { field: "initial_pull_down_max_run_minutes", kind: "minutes", labelKey: "humidityPullDownMaxRun", helpKey: "humidityPullDownMaxRunHelp", min: 1, max: 720, step: 1 },
  { field: "initial_pull_down_target_offset", kind: "delta", labelKey: "humidityPullDownOffset", helpKey: "humidityPullDownOffsetHelp", min: 0, max: 10, step: 0.1 },
];

export function humidityAssistSettings(
  raw: Partial<HumidityAssistSettings> | undefined,
): HumidityAssistSettings {
  const measure = raw?.measure === "relative_humidity" ? "relative_humidity" : "dew_point";
  return {
    enabled: Boolean(raw?.enabled),
    sensor_entity_id: typeof raw?.sensor_entity_id === "string" && raw.sensor_entity_id ? raw.sensor_entity_id : null,
    measure,
    target: finiteOrNull(raw?.target),
    priority: Boolean(raw?.priority),
    pulse_temperature: finiteOrNull(raw?.pulse_temperature),
    pulse_hvac_mode: raw?.pulse_hvac_mode === "dry" ? "dry" : "cool",
    pulse_fan_mode: typeof raw?.pulse_fan_mode === "string" && raw.pulse_fan_mode ? raw.pulse_fan_mode : null,
  };
}

export function humidityAssistGlobalSettings(
  raw: Partial<HumidityAssistGlobalSettings> | undefined,
  temperatureUnit: string | undefined,
): HumidityAssistGlobalSettings {
  const fahrenheit = isFahrenheit(temperatureUnit);
  const delta = (celsius: number, fahrenheitValue: number) => (fahrenheit ? fahrenheitValue : celsius);
  return {
    start_buffer: finiteOr(raw?.start_buffer, delta(0.2, 0.4)),
    stop_buffer: finiteOr(raw?.stop_buffer, delta(0.6, 1.1)),
    min_on_minutes: finiteOr(raw?.min_on_minutes, 10),
    max_on_minutes: finiteOr(raw?.max_on_minutes, 20),
    min_off_minutes: finiteOr(raw?.min_off_minutes, 10),
    max_simultaneous_pulses: finiteOr(raw?.max_simultaneous_pulses, 2),
    emergency_margin_priority: finiteOr(raw?.emergency_margin_priority, delta(0.3, 0.5)),
    emergency_margin_standard: finiteOr(raw?.emergency_margin_standard, delta(0.5, 0.9)),
    median_window_minutes: finiteOr(raw?.median_window_minutes, 15),
    initial_pull_down_window_minutes: finiteOr(raw?.initial_pull_down_window_minutes, 90),
    initial_pull_down_max_run_minutes: finiteOr(raw?.initial_pull_down_max_run_minutes, 45),
    initial_pull_down_target_offset: finiteOr(raw?.initial_pull_down_target_offset, delta(0.6, 1.1)),
    gate_entity_id: typeof raw?.gate_entity_id === "string" && raw.gate_entity_id ? raw.gate_entity_id : null,
  };
}

export type HumiditySensorOption = {
  entityId: string;
  label: string;
};

export function humiditySensorOptions(
  hass: HomeAssistant | undefined,
  selectedEntityId: string,
  measure: HumidityAssistMeasure,
): HumiditySensorOption[] {
  const states = hass?.states ?? {};
  const options = Object.entries(states)
    .filter(([entityId, state]) => {
      if (!entityId.startsWith("sensor.")) {
        return false;
      }
      if (entityId === selectedEntityId) {
        return true;
      }
      const attributes = state.attributes ?? {};
      const unit = String(attributes.unit_of_measurement ?? "");
      const name = `${entityId} ${attributes.friendly_name ?? ""}`.toLowerCase();
      if (measure === "relative_humidity") {
        return attributes.device_class === "humidity" || unit === "%";
      }
      return (
        name.includes("dew")
        || name.includes("rocío")
        || name.includes("taupunkt")
        || name.includes("rosée")
        || (attributes.device_class === "temperature" && name.includes("point"))
      );
    })
    .map(([entityId, state]) => {
      const name = state.attributes?.friendly_name ?? entityId;
      const unit = state.attributes?.unit_of_measurement ?? "";
      const reading = Number.isFinite(Number(state.state)) ? `${state.state}${unit ? ` ${unit}` : ""}` : "";
      return {
        entityId,
        label: reading ? `${name} (${reading})` : `${name} (${entityId})`,
      };
    })
    .sort((left, right) => left.label.localeCompare(right.label));

  if (selectedEntityId && !options.some((option) => option.entityId === selectedEntityId)) {
    options.unshift({ entityId: selectedEntityId, label: selectedEntityId });
  }
  return options;
}

export type GateEntityOption = {
  entityId: string;
  label: string;
};

export function gateEntityOptions(hass: HomeAssistant | undefined, selectedEntityId: string): GateEntityOption[] {
  const states = hass?.states ?? {};
  const options = Object.entries(states)
    .filter(([entityId]) =>
      entityId.startsWith("input_boolean.")
      || entityId.startsWith("binary_sensor.")
      || entityId.startsWith("switch.")
      || entityId === selectedEntityId)
    .map(([entityId, state]) => ({
      entityId,
      label: `${state.attributes?.friendly_name ?? entityId} (${entityId})`,
    }))
    .sort((left, right) => left.label.localeCompare(right.label));
  if (selectedEntityId && !options.some((option) => option.entityId === selectedEntityId)) {
    options.unshift({ entityId: selectedEntityId, label: selectedEntityId });
  }
  return options;
}

export function humidityStateLabelKey(state: HumidityAssistState | string | undefined): string {
  switch (state) {
    case "unavailable":
      return "humidityStateUnavailable";
    case "blocked_manual":
      return "humidityStateBlockedManual";
    case "blocked_gate":
      return "humidityStateBlockedGate";
    case "waiting":
      return "humidityStateWaiting";
    case "pulsing":
      return "humidityStatePulsing";
    case "resting":
      return "humidityStateResting";
    default:
      return "humidityStateDisabled";
  }
}

export function humidityReasonLabelKey(reason: string | null | undefined): string | undefined {
  switch (reason) {
    case "no_sensor":
      return "humidityReasonNoSensor";
    case "no_target":
      return "humidityReasonNoTarget";
    case "no_pulse_temperature":
      return "humidityReasonNoPulseTemperature";
    case "climate_unavailable":
      return "humidityReasonClimateUnavailable";
    case "sensor_unavailable":
      return "humidityReasonSensorUnavailable";
    default:
      return undefined;
  }
}

export function humidityNextTransitionMinutes(
  nextTransitionAt: string | null | undefined,
  now: Date,
): number | undefined {
  if (!nextTransitionAt) {
    return undefined;
  }
  const when = new Date(nextTransitionAt).getTime();
  if (!Number.isFinite(when)) {
    return undefined;
  }
  return Math.max(0, Math.ceil((when - now.getTime()) / 60_000));
}

export function formatHumidityValue(
  value: number | null | undefined,
  unit: string | undefined,
): string {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return "—";
  }
  const rounded = Math.round(value * 10) / 10;
  const text = Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
  return unit ? `${text} ${unit}` : text;
}

export function humidityStatusForZone(
  statuses: Record<string, HumidityAssistStatus> | undefined,
  entityId: string,
  settings: HumidityAssistSettings,
): HumidityAssistStatus {
  return statuses?.[entityId] ?? {
    state: "disabled",
    enabled: settings.enabled,
    configured: Boolean(settings.sensor_entity_id && settings.target !== null),
  };
}

export function humidityExcess(status: HumidityAssistStatus): number | undefined {
  if (typeof status.excess === "number" && Number.isFinite(status.excess)) {
    return status.excess;
  }
  const target = status.target;
  const values = [status.raw, status.median].filter(
    (value): value is number => typeof value === "number" && Number.isFinite(value),
  );
  if (typeof target !== "number" || !values.length) {
    return undefined;
  }
  return Math.max(...values) - target;
}

function finiteOrNull(value: unknown): number | null {
  const number = Number(value);
  return value !== null && value !== undefined && value !== "" && Number.isFinite(number) ? number : null;
}

function finiteOr(value: unknown, fallback: number): number {
  const number = Number(value);
  return value !== null && value !== undefined && value !== "" && Number.isFinite(number) ? number : fallback;
}
