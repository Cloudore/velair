// @vitest-environment jsdom

import { render } from "lit";
import { describe, expect, it, vi } from "vitest";

import { VelairPresenceView } from "../../src/velair/components/presence/presence-view-element";
import type { VelairViewHost } from "../../src/velair/host-types";
import type { HomeAssistant, ScheduleResponse } from "../../src/velair/types";
import { renderPresenceView } from "../../src/velair/views/presence-view";

type Deferred = { resolve(value: ScheduleResponse): void; reject(error: Error): void };

function schedule(): ScheduleResponse {
  return {
    configured_entities: ["climate.den", "climate.guest"],
    temperature_unit: "°C",
    settings: {
      first_weekday: "monday",
      zone_order: [],
      house_modes: { away_after_minutes: 45, presence_entity_ids: ["person.izzat"], travel_entity_id: "input_boolean.travel" },
      guards: { manual_lease_minutes: 20 },
    },
    zones: {
      "climate.den": {
        enabled: true,
        schedule: {},
        occupancy_assist: {
          enabled: true,
          occupancy_entity_id: "binary_sensor.den_occupied",
          blocking_entity_ids: ["input_boolean.projector"],
          setback_stages: [
            { after_minutes: 10, temperature: 23 },
            { after_minutes: 30, temperature: 25 },
          ],
          arrival_stages: [
            { after_minutes: 5, temperature: 26 },
            { after_minutes: 10, temperature: null },
          ],
          arrival_exit_grace_minutes: 2,
          comfort_temperature: 26,
        },
        house_modes: { away_temperature: 27, sleep_constraint: "absolute", sleep_fan_mode: "high" },
        guards: {
          never_off_enabled: true,
          activity_holds: [{
            entity_id: "input_boolean.kitchen_cooking_mode",
            temperature: 25,
            constraint: "lower_only",
            hvac_mode: "cool",
            release_delay_minutes: 10,
            pause_id: "activity",
            label: "Cooking",
          }],
        },
      },
      "climate.guest": { enabled: true, schedule: {} },
    },
    occupancy_assist: {
      "climate.den": { state: "setback_1", stage: 1, next_stage_at: "2026-09-04T12:20:00Z" },
    },
    house_mode: { state: "away", empty_since: "2026-09-04T11:00:00Z" },
    guards: { "climate.den": { state: "manual_watch", manual_release_at: "2026-09-04T12:30:00Z" } },
    next_events: [],
  } as unknown as ScheduleResponse;
}

function hassStub(options: { deferred?: Deferred[] } = {}): { hass: HomeAssistant; sendMessagePromise: ReturnType<typeof vi.fn> } {
  const sendMessagePromise = vi.fn(() => new Promise<ScheduleResponse>((resolve, reject) => {
    if (options.deferred) {
      options.deferred.push({ resolve, reject });
    } else {
      resolve(schedule());
    }
  }));
  const hass = {
    connection: { sendMessagePromise },
    config: { unit_system: { temperature: "°C" } },
    states: {
      "climate.den": {
        state: "cool",
        attributes: { friendly_name: "Den", min_temp: 16, max_temp: 30, target_temp_step: 0.5, hvac_modes: ["cool", "dry", "off"], fan_modes: ["auto", "low", "high"] },
      },
      "climate.guest": {
        state: "cool",
        attributes: { friendly_name: "Guest room", min_temp: 16, max_temp: 30, target_temp_step: 1, hvac_modes: ["cool", "off"], fan_modes: ["auto"] },
      },
      "binary_sensor.den_occupied": { state: "on", attributes: { friendly_name: "Den occupied", device_class: "occupancy" } },
      "input_boolean.projector": { state: "off", attributes: { friendly_name: "Projector" } },
      "input_boolean.travel": { state: "off", attributes: { friendly_name: "Travel" } },
      "input_boolean.kitchen_cooking_mode": { state: "off", attributes: { friendly_name: "Cooking" } },
      "person.izzat": { state: "home", attributes: { friendly_name: "Izzat" } },
      "person.marianne": { state: "home", attributes: { friendly_name: "Marianne" } },
    },
  } as unknown as HomeAssistant;
  return { hass, sendMessagePromise };
}

