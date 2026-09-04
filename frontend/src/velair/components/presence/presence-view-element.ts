import { LitElement, html, nothing } from "lit";
import { property, state } from "lit/decorators.js";
import { VelairPresenceApi } from "../../api/presence";
import {
  climateFanModeOptions,
  climateSupportedModes,
  entityTemperatureLimits,
  entityTemperatureStep,
} from "../../domain/climate";
import { temperatureUnit } from "../../domain/formatters";
import { combinedTemperatureLimits, commonTemperatureStep } from "../../domain/settings";
import { dictionaryLabel, languageFromHass, translate } from "../../i18n";
import { cardStyles } from "../../styles/card-styles";
import { presenceStyles } from "../../styles/presence-styles";
import type { TranslationKey } from "../../translations";
import type {
  ArrivalStage,
  GuardsGlobalSettings,
  GuardsZoneSettings,
  HassState,
  HomeAssistant,
  HouseModesGlobalSettings,
  HouseModesZoneSettings,
  OccupancyAssistSettings,
  ScheduleResponse,
  SetbackStage,
} from "../../types";
import type { PresenceFormContext } from "./form-rows";
import { renderPresenceGlobalSection } from "./global-section";
import { renderGuardsSection } from "./guards-section";
import { renderHouseModesSection } from "./house-modes-section";
import { renderOccupancySection } from "./occupancy-section";
import {
  guardStatus,
  guardsGlobalSettings,
  guardsZoneSettings,
  houseModeStatus,
  houseModesGlobalSettings,
  houseModesZoneSettings,
  occupancyAssistSettings,
  occupancyAssistStatus,
  validateArrivalStages,
  validateSetbackStages,
  type StageValidationError,
} from "./presence-settings";
import { renderGuardChip, renderHouseModeChip, renderOccupancyChip } from "./runtime-chips";

type PendingPatch =
  | { id: number; scope: "occupancy_assist"; entityId: string; patch: Partial<OccupancyAssistSettings> }
  | { id: number; scope: "house_modes"; entityId: string; patch: Partial<HouseModesZoneSettings> }
  | { id: number; scope: "guards"; entityId: string; patch: Partial<GuardsZoneSettings> }
  | { id: number; scope: "house_modes_global"; patch: Partial<HouseModesGlobalSettings> }
  | { id: number; scope: "guards_global"; patch: Partial<GuardsGlobalSettings> };

/** `Omit` distributed over the union so each variant keeps its own keys. */
type PendingRequest = PendingPatch extends infer P ? (P extends PendingPatch ? Omit<P, "id"> : never) : never;

type StageDraft<T> = { stages: T[]; error: StageValidationError };

/**
 * `<velair-presence-view>` — the Presence panel/card body.
 *
 * The element is self-contained like `velair-profiles-view`: it reads the
 * schedule payload it is given, writes through {@link VelairPresenceApi},
 * shows every edit optimistically until the backend answers, and reports the
 * fresh payload (`presence-data-changed`) or the failure (`presence-error`)
 * to the hosting card, which owns the notice toasts.
 */
export class VelairPresenceView extends LitElement {
  @property({ attribute: false }) public hass?: HomeAssistant;
  @property({ attribute: false }) public data?: ScheduleResponse;
  @property({ attribute: false }) public zoneIds: string[] = [];
  @property({ attribute: "initial-entity" }) public initialEntity = "";
  @property({ attribute: false }) public timelineNow?: Date;

  @state() private _selectedEntity = "";
  @state() private _pending: PendingPatch[] = [];
  @state() private _setbackDrafts: Record<string, StageDraft<SetbackStage>> = {};
  @state() private _arrivalDrafts: Record<string, StageDraft<ArrivalStage>> = {};
  private _nextPatchId = 1;

  /** Optimistic view of the payload: every in-flight patch layered on top of `data`. */
  public effectiveData(): ScheduleResponse | undefined {
    if (!this.data) {
      return undefined;
    }
    if (!this._pending.length) {
      return this.data;
    }
    const zones = { ...this.data.zones };
    const settings = { ...this.data.settings };
    for (const pending of this._pending) {
      if (pending.scope === "house_modes_global") {
        settings.house_modes = { ...(settings.house_modes ?? {}), ...pending.patch };
      } else if (pending.scope === "guards_global") {
        settings.guards = { ...(settings.guards ?? {}), ...pending.patch };
      } else {
        const zone = zones[pending.entityId];
        if (!zone) {
          continue;
        }
        zones[pending.entityId] = {
          ...zone,
          [pending.scope]: { ...(zone[pending.scope] ?? {}), ...pending.patch },
        };
      }
    }
    return { ...this.data, zones, settings };
  }

