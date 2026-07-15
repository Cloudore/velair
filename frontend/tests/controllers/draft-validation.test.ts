import { describe, expect, it } from "vitest";

import { ACTION_SET_TEMPERATURE } from "../../src/velair/constants";
import { temperatureError } from "../../src/velair/controllers/draft-validation";

describe("draft validation controller", () => {
  it("reports the exact Home Assistant target step", () => {
    const host = {
      _blocksForSource: () => [],
      _formatTemperatureLimit: (value: number) => String(value),
      _t: (key: string, replacements?: Record<string, string | number>) =>
        key === "invalidTemperatureStep" ? `step:${replacements?.step}` : key,
      _temperatureLimits: () => [41, 95] as [number, number],
      _temperatureStep: () => 0.2,
    };

    expect(temperatureError(host, {
      action: ACTION_SET_TEMPERATURE,
      hvac_mode: "heat",
      start: "08:00",
      temperature: 42.1,
    })).toBe("step:0.2");
  });
});
