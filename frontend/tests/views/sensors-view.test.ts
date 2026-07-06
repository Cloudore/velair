// @vitest-environment jsdom

import { render } from "lit";
import { describe, expect, it, vi } from "vitest";

import type { VelairViewHost } from "../../src/velair/host-types";
import { renderSensorsView } from "../../src/velair/views/sensors-view";

function host(options: {
  activeFrom?: string | null;
  climateTargetTemperature?: number;
  entityExists?: boolean;
  expandedZoneIds?: string[];
  hvacMode?: string;
  maxDelta?: number;
  debounceSeconds?: number;
  roomTemperatureEntityId?: string | null;
  assistEnabled?: boolean;
  roomAssistStatus?: "assisting" | "idle";
  roomTemperature?: number;
  scheduledTargetTemperature?: number;
  targetWhen?: string | null;
  thermostatTemperature?: number;
} = {}) {
  const saveZonePreconditioning = vi.fn(async () => {});
  const togglePreconditioningZone = vi.fn();
  const viewHost = {
    _data: {
      configured_entities: ["climate.first", "climate.second"],
      zones: {
        "climate.first": {
          enabled: true,
          preconditioning: {
            room_temperature_entity_id: options.roomTemperatureEntityId ?? null,
            room_sensor_assist_enabled: options.assistEnabled ?? false,
            room_sensor_assist_max_delta: options.maxDelta ?? 5,
            room_sensor_assist_debounce_seconds: options.debounceSeconds ?? 20,
          },
          schedule: {},
        },
        "climate.second": {
          enabled: true,
          preconditioning: {
            room_temperature_entity_id: "sensor.bedroom_temperature",
            room_sensor_assist_enabled: true,
            room_sensor_assist_max_delta: 2,
            room_sensor_assist_debounce_seconds: options.debounceSeconds ?? 20,
          },
          schedule: {},
        },
      },
      room_sensor_assist: {
        "climate.second": {
          status: options.roomAssistStatus ?? "assisting",
          enabled: true,
          configured: true,
          room_temperature_entity_id: "sensor.bedroom_temperature",
          target_temperature:
            options.roomAssistStatus === "idle"
              ? null
              : (options.scheduledTargetTemperature ?? 25),
          applied_temperature: options.roomAssistStatus === "idle" ? null : 22,
          climate_target_temperature: options.climateTargetTemperature ?? 21,
          room_temperature: options.roomTemperature ?? 20,
          climate_temperature: options.thermostatTemperature ?? 17.1,
          assist_delta: 5,
          direction: "heat",
          hvac_mode: options.hvacMode ?? "heat",
          weekday: "tuesday",
          start: options.roomAssistStatus === "idle" ? null : "17:00",
          active_from:
            options.roomAssistStatus === "idle"
              ? null
              : (options.activeFrom ?? "2026-05-19T17:00:00+00:00"),
          target_when: options.targetWhen ?? null,
        },
      },
    },
    hass: {
      config: {
        unit_system: {
          temperature: "°C",
        },
      },
      states: {
        "sensor.bedroom_temperature": {
          state: "20.4",
          attributes: {
            device_class: "temperature",
            friendly_name: "Bedroom temperature",
            unit_of_measurement: "°C",
          },
        },
      },
    },
    _expandedPreconditioningZones: new Set(options.expandedZoneIds ?? []),
    _entityExists: () => options.entityExists ?? true,
    _formatTemperature: (value: number) => `${value} °C`,
    _formatDateTime: (value: string) => value,
    _formatScheduleTime: (value: string) => value,
    _friendlyEntityName: (entityId: string) =>
      entityId === "climate.first" ? "First" : "Second",
    _modeLabel: (mode: string) => `mode:${mode}`,
    _saveZonePreconditioning: saveZonePreconditioning,
    _settingsSaving: false,
    _t: (key: string, replacements?: Record<string, string | number>) =>
      replacements
        ? `${key}:${Object.entries(replacements)
            .map(([replacementKey, value]) => `${replacementKey}=${value}`)
            .join(",")}`
        : key,
    _temperatureUnit: () => "°C",
    _togglePreconditioningZone: togglePreconditioningZone,
  } as unknown as VelairViewHost;

  return {
    saveZonePreconditioning,
    togglePreconditioningZone,
    viewHost,
  };
}