  public selectedEntity(): string | undefined {
    if (this._selectedEntity && this.zoneIds.includes(this._selectedEntity)) {
      return this._selectedEntity;
    }
    if (this.initialEntity && this.zoneIds.includes(this.initialEntity)) {
      return this.initialEntity;
    }
    return this.zoneIds[0];
  }

  protected render() {
    const data = this.effectiveData();
    const zoneIds = this.zoneIds;
    const selected = this.selectedEntity();
    const now = this.timelineNow ?? new Date();
    const unit = this._temperatureUnit();
    const allHvacModes = this._unionModes(zoneIds, climateSupportedModes);
    const allFanModes = this._unionModes(zoneIds, climateFanModeOptions);
    const globalContext = this._context(unit, this._globalTemperatureLimits(zoneIds, unit), this._globalTemperatureStep(zoneIds));
    return html`
      <section class="presence-view">
        <header class="presence-intro">
          <ha-icon icon="mdi:home-account"></ha-icon>
          <span>
            <strong>${this._t("presenceIntroTitle")}</strong>
            <small>${this._t("presenceIntroDetail")}</small>
          </span>
        </header>
        ${renderPresenceGlobalSection(globalContext, {
          houseModes: houseModesGlobalSettings(data?.settings?.house_modes, unit),
          guards: guardsGlobalSettings(data?.settings?.guards),
          houseMode: houseModeStatus(data?.house_mode),
          hvacModes: allHvacModes,
          fanModes: allFanModes,
          now,
          saveHouseModes: (patch) => this._save({ scope: "house_modes_global", patch }),
          saveGuards: (patch) => this._save({ scope: "guards_global", patch }),
        })}
        ${zoneIds.length
          ? html`
              <section class="presence-zone-picker">
                <div class="schedule-step-heading"><strong>${this._t("presenceZoneStep")}</strong></div>
                <section class="zones">
                  ${zoneIds.map((entityId) => html`
                    <button
                      type="button"
                      class=${entityId === selected ? "zone active" : "zone"}
                      @click=${() => { this._selectedEntity = entityId; }}
                    >${this._friendlyEntityName(entityId)}</button>
                  `)}
                </section>
              </section>
              ${selected ? this._renderZone(data, selected, unit, now) : nothing}
            `
          : html`<span class="empty presence-empty">${this._t("noManagedEntities")}</span>`}
      </section>
    `;
  }

  private _renderZone(data: ScheduleResponse | undefined, entityId: string, unit: string, now: Date) {
    const zone = data?.zones[entityId];
    const exists = Boolean(this.hass?.states?.[entityId]);
    const state = this.hass?.states?.[entityId];
    const context = this._context(unit, entityTemperatureLimits(state, unit), entityTemperatureStep(state) ?? 0.5);
    const occupancy = occupancyAssistSettings(zone?.occupancy_assist, unit);
    const occupancyStatus = occupancyAssistStatus(data?.occupancy_assist, entityId, occupancy);
    const guard = guardStatus(data?.guards, entityId);
    const houseMode = houseModeStatus(data?.house_mode);
    const external = zone?.execution?.type === "external";
    const setbackDraft = this._setbackDrafts[entityId];
    const arrivalDraft = this._arrivalDrafts[entityId];
    return html`
      <section class=${`presence-zone ${occupancy.enabled ? "enabled" : "disabled"} state-${occupancyStatus.state}`}>
        <header class="presence-zone-heading">
          <span class="presence-zone-identity">
            <strong title=${this._friendlyEntityName(entityId)}>${this._friendlyEntityName(entityId)}</strong>
            <span>${entityId}</span>
          </span>
          <div class="presence-chips">
            ${renderOccupancyChip(context, occupancyStatus, now)}
            ${renderGuardChip(context, guard, now)}
            ${renderHouseModeChip(context, houseMode, now)}
          </div>
        </header>
        ${external
          ? html`<span class="presence-unavailable-message">${this._t("externalActionsInactive")}</span>`
          : !exists
            ? html`<span class="presence-unavailable-message">${this._t("presenceZoneUnavailable")}</span>`
            : html`
                ${renderOccupancySection(context, {
                  entityId,
                  settings: occupancy,
                  setbackStages: setbackDraft?.stages ?? occupancy.setback_stages,
                  setbackError: setbackDraft?.error,
                  arrivalStages: arrivalDraft?.stages ?? occupancy.arrival_stages,
                  arrivalError: arrivalDraft?.error,
                  hvacModes: climateSupportedModes(state),
                  fanModes: climateFanModeOptions(state),
                  save: (patch) => this._save({ scope: "occupancy_assist", entityId, patch }),
                  onSetbackStagesChange: (stages) => this._changeSetbackStages(entityId, stages),
                  onArrivalStagesChange: (stages) => this._changeArrivalStages(entityId, stages),
                })}
                ${renderHouseModesSection(context, {
                  entityId,
                  settings: houseModesZoneSettings(zone?.house_modes, unit),
                  fanModes: climateFanModeOptions(state),
                  save: (patch) => this._save({ scope: "house_modes", entityId, patch }),
                })}
                ${renderGuardsSection(context, {
                  entityId,
                  settings: guardsZoneSettings(zone?.guards, unit),
                  hvacModes: climateSupportedModes(state),
                  save: (patch) => this._save({ scope: "guards", entityId, patch }),
                })}
              `}
      </section>
    `;
  }