async function mount(options: { zoneIds?: string[]; data?: ScheduleResponse; deferred?: Deferred[] } = {}) {
  const { hass, sendMessagePromise } = hassStub({ deferred: options.deferred });
  const element = new VelairPresenceView();
  element.hass = hass;
  element.data = options.data ?? schedule();
  element.zoneIds = options.zoneIds ?? ["climate.den", "climate.guest"];
  element.timelineNow = new Date("2026-09-04T12:00:00Z");
  const errors: string[] = [];
  const updates: ScheduleResponse[] = [];
  element.addEventListener("presence-error", (event) => errors.push((event as CustomEvent<string>).detail));
  element.addEventListener("presence-data-changed", (event) => updates.push((event as CustomEvent<ScheduleResponse>).detail));
  document.body.append(element);
  await element.updateComplete;
  const root = element.shadowRoot!;
  return { element, errors, root, sendMessagePromise, updates };
}

function field<T extends Element>(root: ShadowRoot, id: string, selector: string): T {
  const node = root.querySelector<T>(`[data-field="${id}"] ${selector}`);
  if (!node) {
    throw new Error(`missing ${selector} in field ${id}`);
  }
  return node;
}

function change(node: HTMLInputElement | HTMLSelectElement, value: string): void {
  node.value = value;
  node.dispatchEvent(new Event("change"));
}

async function settle(element: VelairPresenceView): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, 0));
  await element.updateComplete;
}

function toggle(node: Element, checked: boolean): void {
  (node as HTMLElement & { checked: boolean }).checked = checked;
  node.dispatchEvent(new Event("change"));
}

