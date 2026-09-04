import { html, nothing } from "lit";
import type { TranslationKey } from "../../translations";
import type { ArrivalStage, OccupancyAssistSettings, SetbackStage } from "../../types";
import { occupancyEntityOptions, onOffEntityOptions } from "./entity-options";
import {
  fanModeChoices,
  hvacModeChoices,
  renderEntityListRow,
  renderEntityRow,
  renderMinutesRow,
  renderSelectRow,
  renderTemperatureRow,
  renderToggleRow,
  type PresenceFormContext,
} from "./form-rows";
import {
  MAX_ARRIVAL_STAGES,
  MAX_SETBACK_STAGES,
  nextArrivalStage,
  nextSetbackStage,
  stageValidationLabelKey,
  type StageValidationError,
} from "./presence-settings";

export type OccupancySectionOptions = {
  entityId: string;
  settings: OccupancyAssistSettings;
  /** Stage rows as currently shown (a rejected draft stays visible with its error). */
  setbackStages: SetbackStage[];
  setbackError?: StageValidationError;
  arrivalStages: ArrivalStage[];
  arrivalError?: StageValidationError;
  hvacModes: string[];
  fanModes: string[];
  save(patch: Partial<OccupancyAssistSettings>): void;
  onSetbackStagesChange(stages: SetbackStage[]): void;
  onArrivalStagesChange(stages: ArrivalStage[]): void;
};

export function renderOccupancySection(ctx: PresenceFormContext, options: OccupancySectionOptions) {
  const { settings, save } = options;
  const canEnable = Boolean(settings.occupancy_entity_id);
  return html`
    <section class="presence-zone-section presence-occupancy">
      <div class="presence-zone-section-heading">
        <h3><ha-icon icon="mdi:motion-sensor"></ha-icon>${ctx.t("presenceOccupancyTitle")}</h3>
        <span class="presence-enable-control" title=${canEnable || settings.enabled ? "" : ctx.t("presenceOccupancyNeedsEntity")}>
          <ha-switch
            class="presence-occupancy-enable"
            aria-label=${ctx.t("presenceOccupancyEnabled")}
            .checked=${settings.enabled}
            ?disabled=${ctx.disabled || (!settings.enabled && !canEnable)}
            @change=${(event: Event) => save({ enabled: Boolean((event.target as HTMLInputElement).checked) })}
          ></ha-switch>
        </span>
      </div>
      <p class="presence-section-detail">${ctx.t("presenceOccupancyDetail")}</p>
      ${!canEnable ? html`<p class="presence-disabled-note">${ctx.t("presenceOccupancyNeedsEntity")}</p>` : nothing}
      <div class="presence-fields">
        ${renderEntityRow(ctx, {
          id: `occupancy-entity-${options.entityId}`,
          label: ctx.t("presenceOccupancyEntity"),
          value: settings.occupancy_entity_id,
          entities: occupancyEntityOptions(ctx.hass, settings.occupancy_entity_id ? [settings.occupancy_entity_id] : []),
          emptyLabel: ctx.t("presenceSelectOccupancyEntity"),
          helpKey: "presenceOccupancyEntityHelp",
          onChange: (value) => save({ occupancy_entity_id: value }),
        })}
        ${renderEntityListRow(ctx, {
          id: `occupancy-blocking-${options.entityId}`,
          label: ctx.t("presenceBlockingEntities"),
          values: settings.blocking_entity_ids,
          entities: onOffEntityOptions(ctx.hass, settings.blocking_entity_ids),
          helpKey: "presenceBlockingEntitiesHelp",
          onChange: (values) => save({ blocking_entity_ids: values }),
        })}
        ${renderEntityListRow(ctx, {
          id: `occupancy-corroboration-${options.entityId}`,
          label: ctx.t("presenceCorroborationEntities"),
          values: settings.corroboration_entity_ids,
          entities: onOffEntityOptions(ctx.hass, settings.corroboration_entity_ids),
          helpKey: "presenceCorroborationEntitiesHelp",
          onChange: (values) => save({ corroboration_entity_ids: values }),
        })}
      </div>

      <div class="presence-subsection presence-setback">
        <h4><ha-icon icon="mdi:thermometer-chevron-up"></ha-icon>${ctx.t("presenceSetbackTitle")}</h4>
        <p class="presence-section-detail">${ctx.t("presenceSetbackDetail")}</p>
        ${renderSetbackStages(ctx, options)}
        <div class="presence-fields">
          ${renderSelectRow(ctx, {
            id: `occupancy-setback-hvac-${options.entityId}`,
            label: ctx.t("presenceSetbackHvacMode"),
            value: settings.setback_hvac_mode ?? "",
            choices: hvacModeChoices(ctx, options.hvacModes, settings.setback_hvac_mode),
            emptyLabel: ctx.t("presenceKeepHvacMode"),
            helpKey: "presenceSetbackHvacModeHelp",
            onChange: (value) => save({ setback_hvac_mode: value || null }),
          })}
          ${renderSelectRow(ctx, {
            id: `occupancy-setback-fan-${options.entityId}`,
            label: ctx.t("presenceSetbackFanMode"),
            value: settings.setback_fan_mode ?? "",
            choices: fanModeChoices(ctx, options.fanModes, settings.setback_fan_mode),
            emptyLabel: ctx.t("presenceKeepFanMode"),
            onChange: (value) => save({ setback_fan_mode: value || null }),
          })}
        </div>
      </div>

      <div class="presence-subsection presence-arrival">
        <h4><ha-icon icon="mdi:account-arrow-right-outline"></ha-icon>${ctx.t("presenceArrivalTitle")}</h4>
        <p class="presence-section-detail">${ctx.t("presenceArrivalDetail")}</p>
        ${renderArrivalStages(ctx, options)}
        <div class="presence-fields">
          ${renderMinutesRow(ctx, {
            id: `occupancy-exit-grace-${options.entityId}`,
            label: ctx.t("presenceArrivalExitGrace"),
            value: settings.arrival_exit_grace_minutes,
            max: 1440,
            helpKey: "presenceArrivalExitGraceHelp",
            onChange: (value) => save({ arrival_exit_grace_minutes: value }),
          })}
          ${renderTemperatureRow(ctx, {
            id: `occupancy-comfort-temperature-${options.entityId}`,
            label: ctx.t("presenceComfortTemperature"),
            value: settings.comfort_temperature,
            helpKey: "presenceComfortTemperatureHelp",
            onChange: (value) => {
              if (value !== null) {
                save({ comfort_temperature: value });
              }
            },
          })}
          ${renderToggleRow(ctx, {
            id: `occupancy-sync-schedule-${options.entityId}`,
            label: ctx.t("presenceSyncComfort"),
            checked: settings.sync_comfort_to_schedule,
            helpKey: "presenceSyncComfortHelp",
            onChange: (checked) => save({ sync_comfort_to_schedule: checked }),
          })}
        </div>
      </div>
    </section>
  `;
}