  private _changeSetbackStages(entityId: string, stages: SetbackStage[]): void {
    const error = validateSetbackStages(stages);
    if (error) {
      this._setbackDrafts = { ...this._setbackDrafts, [entityId]: { stages, error } };
      return;
    }
    const { [entityId]: _dropped, ...rest } = this._setbackDrafts;
    this._setbackDrafts = rest;
    this._save({ scope: "occupancy_assist", entityId, patch: { setback_stages: stages } });
  }

  private _changeArrivalStages(entityId: string, stages: ArrivalStage[]): void {
    const error = validateArrivalStages(stages);
    if (error) {
      this._arrivalDrafts = { ...this._arrivalDrafts, [entityId]: { stages, error } };
      return;
    }
    const { [entityId]: _dropped, ...rest } = this._arrivalDrafts;
    this._arrivalDrafts = rest;
    this._save({ scope: "occupancy_assist", entityId, patch: { arrival_stages: stages } });
  }

  private _save(request: PendingRequest): void {
    if (!this.hass) {
      return;
    }
    const api = new VelairPresenceApi(this.hass);
    const pending = { ...request, id: this._nextPatchId++ } as PendingPatch;
    this._pending = [...this._pending, pending];
    const call = pending.scope === "occupancy_assist"
      ? api.updateZoneOccupancyAssist(pending.entityId, pending.patch)
      : pending.scope === "house_modes"
        ? api.updateZoneHouseModes(pending.entityId, pending.patch)
        : pending.scope === "guards"
          ? api.updateZoneGuards(pending.entityId, pending.patch)
          : pending.scope === "house_modes_global"
            ? api.updateHouseModesSettings(pending.patch)
            : api.updateGuardsSettings(pending.patch);
    void call
      .then((response) => {
        this._dispatch("presence-data-changed", response);
      })
      .catch((error: unknown) => {
        this._dispatch("presence-error", this._errorMessage(error));
      })
      .finally(() => {
        this._pending = this._pending.filter((entry) => entry.id !== pending.id);
      });
  }

  private _dispatch<T>(type: string, detail: T): void {
    this.dispatchEvent(new CustomEvent(type, { bubbles: true, composed: true, detail }));
  }

  private _errorMessage(error: unknown): string {
    return error instanceof Error && error.message ? error.message : this._t("unableSaveSettings");
  }

  private _context(unit: string, limits: [number, number], step: number): PresenceFormContext {
    return {
      hass: this.hass,
      disabled: false,
      temperatureUnit: unit,
      temperatureLimits: limits,
      temperatureStep: step,
      t: (key, replacements) => this._t(key, replacements),
      modeLabel: (mode) => dictionaryLabel(languageFromHass(this.hass), "hvacModes", mode),
    };
  }

  private _temperatureUnit(): string {
    return this.data?.temperature_unit ?? temperatureUnit(undefined, this.hass?.config?.unit_system?.temperature);
  }

  private _globalTemperatureLimits(zoneIds: string[], unit: string): [number, number] {
    const known = zoneIds.filter((entityId) => this.hass?.states?.[entityId]);
    if (!known.length) {
      return entityTemperatureLimits(undefined, unit);
    }
    return combinedTemperatureLimits(known.map((entityId) => entityTemperatureLimits(this.hass?.states?.[entityId], unit)));
  }

  private _globalTemperatureStep(zoneIds: string[]): number {
    return commonTemperatureStep(zoneIds.map((entityId) => entityTemperatureStep(this.hass?.states?.[entityId]))) ?? 0.5;
  }

  private _unionModes(zoneIds: string[], reader: (state?: HassState) => string[]): string[] {
    return [...new Set(zoneIds.flatMap((entityId) => reader(this.hass?.states?.[entityId])))];
  }

  private _friendlyEntityName(entityId: string): string {
    return this.hass?.states?.[entityId]?.attributes?.friendly_name ?? entityId;
  }

  private _t(key: TranslationKey, replacements: Record<string, string | number> = {}): string {
    return translate(languageFromHass(this.hass), key, replacements);
  }

  static styles = [cardStyles, presenceStyles];
}

if (!customElements.get("velair-presence-view")) {
  customElements.define("velair-presence-view", VelairPresenceView);
}

declare global {
  interface HTMLElementTagNameMap {
    "velair-presence-view": VelairPresenceView;
  }
}
