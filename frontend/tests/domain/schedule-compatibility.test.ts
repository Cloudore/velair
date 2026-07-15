import { describe, expect, it } from "vitest";

import { incompatibleScheduleTargetCount } from "../../src/velair/domain/schedule-compatibility";

const zones = {
  "climate.room": {
    enabled: true,
    schedule: {
      monday: [
        { start: "08:00", temperature: 42 },
        { start: "18:00", temperature: 42.2 },
      ],
    },
  },
};

describe("schedule compatibility", () => {
  it("reports stored targets outside the exact Home Assistant grid", () => {
    expect(incompatibleScheduleTargetCount(zones, () => [41, 95], () => 1)).toBe(1);
  });

  it("waits for Home Assistant to publish a valid target step", () => {
    expect(incompatibleScheduleTargetCount(zones, () => [41, 95], () => undefined)).toBe(0);
  });
});
