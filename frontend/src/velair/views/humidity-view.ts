import { html, nothing } from "lit";
import {
  HUMIDITY_ASSIST_MEASURES,
  HUMIDITY_ASSIST_PULSE_MODES,
  HUMIDITY_PARAMETERS,
  formatHumidityValue,
  gateEntityOptions,
  humidityAssistGlobalSettings,
  humidityAssistSettings,
  humidityNextTransitionMinutes,
  humidityReasonLabelKey,
  humiditySensorOptions,
  humidityStateLabelKey,
  humidityStatusForZone,
  type HumidityParameterDefinition,
} from "../domain/humidity-assist";
import type { VelairViewHost } from "../host-types";
import type { TranslationKey } from "../translations";
import { renderInlineHelp } from "./inline-help";
import type {
  HumidityAssistGlobalSettings,
  HumidityAssistSettings,
  HumidityAssistStatus,
} from "../types";

type HumidityViewHost = VelairViewHost;

const HUMIDITY_STATE_ICONS: Record<string, string> = {
  disabled: "mdi:water-off-outline",
  unavailable: "mdi:alert-circle-outline",
  blocked_manual: "mdi:hand-back-right-outline",
  blocked_gate: "mdi:gate",
  waiting: "mdi:timer-sand",
  pulsing: "mdi:snowflake",
  resting: "mdi:sleep",
};

export function renderHumidityView(host: HumidityViewHost, zoneIds: string[]) {
  const compliant = Boolean(host._data?.humidity_assist_compliant);
  const anyEnabled = zoneIds.some((entityId) =>
    humidityAssistSettings(host._data?.zones[entityId]?.humidity_assist).enabled);
  return html`
    <section class="humidity-view">
      <header class="humidity-intro">
        <ha-icon icon="mdi:water-percent"></ha-icon>
        <span>
          <strong>${host._t("humidityIntroTitle")}</strong>
          <small>${host._t("humidityIntroDetail")}</small>
        </span>
        ${anyEnabled
          ? html`<span class=${`humidity-compliance ${compliant ? "compliant" : "exceeded"}`}>
              <ha-icon icon=${compliant ? "mdi:check-circle-outline" : "mdi:water-alert-outline"}></ha-icon>
              ${host._t(compliant ? "humidityCompliant" : "humidityNotCompliant")}
            </span>`
          : nothing}
      </header>
      ${zoneIds.length
        ? zoneIds.map((entityId) => renderHumidityZone(host, entityId))
        : html`<span class="empty">${host._t("noManagedEntities")}</span>`}
      ${renderGlobalParameters(host, zoneIds[0])}
    </section>
  `;
}

