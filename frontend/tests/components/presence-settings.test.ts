import { describe, expect, it } from "vitest";

import {
  activityHold,
  defaultTemperature,
  guardStatus,
  guardsGlobalSettings,
  guardsZoneSettings,
  houseModeStatus,
  houseModesGlobalSettings,
  houseModesZoneSettings,
  nextArrivalStage,
  nextSetbackStage,
  occupancyAssistSettings,
  occupancyAssistStatus,
  validateArrivalStages,
  validateSetbackStages,
} from "../../src/velair/components/presence/presence-settings";
import {
  occupancyEntityOptions,
  onOffEntityOptions,
  presenceEntityOptions,
} from "../../src/velair/components/presence/entity-options";
import type { HomeAssistant } from "../../src/velair/types";

describe("occupancy assist settings", () => {
  it("fills the spec defaults in Celsius", () => {
    expect(occupancyAssistSettings(undefined, "°C")).toEqual({
      enabled: false,
      occupancy_entity_id: null,
      blocking_entity_ids: [],
      corroboration_entity_ids: [],
      setback_stages: [
        { after_minutes: 10, temperature: 23 },
        { after_minutes: 30, temperature: 25 },
        { after_minutes: 90, temperature: 26 },
      ],
      setback_hvac_mode: "cool",
      setback_fan_mode: "auto",
      arrival_stages: [
        { after_minutes: 5, temperature: 26 },
        { after_minutes: 10, temperature: null },
      ],
      arrival_exit_grace_minutes: 2,
      comfort_temperature: 26,
      sync_comfort_to_schedule: true,
    });
  });

  it("converts the temperature defaults for Fahrenheit panels", () => {
    const settings = occupancyAssistSettings({}, "°F");
    expect(settings.setback_stages.map((stage) => stage.temperature)).toEqual([73, 77, 79]);
    expect(settings.arrival_stages[0].temperature).toBe(79);
    expect(settings.comfort_temperature).toBe(79);
    expect(defaultTemperature(29, "°F")).toBe(84);
  });

  it("keeps stored values, drops unknown keys, and caps the stage lists", () => {
    const settings = occupancyAssistSettings({
      enabled: true,
      occupancy_entity_id: "binary_sensor.den_occupied",
      blocking_entity_ids: ["input_boolean.projector", "input_boolean.projector", ""],
      setback_stages: [
        { after_minutes: 5, temperature: 24 },
        { after_minutes: 20, temperature: 25 },
        { after_minutes: 60, temperature: 26 },
        { after_minutes: 120, temperature: 27 },
      ],
      setback_hvac_mode: null,
      arrival_stages: [{ after_minutes: 3, temperature: null }],
      comfort_temperature: "25.5",
      sync_comfort_to_schedule: false,
      unknown_key: "ignored",
    } as never, "°C");

    expect(settings.enabled).toBe(true);
    expect(settings.blocking_entity_ids).toEqual(["input_boolean.projector"]);
    expect(settings.setback_stages).toHaveLength(3);
    expect(settings.setback_hvac_mode).toBeNull();
    expect(settings.setback_fan_mode).toBe("auto");
    expect(settings.arrival_stages).toEqual([{ after_minutes: 3, temperature: null }]);
    expect(settings.comfort_temperature).toBe(25.5);
    expect(settings.sync_comfort_to_schedule).toBe(false);
    expect("unknown_key" in settings).toBe(false);
  });

  it("validates setback stage ordering", () => {
    expect(validateSetbackStages([
      { after_minutes: 10, temperature: 23 },
      { after_minutes: 30, temperature: 25 },
    ])).toBeUndefined();
    expect(validateSetbackStages([
      { after_minutes: 10, temperature: 23 },
      { after_minutes: 10, temperature: 25 },
    ])).toEqual({ index: 1, code: "minutes_order" });
    expect(validateSetbackStages([
      { after_minutes: 30, temperature: 23 },
      { after_minutes: 5, temperature: 25 },
    ])).toEqual({ index: 1, code: "minutes_order" });
    expect(validateSetbackStages([{ after_minutes: 0, temperature: 23 }]))
      .toEqual({ index: 0, code: "minutes_positive" });
    expect(validateSetbackStages([{ after_minutes: 10, temperature: Number.NaN }]))
      .toEqual({ index: 0, code: "temperature_missing" });
    expect(validateSetbackStages([])).toBeUndefined();
  });

  it("only lets the last arrival stage release to the schedule", () => {
    expect(validateArrivalStages([
      { after_minutes: 5, temperature: 26 },
      { after_minutes: 10, temperature: null },
    ])).toBeUndefined();
    expect(validateArrivalStages([
      { after_minutes: 5, temperature: null },
      { after_minutes: 10, temperature: 26 },
    ])).toEqual({ index: 0, code: "temperature_missing" });
    expect(validateArrivalStages([
      { after_minutes: 10, temperature: 26 },
      { after_minutes: 5, temperature: null },
    ])).toEqual({ index: 1, code: "minutes_order" });
  });

  it("suggests ascending rows when adding stages", () => {
    expect(nextSetbackStage([{ after_minutes: 10, temperature: 23 }], "°C", 30))
      .toEqual({ after_minutes: 40, temperature: 24 });
    expect(nextSetbackStage([{ after_minutes: 10, temperature: 30 }], "°C", 30).temperature).toBe(30);
    expect(nextSetbackStage([], "°F", 95)).toEqual({ after_minutes: 10, temperature: 73 });
    expect(nextArrivalStage([{ after_minutes: 5, temperature: 26 }])).toEqual({ after_minutes: 10, temperature: null });
  });

  it("derives a status when the backend has not reported one yet", () => {
    const enabled = occupancyAssistSettings({ enabled: true }, "°C");
    expect(occupancyAssistStatus(undefined, "climate.den", enabled)).toEqual({ state: "unavailable" });
    expect(occupancyAssistStatus({}, "climate.den", occupancyAssistSettings({}, "°C"))).toEqual({ state: "disabled" });
    expect(occupancyAssistStatus({ "climate.den": { state: "setback_2", stage: 2 } }, "climate.den", enabled))
      .toEqual({ state: "setback_2", stage: 2 });
  });
});

