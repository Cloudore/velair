import type {
  GuardsGlobalSettings,
  GuardsZoneSettings,
  HomeAssistant,
  HouseModesGlobalSettings,
  HouseModesZoneSettings,
  OccupancyAssistSettings,
  ScheduleResponse,
} from "../types";

/**
 * WebSocket client for the home policy modules (docs/dev/home-policy-spec.md §3–§5).
 *
 * Four commands back the Presence view:
 * - `velair/update_zone_occupancy_assist` `{entity_id, occupancy_assist}`
 * - `velair/update_zone_house_modes`      `{entity_id, house_modes}`
 * - `velair/update_zone_guards`           `{entity_id, guards}`
 * - `velair/update_settings`              `{house_modes}` or `{guards}`
 *
 * Every call returns the full schedule payload, exactly like the other
 * `velair/update_*` commands, so the card can apply it as fresh state.
 */
export class VelairPresenceApi {
  public constructor(private readonly hass: HomeAssistant) {}

  public updateZoneOccupancyAssist(
    entityId: string,
    occupancyAssist: Partial<OccupancyAssistSettings>,
  ): Promise<ScheduleResponse> {
    return this.hass.connection.sendMessagePromise<ScheduleResponse>({
      type: "velair/update_zone_occupancy_assist",
      entity_id: entityId,
      occupancy_assist: occupancyAssist,
    });
  }

  public updateZoneHouseModes(
    entityId: string,
    houseModes: Partial<HouseModesZoneSettings>,
  ): Promise<ScheduleResponse> {
    return this.hass.connection.sendMessagePromise<ScheduleResponse>({
      type: "velair/update_zone_house_modes",
      entity_id: entityId,
      house_modes: houseModes,
    });
  }

  public updateZoneGuards(
    entityId: string,
    guards: Partial<GuardsZoneSettings>,
  ): Promise<ScheduleResponse> {
    return this.hass.connection.sendMessagePromise<ScheduleResponse>({
      type: "velair/update_zone_guards",
      entity_id: entityId,
      guards,
    });
  }

  public updateHouseModesSettings(
    houseModes: Partial<HouseModesGlobalSettings>,
  ): Promise<ScheduleResponse> {
    return this.hass.connection.sendMessagePromise<ScheduleResponse>({
      type: "velair/update_settings",
      house_modes: houseModes,
    });
  }

  public updateGuardsSettings(guards: Partial<GuardsGlobalSettings>): Promise<ScheduleResponse> {
    return this.hass.connection.sendMessagePromise<ScheduleResponse>({
      type: "velair/update_settings",
      guards,
    });
  }
}