function renderHumidityZone(host: HumidityViewHost, entityId: string) {
  if (host._data?.zones[entityId]?.execution?.type === "external") {
    return html`
      <section class="humidity-zone disabled collapsed">
        <header class="humidity-zone-heading">
          <ha-icon icon="mdi:calendar-export"></ha-icon>
          <span class="humidity-zone-identity">
            <strong>${host._friendlyEntityName(entityId)}</strong>
            <span>${host._t("externalActionsInactive")}</span>
          </span>
        </header>
      </section>
    `;
  }
  const exists = host._entityExists(entityId);
  const settings = humidityAssistSettings(host._data?.zones[entityId]?.humidity_assist);
  const status = humidityStatusForZone(host._data?.humidity_assist, entityId, settings);
  const expanded = exists && host._expandedHumidityZones.has(entityId);
  const contentId = `humidity-zone-content-${entityId.replace(/[^a-zA-Z0-9_-]/g, "-")}`;
  const toggleLabel = exists
    ? host._t(expanded ? "humidityCollapseClimate" : "humidityExpandClimate", {
        climate: host._friendlyEntityName(entityId),
      })
    : host._t("humidityUnavailable");
  const handleToggle = (event: Event) => {
    event.preventDefault();
    event.stopPropagation();
    if (exists) {
      host._toggleHumidityZone(entityId);
    }
  };
  const handleHeadingClick = (event: Event) => {
    if (!exists) {
      return;
    }
    const target = event.target;
    if (target instanceof Element && target.closest(".humidity-zone-actions")) {
      return;
    }
    host._toggleHumidityZone(entityId);
  };
  const stateKey = humidityStateLabelKey(status.state) as TranslationKey;
  const canEnable = exists && Boolean(settings.sensor_entity_id) && settings.target !== null
    && settings.pulse_temperature !== null;

  return html`
    <section class=${`humidity-zone ${settings.enabled ? "enabled" : "disabled"} ${expanded ? "expanded" : "collapsed"} state-${status.state}`}>
      <header class="humidity-zone-heading" @click=${handleHeadingClick}>
        <button
          type="button"
          class="humidity-zone-toggle"
          title=${toggleLabel}
          aria-label=${toggleLabel}
          aria-expanded=${String(expanded)}
          aria-controls=${expanded ? contentId : nothing}
          ?disabled=${!exists}
          @click=${handleToggle}
        >
          <ha-icon
            class="humidity-expand-icon"
            icon=${expanded ? "mdi:chevron-down" : "mdi:chevron-right"}
          ></ha-icon>
          <span class="humidity-zone-identity">
            <strong title=${host._friendlyEntityName(entityId)}>
              ${host._friendlyEntityName(entityId)}
            </strong>
            <span>${entityId}</span>
          </span>
        </button>
        <span class=${`humidity-chip state-${status.state}`} title=${host._t(stateKey)}>
          <ha-icon icon=${HUMIDITY_STATE_ICONS[status.state] ?? "mdi:water-percent"}></ha-icon>
          <span>${host._t(stateKey)}</span>
        </span>
        ${settings.priority
          ? html`<span class="humidity-priority-badge" title=${host._t("humidityPriority")}>
              <ha-icon icon="mdi:star"></ha-icon>${host._t("humidityPriorityBadge")}
            </span>`
          : nothing}
        <div class="humidity-zone-actions" @click=${(event: Event) => event.stopPropagation()}>
          <span
            class=${exists ? "humidity-enable-control" : "humidity-enable-control unavailable"}
            title=${exists ? "" : host._t("humidityUnavailable")}
          >
            <ha-switch
              .checked=${settings.enabled}
              ?disabled=${host._settingsSaving || (!settings.enabled && !canEnable)}
              @change=${(event: Event) =>
                host._saveZoneHumidityAssist(entityId, {
                  enabled: Boolean((event.target as HTMLInputElement).checked),
                })}
            ></ha-switch>
          </span>
        </div>
      </header>
      ${exists ? renderHumiditySummary(host, entityId, settings, status) : html`
        <span class="humidity-unavailable-message">${host._t("humidityUnavailable")}</span>
      `}
      ${exists && expanded
        ? html`
            <div id=${contentId} class="humidity-zone-content">
              ${renderHumidityConfiguration(host, entityId, settings)}
            </div>
          `
        : nothing}
    </section>
  `;
}

function renderHumiditySummary(
  host: HumidityViewHost,
  entityId: string,
  settings: HumidityAssistSettings,
  status: HumidityAssistStatus,
) {
  const unit = status.unit ?? (settings.measure === "dew_point" ? host._temperatureUnit(entityId) : "%");
  const reasonKey = humidityReasonLabelKey(status.reason);
  const minutes = humidityNextTransitionMinutes(status.next_transition_at, host._currentTimelineNow());
  const decisionText = status.decision ? host._t("humidityDecision", { decision: status.decision }) : "";
  const showReadings = settings.enabled && status.state !== "disabled";
  return html`
    <div class="humidity-summary">
      ${showReadings
        ? html`
            <div class="humidity-metrics">
              ${renderMetric(host._t("humidityRaw"), formatHumidityValue(status.raw, unit))}
              ${renderMetric(host._t("humidityMedian"), formatHumidityValue(status.median, unit))}
              ${renderMetric(
                host._t("humidityTargetLabel"),
                formatHumidityValue(status.effective_target ?? status.target ?? settings.target, unit),
                status.pull_down_active ? host._t("humidityPullDownActive") : undefined,
              )}
              ${renderMetric(
                host._t("humidityNextTransition"),
                minutes === undefined
                  ? host._t("humidityNoTransition")
                  : minutes === 0
                    ? host._t("humidityNextTransitionNow")
                    : host._t("humidityNextTransitionIn", { minutes }),
              )}
            </div>
            <div class="humidity-flags">
              ${status.gate_active ? html`<span class="humidity-flag gate"><ha-icon icon="mdi:gate"></ha-icon>${host._t("humidityGateActive")}</span>` : nothing}
              ${status.emergency_high ? html`<span class="humidity-flag emergency"><ha-icon icon="mdi:alert"></ha-icon>${host._t("humidityEmergencyHigh")}</span>` : nothing}
              ${decisionText ? html`<span class="humidity-flag decision">${decisionText}</span>` : nothing}
            </div>
          `
        : nothing}
      ${reasonKey ? html`<small class="humidity-reason">${host._t(reasonKey as TranslationKey)}</small>` : nothing}
    </div>
  `;
}

function renderMetric(label: string, value: string, note?: string) {
  return html`
    <span class="humidity-metric">
      <small>${label}</small>
      <strong>${value}</strong>
      ${note ? html`<em>${note}</em>` : nothing}
    </span>
  `;
}

