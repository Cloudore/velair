import { describe, expect, it } from "vitest";

import {
  cloneDayPresetTargets,
  externalSwitchpointUsage,
} from "../../src/velair/domain/schedule-editor";

describe("schedule editor domain helpers", () => {
  it("selects semantic clone presets and always excludes the source day", () => {
    expect([...cloneDayPresetTargets("weekdays", "wednesday")]).toEqual([
      "monday", "tuesday", "thursday", "friday",
    ]);
    expect([...cloneDayPresetTargets("weekend", "saturday")]).toEqual(["sunday"]);
    expect([...cloneDayPresetTargets("all", "sunday")]).toEqual([
      "monday", "tuesday", "wednesday", "thursday", "friday", "saturday",
    ]);
    expect([...cloneDayPresetTargets("clear", "monday")]).toEqual([]);
  });

  it("counts an implicit midnight switchpoint only when the capability requires it", () => {
    const capabilities = {
      max_switchpoints_per_day: 6,
      implicit_midnight_change_counts_toward_limit: true,
    };
    expect(externalSwitchpointUsage([
      { start: "10:00" },
      { start: "18:05" },
    ], capabilities)).toEqual({
      scheduled: 2,
      implicitMidnight: 1,
      used: 3,
      max: 6,
      state: "normal",
    });
    expect(externalSwitchpointUsage([
      { start: "00:00" },
      { start: "18:05" },
    ], capabilities).implicitMidnight).toBe(0);
    expect(externalSwitchpointUsage([], capabilities)).toMatchObject({
      scheduled: 0,
      implicitMidnight: 1,
      used: 1,
    });
    expect(externalSwitchpointUsage([{ start: "10:00" }], {
      ...capabilities,
      implicit_midnight_change_counts_toward_limit: false,
    }).implicitMidnight).toBe(0);
  });

  it("identifies the controller limit and an overflow", () => {
    const capabilities = {
      max_switchpoints_per_day: 6,
      implicit_midnight_change_counts_toward_limit: true,
    };
    const fiveBlocks = ["01:00", "05:00", "09:00", "13:00", "18:00"].map((start) => ({ start }));
    expect(externalSwitchpointUsage(fiveBlocks, capabilities).state).toBe("at-limit");
    expect(externalSwitchpointUsage([...fiveBlocks, { start: "22:00" }], capabilities).state).toBe("over-limit");
  });
});
