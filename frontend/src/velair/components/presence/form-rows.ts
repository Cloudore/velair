import { html, nothing } from "lit";
import type { TranslationKey } from "../../translations";
import type { HomeAssistant } from "../../types";
import { renderInlineHelp } from "../../views/inline-help";
import { friendlyEntityLabel, type PresenceEntityOption } from "./entity-options";

/** Everything a Presence form needs to render and write one field. */
export type PresenceFormContext = {
  hass?: HomeAssistant;
  disabled: boolean;
  temperatureUnit: string;
  temperatureLimits: [number, number];
  temperatureStep: number;
  t(key: TranslationKey, replacements?: Record<string, string | number>): string;
  modeLabel(mode: string): string;
};

export function helpId(prefix: string, label: string): string {
  return `${prefix}-${label.replace(/[^a-zA-Z0-9_-]/g, "-").toLowerCase()}`;
}

function labelWithHelp(ctx: PresenceFormContext, prefix: string, label: string, helpKey?: TranslationKey) {
  return html`<span class="presence-field-label">${label}${helpKey
    ? renderInlineHelp(helpId(prefix, label), label, ctx.t(helpKey))
    : nothing}</span>`;
}

export function renderNumberRow(
  ctx: PresenceFormContext,
  options: {
    id: string;
    label: string;
    value: number | null;
    min: number;
    max: number;
    step: number;
    unit?: string;
    helpKey?: TranslationKey;
    /** `true` lets the field be cleared to `null` (renders an empty input). */
    nullable?: boolean;
    placeholder?: string;
    onChange(value: number | null): void;
  },
) {
  const label = options.unit ? `${options.label} (${options.unit})` : options.label;
  return html`
    <label class="presence-field presence-number-field" data-field=${options.id}>
      ${labelWithHelp(ctx, options.id, options.label, options.helpKey)}
      <span class="presence-number-input"><input
        type="number"
        inputmode="decimal"
        aria-label=${label}
        min=${String(options.min)}
        max=${String(options.max)}
        step=${String(options.step)}
        placeholder=${options.placeholder ?? ""}
        .value=${options.value === null ? "" : String(options.value)}
        ?disabled=${ctx.disabled}
        @change=${(event: Event) => {
          if (ctx.disabled) {
            return;
          }
          const rawValue = (event.currentTarget as HTMLInputElement).value.trim();
          if (rawValue === "") {
            if (options.nullable) {
              options.onChange(null);
            } else {
              (event.currentTarget as HTMLInputElement).value = options.value === null ? "" : String(options.value);
            }
            return;
          }
          const number = Number(rawValue);
          if (!Number.isFinite(number)) {
            return;
          }
          const bounded = Math.min(options.max, Math.max(options.min, number));
          options.onChange(options.step >= 1 ? Math.round(bounded) : bounded);
        }}
      >${options.unit ? html`<span class="presence-unit">${options.unit}</span>` : nothing}</span>
    </label>
  `;
}

export function renderTemperatureRow(
  ctx: PresenceFormContext,
  options: {
    id: string;
    label: string;
    value: number | null;
    helpKey?: TranslationKey;
    nullable?: boolean;
    placeholder?: string;
    onChange(value: number | null): void;
  },
) {
  return renderNumberRow(ctx, {
    ...options,
    min: ctx.temperatureLimits[0],
    max: ctx.temperatureLimits[1],
    step: ctx.temperatureStep,
    unit: ctx.temperatureUnit,
  });
}

export function renderMinutesRow(
  ctx: PresenceFormContext,
  options: {
    id: string;
    label: string;
    value: number;
    min?: number;
    max?: number;
    helpKey?: TranslationKey;
    onChange(value: number): void;
  },
) {
  return renderNumberRow(ctx, {
    id: options.id,
    label: options.label,
    value: options.value,
    min: options.min ?? 0,
    max: options.max ?? 10_080,
    step: 1,
    unit: ctx.t("minutesShort"),
    helpKey: options.helpKey,
    onChange: (value) => {
      if (value !== null) {
        options.onChange(value);
      }
    },
  });
}

export function renderToggleRow(
  ctx: PresenceFormContext,
  options: {
    id: string;
    label: string;
    checked: boolean;
    helpKey?: TranslationKey;
    disabled?: boolean;
    onChange(checked: boolean): void;
  },
) {
  return html`
    <label class="presence-field presence-toggle-field" data-field=${options.id}>
      ${labelWithHelp(ctx, options.id, options.label, options.helpKey)}
      <ha-switch
        .checked=${options.checked}
        aria-label=${options.label}
        ?disabled=${ctx.disabled || Boolean(options.disabled)}
        @change=${(event: Event) => options.onChange(Boolean((event.target as HTMLInputElement).checked))}
      ></ha-switch>
    </label>
  `;
}

export function renderSelectRow(
  ctx: PresenceFormContext,
  options: {
    id: string;
    label: string;
    value: string;
    choices: Array<{ value: string; label: string }>;
    /** Label of an extra leading option whose value is `""`. */
    emptyLabel?: string;
    helpKey?: TranslationKey;
    onChange(value: string): void;
  },
) {
  return html`
    <label class="presence-field presence-select-field" data-field=${options.id}>
      ${labelWithHelp(ctx, options.id, options.label, options.helpKey)}
      <span class="select-wrap">
        <select
          aria-label=${options.label}
          .value=${options.value}
          value=${options.value}
          ?disabled=${ctx.disabled}
          @change=${(event: Event) => options.onChange((event.currentTarget as HTMLSelectElement).value.trim())}
        >
          ${options.emptyLabel !== undefined
            ? html`<option value="" ?selected=${!options.value}>${options.emptyLabel}</option>`
            : nothing}
          ${options.choices.map((choice) => html`
            <option value=${choice.value} ?selected=${choice.value === options.value}>${choice.label}</option>
          `)}
        </select>
      </span>
    </label>
  `;
}

