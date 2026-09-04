import { html } from "lit";
import type { TranslationKey } from "../../translations";
import type { HouseModesZoneSettings } from "../../types";
import {
  fanModeChoices,
  renderSelectRow,
  renderTemperatureRow,
  renderToggleRow,
  type PresenceFormContext,
} from "./form-rows";
import { SLEEP_CONSTRAINTS, holdConstraintLabelKey } from "./presence-settings";

export type HouseModesSectionOptions = {
  entityId: string;
  settings: HouseModesZoneSettings;
  fanModes: string[];
  save(patch: Partial<HouseModesZoneSettings>): void;
};

export function renderHouseModesSection(ctx: PresenceFormContext, options: HouseModesSectionOptions) {
  const { settings, save } = options;
  const id = (suffix: string) => `house-modes-${suffix}-${options.entityId}`;
  return html`
    <section class="presence-zone-section presence-house-modes">
      <div class="presence-zone-section-heading">
        <h3><ha-icon icon="mdi:home-clock-outline"></ha-icon>${ctx.t("presenceHouseModesTitle")}</h3>
      </div>
      <p class="presence-section-detail">${ctx.t("presenceHouseModesDetail")}</p>

      <div class="presence-subsection presence-away">
        <h4><ha-icon icon="mdi:home-export-outline"></ha-icon>${ctx.t("presenceAwayTitle")}</h4>
        <div class="presence-fields">
          ${renderToggleRow(ctx, {
            id: id("away-enabled"),
            label: ctx.t("presenceAwayEnabled"),
            checked: settings.away_enabled,
            helpKey: "presenceAwayEnabledHelp",
            onChange: (checked) => save({ away_enabled: checked }),
          })}
          ${renderTemperatureRow(ctx, {
            id: id("away-temperature"),
            label: ctx.t("presenceAwayTemperature"),
            value: settings.away_temperature,
            helpKey: "presenceAwayTemperatureHelp",
            onChange: (value) => {
              if (value !== null) {
                save({ away_temperature: value });
              }
            },
          })}
          ${renderTemperatureRow(ctx, {
            id: id("away-deep-temperature"),
            label: ctx.t("presenceAwayDeepTemperature"),
            value: settings.away_deep_temperature,
            nullable: true,
            placeholder: ctx.t("presenceSkipZone"),
            helpKey: "presenceAwayDeepTemperatureHelp",
            onChange: (value) => save({ away_deep_temperature: value }),
          })}
        </div>
      </div>

      <div class="presence-subsection presence-zone-sleep">
        <h4><ha-icon icon="mdi:weather-night"></ha-icon>${ctx.t("presenceSleepTitle")}</h4>
        <div class="presence-fields">
          ${renderToggleRow(ctx, {
            id: id("sleep-enabled"),
            label: ctx.t("presenceSleepEnabled"),
            checked: settings.sleep_enabled,
            helpKey: "presenceSleepEnabledHelp",
            onChange: (checked) => save({ sleep_enabled: checked }),
          })}
          ${renderTemperatureRow(ctx, {
            id: id("sleep-temperature"),
            label: ctx.t("presenceSleepTemperature"),
            value: settings.sleep_temperature,
            helpKey: "presenceSleepTemperatureHelp",
            onChange: (value) => {
              if (value !== null) {
                save({ sleep_temperature: value });
              }
            },
          })}
          ${renderSelectRow(ctx, {
            id: id("sleep-constraint"),
            label: ctx.t("presenceSleepConstraint"),
            value: settings.sleep_constraint,
            choices: SLEEP_CONSTRAINTS.map((constraint) => ({
              value: constraint,
              label: ctx.t(holdConstraintLabelKey(constraint) as TranslationKey),
            })),
            helpKey: "presenceSleepConstraintHelp",
            onChange: (value) => save({ sleep_constraint: value === "absolute" ? "absolute" : "raise_only" }),
          })}
          ${renderSelectRow(ctx, {
            id: id("sleep-fan-mode"),
            label: ctx.t("presenceSleepFanMode"),
            value: settings.sleep_fan_mode ?? "",
            choices: fanModeChoices(ctx, options.fanModes, settings.sleep_fan_mode),
            emptyLabel: ctx.t("presenceKeepFanMode"),
            helpKey: "presenceSleepFanModeHelp",
            onChange: (value) => save({ sleep_fan_mode: value || null }),
          })}
          ${renderTemperatureRow(ctx, {
            id: id("sleep-minimum-temperature"),
            label: ctx.t("presenceSleepMinimumTemperature"),
            value: settings.sleep_minimum_temperature,
            nullable: true,
            placeholder: ctx.t("presenceKeepLimit"),
            helpKey: "presenceSleepMinimumTemperatureHelp",
            onChange: (value) => save({ sleep_minimum_temperature: value }),
          })}
          ${renderTemperatureRow(ctx, {
            id: id("presleep-temperature"),
            label: ctx.t("presencePresleepTemperature"),
            value: settings.presleep_temperature,
            nullable: true,
            placeholder: ctx.t("presenceSkipZone"),
            helpKey: "presencePresleepTemperatureHelp",
            onChange: (value) => save({ presleep_temperature: value }),
          })}
        </div>
      </div>

      <div class="presence-subsection presence-zone-travel">
        <h4><ha-icon icon="mdi:airplane"></ha-icon>${ctx.t("presenceTravelTitle")}</h4>
        <div class="presence-fields">
          ${renderToggleRow(ctx, {
            id: id("travel-park-enabled"),
            label: ctx.t("presenceTravelParkEnabled"),
            checked: settings.travel_park_enabled,
            helpKey: "presenceTravelParkEnabledHelp",
            onChange: (checked) => save({ travel_park_enabled: checked }),
          })}
        </div>
      </div>
    </section>
  `;
}