describe("sensors view", () => {
  it("renders climates in the provided user order", () => {
    const { viewHost } = host();
    const container = document.createElement("div");

    render(renderSensorsView(viewHost, ["climate.second", "climate.first"]), container);

    expect(
      [...container.querySelectorAll(".sensor-zone-identity strong")]
        .map((element) => element.textContent?.trim()),
    ).toEqual(["Second", "First"]);
  });

  it("renders climates collapsed by default and requests expansion from the heading", () => {
    const { togglePreconditioningZone, viewHost } = host();
    const container = document.createElement("div");

    render(renderSensorsView(viewHost, ["climate.first"]), container);

    const zone = container.querySelector(".sensor-zone");
    const toggle = container.querySelector<HTMLButtonElement>(".sensor-zone-toggle");
    expect(zone?.classList).toContain("collapsed");
    expect(container.querySelector(".sensor-zone-content")).toBeNull();
    expect(toggle?.getAttribute("aria-expanded")).toBe("false");
    expect(toggle?.getAttribute("aria-label")).toBe("roomSensorExpandClimate:climate=First");

    toggle?.click();
    expect(togglePreconditioningZone).toHaveBeenCalledWith("climate.first");
  });

  it("lets the whole climate heading toggle the collapsed row", () => {
    const { togglePreconditioningZone, viewHost } = host();
    const container = document.createElement("div");

    render(renderSensorsView(viewHost, ["climate.first"]), container);

    container.querySelector<HTMLElement>(".sensor-zone-heading")?.click();

    expect(togglePreconditioningZone).toHaveBeenCalledWith("climate.first");
  });

  it("keeps a saved room sensor selected when the view is rendered again", () => {
    const { viewHost } = host({
      expandedZoneIds: ["climate.first"],
      roomTemperatureEntityId: "sensor.bedroom_temperature",
    });
    const container = document.createElement("div");

    render(renderSensorsView(viewHost, ["climate.first"]), container);

    const select = container.querySelector(".sensor-picker-row select") as HTMLSelectElement;
    expect(select.value).toBe("sensor.bedroom_temperature");
    expect(select.selectedOptions[0]?.textContent?.trim()).toContain(
      "Bedroom temperature",
    );
    expect(select.selectedOptions[0]?.textContent?.trim()).toContain(
      "sensor.bedroom_temperature",
    );
    expect(container.querySelector(".sensor-selected-entity")?.textContent).toContain(
      "sensor.bedroom_temperature",
    );
  });

  it("disables assist until a room sensor is configured", () => {
    const { viewHost } = host();
    const container = document.createElement("div");

    render(renderSensorsView(viewHost, ["climate.first"]), container);

    const control = container.querySelector(".sensor-enable-control");
    const toggle = control?.querySelector("ha-switch");
    expect(control?.getAttribute("title")).toBe("roomSensorNotConfigured");
    expect(toggle?.hasAttribute("disabled")).toBe(true);
  });

  it("persists assist enable changes for the selected climate", () => {
    const { saveZonePreconditioning, viewHost } = host({
      roomTemperatureEntityId: "sensor.bedroom_temperature",
    });
    const container = document.createElement("div");

    render(renderSensorsView(viewHost, ["climate.first"]), container);
    const toggle = container.querySelector("ha-switch") as HTMLElement & {
      checked: boolean;
    };
    toggle.checked = true;
    toggle.dispatchEvent(new Event("change", { bubbles: true }));

    expect(saveZonePreconditioning).toHaveBeenCalledWith(
      "climate.first",
      { room_sensor_assist_enabled: true },
    );
  });

  it("shows and persists the Room Assist refresh delay", () => {
    const { saveZonePreconditioning, viewHost } = host({
      assistEnabled: true,
      debounceSeconds: 30,
      expandedZoneIds: ["climate.first"],
      roomTemperatureEntityId: "sensor.bedroom_temperature",
    });
    const container = document.createElement("div");

    render(renderSensorsView(viewHost, ["climate.first"]), container);

    expect(container.textContent).toContain("roomSensorAssistDebounce");
    const debounceInput = [
      ...container.querySelectorAll<HTMLInputElement>(".sensor-number-input input"),
    ].find((input) => input.value === "30");
    expect(debounceInput).not.toBeUndefined();
    expect(debounceInput?.getAttribute("min")).toBe("0");
    expect(debounceInput?.getAttribute("max")).toBe("300");
    expect(debounceInput?.getAttribute("step")).toBe("1");

    debounceInput!.value = "10";
    debounceInput!.dispatchEvent(new Event("change", { bubbles: true }));

    expect(saveZonePreconditioning).toHaveBeenCalledWith(
      "climate.first",
      { room_sensor_assist_debounce_seconds: 10 },
    );

    debounceInput!.value = "500";
    debounceInput!.dispatchEvent(new Event("change", { bubbles: true }));

    expect(saveZonePreconditioning).toHaveBeenCalledWith(
      "climate.first",
      { room_sensor_assist_debounce_seconds: 300 },
    );
  });

  it("shows live room sensor assist values when a sensor is configured", () => {
    const { viewHost } = host({ expandedZoneIds: ["climate.second"] });
    const container = document.createElement("div");

    render(renderSensorsView(viewHost, ["climate.second"]), container);

    expect(container.textContent).toContain("roomSensorIntroTitle");
    expect(container.textContent).toContain("roomSensorIntroDetail");
    expect(container.querySelector(".sensor-runtime-section")).not.toBeNull();
    expect(container.querySelectorAll(".sensor-status-pill")).toHaveLength(1);
    expect(container.querySelector(".sensor-status-pill")?.textContent).toContain(
      "roomSensorStatusAssisting",
    );
    expect(container.textContent).toContain("roomSensorBlockScheduled:time=17:00");
    expect(container.textContent).toContain("roomSensorBlockActiveSince:time=17:00");
    expect(container.textContent).toContain("roomSensorBlockTarget:target=25 °C");
    expect(container.textContent).toContain("roomSensorBlockMode:mode=mode:heat");
    const scale = container.querySelector(".sensor-temperature-scale");
    expect(scale).not.toBeNull();
    expect(scale?.classList).toContain("mode-heat");
    expect(container.querySelector(".sensor-scale-track")?.getAttribute("aria-label")).toBe(
      "roomSensorTemperatureScale",
    );
    expect(container.querySelectorAll(".sensor-scale-marker")).toHaveLength(4);
    expect(container.querySelectorAll(".sensor-scale-callout")).toHaveLength(4);
    expect(container.querySelectorAll(".sensor-scale-metric")).toHaveLength(0);
    expect(container.querySelector(".sensor-scale-remaining")).not.toBeNull();
    expect(container.querySelector(".sensor-scale-offset")).not.toBeNull();
    expect(container.querySelector(".sensor-scale-offset-help")).not.toBeNull();
    expect(
      container.querySelector(".marker-climateTarget .sensor-scale-value-row .sensor-scale-offset"),
    ).not.toBeNull();
    expect(
      [...container.querySelectorAll(".sensor-scale-marker, .sensor-scale-callout-marker")]
        .map((element) => element.getAttribute("title")),
    ).toEqual([null, null, null, null, null, null, null, null]);
    expect(container.querySelector(".sensor-scale-legend")).toBeNull();
    expect(container.textContent).toContain("roomSensorRemainingValue:value=5 °C");
    expect(container.textContent).toContain("+5 °C");
    expect(container.textContent).toContain("roomSensorScheduledTarget");
    expect(container.textContent).toContain("roomSensorRoomTemperature");
    expect(container.textContent).toContain("roomSensorClimateTarget");
    expect(container.textContent).toContain("roomSensorClimateTemperature");
    expect(container.textContent).toContain("25 °C");
    expect(container.textContent).toContain("21 °C");
    expect(container.textContent).toContain("17.1 °C");
  });

  it("can hide Room Assist controls and live status for Lovelace cards", () => {
    const { viewHost } = host({ expandedZoneIds: ["climate.second"] });
    const container = document.createElement("div");

    render(
      renderSensorsView(viewHost, ["climate.second"], {
        showAssistSwitch: false,
        showDebounce: false,
        showLiveStatus: false,
        showMaxDelta: false,
        showRoomSensor: false,
      }),
      container,
    );

    expect(container.querySelector("ha-switch")).toBeNull();
    expect(container.querySelector(".sensor-picker-row")).toBeNull();
    expect(container.textContent).not.toContain("roomSensorAssistMaxDelta");
    expect(container.textContent).not.toContain("roomSensorAssistDebounce");
    expect(container.querySelector(".sensor-runtime-section")).toBeNull();
    expect(container.querySelector(".sensor-zone-content")).not.toBeNull();
  });

  it("uses the active block mode on the temperature scale", () => {
    const { viewHost } = host({
      expandedZoneIds: ["climate.second"],
      hvacMode: "cool",
    });
    const container = document.createElement("div");

    render(renderSensorsView(viewHost, ["climate.second"]), container);

    expect(container.querySelector(".sensor-temperature-scale")?.classList).toContain(
      "mode-cool",
    );
  });

  it("explains when a block is active early because of preconditioning", () => {
    const { viewHost } = host({
      activeFrom: "2026-05-19T16:30:00",
      expandedZoneIds: ["climate.second"],
      targetWhen: "2026-05-19T17:00:00+00:00",
    });
    const container = document.createElement("div");

    render(renderSensorsView(viewHost, ["climate.second"]), container);

    expect(container.textContent).toContain("roomSensorBlockScheduled:time=17:00");
    expect(container.textContent).toContain(
      "roomSensorBlockStartedEarly:time=16:30",
    );
    expect(
      [...container.querySelectorAll(".sensor-block-detail")]
        .map((element) => element.textContent?.trim()),
    ).toEqual([
      "roomSensorBlockStartedEarly:time=16:30",
      "roomSensorBlockScheduled:time=17:00",
      "roomSensorBlockTarget:target=25 °C",
      "roomSensorBlockMode:mode=mode:heat",
    ]);
  });

  it("keeps coincident temperature markers visible on separate lanes", () => {
    const { viewHost } = host({
      climateTargetTemperature: 25,
      expandedZoneIds: ["climate.second"],
    });
    const container = document.createElement("div");

    render(renderSensorsView(viewHost, ["climate.second"]), container);

    const scheduledMarker =
      container.querySelector<HTMLElement>(".sensor-scale-marker.marker-target");
    const climateTargetMarker = container.querySelector<HTMLElement>(
      ".sensor-scale-marker.marker-climateTarget",
    );
    const scheduledCallout = container.querySelector<HTMLElement>(
      ".sensor-scale-callout-marker.marker-target",
    );
    const climateTargetCallout = container.querySelector<HTMLElement>(
      ".sensor-scale-callout-marker.marker-climateTarget",
    );

    expect(scheduledCallout?.classList).toContain("lane-0");
    expect(climateTargetCallout?.classList).toContain("lane-1");
    expect(scheduledMarker?.style.left).toBe(climateTargetMarker?.style.left);
    expect(scheduledMarker).toBe(climateTargetMarker);
    expect(scheduledMarker?.classList).toContain("count-2");
    expect(scheduledMarker?.querySelector(".sensor-scale-dot")?.classList).toContain(
      "segmented",
    );
    expect(scheduledMarker?.style.getPropertyValue("--sensor-scale-dot-segments")).toContain(
      "conic-gradient",
    );
    expect(scheduledCallout?.style.getPropertyValue("--callout-left")).not.toBe(
      climateTargetCallout?.style.getPropertyValue("--callout-left"),
    );
    expect(
      [scheduledCallout, climateTargetCallout].some((marker) =>
        marker?.classList.contains("shifted"),
      ),
    ).toBe(true);
  });

  it("renders a single segmented dot when every temperature marker overlaps", () => {
    const { viewHost } = host({
      climateTargetTemperature: 25,
      expandedZoneIds: ["climate.second"],
      roomTemperature: 25,
      scheduledTargetTemperature: 25,
      thermostatTemperature: 25,
    });
    const container = document.createElement("div");

    render(renderSensorsView(viewHost, ["climate.second"]), container);

    const marker = container.querySelector<HTMLElement>(".sensor-scale-marker");
    const dot = marker?.querySelector(".sensor-scale-dot");
    const segmentStyle = marker?.style.getPropertyValue("--sensor-scale-dot-segments") ?? "";

    expect(container.querySelectorAll(".sensor-scale-marker")).toHaveLength(1);
    expect(container.querySelectorAll(".sensor-scale-callout")).toHaveLength(4);
    expect(marker?.classList).toContain("count-4");
    expect(marker?.classList).toContain("marker-target");
    expect(marker?.classList).toContain("marker-room");
    expect(marker?.classList).toContain("marker-climateTarget");
    expect(marker?.classList).toContain("marker-climate");
    expect(dot?.classList).toContain("segmented");
    expect(segmentStyle).toContain("var(--secondary-text-color) 0deg 90deg");
    expect(segmentStyle).toContain("var(--primary-color) 90deg 180deg");
    expect(segmentStyle).toContain("var(--success-color, #43a047) 180deg 270deg");
    expect(segmentStyle).toContain("var(--error-color, #d93025) 270deg 360deg");
    const calloutOrder = [...container.querySelectorAll<HTMLElement>(".sensor-scale-callout-marker")]
      .sort(
        (first, second) =>
          Number.parseFloat(first.style.getPropertyValue("--callout-left"))
          - Number.parseFloat(second.style.getPropertyValue("--callout-left")),
      )
      .map((marker) =>
        ["target", "room", "climateTarget", "climate"].find((key) =>
          marker.classList.contains(`marker-${key}`),
        ),
      );
    const segmentColorToMarker: Record<string, string> = {
      "--error-color, #d93025": "target",
      "--success-color, #43a047": "room",
      "--primary-color": "climateTarget",
      "--secondary-text-color": "climate",
    };
    const segmentOrder = [...segmentStyle.matchAll(/var\((--[^)]+)\)/g)].map(
      (match) => segmentColorToMarker[match[1]],
    );
    expect(segmentOrder).toEqual([...calloutOrder].reverse());
    expect(marker?.getAttribute("aria-label")).toContain("roomSensorScheduledTarget");
    expect(marker?.getAttribute("aria-label")).toContain("roomSensorClimateTemperature");
  });

  it("spreads close temperature marker callouts before they overlap", () => {
    const { viewHost } = host({
      climateTargetTemperature: 21.1,
      expandedZoneIds: ["climate.second"],
      roomTemperature: 20.9,
      scheduledTargetTemperature: 21,
      thermostatTemperature: 20.8,
    });
    const container = document.createElement("div");

    render(renderSensorsView(viewHost, ["climate.second"]), container);

    const calloutPositions = [
      ...container.querySelectorAll<HTMLElement>(".sensor-scale-callout-marker"),
    ].map((marker) => marker.style.getPropertyValue("--callout-left"));

    expect(new Set(calloutPositions).size).toBe(4);
    expect(
      container.querySelectorAll(".sensor-scale-callout-marker.shifted").length,
    ).toBeGreaterThan(0);
    expect(calloutPositions.every((position) => position.endsWith("%"))).toBe(true);
    expect(
      calloutPositions
        .map((position) => Number.parseFloat(position))
        .every((position) => position >= 10 && position <= 90),
    ).toBe(true);
  });

  it("keeps close edge marker callouts inside the available direction", () => {
    const { viewHost } = host({
      climateTargetTemperature: 20.2,
      expandedZoneIds: ["climate.second"],
      roomTemperature: 20,
      scheduledTargetTemperature: 20.1,
      thermostatTemperature: 10,
    });
    const container = document.createElement("div");

    render(renderSensorsView(viewHost, ["climate.second"]), container);

    const calloutPositions = [
      ...container.querySelectorAll<HTMLElement>(".sensor-scale-callout-marker"),
    ].map((marker) => Number.parseFloat(marker.style.getPropertyValue("--callout-left")));

    expect(calloutPositions.every((position) => position >= 10 && position <= 90)).toBe(
      true,
    );
    expect(new Set(calloutPositions).size).toBe(4);
    expect(
      container.querySelector(".sensor-scale-callout-marker.marker-climateTarget")?.classList,
    ).toContain("edge-right");
    expect(
      container.querySelector(
        ".sensor-scale-callout-marker.edge-right .sensor-scale-offset-tooltip",
      ),
    ).not.toBeNull();
  });

  it("shows a waiting state when assist is enabled without an active block", () => {
    const { viewHost } = host({
      expandedZoneIds: ["climate.second"],
      roomAssistStatus: "idle",
    });
    const container = document.createElement("div");

    render(renderSensorsView(viewHost, ["climate.second"]), container);

    expect(container.textContent).toContain("roomSensorNoActiveBlock");
    expect(container.textContent).toContain("roomSensorNoActiveBlockDetail");
    expect(container.querySelector(".sensor-idle-state")).not.toBeNull();
    expect(container.querySelector(".sensor-temperature-scale")).toBeNull();
  });

  it("shows a clear inactive state when a sensor is configured but assist is off", () => {
    const { viewHost } = host({
      expandedZoneIds: ["climate.first"],
      roomTemperatureEntityId: "sensor.bedroom_temperature",
    });
    const container = document.createElement("div");

    render(renderSensorsView(viewHost, ["climate.first"]), container);

    expect(container.textContent).toContain("roomSensorAssistDisabledDetail");
    expect(container.querySelector(".sensor-status-card")).toBeNull();
  });

  it("uses a Fahrenheit-friendly maximum assist delta range", () => {
    const { viewHost } = host({
      expandedZoneIds: ["climate.first"],
      roomTemperatureEntityId: "sensor.bedroom_temperature",
      assistEnabled: true,
    });
    (viewHost as unknown as { _temperatureUnit: () => string })._temperatureUnit =
      () => "°F";
    const container = document.createElement("div");

    render(renderSensorsView(viewHost, ["climate.first"]), container);

    const input = container.querySelector<HTMLInputElement>("input[type='number']");
    expect(input?.max).toBe("18");
    expect(container.textContent).toContain("°F");
  });

  it("does not show runtime metrics before a room sensor is configured", () => {
    const { viewHost } = host({ expandedZoneIds: ["climate.first"] });
    const container = document.createElement("div");

    render(renderSensorsView(viewHost, ["climate.first"]), container);

    expect(container.querySelector(".sensor-config-section")).not.toBeNull();
    expect(container.querySelector(".sensor-runtime-section")).toBeNull();
  });
});