describe("house modes settings", () => {
  it("fills the global defaults", () => {
    expect(houseModesGlobalSettings(undefined, "°C")).toEqual({
      presence_entity_ids: [],
      presence_corroboration_entity_ids: [],
      presence_corroboration_quiet_minutes: 15,
      away_after_minutes: 60,
      away_deep_after_minutes: 360,
      arrival_release_minutes: 3,
      sleep_entity_id: null,
      presleep_time: "21:00",
      presleep_duration_minutes: 240,
      travel_entity_id: null,
      travel_park_temperature: 29,
      travel_park_hvac_mode: "cool",
      travel_park_fan_mode: "auto",
      travel_freeze_off_heads: true,
      travel_enable_humidity_assist: true,
      travel_auto_exit_on_arrival: false,
    });
    expect(houseModesGlobalSettings({}, "°F").travel_park_temperature).toBe(84);
  });

  it("normalizes the pre-sleep time and keeps an explicit null", () => {
    expect(houseModesGlobalSettings({ presleep_time: "9:30" }, "°C").presleep_time).toBe("09:30");
    expect(houseModesGlobalSettings({ presleep_time: "21:00:00" }, "°C").presleep_time).toBe("21:00");
    expect(houseModesGlobalSettings({ presleep_time: null }, "°C").presleep_time).toBeNull();
    expect(houseModesGlobalSettings({ presleep_time: "25:00" }, "°C").presleep_time).toBeNull();
  });

  it("fills the zone defaults", () => {
    expect(houseModesZoneSettings(undefined, "°C")).toEqual({
      away_enabled: true,
      away_temperature: 26,
      away_deep_temperature: null,
      sleep_enabled: true,
      sleep_temperature: 26,
      sleep_constraint: "raise_only",
      sleep_fan_mode: null,
      sleep_minimum_temperature: null,
      presleep_temperature: null,
      travel_park_enabled: true,
    });
    expect(houseModesZoneSettings({ sleep_constraint: "absolute", sleep_fan_mode: "high", away_deep_temperature: 27 }, "°C"))
      .toMatchObject({ sleep_constraint: "absolute", sleep_fan_mode: "high", away_deep_temperature: 27 });
    expect(houseModesZoneSettings({ sleep_constraint: "lower_only" as never }, "°C").sleep_constraint).toBe("raise_only");
  });

  it("accepts the house mode either as a state string or as the status object", () => {
    expect(houseModeStatus("away")).toEqual({ state: "away" });
    expect(houseModeStatus({ state: "travel", sleeping: true })).toEqual({ state: "travel", sleeping: true });
    expect(houseModeStatus("bogus")).toEqual({ state: "disabled" });
    expect(houseModeStatus(undefined)).toEqual({ state: "disabled" });
  });
});

