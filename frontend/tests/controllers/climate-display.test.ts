import { describe, expect, it } from "vitest";

import {
  fanModeOptions,
  entityTemperatureStepForHost,
  humidityLimits,
  presetModeOptions,
  swingHorizontalModeOptions,
  swingModeOptions,
  temperatureUnitForHost,
  temperatureStep,
} from "../../src/velair/controllers/climate-display";

function host() {
  return {
    _data: {
      configured_entities: ["climate.living_room", "climate.bedroom"],
    },
    _selectedEntity: "climate.living_room",
    hass: {
      states: {
        "climate.living_room": {
          attributes: {
            fan_modes: ["quiet", "auto"],
            humidity: 45,
            max_humidity: 70,
            min_humidity: 30,
            preset_modes: ["eco"],
            swing_horizontal_modes: ["left"],
            swing_modes: ["vertical"],
          },
        },
        "climate.bedroom": {
          attributes: {
            fan_modes: ["auto", "high"],
            preset_modes: ["sleep"],
            swing_modes: ["off"],
          },
        },
      },
    },
  };
}

describe("climate display controller", () => {
  it("uses the stored unit for persisted values while migration is pending", () => {
    const viewHost = {
      _data: {
        temperature_unit: "°C",
        home_assistant_temperature_unit: "°F",
      },
      hass: { config: { unit_system: { temperature: "°F" } } },
    } as any;

    expect(temperatureUnitForHost(viewHost)).toBe("°C");
    expect(temperatureUnitForHost(viewHost, "climate.living_room")).toBe("°C");
  });

  it("preserves the exact Home Assistant target step without a unit fallback", () => {
    const viewHost = host() as any;
    viewHost._temperatureUnit = () => "°F";
    viewHost.hass.states["climate.living_room"].attributes.target_temp_step = 0.2;

    expect(entityTemperatureStepForHost(viewHost, "climate.living_room")).toBe(0.2);

    delete viewHost.hass.states["climate.living_room"].attributes.target_temp_step;
    expect(entityTemperatureStepForHost(viewHost, "climate.living_room")).toBeUndefined();
  });

  it("uses no template step when managed climates publish different steps", () => {
    const viewHost = host() as any;
    viewHost._entityTemperatureStep = (entityId: string) =>
      entityId === "climate.living_room" ? 0.2 : 0.5;

    expect(temperatureStep(viewHost, "template")).toBeUndefined();
  });

  it("uses selected climate options for schedules and all managed options for templates", () => {
    const viewHost = host();

    expect(fanModeOptions(viewHost, "schedule")).toEqual(["auto", "quiet"]);
    expect(presetModeOptions(viewHost, "schedule")).toEqual(["eco"]);
    expect(swingModeOptions(viewHost, "schedule")).toEqual(["vertical"]);
    expect(swingHorizontalModeOptions(viewHost, "schedule")).toEqual(["left"]);
    expect(humidityLimits(viewHost, "schedule")).toEqual([30, 70]);

    expect(fanModeOptions(viewHost, "template")).toEqual(["auto", "high", "quiet"]);
    expect(presetModeOptions(viewHost, "template")).toEqual(["eco", "sleep"]);
    expect(swingModeOptions(viewHost, "template")).toEqual(["off", "vertical"]);
    expect(swingHorizontalModeOptions(viewHost, "template")).toEqual(["left"]);
    expect(humidityLimits(viewHost, "template")).toEqual([30, 70]);
  });
});