export function renderEntityRow(
  ctx: PresenceFormContext,
  options: {
    id: string;
    label: string;
    value: string | null;
    entities: PresenceEntityOption[];
    emptyLabel: string;
    helpKey?: TranslationKey;
    onChange(value: string | null): void;
  },
) {
  return renderSelectRow(ctx, {
    id: options.id,
    label: options.label,
    value: options.value ?? "",
    choices: options.entities.map((entity) => ({ value: entity.entityId, label: entity.label })),
    emptyLabel: options.emptyLabel,
    helpKey: options.helpKey,
    onChange: (value) => options.onChange(value || null),
  });
}

/**
 * Multi-entity editor: the chosen entities as removable chips plus an
 * "add" select listing the remaining candidates.
 */
export function renderEntityListRow(
  ctx: PresenceFormContext,
  options: {
    id: string;
    label: string;
    values: string[];
    entities: PresenceEntityOption[];
    helpKey?: TranslationKey;
    onChange(values: string[]): void;
  },
) {
  const chosen = new Set(options.values);
  const candidates = options.entities.filter((entity) => !chosen.has(entity.entityId));
  return html`
    <div class="presence-field presence-entity-list-field" data-field=${options.id}>
      ${labelWithHelp(ctx, options.id, options.label, options.helpKey)}
      <div class="presence-entity-list">
        ${options.values.length
          ? options.values.map((entityId) => html`
              <span class="presence-entity-chip" title=${entityId}>
                <span>${friendlyEntityLabel(ctx.hass, entityId)}</span>
                <button
                  type="button"
                  class="presence-chip-remove"
                  title=${ctx.t("presenceRemoveEntity")}
                  aria-label=${`${ctx.t("presenceRemoveEntity")}: ${entityId}`}
                  ?disabled=${ctx.disabled}
                  @click=${() => options.onChange(options.values.filter((value) => value !== entityId))}
                ><ha-icon icon="mdi:close"></ha-icon></button>
              </span>
            `)
          : html`<span class="presence-entity-list-empty">${ctx.t("presenceNoEntities")}</span>`}
        <span class="select-wrap presence-entity-add">
          <select
            aria-label=${`${ctx.t("presenceAddEntity")}: ${options.label}`}
            .value=${""}
            ?disabled=${ctx.disabled || !candidates.length}
            @change=${(event: Event) => {
              const select = event.currentTarget as HTMLSelectElement;
              const entityId = select.value.trim();
              select.value = "";
              if (entityId && !chosen.has(entityId)) {
                options.onChange([...options.values, entityId]);
              }
            }}
          >
            <option value="" selected>${ctx.t("presenceAddEntity")}</option>
            ${candidates.map((entity) => html`<option value=${entity.entityId}>${entity.label}</option>`)}
          </select>
        </span>
      </div>
    </div>
  `;
}

export function renderTimeRow(
  ctx: PresenceFormContext,
  options: {
    id: string;
    label: string;
    value: string | null;
    helpKey?: TranslationKey;
    onChange(value: string | null): void;
  },
) {
  return html`
    <label class="presence-field presence-time-field" data-field=${options.id}>
      ${labelWithHelp(ctx, options.id, options.label, options.helpKey)}
      <span class="presence-time-input">
        <input
          type="time"
          aria-label=${options.label}
          .value=${options.value ?? ""}
          ?disabled=${ctx.disabled}
          @change=${(event: Event) => {
            const value = (event.currentTarget as HTMLInputElement).value.trim();
            options.onChange(value || null);
          }}
        >
        ${options.value
          ? html`<button
              type="button"
              class="presence-inline-clear"
              title=${ctx.t("presenceClearTime")}
              aria-label=${ctx.t("presenceClearTime")}
              ?disabled=${ctx.disabled}
              @click=${() => options.onChange(null)}
            ><ha-icon icon="mdi:close"></ha-icon></button>`
          : nothing}
      </span>
    </label>
  `;
}

export function renderTextRow(
  ctx: PresenceFormContext,
  options: {
    id: string;
    label: string;
    value: string;
    placeholder?: string;
    maxLength?: number;
    helpKey?: TranslationKey;
    onChange(value: string): void;
  },
) {
  return html`
    <label class="presence-field presence-text-field" data-field=${options.id}>
      ${labelWithHelp(ctx, options.id, options.label, options.helpKey)}
      <input
        type="text"
        aria-label=${options.label}
        placeholder=${options.placeholder ?? ""}
        maxlength=${String(options.maxLength ?? 64)}
        .value=${options.value}
        ?disabled=${ctx.disabled}
        @change=${(event: Event) => options.onChange((event.currentTarget as HTMLInputElement).value.trim())}
      >
    </label>
  `;
}

export function fanModeChoices(ctx: PresenceFormContext, fanModes: string[], current: string | null) {
  return [...new Set([...(current ? [current] : []), ...fanModes])].map((mode) => ({ value: mode, label: mode }));
}

export function hvacModeChoices(ctx: PresenceFormContext, hvacModes: string[], current: string | null) {
  return [...new Set([...(current ? [current] : []), ...hvacModes])]
    .filter((mode) => mode !== "off")
    .map((mode) => ({ value: mode, label: ctx.modeLabel(mode) }));
}
