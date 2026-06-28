import { describe, expect, it } from "vitest";

import {
  fanModeOptions,
  humidityLimits,
  presetModeOptions,
  swingHorizontalModeOptions,
  swingModeOptions,
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
