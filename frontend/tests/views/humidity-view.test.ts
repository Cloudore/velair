// @vitest-environment jsdom

import { render } from "lit";
import { describe, expect, it, vi } from "vitest";

import type { VelairViewHost } from "../../src/velair/host-types";
import { renderHumidityView } from "../../src/velair/views/humidity-view";

function host(options: {
  expandedZoneIds?: string[];
  compliant?: boolean;
  entityExists?: boolean;
} = {}) {
  const saveZoneHumidityAssist = vi.fn(async () => {});
  const saveHumidityAssistSettings = vi.fn(async () => {});
  const toggleHumidityZone = vi.fn();
  const viewHost = {
    _data: {
      configured_entities: ["climate.den", "climate.guest"],
      humidity_assist_compliant: options.compliant ?? false,
      settings: {
        first_weekday: "monday",
        zone_order: [],
        humidity_assist: { min_on_minutes: 12, gate_entity_id: "input_boolean.budget" },
      },
      zones: {
        "climate.den": {
          enabled: true,
          schedule: {},
          humidity_assist: {
            enabled: true,
            sensor_entity_id: "sensor.den_dew_point",
            measure: "dew_point",
            target: 22,
            priority: true,
            pulse_temperature: 24,
            pulse_hvac_mode: "cool",
            pulse_fan_mode: "auto",
          },
        },
        "climate.guest": {
          enabled: true,
          schedule: {},
          humidity_assist: { enabled: false },
        },
      },
      humidity_assist: {
        "climate.den": {
          state: "pulsing",
          decision: "start",
          enabled: true,
          configured: true,
          unit: "°C",
          target: 22,
          effective_target: 21.4,
          raw: 22.6,
          median: 22.3,
          priority: true,
          gate_active: true,
          pull_down_active: true,
          next_transition_at: "2026-08-10T15:10:00Z",
        },
        "climate.guest": {
          state: "disabled",
          reason: "no_sensor",
          enabled: false,
          configured: false,
        },
      },
      next_events: [],
    },
    hass: {
      states: {
        "sensor.den_dew_point": {
          state: "22.6",
          attributes: { friendly_name: "Den dew point", unit_of_measurement: "°C" },
        },
        "input_boolean.budget": { state: "on", attributes: { friendly_name: "Budget" } },
      },
    },
    _currentTimelineNow: () => new Date("2026-08-10T15:00:00Z"),
    _entityExists: () => options.entityExists ?? true,
    _entityFanModeOptions: () => ["auto", "low", "high"],
    _entityTemperatureLimits: () => [16, 30] as [number, number],
    _entityTemperatureStep: () => 0.5,
    _expandedHumidityZones: new Set(options.expandedZoneIds ?? []),
    _friendlyEntityName: (entityId: string) => (entityId === "climate.den" ? "Den" : "Guest room"),
    _modeLabel: (mode: string) => `mode:${mode}`,
    _saveHumidityAssistSettings: saveHumidityAssistSettings,
    _saveZoneHumidityAssist: saveZoneHumidityAssist,
    _settingsSaving: false,
    _t: (key: string, replacements?: Record<string, string | number>) =>
      replacements ? `${key}:${Object.values(replacements).join(":")}` : key,
    _temperatureUnit: () => "°C",
    _toggleHumidityZone: toggleHumidityZone,
  } as unknown as VelairViewHost;
  return { saveHumidityAssistSettings, saveZoneHumidityAssist, toggleHumidityZone, viewHost };
}

