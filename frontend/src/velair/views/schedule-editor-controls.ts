import { html } from "lit";

import type { CloneDayPreset, ExternalSwitchpointUsage } from "../domain/schedule-editor";
import type { TranslationKey } from "../translations";

type Translate = (key: TranslationKey, params?: Record<string, string | number>) => string;

const CLONE_PRESETS: Array<{ preset: Exclude<CloneDayPreset, "clear">; key: TranslationKey; icon: string }> = [
  { preset: "weekdays", key: "clonePresetWeekdays", icon: "mdi:calendar-week" },
  { preset: "weekend", key: "clonePresetWeekend", icon: "mdi:calendar-weekend" },
  { preset: "all", key: "clonePresetAll", icon: "mdi:calendar-multiselect" },
];

export function renderCloneDayPresets(
  t: Translate,
  selectPreset: (preset: CloneDayPreset) => void,
  hasSelection: boolean,
) {
  return html`
    <div class="copy-presets" role="group" aria-label=${t("clonePresetLabel")}>
      <div class="copy-preset-options">
        ${CLONE_PRESETS.map(({ preset, key, icon }) => html`
        <button class="copy-preset-button" type="button" @click=${() => selectPreset(preset)}>
          <ha-icon icon=${icon}></ha-icon>
          <span>${t(key)}</span>
        </button>
        `)}
      </div>
      <div class="copy-preset-clear-group">
        <button
          class=${`copy-preset-button copy-preset-clear${hasSelection ? " actionable" : ""}`}
          type="button"
          ?disabled=${!hasSelection}
          @click=${() => selectPreset("clear")}
        >
          <ha-icon icon="mdi:selection-remove"></ha-icon>
          <span>${t("clonePresetClear")}</span>
        </button>
      </div>
    </div>
  `;
}

export function renderExternalSwitchpointUsage(t: Translate, usage?: ExternalSwitchpointUsage) {
  if (!usage) return undefined;
  const progress = usage.max > 0 ? Math.min(100, (usage.used / usage.max) * 100) : 0;
  return html`
    <div class=${`external-switchpoint-usage ${usage.state}`}>
      <strong>${t("externalSwitchpointUsage", { used: usage.used, max: usage.max })}</strong>
      <span>${t(
        usage.implicitMidnight
          ? "externalSwitchpointBreakdownContinuity"
          : "externalSwitchpointBreakdown",
        { count: usage.scheduled },
      )}</span>
      <div class="external-switchpoint-meter" aria-hidden="true">
        <span style=${`width: ${progress}%`}></span>
      </div>
    </div>
  `;
}
