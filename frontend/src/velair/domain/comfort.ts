import type {
  ComfortMetricAssessment,
  HomeAssistant,
  ComfortSettings,
} from "../types";

export type EntityOption = {
  entityId: string;
  label: string;
};

export function comfortSettings(
  settings: Partial<ComfortSettings> | undefined,
  unit: string,
): ComfortSettings {
  return {
    ...defaultComfortSettings(unit),
    ...settings,
  };
}

export function defaultComfortSettings(unit: string): ComfortSettings {
  const isFahrenheit = unit.toUpperCase().includes("F");
  return {
    enabled: false,
    temperature_entity_id: null,
    humidity_enabled: true,
    humidity_entity_id: null,
    co2_entity_id: null,
    temperature_min: isFahrenheit ? 68 : 20,
    temperature_max: isFahrenheit ? 75 : 24,
    humidity_min: 40,
    humidity_max: 60,
    co2_attention: 1000,
    co2_poor: 1500,
    stale_after_minutes: 120,
  };
}

export function comfortSensorOptions(
  hass: HomeAssistant | undefined,
  value: string,
  kind: "temperature" | "humidity" | "co2",
): EntityOption[] {
  const states = hass?.states ?? {};
  const options = Object.entries(states)
    .filter(([entityId, state]) => {
      if (entityId === value) {
        return true;
      }
      if (!entityId.startsWith("sensor.")) {
        return false;
      }
      const deviceClass = String(state.attributes?.device_class ?? "").toLowerCase();
      const unit = String(state.attributes?.unit_of_measurement ?? "").toLowerCase();
      if (kind === "temperature") {
        return deviceClass === "temperature" || unit.includes("°");
      }
      if (kind === "humidity") {
        return deviceClass === "humidity" || unit === "%";
      }
      return deviceClass === "carbon_dioxide" || unit === "ppm";
    })
    .map(([entityId, state]) => ({
      entityId,
      label: state.attributes?.friendly_name || entityId,
    }))
    .sort((first, second) => first.label.localeCompare(second.label));

  if (value && !options.some((option) => option.entityId === value)) {
    options.unshift({ entityId: value, label: value });
  }
  return options;
}

export function comfortMetricIsCurrent(
  metric: ComfortMetricAssessment | undefined,
): metric is ComfortMetricAssessment & { value: number; min: number; max: number } {
  return (
    metric?.availability === "current"
    && typeof metric.value === "number"
    && typeof metric.min === "number"
    && typeof metric.max === "number"
  );
}

export function comfortRangePosition(
  value: number,
  minimum: number,
  maximum: number,
): number {
  const span = Math.max(maximum - minimum, 0.1);
  const domainMinimum = minimum - span;
  const domainMaximum = maximum + span;
  const position = ((value - domainMinimum) / (domainMaximum - domainMinimum)) * 100;
  return Math.max(4, Math.min(96, position));
}

export function comfortCo2Position(
  value: number,
  attention: number,
  poor: number,
): number {
  const domainMinimum = Math.min(400, attention * 0.5);
  const domainMaximum = Math.max(poor * 1.25, domainMinimum + 1);
  const position = ((value - domainMinimum) / (domainMaximum - domainMinimum)) * 100;
  return Math.max(4, Math.min(96, position));
}