describe("humidity view", () => {
  it("renders every zone with a state chip, readings, and a countdown", () => {
    const { viewHost } = host();
    const container = document.createElement("div");

    render(renderHumidityView(viewHost, ["climate.den", "climate.guest"]), container);

    expect(container.querySelector(".humidity-intro")?.textContent).toContain("humidityIntroTitle");
    expect(container.querySelector(".humidity-compliance")?.textContent).toContain("humidityNotCompliant");
    const chips = [...container.querySelectorAll(".humidity-chip")].map((chip) => chip.textContent?.trim());
    expect(chips).toEqual(["humidityStatePulsing", "humidityStateDisabled"]);
    expect(container.querySelector(".humidity-chip.state-pulsing")).not.toBeNull();
    expect(container.querySelector(".humidity-priority-badge")?.textContent).toContain("humidityPriorityBadge");
    const metrics = [...container.querySelectorAll(".humidity-metric strong")].map((element) => element.textContent?.trim());
    expect(metrics).toEqual(["22.6 °C", "22.3 °C", "21.4 °C", "humidityNextTransitionIn:10"]);
    expect(container.querySelector(".humidity-metric em")?.textContent).toContain("humidityPullDownActive");
    expect(container.querySelector(".humidity-flag.gate")?.textContent).toContain("humidityGateActive");
    expect(container.querySelector(".humidity-flag.decision")?.textContent).toContain("humidityDecision:start");
    expect(container.querySelector(".humidity-reason")?.textContent).toContain("humidityReasonNoSensor");
  });

  it("shows the compliant signal when every zone is at target", () => {
    const { viewHost } = host({ compliant: true });
    const container = document.createElement("div");

    render(renderHumidityView(viewHost, ["climate.den"]), container);

    expect(container.querySelector(".humidity-compliance.compliant")?.textContent).toContain("humidityCompliant");
  });

  it("toggles enablement and expansion from the heading", () => {
    const { saveZoneHumidityAssist, toggleHumidityZone, viewHost } = host();
    const container = document.createElement("div");

    render(renderHumidityView(viewHost, ["climate.den", "climate.guest"]), container);

    const toggle = container.querySelector<HTMLButtonElement>(".humidity-zone-toggle");
    expect(toggle?.getAttribute("aria-label")).toBe("humidityExpandClimate:Den");
    toggle?.click();
    expect(toggleHumidityZone).toHaveBeenCalledWith("climate.den");

    const switches = container.querySelectorAll<HTMLElement & { checked: boolean }>(".humidity-enable-control ha-switch");
    expect(switches).toHaveLength(2);
    // The guest zone has no sensor, target, or pulse temperature: it cannot be enabled yet.
    expect(switches[1].hasAttribute("disabled")).toBe(true);
    switches[0].checked = false;
    switches[0].dispatchEvent(new Event("change"));
    expect(saveZoneHumidityAssist).toHaveBeenCalledWith("climate.den", { enabled: false });
  });

  it("saves per-zone configuration from the expanded form", () => {
    const { saveZoneHumidityAssist, viewHost } = host({ expandedZoneIds: ["climate.den"] });
    const container = document.createElement("div");

    render(renderHumidityView(viewHost, ["climate.den"]), container);

    const content = container.querySelector(".humidity-zone-content");
    expect(content).not.toBeNull();
    const selects = content!.querySelectorAll<HTMLSelectElement>("select");
    expect(selects).toHaveLength(4);
    expect([...selects[0].options].map((option) => option.value)).toEqual(["", "sensor.den_dew_point"]);
    expect([...selects[2].options].map((option) => option.textContent?.trim())).toEqual(["mode:cool", "mode:dry"]);
    expect([...selects[3].options].map((option) => option.value)).toEqual(["", "auto", "low", "high"]);

    selects[1].value = "relative_humidity";
    selects[1].dispatchEvent(new Event("change"));
    expect(saveZoneHumidityAssist).toHaveBeenCalledWith("climate.den", { measure: "relative_humidity" });

    const inputs = content!.querySelectorAll<HTMLInputElement>("input[type='number']");
    expect(inputs).toHaveLength(2);
    inputs[0].value = "21.5";
    inputs[0].dispatchEvent(new Event("change"));
    expect(saveZoneHumidityAssist).toHaveBeenCalledWith("climate.den", { target: 21.5 });
    inputs[1].value = "40";
    inputs[1].dispatchEvent(new Event("change"));
    expect(saveZoneHumidityAssist).toHaveBeenCalledWith("climate.den", { pulse_temperature: 30 });

    const prioritySwitch = content!.querySelector<HTMLElement & { checked: boolean }>(".humidity-toggle-row ha-switch");
    prioritySwitch!.checked = false;
    prioritySwitch!.dispatchEvent(new Event("change"));
    expect(saveZoneHumidityAssist).toHaveBeenCalledWith("climate.den", { priority: false });
  });

  it("renders and saves the shared parameters and gate entity", () => {
    const { saveHumidityAssistSettings, viewHost } = host();
    const container = document.createElement("div");

    render(renderHumidityView(viewHost, ["climate.den"]), container);

    const section = container.querySelector(".humidity-global");
    expect(section?.textContent).toContain("humidityGlobalSettings");
    const inputs = section!.querySelectorAll<HTMLInputElement>("input[type='number']");
    expect(inputs).toHaveLength(12);
    expect(inputs[2].value).toBe("12");
    inputs[5].value = "3";
    inputs[5].dispatchEvent(new Event("change"));
    expect(saveHumidityAssistSettings).toHaveBeenCalledWith({ max_simultaneous_pulses: 3 });
    inputs[0].value = "0.35";
    inputs[0].dispatchEvent(new Event("change"));
    expect(saveHumidityAssistSettings).toHaveBeenCalledWith({ start_buffer: 0.35 });

    const gate = section!.querySelector<HTMLSelectElement>("select");
    expect([...gate!.options].map((option) => option.value)).toEqual(["", "input_boolean.budget"]);
    gate!.value = "";
    gate!.dispatchEvent(new Event("change"));
    expect(saveHumidityAssistSettings).toHaveBeenCalledWith({ gate_entity_id: null });
  });

  it("marks unavailable thermostats and external zones", () => {
    const { viewHost } = host({ entityExists: false });
    const container = document.createElement("div");
    (viewHost._data!.zones["climate.guest"] as { execution?: { type: string; provider: string } }).execution = {
      type: "external",
      provider: "ramses_cc",
    };

    render(renderHumidityView(viewHost, ["climate.den", "climate.guest"]), container);

    expect(container.querySelector(".humidity-unavailable-message")?.textContent).toContain("humidityUnavailable");
    expect(container.querySelectorAll(".humidity-zone")[1].textContent).toContain("externalActionsInactive");
  });
});