describe("presence view element", () => {
  it("renders the empty state when no zone is visible", async () => {
    const { element, root } = await mount({ zoneIds: [] });

    expect(root.querySelector(".presence-empty")?.textContent).toContain("No managed climate entities found.");
    expect(root.querySelector(".presence-global")).not.toBeNull();
    expect(root.querySelector(".presence-zone")).toBeNull();
    element.remove();
  });

  it("renders the runtime chips and the selected zone's settings", async () => {
    const { element, root } = await mount();

    const chips = [...root.querySelectorAll(".presence-zone .presence-chip")].map((chip) => chip.textContent?.replace(/\s+/g, " ").trim());
    expect(chips).toEqual(["Setback 1 in 20 min", "Watching manual adjustment in 30 min", "Away"]);
    expect(root.querySelector(".presence-global .presence-chip.chip-house-mode")?.textContent).toContain("Away");

    expect(root.querySelector(".presence-zone-identity strong")?.textContent).toBe("Den");
    expect(field<HTMLSelectElement>(root, "occupancy-entity-climate.den", "select").value).toBe("binary_sensor.den_occupied");
    expect([...root.querySelectorAll("[data-field='occupancy-blocking-climate.den'] .presence-entity-chip")].map((chip) => chip.textContent?.trim()))
      .toEqual(["Projector"]);

    const setbackRows = root.querySelectorAll(".presence-setback-stages .presence-stage-row");
    expect(setbackRows).toHaveLength(2);
    expect([...setbackRows].map((row) => row.querySelector<HTMLInputElement>(".presence-stage-minutes")!.value)).toEqual(["10", "30"]);
    expect([...setbackRows].map((row) => row.querySelector<HTMLInputElement>(".presence-stage-temperature")!.value)).toEqual(["23", "25"]);
    expect(root.querySelector(".presence-setback-add")).not.toBeNull();

    const arrivalRows = root.querySelectorAll(".presence-arrival-stages .presence-stage-row");
    expect(arrivalRows).toHaveLength(2);
    expect(arrivalRows[0].querySelector(".presence-stage-action")).toBeNull();
    expect(arrivalRows[1].querySelector<HTMLSelectElement>(".presence-stage-action")!.value).toBe("release");
    expect(arrivalRows[1].querySelector(".presence-stage-temperature")).toBeNull();
    expect(root.querySelector(".presence-arrival-add")).toBeNull();

    expect(field<HTMLInputElement>(root, "house-modes-away-temperature-climate.den", "input").value).toBe("27");
    expect(field<HTMLSelectElement>(root, "house-modes-sleep-constraint-climate.den", "select").value).toBe("absolute");
    expect(field<HTMLSelectElement>(root, "house-modes-sleep-fan-mode-climate.den", "select").value).toBe("high");
    expect(root.querySelector(".presence-hold-heading strong")?.textContent).toBe("Cooking");
    expect(field<HTMLInputElement>(root, "activity-hold-1-release-delay-climate.den", "input").value).toBe("10");

    expect(field<HTMLInputElement>(root, "house-away-after", "input").value).toBe("45");
    expect(field<HTMLInputElement>(root, "guards-manual-lease", "input").value).toBe("20");
    expect(field<HTMLSelectElement>(root, "house-travel-entity", "select").value).toBe("input_boolean.travel");
    element.remove();
  });

  it("switches zones from the picker and shows defaults for an unconfigured zone", async () => {
    const { element, root } = await mount();

    const zones = root.querySelectorAll<HTMLButtonElement>(".zones .zone");
    expect([...zones].map((zone) => zone.textContent?.trim())).toEqual(["Den", "Guest room"]);
    zones[1].click();
    await element.updateComplete;

    expect(root.querySelector(".presence-zone-identity strong")?.textContent).toBe("Guest room");
    expect(root.querySelector(".presence-chip.chip-occupancy")?.textContent).toContain("Occupancy off");
    expect(root.querySelector(".presence-chip.chip-guard")?.textContent).toContain("Guard idle");
    expect(root.querySelector(".presence-occupancy-enable")?.hasAttribute("disabled")).toBe(true);
    expect(root.querySelectorAll(".presence-setback-stages .presence-stage-row")).toHaveLength(3);
    expect(field<HTMLInputElement>(root, "house-modes-away-temperature-climate.guest", "input").value).toBe("26");
    expect(root.querySelector(".presence-guards .presence-empty-list")?.textContent).toContain("No activity holds.");
    element.remove();
  });

  it("writes zone occupancy edits through velair/update_zone_occupancy_assist", async () => {
    const { element, root, sendMessagePromise, updates } = await mount();

    change(field<HTMLInputElement>(root, "occupancy-exit-grace-climate.den", "input"), "5");
    expect(sendMessagePromise).toHaveBeenLastCalledWith({
      type: "velair/update_zone_occupancy_assist",
      entity_id: "climate.den",
      occupancy_assist: { arrival_exit_grace_minutes: 5 },
    });

    toggle(field(root, "occupancy-sync-schedule-climate.den", "ha-switch"), false);
    expect(sendMessagePromise).toHaveBeenLastCalledWith({
      type: "velair/update_zone_occupancy_assist",
      entity_id: "climate.den",
      occupancy_assist: { sync_comfort_to_schedule: false },
    });

    change(field<HTMLSelectElement>(root, "occupancy-blocking-climate.den", ".presence-entity-add select"), "input_boolean.travel");
    expect(sendMessagePromise).toHaveBeenLastCalledWith({
      type: "velair/update_zone_occupancy_assist",
      entity_id: "climate.den",
      occupancy_assist: { blocking_entity_ids: ["input_boolean.projector", "input_boolean.travel"] },
    });

    change(field<HTMLInputElement>(root, "occupancy-comfort-temperature-climate.den", "input"), "40");
    expect(sendMessagePromise).toHaveBeenLastCalledWith({
      type: "velair/update_zone_occupancy_assist",
      entity_id: "climate.den",
      occupancy_assist: { comfort_temperature: 30 },
    });

    const stageRows = root.querySelectorAll(".presence-setback-stages .presence-stage-row");
    change(stageRows[1].querySelector<HTMLInputElement>(".presence-stage-temperature")!, "24.5");
    expect(sendMessagePromise).toHaveBeenLastCalledWith({
      type: "velair/update_zone_occupancy_assist",
      entity_id: "climate.den",
      occupancy_assist: { setback_stages: [{ after_minutes: 10, temperature: 23 }, { after_minutes: 30, temperature: 24.5 }] },
    });

    root.querySelector<HTMLButtonElement>(".presence-setback-add")!.click();
    expect(sendMessagePromise).toHaveBeenLastCalledWith({
      type: "velair/update_zone_occupancy_assist",
      entity_id: "climate.den",
      occupancy_assist: {
        setback_stages: [
          { after_minutes: 10, temperature: 23 },
          { after_minutes: 30, temperature: 25 },
          { after_minutes: 60, temperature: 26 },
        ],
      },
    });

    const arrivalRows = root.querySelectorAll(".presence-arrival-stages .presence-stage-row");
    change(arrivalRows[1].querySelector<HTMLSelectElement>(".presence-stage-action")!, "hold");
    expect(sendMessagePromise).toHaveBeenLastCalledWith({
      type: "velair/update_zone_occupancy_assist",
      entity_id: "climate.den",
      occupancy_assist: { arrival_stages: [{ after_minutes: 5, temperature: 26 }, { after_minutes: 10, temperature: 26 }] },
    });

    await settle(element);
    expect(updates.length).toBe(sendMessagePromise.mock.calls.length);
    element.remove();
  });

  it("rejects out-of-order setback stages locally and keeps the draft visible", async () => {
    const { element, root, sendMessagePromise } = await mount();

    const rows = root.querySelectorAll(".presence-setback-stages .presence-stage-row");
    change(rows[1].querySelector<HTMLInputElement>(".presence-stage-minutes")!, "5");
    await element.updateComplete;

    expect(sendMessagePromise).not.toHaveBeenCalled();
    expect(root.querySelector(".presence-setback-stages .presence-stage-error")?.textContent)
      .toBe("Stage 2 must start later than the previous stage.");
    const draftRows = root.querySelectorAll(".presence-setback-stages .presence-stage-row");
    expect(draftRows[1].classList.contains("invalid")).toBe(true);
    expect(draftRows[1].querySelector<HTMLInputElement>(".presence-stage-minutes")!.value).toBe("5");

    change(draftRows[1].querySelector<HTMLInputElement>(".presence-stage-minutes")!, "45");
    await element.updateComplete;
    expect(root.querySelector(".presence-setback-stages .presence-stage-error")).toBeNull();
    expect(sendMessagePromise).toHaveBeenLastCalledWith({
      type: "velair/update_zone_occupancy_assist",
      entity_id: "climate.den",
      occupancy_assist: { setback_stages: [{ after_minutes: 10, temperature: 23 }, { after_minutes: 45, temperature: 25 }] },
    });
    element.remove();
  });

  it("rejects an arrival stage that releases before the last one", async () => {
    const { element, root, sendMessagePromise } = await mount();

    root.querySelector<HTMLButtonElement>(".presence-arrival-stages .presence-row-remove")!.click();
    await element.updateComplete;
    expect(sendMessagePromise).toHaveBeenLastCalledWith({
      type: "velair/update_zone_occupancy_assist",
      entity_id: "climate.den",
      occupancy_assist: { arrival_stages: [{ after_minutes: 10, temperature: null }] },
    });

    const rows = root.querySelectorAll(".presence-arrival-stages .presence-stage-row");
    change(rows[0].querySelector<HTMLInputElement>(".presence-stage-minutes")!, "0");
    await element.updateComplete;
    expect(root.querySelector(".presence-arrival-stages .presence-stage-error")?.textContent)
      .toBe("Stage 1 needs a positive number of minutes.");
    expect(sendMessagePromise).toHaveBeenCalledTimes(1);
    element.remove();
  });

  it("writes zone house modes and guards through their own commands", async () => {
    const { element, root, sendMessagePromise } = await mount();

    change(field<HTMLInputElement>(root, "house-modes-away-deep-temperature-climate.den", "input"), "28");
    expect(sendMessagePromise).toHaveBeenLastCalledWith({
      type: "velair/update_zone_house_modes",
      entity_id: "climate.den",
      house_modes: { away_deep_temperature: 28 },
    });

    change(field<HTMLInputElement>(root, "house-modes-away-deep-temperature-climate.den", "input"), "");
    expect(sendMessagePromise).toHaveBeenLastCalledWith({
      type: "velair/update_zone_house_modes",
      entity_id: "climate.den",
      house_modes: { away_deep_temperature: null },
    });

    change(field<HTMLSelectElement>(root, "house-modes-sleep-constraint-climate.den", "select"), "raise_only");
    expect(sendMessagePromise).toHaveBeenLastCalledWith({
      type: "velair/update_zone_house_modes",
      entity_id: "climate.den",
      house_modes: { sleep_constraint: "raise_only" },
    });

    toggle(field(root, "house-modes-travel-park-enabled-climate.den", "ha-switch"), false);
    expect(sendMessagePromise).toHaveBeenLastCalledWith({
      type: "velair/update_zone_house_modes",
      entity_id: "climate.den",
      house_modes: { travel_park_enabled: false },
    });

    toggle(field(root, "guards-zone-never-off-climate.den", "ha-switch"), false);
    expect(sendMessagePromise).toHaveBeenLastCalledWith({
      type: "velair/update_zone_guards",
      entity_id: "climate.den",
      guards: { never_off_enabled: false },
    });

    change(field<HTMLInputElement>(root, "activity-hold-1-release-delay-climate.den", "input"), "15");
    expect(sendMessagePromise).toHaveBeenLastCalledWith({
      type: "velair/update_zone_guards",
      entity_id: "climate.den",
      guards: {
        activity_holds: [{
          entity_id: "input_boolean.kitchen_cooking_mode",
          temperature: 25,
          constraint: "lower_only",
          hvac_mode: "cool",
          release_delay_minutes: 15,
          pause_id: "activity",
          label: "Cooking",
        }],
      },
    });

    root.querySelector<HTMLButtonElement>(".presence-activity-hold-add")!.click();
    const lastCall = sendMessagePromise.mock.calls.at(-1)![0] as { type: string; guards: { activity_holds: unknown[] } };
    expect(lastCall.type).toBe("velair/update_zone_guards");
    expect(lastCall.guards.activity_holds).toHaveLength(2);
    expect(lastCall.guards.activity_holds[1]).toEqual({
      entity_id: "",
      temperature: 25,
      constraint: "lower_only",
      hvac_mode: "cool",
      release_delay_minutes: 10,
      pause_id: "activity",
      label: "",
    });
    element.remove();
  });

  it("writes the global house modes and guards through velair/update_settings", async () => {
    const { element, root, sendMessagePromise } = await mount();

    change(field<HTMLInputElement>(root, "house-away-after", "input"), "90");
    expect(sendMessagePromise).toHaveBeenLastCalledWith({
      type: "velair/update_settings",
      house_modes: { away_after_minutes: 90 },
    });

    change(field<HTMLSelectElement>(root, "house-presence-entities", ".presence-entity-add select"), "person.marianne");
    expect(sendMessagePromise).toHaveBeenLastCalledWith({
      type: "velair/update_settings",
      house_modes: { presence_entity_ids: ["person.izzat", "person.marianne"] },
    });

    root.querySelector<HTMLButtonElement>("[data-field='house-presence-entities'] .presence-chip-remove")!.click();
    expect(sendMessagePromise).toHaveBeenLastCalledWith({
      type: "velair/update_settings",
      house_modes: { presence_entity_ids: [] },
    });

    change(field<HTMLInputElement>(root, "house-presleep-time", "input"), "22:15");
    expect(sendMessagePromise).toHaveBeenLastCalledWith({
      type: "velair/update_settings",
      house_modes: { presleep_time: "22:15" },
    });

    toggle(field(root, "house-travel-auto-exit", "ha-switch"), true);
    expect(sendMessagePromise).toHaveBeenLastCalledWith({
      type: "velair/update_settings",
      house_modes: { travel_auto_exit_on_arrival: true },
    });

    change(field<HTMLInputElement>(root, "guards-manual-lease", "input"), "45");
    expect(sendMessagePromise).toHaveBeenLastCalledWith({
      type: "velair/update_settings",
      guards: { manual_lease_minutes: 45 },
    });

    toggle(field(root, "guards-never-off-enabled", "ha-switch"), false);
    expect(sendMessagePromise).toHaveBeenLastCalledWith({
      type: "velair/update_settings",
      guards: { never_off_enabled: false },
    });
    element.remove();
  });

  it("shows edits optimistically and reverts with an error when the backend rejects them", async () => {
    const deferred: Deferred[] = [];
    const { element, errors, root, updates } = await mount({ deferred });

    change(field<HTMLInputElement>(root, "house-away-after", "input"), "75");
    await element.updateComplete;
    expect(field<HTMLInputElement>(root, "house-away-after", "input").value).toBe("75");
    expect(element.effectiveData()?.settings.house_modes?.away_after_minutes).toBe(75);

    deferred[0].reject(new Error("invalid_house_modes"));
    await settle(element);

    expect(errors).toEqual(["invalid_house_modes"]);
    expect(updates).toEqual([]);
    expect(field<HTMLInputElement>(root, "house-away-after", "input").value).toBe("45");

    change(field<HTMLInputElement>(root, "house-away-after", "input"), "80");
    const accepted = schedule();
    accepted.settings.house_modes = { ...accepted.settings.house_modes, away_after_minutes: 80 };
    deferred[1].resolve(accepted);
    await settle(element);
    expect(updates).toHaveLength(1);
    expect(updates[0].settings.house_modes?.away_after_minutes).toBe(80);
    element.remove();
  });

  it("marks external zones and unavailable thermostats without forms", async () => {
    const data = schedule();
    (data.zones["climate.den"] as { execution?: { type: string; provider: string } }).execution = { type: "external", provider: "ramses_cc" };
    const { element, root } = await mount({ data });

    expect(root.querySelector(".presence-zone .presence-unavailable-message")?.textContent).toContain("Velair");
    expect(root.querySelector(".presence-occupancy")).toBeNull();

    root.querySelectorAll<HTMLButtonElement>(".zones .zone")[1].click();
    element.hass = { ...element.hass!, states: { ...element.hass!.states, "climate.guest": undefined } } as HomeAssistant;
    await element.updateComplete;
    expect(root.querySelector(".presence-zone .presence-unavailable-message")?.textContent)
      .toBe("Thermostat unavailable. Zone settings cannot be edited.");
    element.remove();
  });
});

