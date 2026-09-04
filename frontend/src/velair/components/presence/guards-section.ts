import { html, nothing } from "lit";
import type { TranslationKey } from "../../translations";
import type { ActivityHold, GuardsZoneSettings } from "../../types";
import { friendlyEntityLabel, onOffEntityOptions } from "./entity-options";
import {
  hvacModeChoices,
  renderEntityRow,
  renderMinutesRow,
  renderSelectRow,
  renderTemperatureRow,
  renderTextRow,
  renderToggleRow,
  type PresenceFormContext,
} from "./form-rows";
import { HOLD_CONSTRAINTS, activityHold, holdConstraintLabelKey } from "./presence-settings";

export type GuardsSectionOptions = {
  entityId: string;
  settings: GuardsZoneSettings;
  hvacModes: string[];
  save(patch: Partial<GuardsZoneSettings>): void;
};

export function renderGuardsSection(ctx: PresenceFormContext, options: GuardsSectionOptions) {
  const { settings, save } = options;
  const holds = settings.activity_holds;
  const updateHold = (index: number, patch: Partial<ActivityHold>) =>
    save({ activity_holds: holds.map((hold, position) => (position === index ? { ...hold, ...patch } : hold)) });
  return html`
    <section class="presence-zone-section presence-guards">
      <div class="presence-zone-section-heading">
        <h3><ha-icon icon="mdi:shield-home-outline"></ha-icon>${ctx.t("presenceGuardsTitle")}</h3>
      </div>
      <p class="presence-section-detail">${ctx.t("presenceGuardsDetail")}</p>
      <div class="presence-fields">
        ${renderToggleRow(ctx, {
          id: `guards-zone-never-off-${options.entityId}`,
          label: ctx.t("presenceZoneNeverOffEnabled"),
          checked: settings.never_off_enabled,
          helpKey: "presenceZoneNeverOffEnabledHelp",
          onChange: (checked) => save({ never_off_enabled: checked }),
        })}
        ${renderSelectRow(ctx, {
          id: `guards-zone-below-minimum-action-${options.entityId}`,
          label: ctx.t("presenceZoneBelowMinimumAction"),
          value: settings.manual_release_below_minimum_action,
          choices: [
            { value: "release", label: ctx.t("presenceBelowMinimumActionRelease") },
            { value: "floor_hold", label: ctx.t("presenceBelowMinimumActionFloorHold") },
          ],
          helpKey: "presenceZoneBelowMinimumActionHelp",
          onChange: (value) => save({ manual_release_below_minimum_action: value === "floor_hold" ? "floor_hold" : "release" }),
        })}
      </div>

      <div class="presence-subsection presence-activity-holds">
        <h4><ha-icon icon="mdi:stove"></ha-icon>${ctx.t("presenceActivityHoldsTitle")}</h4>
        <p class="presence-section-detail">${ctx.t("presenceActivityHoldsDetail")}</p>
        ${holds.length
          ? holds.map((hold, index) => renderActivityHold(ctx, options, hold, index, updateHold))
          : html`<span class="presence-empty-list">${ctx.t("presenceNoActivityHolds")}</span>`}
        <div class="presence-actions">
          <button
            type="button"
            class="command-button compact presence-activity-hold-add"
            ?disabled=${ctx.disabled}
            @click=${() => save({ activity_holds: [...holds, activityHold(undefined, ctx.temperatureUnit)] })}
          ><ha-icon icon="mdi:plus"></ha-icon><span>${ctx.t("presenceAddActivityHold")}</span></button>
        </div>
      </div>
    </section>
  `;
}

function renderActivityHold(
  ctx: PresenceFormContext,
  options: GuardsSectionOptions,
  hold: ActivityHold,
  index: number,
  updateHold: (index: number, patch: Partial<ActivityHold>) => void,
) {
  const id = (suffix: string) => `activity-hold-${index + 1}-${suffix}-${options.entityId}`;
  const title = hold.label || (hold.entity_id ? friendlyEntityLabel(ctx.hass, hold.entity_id) : ctx.t("presenceActivityHoldUntitled", { number: index + 1 }));
  return html`
    <div class="presence-hold" data-hold=${String(index + 1)}>
      <div class="presence-hold-heading">
        <strong>${title}</strong>
        <button
          type="button"
          class="presence-row-remove"
          title=${ctx.t("presenceRemoveActivityHold")}
          aria-label=${`${ctx.t("presenceRemoveActivityHold")} ${index + 1}`}
          ?disabled=${ctx.disabled}
          @click=${() => options.save({ activity_holds: options.settings.activity_holds.filter((_, position) => position !== index) })}
        ><ha-icon icon="mdi:close"></ha-icon></button>
      </div>
      ${hold.entity_id ? nothing : html`<p class="presence-disabled-note">${ctx.t("presenceActivityHoldNeedsEntity")}</p>`}
      <div class="presence-hold-grid">
        ${renderEntityRow(ctx, {
          id: id("entity"),
          label: ctx.t("presenceActivityEntity"),
          value: hold.entity_id || null,
          entities: onOffEntityOptions(ctx.hass, hold.entity_id ? [hold.entity_id] : []),
          emptyLabel: ctx.t("presenceNoEntity"),
          helpKey: "presenceActivityEntityHelp",
          onChange: (value) => updateHold(index, { entity_id: value ?? "" }),
        })}
        ${renderTemperatureRow(ctx, {
          id: id("temperature"),
          label: ctx.t("presenceActivityTemperature"),
          value: hold.temperature,
          helpKey: "presenceActivityTemperatureHelp",
          onChange: (value) => {
            if (value !== null) {
              updateHold(index, { temperature: value });
            }
          },
        })}
        ${renderSelectRow(ctx, {
          id: id("constraint"),
          label: ctx.t("presenceActivityConstraint"),
          value: hold.constraint,
          choices: HOLD_CONSTRAINTS.map((constraint) => ({
            value: constraint,
            label: ctx.t(holdConstraintLabelKey(constraint) as TranslationKey),
          })),
          helpKey: "presenceActivityConstraintHelp",
          onChange: (value) => updateHold(index, {
            constraint: HOLD_CONSTRAINTS.includes(value as ActivityHold["constraint"]) ? (value as ActivityHold["constraint"]) : "lower_only",
          }),
        })}
        ${renderSelectRow(ctx, {
          id: id("hvac-mode"),
          label: ctx.t("presenceActivityHvacMode"),
          value: hold.hvac_mode ?? "",
          choices: hvacModeChoices(ctx, options.hvacModes, hold.hvac_mode),
          emptyLabel: ctx.t("presenceKeepHvacMode"),
          onChange: (value) => updateHold(index, { hvac_mode: value || null }),
        })}
        ${renderMinutesRow(ctx, {
          id: id("release-delay"),
          label: ctx.t("presenceActivityReleaseDelay"),
          value: hold.release_delay_minutes,
          max: 1440,
          helpKey: "presenceActivityReleaseDelayHelp",
          onChange: (value) => updateHold(index, { release_delay_minutes: value }),
        })}
        ${renderTextRow(ctx, {
          id: id("pause-id"),
          label: ctx.t("presenceActivityPauseId"),
          value: hold.pause_id,
          placeholder: "activity",
          helpKey: "presenceActivityPauseIdHelp",
          onChange: (value) => updateHold(index, { pause_id: value || "activity" }),
        })}
        ${renderTextRow(ctx, {
          id: id("label"),
          label: ctx.t("presenceActivityLabel"),
          value: hold.label,
          helpKey: "presenceActivityLabelHelp",
          onChange: (value) => updateHold(index, { label: value }),
        })}
      </div>
    </div>
  `;
}
