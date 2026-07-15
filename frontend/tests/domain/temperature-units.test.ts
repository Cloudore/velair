import { describe, expect, it } from "vitest";

import {
  absoluteTemperatureBounds,
  defaultMinimumDelta,
  defaultMinutesPerDegree,
  defaultRoomAssistDelta,
  defaultTargetTemperature,
  minutesPerDegreeBounds,
  temperatureDeltaMaximum,
  temperatureDeltaMinimum,
} from "../../src/velair/domain/temperature-units";

describe("temperature unit defaults", () => {
  it("provides physically equivalent Fahrenheit defaults", () => {
    expect(defaultTargetTemperature("°F")).toBe(70);
    expect(defaultMinimumDelta("°F")).toBe(1);
    expect(defaultRoomAssistDelta("°F")).toBe(4);
    expect(defaultMinutesPerDegree("°F")).toBe(14);
    expect(temperatureDeltaMaximum("°F", 5)).toBe(9);
    expect(temperatureDeltaMinimum("°F", 0.1)).toBeCloseTo(0.18);
    expect(minutesPerDegreeBounds("°F")).toEqual([0.6, 66.7]);
    expect((defaultMinutesPerDegree("°F") - 0.6) / 0.1).toBeCloseTo(134);
    expect(absoluteTemperatureBounds("°F")).toEqual([-58, 212]);
  });
});
