// @vitest-environment jsdom

import { render } from "lit";
import { describe, expect, it, vi } from "vitest";

import {
  renderCloneDayPresets,
  renderExternalSwitchpointUsage,
} from "../../src/velair/views/schedule-editor-controls";

const t = (key: string, values?: Record<string, string | number>) =>
  values ? `${key}:${Object.values(values).join("/")}` : key;

describe("shared schedule editor controls", () => {
  it("renders the two-line controller usage and its limit states", () => {
    const container = document.createElement("div");
    render(renderExternalSwitchpointUsage(t as never, {
      scheduled: 2,
      implicitMidnight: 1,
      used: 3,
      max: 6,
      state: "normal",
    }), container);
    expect(container.querySelector(".external-switchpoint-usage")?.textContent)
      .toContain("externalSwitchpointUsage:3/6");
    expect(container.querySelector(".external-switchpoint-usage")?.textContent)
      .toContain("externalSwitchpointBreakdownContinuity:2");

    render(renderExternalSwitchpointUsage(t as never, {
      scheduled: 6,
      implicitMidnight: 0,
      used: 6,
      max: 6,
      state: "at-limit",
    }), container);
    expect(container.querySelector(".external-switchpoint-usage")?.classList).toContain("at-limit");
    expect(container.querySelector(".external-switchpoint-meter span")?.getAttribute("style"))
      .toContain("width: 100%");

    render(renderExternalSwitchpointUsage(t as never, {
      scheduled: 6,
      implicitMidnight: 1,
      used: 7,
      max: 6,
      state: "over-limit",
    }), container);
    expect(container.querySelector(".external-switchpoint-usage")?.classList).toContain("over-limit");
  });

  it("offers all four selection presets without invoking a clone action", () => {
    const container = document.createElement("div");
    const selectPreset = vi.fn();
    const clone = vi.fn();
    render(renderCloneDayPresets(t as never, selectPreset, false), container);

    const buttons = [...container.querySelectorAll<HTMLButtonElement>(".copy-preset-button")];
    expect(buttons.map((button) => button.textContent?.trim())).toEqual([
      "clonePresetWeekdays",
      "clonePresetWeekend",
      "clonePresetAll",
      "clonePresetClear",
    ]);
    expect(buttons.slice(0, 3).map((button) => button.querySelector("ha-icon")?.getAttribute("icon")))
      .toEqual(["mdi:calendar-week", "mdi:calendar-weekend", "mdi:calendar-multiselect"]);
    expect(buttons[3].classList).toContain("copy-preset-clear");
    expect(buttons[3].querySelector("ha-icon")?.getAttribute("icon")).toBe("mdi:selection-remove");
    expect(buttons[3].disabled).toBe(true);
    expect(buttons[3].classList).not.toContain("actionable");
    buttons[3].click();
    expect(selectPreset).not.toHaveBeenCalledWith("clear");
    buttons[1].click();
    expect(selectPreset).toHaveBeenCalledWith("weekend");
    expect(clone).not.toHaveBeenCalled();

    render(renderCloneDayPresets(t as never, selectPreset, true), container);
    const activeClear = container.querySelector<HTMLButtonElement>(".copy-preset-clear")!;
    expect(activeClear.disabled).toBe(false);
    expect(activeClear.classList).toContain("actionable");
    activeClear.click();
    expect(selectPreset).toHaveBeenCalledWith("clear");
  });
});