function renderHumidityConfiguration(
  host: HumidityViewHost,
  entityId: string,
  settings: HumidityAssistSettings,
) {
  const temperatureUnit = host._temperatureUnit(entityId);
  const targetUnit = settings.measure === "dew_point" ? temperatureUnit : "%";
  const [minTemperature, maxTemperature] = host._entityTemperatureLimits(entityId);
  const temperatureStep = host._entityTemperatureStep(entityId) ?? 0.5;
  const sensors = humiditySensorOptions(host.hass, settings.sensor_entity_id ?? "", settings.measure);
  const fanModes = host._entityFanModeOptions(entityId);
  const disabled = host._settingsSaving;
  const save = (updates: Partial<HumidityAssistSettings>) => host._saveZoneHumidityAssist(entityId, updates);
  return html`
    <div class="humidity-config-rows">
      <label class="humidity-config-row humidity-select-row">
        <span class="humidity-config-label">${host._t("humiditySensor")}</span>
        <span class="select-wrap">
          <select
            .value=${settings.sensor_entity_id ?? ""}
            value=${settings.sensor_entity_id ?? ""}
            ?disabled=${disabled}
            @change=${(event: Event) => {
              const nextValue = (event.currentTarget as HTMLSelectElement).value.trim();
              save({ sensor_entity_id: nextValue || null });
            }}
          >
            <option value="" ?selected=${!settings.sensor_entity_id}>${host._t("humiditySelectSensor")}</option>
            ${sensors.map((sensor) => html`
              <option value=${sensor.entityId} ?selected=${sensor.entityId === settings.sensor_entity_id}>${sensor.label}</option>
            `)}
          </select>
        </span>
      </label>
      <label class="humidity-config-row humidity-select-row">
        <span class="humidity-config-label">${host._t("humidityMeasure")}</span>
        <span class="select-wrap">
          <select
            .value=${settings.measure}
            ?disabled=${disabled}
            @change=${(event: Event) => {
              const nextValue = (event.currentTarget as HTMLSelectElement).value;
              save({ measure: nextValue === "relative_humidity" ? "relative_humidity" : "dew_point" });
            }}
          >
            ${HUMIDITY_ASSIST_MEASURES.map((measure) => html`
              <option value=${measure} ?selected=${measure === settings.measure}>
                ${host._t(measure === "dew_point" ? "humidityMeasureDewPoint" : "humidityMeasureRelativeHumidity")}
              </option>
            `)}
          </select>
        </span>
      </label>
      ${renderNumberRow(
        host,
        `${host._t("humidityTarget")} (${targetUnit})`,
        settings.target,
        settings.measure === "dew_point" ? (targetUnit.includes("F") ? 32 : 0) : 0,
        settings.measure === "dew_point" ? (targetUnit.includes("F") ? 104 : 40) : 100,
        0.1,
        disabled,
        (value) => save({ target: value }),
        "humidityTargetHelp",
      )}
      <label class="humidity-config-row humidity-toggle-row">
        <span class="humidity-config-label">${host._t("humidityPriority")}${renderInlineHelp(`humidity-priority-${entityId}`, host._t("humidityPriority"), host._t("humidityPriorityHelp"))}</span>
        <ha-switch
          .checked=${settings.priority}
          ?disabled=${disabled}
          @change=${(event: Event) => save({ priority: Boolean((event.target as HTMLInputElement).checked) })}
        ></ha-switch>
      </label>
      ${renderNumberRow(
        host,
        `${host._t("humidityPulseTemperature")} (${temperatureUnit})`,
        settings.pulse_temperature,
        minTemperature,
        maxTemperature,
        temperatureStep,
        disabled,
        (value) => save({ pulse_temperature: value }),
        "humidityPulseTemperatureHelp",
      )}
      <label class="humidity-config-row humidity-select-row">
        <span class="humidity-config-label">${host._t("humidityPulseMode")}</span>
        <span class="select-wrap">
          <select
            .value=${settings.pulse_hvac_mode}
            ?disabled=${disabled}
            @change=${(event: Event) => {
              const nextValue = (event.currentTarget as HTMLSelectElement).value;
              save({ pulse_hvac_mode: nextValue === "dry" ? "dry" : "cool" });
            }}
          >
            ${HUMIDITY_ASSIST_PULSE_MODES.map((mode) => html`
              <option value=${mode} ?selected=${mode === settings.pulse_hvac_mode}>${host._modeLabel(mode)}</option>
            `)}
          </select>
        </span>
      </label>
      <label class="humidity-config-row humidity-select-row">
        <span class="humidity-config-label">${host._t("humidityPulseFanMode")}</span>
        <span class="select-wrap">
          <select
            .value=${settings.pulse_fan_mode ?? ""}
            value=${settings.pulse_fan_mode ?? ""}
            ?disabled=${disabled}
            @change=${(event: Event) => {
              const nextValue = (event.currentTarget as HTMLSelectElement).value.trim();
              save({ pulse_fan_mode: nextValue || null });
            }}
          >
            <option value="" ?selected=${!settings.pulse_fan_mode}>${host._t("humidityPulseFanKeep")}</option>
            ${[...new Set([...(settings.pulse_fan_mode ? [settings.pulse_fan_mode] : []), ...fanModes])].map((mode) => html`
              <option value=${mode} ?selected=${mode === settings.pulse_fan_mode}>${mode}</option>
            `)}
          </select>
        </span>
      </label>
    </div>
  `;
}

