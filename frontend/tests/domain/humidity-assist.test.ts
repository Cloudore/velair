import { describe, expect, it } from "vitest";

import {
  HUMIDITY_PARAMETERS,
  formatHumidityValue,
  gateEntityOptions,
  humidityAssistGlobalSettings,
  humidityAssistSettings,
  humidityExcess,
  humidityNextTransitionMinutes,
  humidityReasonLabelKey,
  humiditySensorOptions,
  humidityStateLabelKey,
  humidityStatusForZone,
} from "../../src/velair/domain/humidity-assist";
import type { HomeAssistant } from "../../src/velair/types";

describe("humidity assist settings", () => {
  it("normalizes missing and invalid zone settings to safe defaults", () => {
    expect(humidityAssistSettings(undefined)).toEqual({
      enabled: false,
      sensor_entity_id: null,
      measure: "dew_point",
      target: null,
      priority: false,
      pulse_temperature: null,
      pulse_hvac_mode: "cool",
      pulse_fan_mode: null,
    });
    expect(
      humidityAssistSettings({
        enabled: true,
        sensor_entity_id: "sensor.den_dew_point",
        measure: "relative_humidity",
        target: "61" as unknown as number,
        priority: true,
        pulse_temperature: Number.NaN,
        pulse_hvac_mode: "dry",
        pulse_fan_mode: "",
      }),
    ).toEqual({
      enabled: true,
      sensor_entity_id: "sensor.den_dew_point",
      measure: "relative_humidity",
      target: 61,
      priority: true,
      pulse_temperature: null,
      pulse_hvac_mode: "dry",
      pulse_fan_mode: null,
    });
  });

  it("uses unit-aware defaults for the shared parameters", () => {
    const celsius = humidityAssistGlobalSettings(undefined, "°C");
    const fahrenheit = humidityAssistGlobalSettings({ min_on_minutes: 12 }, "°F");

    expect(celsius.start_buffer).toBe(0.2);
    expect(celsius.stop_buffer).toBe(0.6);
    expect(celsius.max_simultaneous_pulses).toBe(2);
    expect(celsius.gate_entity_id).toBeNull();
    expect(fahrenheit.start_buffer).toBe(0.4);
    expect(fahrenheit.initial_pull_down_target_offset).toBe(1.1);
    expect(fahrenheit.min_on_minutes).toBe(12);
    expect(HUMIDITY_PARAMETERS.map((parameter) => parameter.field)).toEqual([
      "start_buffer",
      "stop_buffer",
      "min_on_minutes",
      "max_on_minutes",
      "min_off_minutes",
      "max_simultaneous_pulses",
      "emergency_margin_priority",
      "emergency_margin_standard",
      "median_window_minutes",
      "initial_pull_down_window_minutes",
      "initial_pull_down_max_run_minutes",
      "initial_pull_down_target_offset",
    ]);
  });

  it("lists matching sensors and keeps the selected entity available", () => {
    const hass = {
      states: {
        "sensor.den_dew_point": {
          state: "21.4",
          attributes: { friendly_name: "Den dew point", unit_of_measurement: "°C", device_class: "temperature" },
        },
        "sensor.den_humidity": {
          state: "58",
          attributes: { friendly_name: "Den humidity", unit_of_measurement: "%", device_class: "humidity" },
        },
        "sensor.den_temperature": {
          state: "24",
          attributes: { friendly_name: "Den temperature", unit_of_measurement: "°C", device_class: "temperature" },
        },
        "input_boolean.budget": { state: "on", attributes: { friendly_name: "Budget exhausted" } },
      },
    } as unknown as HomeAssistant;

    expect(humiditySensorOptions(hass, "", "dew_point").map((option) => option.entityId)).toEqual([
      "sensor.den_dew_point",
    ]);
    expect(humiditySensorOptions(hass, "", "relative_humidity").map((option) => option.entityId)).toEqual([
      "sensor.den_humidity",
    ]);
    expect(humiditySensorOptions(hass, "sensor.missing", "dew_point")[0]).toEqual({
      entityId: "sensor.missing",
      label: "sensor.missing",
    });
    expect(humiditySensorOptions(hass, "", "dew_point")[0].label).toBe("Den dew point (21.4 °C)");
    expect(gateEntityOptions(hass, "").map((option) => option.entityId)).toEqual(["input_boolean.budget"]);
  });

  it("maps states, reasons, countdowns, and formatted values", () => {
    expect(humidityStateLabelKey("pulsing")).toBe("humidityStatePulsing");
    expect(humidityStateLabelKey("blocked_gate")).toBe("humidityStateBlockedGate");
    expect(humidityStateLabelKey(undefined)).toBe("humidityStateDisabled");
    expect(humidityReasonLabelKey("no_sensor")).toBe("humidityReasonNoSensor");
    expect(humidityReasonLabelKey(null)).toBeUndefined();

    const now = new Date("2026-08-10T15:00:00Z");
    expect(humidityNextTransitionMinutes("2026-08-10T15:10:00Z", now)).toBe(10);
    expect(humidityNextTransitionMinutes("2026-08-10T14:50:00Z", now)).toBe(0);
    expect(humidityNextTransitionMinutes(null, now)).toBeUndefined();
    expect(humidityNextTransitionMinutes("garbage", now)).toBeUndefined();

    expect(formatHumidityValue(22.46, "°C")).toBe("22.5 °C");
    expect(formatHumidityValue(60, "%")).toBe("60 %");
    expect(formatHumidityValue(null, "%")).toBe("—");
  });

  it("derives status fallbacks and excess", () => {
    const settings = humidityAssistSettings({ enabled: true, sensor_entity_id: "sensor.x", target: 22 });
    expect(humidityStatusForZone(undefined, "climate.den", settings)).toEqual({
      state: "disabled",
      enabled: true,
      configured: true,
    });
    expect(humidityExcess({ state: "waiting", enabled: true, configured: true, excess: 0.4 })).toBe(0.4);
    expect(
      humidityExcess({ state: "waiting", enabled: true, configured: true, target: 22, raw: 22.5, median: 22.1 }),
    ).toBeCloseTo(0.5);
    expect(humidityExcess({ state: "waiting", enabled: true, configured: true })).toBeUndefined();
  });
});
