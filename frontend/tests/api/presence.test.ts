import { describe, expect, it, vi } from "vitest";

import { VelairPresenceApi } from "../../src/velair/api/presence";
import type { HomeAssistant, ScheduleResponse } from "../../src/velair/types";

function client() {
  const response = { configured_entities: ["climate.den"] } as unknown as ScheduleResponse;
  const sendMessagePromise = vi.fn(async () => response);
  const hass = { connection: { sendMessagePromise } } as unknown as HomeAssistant;
  return { api: new VelairPresenceApi(hass), response, sendMessagePromise };
}

describe("presence API client", () => {
  it("updates a zone's Occupancy Assist settings", async () => {
    const { api, response, sendMessagePromise } = client();
    const patch = { enabled: true, occupancy_entity_id: "binary_sensor.den_occupied" };

    await expect(api.updateZoneOccupancyAssist("climate.den", patch)).resolves.toBe(response);

    expect(sendMessagePromise).toHaveBeenCalledWith({
      type: "velair/update_zone_occupancy_assist",
      entity_id: "climate.den",
      occupancy_assist: patch,
    });
  });

  it("updates a zone's house-mode settings", async () => {
    const { api, sendMessagePromise } = client();

    await api.updateZoneHouseModes("climate.den", { away_temperature: 27, sleep_constraint: "absolute" });

    expect(sendMessagePromise).toHaveBeenCalledWith({
      type: "velair/update_zone_house_modes",
      entity_id: "climate.den",
      house_modes: { away_temperature: 27, sleep_constraint: "absolute" },
    });
  });

  it("updates a zone's guards", async () => {
    const { api, sendMessagePromise } = client();
    const holds = [{
      entity_id: "input_boolean.kitchen_cooking_mode",
      temperature: 25,
      constraint: "lower_only" as const,
      hvac_mode: "cool",
      release_delay_minutes: 10,
      pause_id: "activity",
      label: "Cooking",
    }];

    await api.updateZoneGuards("climate.kitchen", { never_off_enabled: false, activity_holds: holds });

    expect(sendMessagePromise).toHaveBeenCalledWith({
      type: "velair/update_zone_guards",
      entity_id: "climate.kitchen",
      guards: { never_off_enabled: false, activity_holds: holds },
    });
  });

  it("writes global house modes and guards through velair/update_settings", async () => {
    const { api, sendMessagePromise } = client();

    await api.updateHouseModesSettings({ away_after_minutes: 45, presence_entity_ids: ["person.izzat"] });
    await api.updateGuardsSettings({ manual_lease_minutes: 20 });

    expect(sendMessagePromise).toHaveBeenNthCalledWith(1, {
      type: "velair/update_settings",
      house_modes: { away_after_minutes: 45, presence_entity_ids: ["person.izzat"] },
    });
    expect(sendMessagePromise).toHaveBeenNthCalledWith(2, {
      type: "velair/update_settings",
      guards: { manual_lease_minutes: 20 },
    });
  });

  it("propagates backend failures", async () => {
    const sendMessagePromise = vi.fn(async () => {
      throw new Error("invalid_occupancy_assist");
    });
    const api = new VelairPresenceApi({ connection: { sendMessagePromise } } as unknown as HomeAssistant);

    await expect(api.updateZoneOccupancyAssist("climate.den", { enabled: true }))
      .rejects.toThrow("invalid_occupancy_assist");
  });
});