describe("presence view binding", () => {
  it("mounts the element with the visible zones and forwards its events to the card", async () => {
    const applyScheduleData = vi.fn();
    const showError = vi.fn();
    const { hass } = hassStub();
    const host = {
      hass,
      _data: schedule(),
      _applyScheduleData: applyScheduleData,
      _showError: showError,
      _currentTimelineNow: () => new Date("2026-09-04T12:00:00Z"),
    } as unknown as VelairViewHost;
    const container = document.createElement("div");
    document.body.append(container);

    render(renderPresenceView(host, ["climate.guest"], "climate.guest"), container);
    const element = container.querySelector("velair-presence-view") as VelairPresenceView;
    await element.updateComplete;

    expect(element.zoneIds).toEqual(["climate.guest"]);
    expect(element.selectedEntity()).toBe("climate.guest");
    expect(element.shadowRoot?.querySelector(".presence-zone-identity strong")?.textContent).toBe("Guest room");

    const updated = schedule();
    element.dispatchEvent(new CustomEvent("presence-data-changed", { bubbles: true, composed: true, detail: updated }));
    expect(applyScheduleData).toHaveBeenCalledWith(updated, { forceDraft: false });
    element.dispatchEvent(new CustomEvent("presence-error", { bubbles: true, composed: true, detail: "boom" }));
    expect(showError).toHaveBeenCalledWith("boom");
    container.remove();
  });
});
