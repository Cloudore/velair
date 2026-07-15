// @vitest-environment jsdom

import { render } from "lit";
import { describe, expect, it, vi } from "vitest";

import type { VelairViewHost } from "../../src/velair/host-types";
import { renderSettingsZoneOrderRow } from "../../src/velair/views/settings-view";

function host(
  preconditioningEnabled: boolean,
  options: { roomSensorAssistEnabled?: boolean; roomSensorConfigured?: boolean } = {},
) {
  return {
    _data: {
      zones: {
        "climate.office": {
          preconditioning: {
            enabled: preconditioningEnabled,
            room_sensor_assist_enabled: options.roomSensorAssistEnabled ?? false,
            room_temperature_entity_id: options.roomSensorConfigured === false
              ? null
              : "sensor.office_temperature",
          },
        },
      },
    },
    _climateProvidedData: () => [],
    _climateSupportedModes: () => ["heat"],
    _entityDiagnostic: () => ({ status: "ok", tooltip: "Available", messages: [] }),
    _entityExists: () => true,
    _entityTemperatureLimits: () => [7, 35],
    _entityTemperatureStep: () => 0.5,
    _formatTemperatureLimit: (value: number) => String(value),
    _friendlyEntityName: () => "Office",
    _handleSettingsZoneDragEnd: vi.fn(),
    _handleSettingsZoneDragOver: vi.fn(),
    _handleSettingsZoneDragStart: vi.fn(),
    _handleSettingsZoneDrop: vi.fn(),
    _modeLabel: () => "Heat",
    _moveSettingsZone: vi.fn(),
    _t: (key: string) => key,
    _temperatureUnit: () => "\u00b0C",
  } as unknown as VelairViewHost;
}

describe("settings climate row", () => {
  it("shows preconditioning when it is enabled for the climate", () => {
    const container = document.createElement("div");

    render(renderSettingsZoneOrderRow(host(true), "climate.office", 0, 1), container);

    const badge = container.querySelector(".settings-feature-badge.preconditioning");
    expect(badge?.textContent).toContain("preconditioning");
    expect(badge?.getAttribute("aria-label")).toBe("preconditioningEnabled");
    expect(badge?.querySelector("ha-icon")?.getAttribute("icon")).toBe("mdi:clock-fast");
  });

  it("does not show the indicator when preconditioning is disabled", () => {
    const container = document.createElement("div");

    render(renderSettingsZoneOrderRow(host(false), "climate.office", 0, 1), container);

    expect(container.querySelector(".settings-feature-badge.preconditioning")).toBeNull();
  });

  it("shows room assist when a room sensor is configured and assist is enabled", () => {
    const container = document.createElement("div");

    render(
      renderSettingsZoneOrderRow(
        host(false, { roomSensorAssistEnabled: true }),
        "climate.office",
        0,
        1,
      ),
      container,
    );

    const badge = container.querySelector(".settings-feature-badge.room-assist");
    expect(badge?.textContent).toContain("roomSensorAssistBadge");
    expect(badge?.getAttribute("aria-label")).toBe("roomSensorAssistEnabled");
    expect(badge?.querySelector("ha-icon")?.getAttribute("icon")).toBe(
      "mdi:home-thermometer-outline",
    );
  });

  it("does not show room assist when no room sensor is configured", () => {
    const container = document.createElement("div");

    render(
      renderSettingsZoneOrderRow(
        host(false, { roomSensorAssistEnabled: true, roomSensorConfigured: false }),
        "climate.office",
        0,
        1,
      ),
      container,
    );

    expect(container.querySelector(".settings-feature-badge.room-assist")).toBeNull();
  });

  it("explains when Home Assistant does not report a temperature step", () => {
    const container = document.createElement("div");
    const viewHost = host(false);
    viewHost._entityTemperatureStep = () => undefined;

    render(renderSettingsZoneOrderRow(viewHost, "climate.office", 0, 1), container);

    const status = container.querySelector(".capability-not-reported");
    expect(status?.textContent).toContain(
      "temperatureStep: temperatureStepNotReported",
    );
    expect(status?.getAttribute("title")).toBe(
      "temperatureStepNotReportedDescription",
    );
  });

  it("continues to show the exact reported temperature step", () => {
    const container = document.createElement("div");

    render(renderSettingsZoneOrderRow(host(false), "climate.office", 0, 1), container);

    const step = [...container.querySelectorAll(".settings-facts > span")].find(
      (item) => item.textContent?.includes("temperatureStep:"),
    );
    expect(step?.textContent).toContain("temperatureStep: 0.5");
    expect(step?.classList.contains("capability-not-reported")).toBe(false);
  });
});