function renderNumberRow(
  host: HumidityViewHost,
  label: string,
  value: number | null,
  min: number,
  max: number,
  step: number,
  disabled: boolean,
  onChange: (value: number | null) => void,
  helpKey?: TranslationKey,
) {
  const helpId = `humidity-help-${label.replace(/[^a-zA-Z0-9_-]/g, "-")}`;
  return html`
    <label class="humidity-config-row">
      <span class="humidity-config-label">${label}${helpKey ? renderInlineHelp(helpId, label, host._t(helpKey)) : nothing}</span>
      <span class="humidity-number-input"><input
        type="number"
        min=${String(min)}
        max=${String(max)}
        step=${String(step)}
        .value=${value === null ? "" : String(value)}
        ?disabled=${disabled}
        @change=${(event: Event) => {
          if (disabled) {
            return;
          }
          const rawValue = (event.currentTarget as HTMLInputElement).value.trim();
          if (rawValue === "") {
            onChange(null);
            return;
          }
          const number = Number(rawValue);
          if (!Number.isFinite(number)) {
            return;
          }
          onChange(Math.min(max, Math.max(min, number)));
        }}
      ></span>
    </label>
  `;
}

function renderGlobalParameters(host: HumidityViewHost, firstEntityId?: string) {
  const temperatureUnit = host._temperatureUnit(firstEntityId);
  const settings = humidityAssistGlobalSettings(host._data?.settings?.humidity_assist, temperatureUnit);
  const gates = gateEntityOptions(host.hass, settings.gate_entity_id ?? "");
  const disabled = host._settingsSaving;
  return html`
    <section class="humidity-global">
      <h3><ha-icon icon="mdi:tune-variant"></ha-icon>${host._t("humidityGlobalSettings")}</h3>
      <p class="humidity-global-detail">${host._t("humidityGlobalSettingsDetail")}</p>
      <div class="humidity-config-rows">
        ${HUMIDITY_PARAMETERS.map((parameter) => renderParameterRow(host, parameter, settings, temperatureUnit, disabled))}
        <label class="humidity-config-row humidity-select-row">
          <span class="humidity-config-label">${host._t("humidityGateEntity")}${renderInlineHelp("humidity-gate-help", host._t("humidityGateEntity"), host._t("humidityGateEntityHelp"))}</span>
          <span class="select-wrap">
            <select
              .value=${settings.gate_entity_id ?? ""}
              value=${settings.gate_entity_id ?? ""}
              ?disabled=${disabled}
              @change=${(event: Event) => {
                const nextValue = (event.currentTarget as HTMLSelectElement).value.trim();
                host._saveHumidityAssistSettings({ gate_entity_id: nextValue || null });
              }}
            >
              <option value="" ?selected=${!settings.gate_entity_id}>${host._t("humidityGateNone")}</option>
              ${gates.map((gate) => html`
                <option value=${gate.entityId} ?selected=${gate.entityId === settings.gate_entity_id}>${gate.label}</option>
              `)}
            </select>
          </span>
        </label>
      </div>
    </section>
  `;
}

function renderParameterRow(
  host: HumidityViewHost,
  parameter: HumidityParameterDefinition,
  settings: HumidityAssistGlobalSettings,
  temperatureUnit: string,
  disabled: boolean,
) {
  const unit = parameter.kind === "delta"
    ? temperatureUnit
    : parameter.kind === "minutes"
      ? host._t("minutesShort")
      : "";
  const label = unit ? `${host._t(parameter.labelKey as TranslationKey)} (${unit})` : host._t(parameter.labelKey as TranslationKey);
  return renderNumberRow(
    host,
    label,
    settings[parameter.field],
    parameter.min,
    parameter.max,
    parameter.step,
    disabled,
    (value) => {
      if (value === null) {
        return;
      }
      host._saveHumidityAssistSettings({
        [parameter.field]: parameter.kind === "delta" ? value : Math.round(value),
      });
    },
    parameter.helpKey as TranslationKey,
  );
}
