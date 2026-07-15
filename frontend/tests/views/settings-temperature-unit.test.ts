// @vitest-environment jsdom

import { render } from "lit";
import { describe, expect, it, vi } from "vitest";

import type { VelairViewHost } from "../../src/velair/host-types";
import { renderTemperatureUnitSettings } from "../../src/velair/views/settings-view";

function host(required: boolean): VelairViewHost {
  return {
    _data: {
      temperature_unit: "°C",
      home_assistant_temperature_unit: "°F",
      temperature_migration: {
        required,
        source_unit: required ? "°C" : "°F",
        target_unit: "°F",
        temperature_revision: 3,
      },
    },
    _maintenanceAction: undefined,
    _resetVelairData: vi.fn(),
    _resolveTemperatureMigration: vi.fn(),
    _t: (key: string, replacements?: Record<string, string | number>) =>
      replacements?.unit ? `${key}:${replacements.unit}` : key,
    _temperatureUnit: () => "°C",
  } as unknown as VelairViewHost;
}

describe("settings temperature unit", () => {
  it("shows the unit detected by the backend as read-only", () => {
    const container = document.createElement("div");

    render(renderTemperatureUnitSettings(host(false)), container);

    expect(container.querySelector(".settings-temperature-value")?.textContent).toBe("°F");
    expect(container.textContent).toContain("temperatureUnitManagedByHomeAssistant");
    expect(container.querySelector("select")).toBeNull();
    expect(container.querySelector(".temperature-migration-action")).toBeNull();
  });

  it("offers an explicit source-unit decision only when migration is required", () => {
    const migrationHost = host(true);
    const container = document.createElement("div");

    render(renderTemperatureUnitSettings(migrationHost), container);
    const buttons = Array.from(container.querySelectorAll<HTMLButtonElement>(".temperature-migration-buttons button"));
    buttons[0].click();

    expect(buttons.map((button) => button.textContent?.trim())).toEqual([
      "temperatureMigrationUse",
    ]);
    expect(migrationHost._resolveTemperatureMigration).toHaveBeenCalledWith("°C");
  });

  it("offers reset instead of migration for published legacy Celsius data", () => {
    const legacyHost = host(true);
    legacyHost._data!.temperature_migration.reason = "legacy_celsius_upgrade_reset_required";
    const container = document.createElement("div");

    render(renderTemperatureUnitSettings(legacyHost), container);
    const button = container.querySelector<HTMLButtonElement>(".temperature-migration-buttons button");
    button?.click();

    expect(container.textContent).toContain("temperatureLegacyResetQuestion");
    expect(button?.textContent?.trim()).toBe("resetVelair");
    expect(legacyHost._resetVelairData).toHaveBeenCalledOnce();
    expect(legacyHost._resolveTemperatureMigration).not.toHaveBeenCalled();
  });
});
