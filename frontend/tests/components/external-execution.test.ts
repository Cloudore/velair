// @vitest-environment jsdom

import { describe, expect, it } from "vitest";

import { VelairCard } from "../../src/velair/components/velair-card-element";
import { en } from "../../src/velair/translations/en";
import type { HomeAssistant, ScheduleResponse } from "../../src/velair/types";

const TEST_TAG = "test-velair-external-execution-card";
if (!customElements.get(TEST_TAG)) customElements.define(TEST_TAG, VelairCard);

describe("external execution settings", () => {
  it("recognizes a plain Home Assistant schedule-required error", async () => {
    const element = document.createElement(TEST_TAG) as VelairCard;
    element.hass = {
      connection: {
        sendMessagePromise: async () => {
          throw {
            code: "external_schedule_required",
            message: "External schedules require at least one temperature block",
          };
        },
        subscribeMessage: async () => () => undefined,
      },
    } as HomeAssistant;
    const internal = element as unknown as {
      _error?: string;
      _setZoneExecution(entityId: string, provider?: string): Promise<boolean>;
    };

    const selected = await internal._setZoneExecution("climate.office", "ramses_cc");

    expect(selected).toBe(false);
    expect(internal._error).toBe(en.externalScheduleRequired);
  });

  it("retains a provider confirmed by the authoritative state after an error", async () => {
    const element = document.createElement(TEST_TAG) as VelairCard;
    const authoritative = {
      external_execution: {
        systems: [],
        zones: {
          "climate.office": {
            type: "external",
            provider: "ramses_cc",
            available: true,
            publication: null,
          },
        },
      },
    } as unknown as ScheduleResponse;
    element.hass = {
      connection: {
        sendMessagePromise: async (message: Record<string, unknown>) => {
          if (message.type === "velair/set_zone_execution") {
            throw { code: "invalid_external_execution", message: "Publication interrupted" };
          }
          return authoritative;
        },
        subscribeMessage: async () => () => undefined,
      },
    } as HomeAssistant;
    const internal = element as unknown as {
      _data?: ScheduleResponse;
      _error?: string;
      _applyScheduleData(data: ScheduleResponse): void;
      _setZoneExecution(entityId: string, provider?: string): Promise<boolean>;
    };
    internal._applyScheduleData = (data) => {
      internal._data = data;
    };

    const selected = await internal._setZoneExecution("climate.office", "ramses_cc");

    expect(selected).toBe(true);
    expect(internal._error).toBe("Publication interrupted");
    expect(internal._data).toBe(authoritative);
  });
});
