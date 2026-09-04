import { html } from "lit";
import type { GuardsGlobalSettings, HouseModeStatus, HouseModesGlobalSettings } from "../../types";
import { onOffEntityOptions, presenceEntityOptions } from "./entity-options";
import {
  fanModeChoices,
  hvacModeChoices,
  renderEntityListRow,
  renderEntityRow,
  renderMinutesRow,
  renderSelectRow,
  renderTemperatureRow,
  renderTimeRow,
  renderToggleRow,
  type PresenceFormContext,
} from "./form-rows";
import { renderHouseModeChip } from "./runtime-chips";

export type PresenceGlobalSectionOptions = {
  houseModes: HouseModesGlobalSettings;
  guards: GuardsGlobalSettings;
  houseMode: HouseModeStatus;
  hvacModes: string[];
  fanModes: string[];
  now: Date;
  saveHouseModes(patch: Partial<HouseModesGlobalSettings>): void;
  saveGuards(patch: Partial<GuardsGlobalSettings>): void;
};

export function renderPresenceGlobalSection(ctx: PresenceFormContext, options: PresenceGlobalSectionOptions) {
  const { houseModes, guards, saveHouseModes, saveGuards } = options;
  return html`
    <section class="presence-section presence-global">
      <div class="presence-zone-section-heading">
        <h3><ha-icon icon="mdi:home-group"></ha-icon>${ctx.t("presenceGlobalTitle")}</h3>
        <div class="presence-chips">${renderHouseModeChip(ctx, options.houseMode, options.now)}</div>
      </div>
      <p class="presence-section-detail">${ctx.t("presenceGlobalDetail")}</p>

      <div class="presence-subsection presence-house-presence">
        <h4><ha-icon icon="mdi:account-group-outline"></ha-icon>${ctx.t("presenceHousePresenceTitle")}</h4>
        <div class="presence-fields">
          ${renderEntityListRow(ctx, {
            id: "house-presence-entities",
            label: ctx.t("presenceHousePresenceEntities"),
            values: houseModes.presence_entity_ids,
            entities: presenceEntityOptions(ctx.hass, houseModes.presence_entity_ids),
            helpKey: "presenceHousePresenceEntitiesHelp",
            onChange: (values) => saveHouseModes({ presence_entity_ids: values }),
          })}
          ${renderEntityListRow(ctx, {
            id: "house-corroboration-entities",
            label: ctx.t("presenceHouseCorroborationEntities"),
            values: houseModes.presence_corroboration_entity_ids,
            entities: onOffEntityOptions(ctx.hass, houseModes.presence_corroboration_entity_ids),
            helpKey: "presenceHouseCorroborationEntitiesHelp",
            onChange: (values) => saveHouseModes({ presence_corroboration_entity_ids: values }),
          })}
          ${renderMinutesRow(ctx, {
            id: "house-corroboration-quiet",
            label: ctx.t("presenceHouseCorroborationQuiet"),
            value: houseModes.presence_corroboration_quiet_minutes,
            max: 1440,
            helpKey: "presenceHouseCorroborationQuietHelp",
            onChange: (value) => saveHouseModes({ presence_corroboration_quiet_minutes: value }),
          })}
          ${renderMinutesRow(ctx, {
            id: "house-away-after",
            label: ctx.t("presenceAwayAfter"),
            value: houseModes.away_after_minutes,
            min: 1,
            helpKey: "presenceAwayAfterHelp",
            onChange: (value) => saveHouseModes({ away_after_minutes: value }),
          })}
          ${renderMinutesRow(ctx, {
            id: "house-away-deep-after",
            label: ctx.t("presenceAwayDeepAfter"),
            value: houseModes.away_deep_after_minutes,
            helpKey: "presenceAwayDeepAfterHelp",
            onChange: (value) => saveHouseModes({ away_deep_after_minutes: value }),
          })}
          ${renderMinutesRow(ctx, {
            id: "house-arrival-release",
            label: ctx.t("presenceArrivalRelease"),
            value: houseModes.arrival_release_minutes,
            max: 1440,
            helpKey: "presenceArrivalReleaseHelp",
            onChange: (value) => saveHouseModes({ arrival_release_minutes: value }),
          })}
        </div>
      </div>

      <div class="presence-subsection presence-sleep">
        <h4><ha-icon icon="mdi:weather-night"></ha-icon>${ctx.t("presenceSleepTitle")}</h4>
        <div class="presence-fields">
          ${renderEntityRow(ctx, {
            id: "house-sleep-entity",
            label: ctx.t("presenceSleepEntity"),
            value: houseModes.sleep_entity_id,
            entities: onOffEntityOptions(ctx.hass, houseModes.sleep_entity_id ? [houseModes.sleep_entity_id] : []),
            emptyLabel: ctx.t("presenceNoEntity"),
            helpKey: "presenceSleepEntityHelp",
            onChange: (value) => saveHouseModes({ sleep_entity_id: value }),
          })}
          ${renderTimeRow(ctx, {
            id: "house-presleep-time",
            label: ctx.t("presencePresleepTime"),
            value: houseModes.presleep_time,
            helpKey: "presencePresleepTimeHelp",
            onChange: (value) => saveHouseModes({ presleep_time: value }),
          })}
          ${renderMinutesRow(ctx, {
            id: "house-presleep-duration",
            label: ctx.t("presencePresleepDuration"),
            value: houseModes.presleep_duration_minutes,
            min: 1,
            max: 1440,
            helpKey: "presencePresleepDurationHelp",
            onChange: (value) => saveHouseModes({ presleep_duration_minutes: value }),
          })}
        </div>
      </div>

      <div class="presence-subsection presence-travel">
        <h4><ha-icon icon="mdi:airplane"></ha-icon>${ctx.t("presenceTravelTitle")}</h4>
        <div class="presence-fields">
          ${renderEntityRow(ctx, {
            id: "house-travel-entity",
            label: ctx.t("presenceTravelEntity"),
            value: houseModes.travel_entity_id,
            entities: onOffEntityOptions(ctx.hass, houseModes.travel_entity_id ? [houseModes.travel_entity_id] : []),
            emptyLabel: ctx.t("presenceNoEntity"),
            helpKey: "presenceTravelEntityHelp",
            onChange: (value) => saveHouseModes({ travel_entity_id: value }),
          })}
          ${renderTemperatureRow(ctx, {
            id: "house-travel-park-temperature",
            label: ctx.t("presenceTravelParkTemperature"),
            value: houseModes.travel_park_temperature,
            helpKey: "presenceTravelParkTemperatureHelp",
            onChange: (value) => {
              if (value !== null) {
                saveHouseModes({ travel_park_temperature: value });
              }
            },
          })}
          ${renderSelectRow(ctx, {
            id: "house-travel-park-hvac-mode",
            label: ctx.t("presenceTravelParkHvacMode"),
            value: houseModes.travel_park_hvac_mode ?? "",
            choices: hvacModeChoices(ctx, options.hvacModes, houseModes.travel_park_hvac_mode),
            emptyLabel: ctx.t("presenceKeepHvacMode"),
            onChange: (value) => saveHouseModes({ travel_park_hvac_mode: value || null }),
          })}
          ${renderSelectRow(ctx, {
            id: "house-travel-park-fan-mode",
            label: ctx.t("presenceTravelParkFanMode"),
            value: houseModes.travel_park_fan_mode ?? "",
            choices: fanModeChoices(ctx, options.fanModes, houseModes.travel_park_fan_mode),
            emptyLabel: ctx.t("presenceKeepFanMode"),
            onChange: (value) => saveHouseModes({ travel_park_fan_mode: value || null }),
          })}
          ${renderToggleRow(ctx, {
            id: "house-travel-freeze-off-heads",
            label: ctx.t("presenceTravelFreezeOffHeads"),
            checked: houseModes.travel_freeze_off_heads,
            helpKey: "presenceTravelFreezeOffHeadsHelp",
            onChange: (checked) => saveHouseModes({ travel_freeze_off_heads: checked }),
          })}
          ${renderToggleRow(ctx, {
            id: "house-travel-humidity-assist",
            label: ctx.t("presenceTravelHumidityAssist"),
            checked: houseModes.travel_enable_humidity_assist,
            helpKey: "presenceTravelHumidityAssistHelp",
            onChange: (checked) => saveHouseModes({ travel_enable_humidity_assist: checked }),
          })}
          ${renderToggleRow(ctx, {
            id: "house-travel-auto-exit",
            label: ctx.t("presenceTravelAutoExit"),
            checked: houseModes.travel_auto_exit_on_arrival,
            helpKey: "presenceTravelAutoExitHelp",
            onChange: (checked) => saveHouseModes({ travel_auto_exit_on_arrival: checked }),
          })}
        </div>
      </div>

      <div class="presence-subsection presence-never-off">
        <h4><ha-icon icon="mdi:shield-check-outline"></ha-icon>${ctx.t("presenceNeverOffTitle")}</h4>
        <div class="presence-fields">
          ${renderToggleRow(ctx, {
            id: "guards-never-off-enabled",
            label: ctx.t("presenceNeverOffEnabled"),
            checked: guards.never_off_enabled,
            helpKey: "presenceNeverOffEnabledHelp",
            onChange: (checked) => saveGuards({ never_off_enabled: checked }),
          })}
          ${renderMinutesRow(ctx, {
            id: "guards-never-off-grace",
            label: ctx.t("presenceNeverOffGrace"),
            value: guards.never_off_grace_minutes,
            min: 1,
            max: 1440,
            helpKey: "presenceNeverOffGraceHelp",
            onChange: (value) => saveGuards({ never_off_grace_minutes: value }),
          })}
          ${renderMinutesRow(ctx, {
            id: "guards-never-off-snooze",
            label: ctx.t("presenceNeverOffSnooze"),
            value: guards.never_off_snooze_minutes,
            min: 1,
            helpKey: "presenceNeverOffSnoozeHelp",
            onChange: (value) => saveGuards({ never_off_snooze_minutes: value }),
          })}
          ${renderMinutesRow(ctx, {
            id: "guards-never-off-vacancy-release",
            label: ctx.t("presenceNeverOffVacancyRelease"),
            value: guards.never_off_snooze_release_vacant_minutes,
            max: 1440,
            helpKey: "presenceNeverOffVacancyReleaseHelp",
            onChange: (value) => saveGuards({ never_off_snooze_release_vacant_minutes: value }),
          })}
          ${renderToggleRow(ctx, {
            id: "guards-never-off-respect-travel",
            label: ctx.t("presenceNeverOffRespectTravel"),
            checked: guards.never_off_respect_travel,
            helpKey: "presenceNeverOffRespectTravelHelp",
            onChange: (checked) => saveGuards({ never_off_respect_travel: checked }),
          })}
        </div>
      </div>

      <div class="presence-subsection presence-manual-release">
        <h4><ha-icon icon="mdi:hand-back-right-outline"></ha-icon>${ctx.t("presenceManualReleaseTitle")}</h4>
        <div class="presence-fields">
          ${renderToggleRow(ctx, {
            id: "guards-manual-release-enabled",
            label: ctx.t("presenceManualReleaseEnabled"),
            checked: guards.manual_release_enabled,
            helpKey: "presenceManualReleaseEnabledHelp",
            onChange: (checked) => saveGuards({ manual_release_enabled: checked }),
          })}
          ${renderMinutesRow(ctx, {
            id: "guards-manual-lease",
            label: ctx.t("presenceManualLease"),
            value: guards.manual_lease_minutes,
            max: 1440,
            helpKey: "presenceManualLeaseHelp",
            onChange: (value) => saveGuards({ manual_lease_minutes: value }),
          })}
          ${renderMinutesRow(ctx, {
            id: "guards-manual-release-vacant",
            label: ctx.t("presenceManualReleaseVacant"),
            value: guards.manual_release_vacant_minutes,
            min: 1,
            max: 1440,
            helpKey: "presenceManualReleaseVacantHelp",
            onChange: (value) => saveGuards({ manual_release_vacant_minutes: value }),
          })}
          ${renderToggleRow(ctx, {
            id: "guards-manual-release-on-travel",
            label: ctx.t("presenceManualReleaseOnTravel"),
            checked: guards.manual_release_on_travel,
            helpKey: "presenceManualReleaseOnTravelHelp",
            onChange: (checked) => saveGuards({ manual_release_on_travel: checked }),
          })}
          ${renderEntityListRow(ctx, {
            id: "guards-owner-entities",
            label: ctx.t("presenceOwnerEntities"),
            values: guards.owner_entity_ids,
            entities: presenceEntityOptions(ctx.hass, guards.owner_entity_ids),
            helpKey: "presenceOwnerEntitiesHelp",
            onChange: (values) => saveGuards({ owner_entity_ids: values }),
          })}
          ${renderMinutesRow(ctx, {
            id: "guards-owner-away",
            label: ctx.t("presenceOwnerAway"),
            value: guards.owner_away_minutes,
            max: 1440,
            helpKey: "presenceOwnerAwayHelp",
            onChange: (value) => saveGuards({ owner_away_minutes: value }),
          })}
          ${renderToggleRow(ctx, {
            id: "guards-manual-release-below-minimum",
            label: ctx.t("presenceManualReleaseBelowMinimum"),
            checked: guards.manual_release_below_minimum,
            helpKey: "presenceManualReleaseBelowMinimumHelp",
            onChange: (checked) => saveGuards({ manual_release_below_minimum: checked }),
          })}
        </div>
      </div>
    </section>
  `;
}