describe("guards settings", () => {
  it("fills the global defaults", () => {
    expect(guardsGlobalSettings(undefined)).toEqual({
      never_off_enabled: true,
      never_off_grace_minutes: 10,
      never_off_snooze_minutes: 1440,
      never_off_snooze_release_vacant_minutes: 30,
      never_off_respect_travel: true,
      manual_release_enabled: true,
      manual_lease_minutes: 30,
      manual_release_vacant_minutes: 60,
      manual_release_on_travel: true,
      owner_entity_ids: [],
      owner_away_minutes: 4,
      manual_release_below_minimum: true,
    });
  });

  it("normalizes activity holds with their defaults", () => {
    expect(guardsZoneSettings(undefined, "°C")).toEqual({ never_off_enabled: true, manual_release_below_minimum_action: "release", activity_holds: [] });
    expect(activityHold({ entity_id: "input_boolean.kitchen_cooking_mode" }, "°C")).toEqual({
      entity_id: "input_boolean.kitchen_cooking_mode",
      temperature: 25,
      constraint: "lower_only",
      hvac_mode: "cool",
      release_delay_minutes: 10,
      pause_id: "activity",
      label: "",
    });
    expect(activityHold({ constraint: "absolute", hvac_mode: null, pause_id: " ", label: "Cooking" }, "°F"))
      .toMatchObject({ constraint: "absolute", hvac_mode: null, pause_id: "activity", label: "Cooking", temperature: 77 });
  });

  it("falls back to an idle guard status", () => {
    expect(guardStatus(undefined, "climate.den")).toEqual({ state: "idle" });
    expect(guardStatus({ "climate.den": { state: "snoozed", snooze_until: "2026-09-05T10:00:00Z" } }, "climate.den"))
      .toEqual({ state: "snoozed", snooze_until: "2026-09-05T10:00:00Z" });
  });
});

describe("entity options", () => {
  const hass = {
    states: {
      "binary_sensor.den_motion": { state: "on", attributes: { friendly_name: "Den motion", device_class: "motion" } },
      "binary_sensor.door": { state: "off", attributes: { friendly_name: "Door", device_class: "door" } },
      "binary_sensor.study_presence": { state: "off", attributes: { friendly_name: "Study presence", device_class: "occupancy" } },
      "input_boolean.sleep_mode": { state: "off", attributes: { friendly_name: "Sleep mode" } },
      "switch.fan": { state: "off", attributes: { friendly_name: "Fan" } },
      "person.izzat": { state: "home", attributes: { friendly_name: "Izzat" } },
      "device_tracker.phone": { state: "not_home", attributes: { friendly_name: "Phone" } },
      "sensor.temperature": { state: "22", attributes: { friendly_name: "Temperature" } },
    },
  } as unknown as HomeAssistant;

  it("lists on/off entities and floats occupancy sensors to the top", () => {
    expect(occupancyEntityOptions(hass).map((option) => option.entityId)).toEqual([
      "binary_sensor.den_motion",
      "binary_sensor.study_presence",
      "binary_sensor.door",
      "switch.fan",
      "input_boolean.sleep_mode",
    ]);
    expect(onOffEntityOptions(hass).map((option) => option.entityId)).toEqual([
      "binary_sensor.den_motion",
      "binary_sensor.door",
      "switch.fan",
      "input_boolean.sleep_mode",
      "binary_sensor.study_presence",
    ]);
  });

  it("lists presence entities and keeps unknown selections", () => {
    expect(presenceEntityOptions(hass, ["person.marianne"]).map((option) => option.entityId)).toEqual([
      "person.marianne",
      "person.izzat",
      "device_tracker.phone",
    ]);
  });
});
