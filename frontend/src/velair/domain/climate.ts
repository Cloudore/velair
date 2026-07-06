import { HVAC_MODES } from "../constants";
import type { HassState } from "../types";

export type ClimateCapabilityKey =
  | "currentTemperature"
  | "targetTemperature"
  | "currentHumidity"
  | "supportedPresetModes"
  | "supportedFanModes"
  | "supportedSwingModes"
  | "supportedHorizontalSwingModes"
  | "temperatureRange";

export type ClimateCapability = {
  icon: string;
  labelKey: ClimateCapabilityKey;
};

export function climateStateSignature(state?: HassState): string {
  const attributes = state?.attributes;
  return JSON.stringify([
    state?.state ?? "",
    attributes?.current_temperature ?? null,
    attributes?.temperature ?? null,
    attributes?.hvac_action ?? "",
    attributes?.friendly_name ?? "",
    attributes?.unit_of_measurement ?? "",
    attributes?.hvac_modes ?? [],
    attributes?.min_temp ?? null,
    attributes?.max_temp ?? null,
    attributes?.target_temp_step ?? null,
    attributes?.fan_mode ?? null,
    attributes?.current_humidity ?? null,
    attributes?.humidity ?? null,
    attributes?.min_humidity ?? null,
    attributes?.max_humidity ?? null,
    attributes?.preset_mode ?? null,
    attributes?.preset_modes ?? [],
    attributes?.fan_modes ?? [],
    attributes?.swing_mode ?? null,
    attributes?.swing_modes ?? [],
    attributes?.swing_horizontal_mode ?? null,
    attributes?.swing_horizontal_modes ?? [],
  ]);
}

export function climateModeIcon(mode?: string): string | undefined {
  switch (mode) {
    case "auto":
      return "mdi:autorenew";
    case "cool":
      return "mdi:snowflake";
    case "dry":
      return "mdi:water-percent";
    case "fan_only":
      return "mdi:fan";
    case "heat":
      return "mdi:fire";
    case "heat_cool":
      return "mdi:sun-snowflake";
    case "off":
      return "mdi:power";
    default:
      return undefined;
  }
}

export function modeClassName(mode: string): string {
  return mode.replaceAll("_", "-");
}

export function entityTemperatureLimits(state?: HassState): [number, number] {
  const minTemperature = coerceNumber(state?.attributes?.min_temp, 5);
  const maxTemperature = coerceNumber(state?.attributes?.max_temp, 35);
  return minTemperature < maxTemperature ? [minTemperature, maxTemperature] : [5, 35];
}

export function entityTemperatureStep(state?: HassState): number {
  const step = coerceNumber(state?.attributes?.target_temp_step, 0.5);
  return step > 0 ? step : 0.5;
}

export function climateSupportedModes(state?: HassState): string[] {
  const modes = state?.attributes?.hvac_modes;
  if (!Array.isArray(modes)) {
    return [];
  }

  return modes.filter((mode): mode is string => typeof mode === "string");
}

export function climateFanModeOptions(state?: HassState): string[] {
  return stringArrayAttribute(state, "fan_modes");
}

export function climatePresetModeOptions(state?: HassState): string[] {
  return stringArrayAttribute(state, "preset_modes");
}

export function climateSwingModeOptions(state?: HassState): string[] {
  return stringArrayAttribute(state, "swing_modes");
}

export function climateSwingHorizontalModeOptions(state?: HassState): string[] {
  return stringArrayAttribute(state, "swing_horizontal_modes");
}

export function climateHumidityLimits(state?: HassState): [number, number] | undefined {
  const minHumidity = coerceNumber(state?.attributes?.min_humidity, Number.NaN);
  const maxHumidity = coerceNumber(state?.attributes?.max_humidity, Number.NaN);
  if (
    !Number.isFinite(minHumidity) &&
    !Number.isFinite(maxHumidity) &&
    typeof state?.attributes?.humidity !== "number"
  ) {
    return undefined;
  }
  const minimum = Number.isFinite(minHumidity) ? minHumidity : 0;
  const maximum = Number.isFinite(maxHumidity) ? maxHumidity : 100;
  return minimum < maximum ? [minimum, maximum] : undefined;
}

export function uniqueKnownHvacModes(modes: string[]): string[] {
  const supportedModes = new Set(modes);
  return HVAC_MODES.filter((mode) => supportedModes.has(mode));
}

export function climateCapabilities(state?: HassState): ClimateCapability[] {
  const attributes = state?.attributes ?? {};
  const items: ClimateCapability[] = [];

  if (typeof attributes.current_temperature === "number") {
    items.push({ icon: "mdi:thermometer", labelKey: "currentTemperature" });
  }
  if (typeof attributes.temperature === "number") {
    items.push({ icon: "mdi:thermostat", labelKey: "targetTemperature" });
  }
  if (typeof attributes.current_humidity === "number" || typeof attributes.humidity === "number") {
    items.push({ icon: "mdi:water-percent", labelKey: "currentHumidity" });
  }
  if (Array.isArray(attributes.preset_modes) && attributes.preset_modes.length) {
    items.push({ icon: "mdi:tune-variant", labelKey: "supportedPresetModes" });
  }
  if (Array.isArray(attributes.fan_modes) && attributes.fan_modes.length) {
    items.push({ icon: "mdi:fan", labelKey: "supportedFanModes" });
  }
  if (Array.isArray(attributes.swing_modes) && attributes.swing_modes.length) {
    items.push({ icon: "mdi:swap-vertical", labelKey: "supportedSwingModes" });
  }
  if (Array.isArray(attributes.swing_horizontal_modes) && attributes.swing_horizontal_modes.length) {
    items.push({ icon: "mdi:swap-horizontal", labelKey: "supportedHorizontalSwingModes" });
  }
  if (typeof attributes.target_temp_low === "number" || typeof attributes.target_temp_high === "number") {
    items.push({ icon: "mdi:thermometer-lines", labelKey: "temperatureRange" });
  }

  return items;
}

function coerceNumber(value: unknown, fallback: number): number {
  const numberValue = Number(value);
  return Number.isFinite(numberValue) ? numberValue : fallback;
}

function stringArrayAttribute(state: HassState | undefined, attribute: string): string[] {
  const value = state?.attributes?.[attribute as keyof NonNullable<HassState["attributes"]>];
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}
