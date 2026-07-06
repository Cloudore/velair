// @vitest-environment jsdom

import { render } from "lit";
import { describe, expect, it, vi } from "vitest";

import type { VelairViewHost } from "../../src/velair/host-types";
import { renderTemplatePanel } from "../../src/velair/views/schedule-view";

function host() {
  const state = {
    _inputValue: (event: Event) => (event.target as HTMLSelectElement).value,
    _scheduleTemplates: () => [{ key: "comfort", name: "Comfort", blocks: [] }],
    _selectScheduleTemplate: vi.fn((key: string) => {
      state._selectedTemplateKey = key ? "" : key;
    }),
    _selectedTemplateKey: "",
    _t: (key: string) => key,
    _templateLabel: (template: { name?: string; key: string }) => template.name ?? template.key,
  };
  return state as unknown as VelairViewHost;
}

describe("schedule view", () => {
  it("resets the template selector visually after applying a schedule template", () => {
    const container = document.createElement("div");
    const viewHost = host();

    render(renderTemplatePanel(viewHost), container);

    const select = container.querySelector("select") as HTMLSelectElement;
    select.value = "comfort";
    select.dispatchEvent(new Event("change"));

    expect(viewHost._selectScheduleTemplate).toHaveBeenCalledWith("comfort");
    expect(select.value).toBe("");
  });
});