function readMinutes(event: Event, fallback: number): number {
  const raw = (event.currentTarget as HTMLInputElement).value.trim();
  const number = Number(raw);
  return raw !== "" && Number.isFinite(number) ? Math.round(number) : fallback;
}

function readTemperature(ctx: PresenceFormContext, event: Event): number | null {
  const raw = (event.currentTarget as HTMLInputElement).value.trim();
  const number = Number(raw);
  if (raw === "" || !Number.isFinite(number)) {
    return null;
  }
  return Math.min(ctx.temperatureLimits[1], Math.max(ctx.temperatureLimits[0], number));
}

function renderSetbackStages(ctx: PresenceFormContext, options: OccupancySectionOptions) {
  const stages = options.setbackStages;
  const error = options.setbackError;
  const update = (index: number, patch: Partial<SetbackStage>) =>
    options.onSetbackStagesChange(stages.map((stage, position) => (position === index ? { ...stage, ...patch } : stage)));
  return html`
    <div class="presence-stages presence-setback-stages">
      ${stages.length
        ? stages.map((stage, index) => html`
            <div class=${`presence-stage-row ${error?.index === index ? "invalid" : ""}`} data-stage=${String(index + 1)}>
              <span class="presence-stage-index">${ctx.t("presenceStageLabel", { number: index + 1 })}</span>
              <input
                type="number"
                inputmode="numeric"
                class="presence-stage-minutes"
                aria-label=${ctx.t("presenceStageAfterMinutes", { number: index + 1 })}
                min="1"
                max="10080"
                step="1"
                .value=${Number.isFinite(stage.after_minutes) ? String(stage.after_minutes) : ""}
                ?disabled=${ctx.disabled}
                @change=${(event: Event) => update(index, { after_minutes: readMinutes(event, stage.after_minutes) })}
              >
              <span>${ctx.t("minutesShort")}</span>
              <span class="presence-stage-then">→</span>
              <input
                type="number"
                inputmode="decimal"
                class="presence-stage-temperature"
                aria-label=${ctx.t("presenceStageTemperature", { number: index + 1 })}
                min=${String(ctx.temperatureLimits[0])}
                max=${String(ctx.temperatureLimits[1])}
                step=${String(ctx.temperatureStep)}
                .value=${Number.isFinite(stage.temperature) ? String(stage.temperature) : ""}
                ?disabled=${ctx.disabled}
                @change=${(event: Event) => update(index, { temperature: readTemperature(ctx, event) ?? Number.NaN })}
              >
              <span>${ctx.temperatureUnit}</span>
              <button
                type="button"
                class="presence-row-remove"
                title=${ctx.t("presenceRemoveStage")}
                aria-label=${`${ctx.t("presenceRemoveStage")} ${index + 1}`}
                ?disabled=${ctx.disabled}
                @click=${() => options.onSetbackStagesChange(stages.filter((_, position) => position !== index))}
              ><ha-icon icon="mdi:close"></ha-icon></button>
            </div>
          `)
        : html`<span class="presence-empty-list">${ctx.t("presenceNoSetbackStages")}</span>`}
      ${error ? html`<span class="presence-stage-error" role="alert">${ctx.t(stageValidationLabelKey(error) as TranslationKey, { number: error.index + 1 })}</span>` : nothing}
      ${stages.length < MAX_SETBACK_STAGES
        ? html`<div class="presence-actions">
            <button
              type="button"
              class="command-button compact presence-stage-add presence-setback-add"
              ?disabled=${ctx.disabled}
              @click=${() => options.onSetbackStagesChange([...stages, nextSetbackStage(stages, ctx.temperatureUnit, ctx.temperatureLimits[1])])}
            ><ha-icon icon="mdi:plus"></ha-icon><span>${ctx.t("presenceAddSetbackStage")}</span></button>
          </div>`
        : nothing}
    </div>
  `;
}

function renderArrivalStages(ctx: PresenceFormContext, options: OccupancySectionOptions) {
  const stages = options.arrivalStages;
  const error = options.arrivalError;
  const update = (index: number, patch: Partial<ArrivalStage>) =>
    options.onArrivalStagesChange(stages.map((stage, position) => (position === index ? { ...stage, ...patch } : stage)));
  return html`
    <div class="presence-stages presence-arrival-stages">
      ${stages.length
        ? stages.map((stage, index) => {
          const last = index === stages.length - 1;
          const release = stage.temperature === null;
          return html`
            <div class=${`presence-stage-row ${release ? "release" : ""} ${error?.index === index ? "invalid" : ""}`} data-stage=${String(index + 1)}>
              <span class="presence-stage-index">${ctx.t("presenceStageLabel", { number: index + 1 })}</span>
              <input
                type="number"
                inputmode="numeric"
                class="presence-stage-minutes"
                aria-label=${ctx.t("presenceStageAfterMinutes", { number: index + 1 })}
                min="1"
                max="10080"
                step="1"
                .value=${Number.isFinite(stage.after_minutes) ? String(stage.after_minutes) : ""}
                ?disabled=${ctx.disabled}
                @change=${(event: Event) => update(index, { after_minutes: readMinutes(event, stage.after_minutes) })}
              >
              <span>${ctx.t("minutesShort")}</span>
              <span class="presence-stage-then">→</span>
              ${last
                ? html`<span class="select-wrap"><select
                    class="presence-stage-action"
                    aria-label=${ctx.t("presenceArrivalAction", { number: index + 1 })}
                    .value=${release ? "release" : "hold"}
                    ?disabled=${ctx.disabled}
                    @change=${(event: Event) => {
                      const value = (event.currentTarget as HTMLSelectElement).value;
                      update(index, { temperature: value === "release" ? null : options.settings.comfort_temperature });
                    }}
                  >
                    <option value="hold" ?selected=${!release}>${ctx.t("presenceArrivalHoldTemperature")}</option>
                    <option value="release" ?selected=${release}>${ctx.t("presenceArrivalReleaseToSchedule")}</option>
                  </select></span>`
                : nothing}
              ${release
                ? nothing
                : html`<input
                    type="number"
                    inputmode="decimal"
                    class="presence-stage-temperature"
                    aria-label=${ctx.t("presenceStageTemperature", { number: index + 1 })}
                    min=${String(ctx.temperatureLimits[0])}
                    max=${String(ctx.temperatureLimits[1])}
                    step=${String(ctx.temperatureStep)}
                    .value=${stage.temperature === null || !Number.isFinite(stage.temperature) ? "" : String(stage.temperature)}
                    ?disabled=${ctx.disabled}
                    @change=${(event: Event) => update(index, { temperature: readTemperature(ctx, event) ?? Number.NaN })}
                  ><span>${ctx.temperatureUnit}</span>`}
              <button
                type="button"
                class="presence-row-remove"
                title=${ctx.t("presenceRemoveStage")}
                aria-label=${`${ctx.t("presenceRemoveStage")} ${index + 1}`}
                ?disabled=${ctx.disabled}
                @click=${() => options.onArrivalStagesChange(stages.filter((_, position) => position !== index))}
              ><ha-icon icon="mdi:close"></ha-icon></button>
            </div>
          `;
        })
        : html`<span class="presence-empty-list">${ctx.t("presenceNoArrivalStages")}</span>`}
      ${error ? html`<span class="presence-stage-error" role="alert">${ctx.t(stageValidationLabelKey(error) as TranslationKey, { number: error.index + 1 })}</span>` : nothing}
      ${stages.length < MAX_ARRIVAL_STAGES
        ? html`<div class="presence-actions">
            <button
              type="button"
              class="command-button compact presence-stage-add presence-arrival-add"
              ?disabled=${ctx.disabled}
              @click=${() => options.onArrivalStagesChange([...stages, nextArrivalStage(stages)])}
            ><ha-icon icon="mdi:plus"></ha-icon><span>${ctx.t("presenceAddArrivalStage")}</span></button>
          </div>`
        : nothing}
    </div>
  `;
}
