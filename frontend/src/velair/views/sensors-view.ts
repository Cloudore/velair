import { html, nothing } from "lit";
import { modeClassName } from "../domain/climate";
import { preconditioningSettings, temperatureSensorOptions } from "../domain/preconditioning";
import type { VelairViewHost } from "../host-types";
import type { TranslationKey } from "../translations";
import type { PreconditioningSettings, RoomSensorAssistStatus } from "../types";

type SensorsViewHost = VelairViewHost;

export type RoomSensorViewOptions = {
  showAssistSwitch: boolean;
  showDebounce: boolean;
  showLiveStatus: boolean;
  showMaxDelta: boolean;
  showRoomSensor: boolean;
};

type TemperatureMarker = {
  key: "target" | "room" | "climateTarget" | "climate";
  label: string;
  value: number;
  calloutPosition: number;
  formatted: string;
  lane: number;
  position: number;
  shifted: boolean;
};

type TemperatureMarkerGroup = {
  markers: TemperatureMarker[];
  position: number;
};

const TEMPERATURE_MARKER_COLOR: Record<TemperatureMarker["key"], string> = {
  climate: "var(--secondary-text-color)",
  climateTarget: "var(--primary-color)",
  room: "var(--success-color, #43a047)",
  target: "var(--error-color, #d93025)",
};

const TEMPERATURE_MARKER_ORDER: Record<TemperatureMarker["key"], number> = {
  target: 0,
  room: 1,
  climateTarget: 2,
  climate: 3,
};

const TEMPERATURE_MARKER_DOT_GROUP_DISTANCE_PERCENT = 1.25;
const TEMPERATURE_MARKER_COLLISION_DISTANCE_PERCENT = 22;
const TEMPERATURE_MARKER_CALLOUT_EDGE_PERCENT = 10;
const TEMPERATURE_MARKER_CALLOUT_GAP_PERCENT = 20;

const SENSOR_HELP_KEYS: Partial<Record<TranslationKey, TranslationKey>> = {
  roomSensorAssist: "roomSensorAssistHelp",
  roomSensorAssistMaxDelta: "roomSensorAssistMaxDeltaHelp",
  roomSensorAssistDebounce: "roomSensorAssistDebounceHelp",
  roomSensorTemperatureEntity: "roomSensorTemperatureEntityHelp",
};
const DEFAULT_ROOM_SENSOR_VIEW_OPTIONS: RoomSensorViewOptions = {
  showAssistSwitch: true,
  showDebounce: true,
  showLiveStatus: true,
  showMaxDelta: true,
  showRoomSensor: true,
};

export function renderSensorsView(
  host: SensorsViewHost,
  zoneIds: string[],
  options: Partial<RoomSensorViewOptions> = {},
) {
  const viewOptions = roomSensorViewOptions(options);
  return html`
    <section class="sensors-view">
      <header class="sensors-intro">
        <ha-icon icon="mdi:home-thermometer-outline"></ha-icon>
        <span>
          <strong>${host._t("roomSensorIntroTitle")}</strong>
          <small>${host._t("roomSensorIntroDetail")}</small>
        </span>
      </header>
      ${zoneIds.length
        ? zoneIds.map((entityId) => renderSensorZone(host, entityId, viewOptions))
        : html`<span class="empty">${host._t("noManagedEntities")}</span>`}
    </section>
  `;
}

function roomSensorViewOptions(options: Partial<RoomSensorViewOptions>): RoomSensorViewOptions {
  return {
    ...DEFAULT_ROOM_SENSOR_VIEW_OPTIONS,
    ...options,
  };
}

function renderSensorZone(
  host: SensorsViewHost,
  entityId: string,
  options: RoomSensorViewOptions,
) {
  const exists = host._entityExists(entityId);
  const settings = preconditioningSettings(
    host._data?.zones[entityId]?.preconditioning,
  );
  const status = host._data?.room_sensor_assist?.[entityId];
  const expanded = exists && host._expandedPreconditioningZones.has(entityId);
  const contentId = `sensor-zone-content-${entityId.replace(/[^a-zA-Z0-9_-]/g, "-")}`;
  const toggleLabel = exists
    ? host._t(
        expanded ? "roomSensorCollapseClimate" : "roomSensorExpandClimate",
        { climate: host._friendlyEntityName(entityId) },
      )
    : host._t("roomSensorUnavailable");
  const canEnable = exists && Boolean(settings.room_temperature_entity_id);
  const handleToggle = (event: Event) => {
    event.preventDefault();
    event.stopPropagation();
    host._togglePreconditioningZone(entityId);
  };
  const handleHeadingClick = (event: Event) => {
    const target = event.target;
    if (target instanceof Element && target.closest(".sensor-zone-actions")) {
      return;
    }
    host._togglePreconditioningZone(entityId);
  };

  return html`
    <section class=${`sensor-zone ${settings.room_sensor_assist_enabled ? "enabled" : "disabled"} ${expanded ? "expanded" : "collapsed"}`}>
      <header class="sensor-zone-heading" @click=${handleHeadingClick}>
        <button
          type="button"
          class="sensor-zone-toggle"
          title=${toggleLabel}
          aria-label=${toggleLabel}
          aria-expanded=${String(expanded)}
          aria-controls=${expanded ? contentId : nothing}
          ?disabled=${!exists}
          @click=${handleToggle}
        >
          <ha-icon
            class="sensor-expand-icon"
            icon=${expanded ? "mdi:chevron-down" : "mdi:chevron-right"}
          ></ha-icon>
          <span class="sensor-zone-identity">
            <strong title=${host._friendlyEntityName(entityId)}>
              ${host._friendlyEntityName(entityId)}
            </strong>
            <span>${entityId}</span>
          </span>
        </button>
        ${options.showAssistSwitch
          ? html`
              <div class="sensor-zone-actions" @click=${(event: Event) => event.stopPropagation()}>
                <span
                  class=${canEnable ? "sensor-enable-control" : "sensor-enable-control unavailable"}
                  title=${canEnable ? "" : host._t("roomSensorNotConfigured")}
                >
                  <ha-switch
                    .checked=${settings.room_sensor_assist_enabled}
                    ?disabled=${host._settingsSaving || !canEnable}
                    @change=${(event: Event) =>
                      host._saveZonePreconditioning(entityId, {
                        room_sensor_assist_enabled: Boolean((event.target as HTMLInputElement).checked),
                      })}
                  ></ha-switch>
                </span>
              </div>
            `
          : nothing}
      </header>
      ${exists && expanded
        ? html`
            <div id=${contentId} class="sensor-zone-content">
              ${renderSensorConfiguration(host, entityId, settings, options)}
              ${options.showLiveStatus && settings.room_temperature_entity_id && !settings.room_sensor_assist_enabled
                ? renderSensorInactiveNotice(host)
                : nothing}
              ${options.showLiveStatus && settings.room_temperature_entity_id && settings.room_sensor_assist_enabled
                ? renderSensorRuntime(host, entityId, status)
                : nothing}
            </div>
          `
        : nothing}
    </section>
  `;
}

function renderSensorConfiguration(
  host: SensorsViewHost,
  entityId: string,
  settings: PreconditioningSettings,
  options: RoomSensorViewOptions,
) {
  if (!options.showRoomSensor && !options.showMaxDelta && !options.showDebounce) {
    return nothing;
  }

  return html`
    <section class="sensor-config-section">
      <h3><ha-icon icon="mdi:tune-variant"></ha-icon>${host._t("roomSensorAssist")}</h3>
      <div class="sensor-config-rows">
        ${options.showRoomSensor
          ? renderSensorEntityPicker(
              host,
              entityId,
              settings.room_temperature_entity_id ?? "",
            )
          : nothing}
        ${options.showMaxDelta
          ? renderSensorNumber(
              host,
              entityId,
              "roomSensorAssistMaxDelta",
              "room_sensor_assist_max_delta",
              settings.room_sensor_assist_max_delta,
              0.1,
              maxAssistDeltaForUnit(host._temperatureUnit(entityId)),
              0.1,
              host._temperatureUnit(entityId),
              {
                inactive:
                  !settings.room_temperature_entity_id
                  || !settings.room_sensor_assist_enabled,
              },
            )
          : nothing}
        ${options.showDebounce
          ? renderSensorNumber(
              host,
              entityId,
              "roomSensorAssistDebounce",
              "room_sensor_assist_debounce_seconds",
              settings.room_sensor_assist_debounce_seconds,
              0,
              300,
              1,
              host._t("secondsShort"),
              {
                inactive:
                  !settings.room_temperature_entity_id
                  || !settings.room_sensor_assist_enabled,
              },
            )
          : nothing}
      </div>
    </section>
  `;
}

function renderSensorInactiveNotice(host: SensorsViewHost) {
  return html`
    <section class="sensor-runtime-section sensor-inactive-section">
      <h3>
        <ha-icon icon="mdi:power-standby"></ha-icon>
        ${host._t("roomSensorStatusDisabled")}
      </h3>
      <p>${host._t("roomSensorAssistDisabledDetail")}</p>
    </section>
  `;
}

function renderSensorRuntime(
  host: SensorsViewHost,
  entityId: string,
  status?: RoomSensorAssistStatus,
) {
  if (!status) {
    return nothing;
  }

  const markers = buildTemperatureMarkers(host, entityId, status);
  const hasActiveBlock = typeof status.target_temperature === "number" && Boolean(status.start);

  return html`
    <section class="sensor-runtime-section">
      <h3 class="sensor-runtime-heading">
        <span class="sensor-section-title">
          <ha-icon icon="mdi:pulse"></ha-icon>
          ${host._t("roomSensorLiveStatus")}
        </span>
        ${renderSensorStatusPill(host, status)}
      </h3>
      <div class="sensor-status-card">
        ${hasActiveBlock
          ? renderSensorActiveBlockSummary(host, entityId, status)
          : renderSensorIdleState(host)}
        ${hasActiveBlock && markers.length
          ? renderTemperatureScale(host, entityId, markers, status)
          : nothing}
      </div>
    </section>
  `;
}

function renderSensorStatusPill(
  host: SensorsViewHost,
  status?: RoomSensorAssistStatus,
) {
  const state = status?.status ?? "not_configured";
  return html`
    <span class=${`sensor-status-pill ${state}`}>
      ${host._t(roomSensorStatusLabelKey(state))}
    </span>
  `;
}

function renderSensorIdleState(host: SensorsViewHost) {
  return html`
    <div class="sensor-idle-state">
      <ha-icon icon="mdi:clock-outline"></ha-icon>
      <span>${host._t("roomSensorNoActiveBlockDetail")}</span>
    </div>
  `;
}

function renderSensorActiveBlockSummary(
  host: SensorsViewHost,
  entityId: string,
  status: RoomSensorAssistStatus,
) {
  const scheduledTime = status.start ? host._formatScheduleTime(status.start) : "";
  const activeFrom = formatTimeForDisplay(host, status.active_from);
  const startedEarly = Boolean(status.target_when && status.active_from);
  const target = typeof status.target_temperature === "number"
    ? host._formatTemperature(status.target_temperature, entityId)
    : host._t("roomSensorValueUnavailable");
  const mode = status.hvac_mode ? host._modeLabel(status.hvac_mode) : host._t("roomSensorValueUnavailable");

  return html`
    <div class="sensor-block-summary">
      ${startedEarly
        ? html`
            <span class="sensor-block-detail emphasis">
              <ha-icon icon="mdi:creation-outline"></ha-icon>
              ${host._t("roomSensorBlockStartedEarly", { time: activeFrom })}
            </span>
            <span class="sensor-block-detail">
              <ha-icon icon="mdi:calendar-clock"></ha-icon>
              ${host._t("roomSensorBlockScheduled", { time: scheduledTime })}
            </span>
          `
        : html`
            <span class="sensor-block-detail">
              <ha-icon icon="mdi:calendar-clock"></ha-icon>
              ${host._t("roomSensorBlockScheduled", { time: scheduledTime })}
            </span>
            <span class="sensor-block-detail">
              <ha-icon icon="mdi:play-circle-outline"></ha-icon>
              ${host._t("roomSensorBlockActiveSince", { time: scheduledTime })}
            </span>
          `}
      <span class="sensor-block-detail">
        <ha-icon icon="mdi:thermometer"></ha-icon>
        ${host._t("roomSensorBlockTarget", { target })}
      </span>
      <span class="sensor-block-detail">
        <ha-icon icon="mdi:hvac"></ha-icon>
        ${host._t("roomSensorBlockMode", { mode })}
      </span>
    </div>
  `;
}

function renderTemperatureScale(
  host: SensorsViewHost,
  entityId: string,
  markers: TemperatureMarker[],
  status: RoomSensorAssistStatus,
) {
  const orderedMarkers = [...markers].sort((first, second) => first.value - second.value);
  const modeClass = status.hvac_mode ? `mode-${modeClassName(status.hvac_mode)}` : "mode-keep";
  const remaining = buildRemainingToTarget(host, entityId, markers);
  const markerGroups = buildTemperatureMarkerGroups(markers);
  return html`
    <div class=${`sensor-temperature-scale ${modeClass}`}>
      <div
        class="sensor-scale-track"
        role="img"
        aria-label=${host._t("roomSensorTemperatureScale")}
      >
        <span class="sensor-scale-line"></span>
        ${remaining
          ? html`
              <span
                class="sensor-scale-remaining"
                style=${[
                  `left: ${remaining.left.toFixed(2)}%;`,
                  `width: ${remaining.width.toFixed(2)}%;`,
                ].join(" ")}
                title=${remaining.title}
              >
                <span>${remaining.label}</span>
              </span>
            `
          : nothing}
        ${markerGroups.map(
          (group) => html`
            <span
              class=${temperatureMarkerGroupClass(group)}
              style=${temperatureMarkerGroupStyle(group)}
              role="img"
              aria-label=${temperatureMarkerGroupLabel(group)}
            >
              <span class=${`sensor-scale-dot ${group.markers.length > 1 ? "segmented" : ""}`}></span>
            </span>
          `,
        )}
        ${markers.map(
          (marker) => html`
            <span
              class=${`sensor-scale-callout-marker marker-${marker.key} lane-${marker.lane} ${temperatureMarkerCalloutEdgeClass(marker)} ${marker.shifted ? "shifted" : ""}`}
              style=${`--callout-left: ${marker.calloutPosition.toFixed(2)}%;`}
            >
              ${renderTemperatureMarkerCallout(host, entityId, marker, status)}
            </span>
          `,
        )}
      </div>
      <div class="sensor-scale-bounds">
        <span>${formatOptionalTemperature(host, entityId, orderedMarkers[0]?.value)}</span>
        <span>${formatOptionalTemperature(host, entityId, orderedMarkers[orderedMarkers.length - 1]?.value)}</span>
      </div>
    </div>
  `;
}

function buildTemperatureMarkerGroups(
  markers: TemperatureMarker[],
): TemperatureMarkerGroup[] {
  const sortedMarkers = [...markers].sort((first, second) =>
    first.position - second.position
    || TEMPERATURE_MARKER_ORDER[first.key] - TEMPERATURE_MARKER_ORDER[second.key],
  );
  const groups: TemperatureMarkerGroup[] = [];

  for (const marker of sortedMarkers) {
    const currentGroup = groups[groups.length - 1];
    if (
      currentGroup
      && Math.abs(marker.position - currentGroup.position)
        <= TEMPERATURE_MARKER_DOT_GROUP_DISTANCE_PERCENT
    ) {
      currentGroup.markers = [...currentGroup.markers, marker].sort(
        (first, second) =>
          TEMPERATURE_MARKER_ORDER[first.key] - TEMPERATURE_MARKER_ORDER[second.key],
      );
      currentGroup.position = averageMarkerPosition(currentGroup.markers);
      continue;
    }

    groups.push({
      markers: [marker],
      position: marker.position,
    });
  }

  return groups;
}

function averageMarkerPosition(markers: TemperatureMarker[]): number {
  return markers.reduce((total, marker) => total + marker.position, 0) / markers.length;
}

function temperatureMarkerGroupClass(group: TemperatureMarkerGroup): string {
  return [
    "sensor-scale-marker",
    `count-${group.markers.length}`,
    ...group.markers.map((marker) => `marker-${marker.key}`),
  ].join(" ");
}

function temperatureMarkerGroupStyle(group: TemperatureMarkerGroup): string {
  const styles = [`left: ${group.position.toFixed(2)}%;`];
  if (group.markers.length > 1) {
    styles.push(`--sensor-scale-dot-segments: ${temperatureMarkerSegments(group.markers)};`);
  }
  return styles.join(" ");
}

function temperatureMarkerSegments(markers: TemperatureMarker[]): string {
  const orderedMarkers = [...markers].sort((first, second) =>
    second.calloutPosition - first.calloutPosition
    || first.lane - second.lane
    || TEMPERATURE_MARKER_ORDER[first.key] - TEMPERATURE_MARKER_ORDER[second.key],
  );
  const step = 360 / orderedMarkers.length;
  const segments = orderedMarkers.map((marker, index) => {
    const start = roundDegrees(index * step);
    const end = roundDegrees((index + 1) * step);
    return `${TEMPERATURE_MARKER_COLOR[marker.key]} ${start}deg ${end}deg`;
  });
  return `conic-gradient(${segments.join(", ")})`;
}

function roundDegrees(value: number): number {
  return Math.round(value * 100) / 100;
}

function temperatureMarkerGroupLabel(group: TemperatureMarkerGroup): string {
  return group.markers
    .map((marker) => `${marker.label}: ${marker.formatted}`)
    .join(", ");
}

function temperatureMarkerCalloutEdgeClass(marker: TemperatureMarker): string {
  if (marker.calloutPosition <= TEMPERATURE_MARKER_CALLOUT_EDGE_PERCENT) {
    return "edge-left";
  }
  if (marker.calloutPosition >= 100 - TEMPERATURE_MARKER_CALLOUT_EDGE_PERCENT) {
    return "edge-right";
  }
  return "";
}

function renderTemperatureMarkerCallout(
  host: SensorsViewHost,
  entityId: string,
  marker: TemperatureMarker,
  status: RoomSensorAssistStatus,
) {
  const assistOffset = marker.key === "climateTarget" && typeof status.assist_delta === "number"
    ? signedAssistDelta(status.assist_delta, status.direction)
    : null;
  const assistOffsetLabel = typeof assistOffset === "number"
    ? formatSignedTemperatureDelta(host, entityId, assistOffset)
    : "";
  const assistOffsetHelp = host._t("roomSensorAssistOffsetHelp");

  return html`
    <span class="sensor-scale-callout">
      <small>${marker.label}</small>
      <span class="sensor-scale-value-row">
        <strong>${marker.formatted}</strong>
        ${assistOffsetLabel
          ? html`
              <span class="sensor-scale-offset">
                <span>${assistOffsetLabel}</span>
                <span
                  class="sensor-scale-offset-help"
                  tabindex="0"
                  aria-label=${assistOffsetHelp}
                  @click=${(event: Event) => {
                    event.preventDefault();
                    event.stopPropagation();
                  }}
                >
                  <ha-icon icon="mdi:information-outline"></ha-icon>
                  <span class="sensor-scale-offset-tooltip" role="tooltip">
                    ${assistOffsetHelp}
                  </span>
                </span>
              </span>
            `
          : nothing}
      </span>
    </span>
  `;
}

function renderSensorLabel(host: SensorsViewHost, labelKey: TranslationKey) {
  const helpKey = SENSOR_HELP_KEYS[labelKey];
  const help = helpKey ? host._t(helpKey) : "";
  return html`
    <span class="label sensor-config-label">
      <span>${host._t(labelKey)}</span>
      ${helpKey
        ? html`
            <span
              class="sensor-help"
              tabindex="0"
              aria-label=${help}
              @click=${(event: Event) => {
                event.preventDefault();
                event.stopPropagation();
              }}
            >
              <ha-icon icon="mdi:information-outline"></ha-icon>
              <span class="sensor-help-tooltip" role="tooltip">${help}</span>
            </span>
          `
        : nothing}
    </span>
  `;
}

function renderSensorEntityPicker(
  host: SensorsViewHost,
  entityId: string,
  value: string,
) {
  const disabled = host._settingsSaving;
  const sensors = temperatureSensorOptions(host.hass, value);
  return html`
    <label class="sensor-config-row sensor-picker-row">
      ${renderSensorLabel(host, "roomSensorTemperatureEntity")}
      <span class="select-wrap">
        <select
          .value=${value}
          value=${value}
          ?disabled=${disabled}
          @change=${(event: Event) => {
            const nextValue = (event.currentTarget as HTMLSelectElement).value.trim();
            host._saveZonePreconditioning(
              entityId,
              nextValue
                ? { room_temperature_entity_id: nextValue }
                : {
                    room_temperature_entity_id: null,
                    room_sensor_assist_enabled: false,
                  },
            );
          }}
        >
          <option value="" ?selected=${value === ""}>
            ${host._t("roomSensorSelectSensor")}
          </option>
          ${sensors.map(
            (sensor) => html`
              <option value=${sensor.entityId} ?selected=${sensor.entityId === value}>
                ${sensor.label} · ${sensor.entityId}
              </option>
            `,
          )}
        </select>
        ${value
          ? html`<small class="sensor-selected-entity">${value}</small>`
          : nothing}
      </span>
    </label>
  `;
}

function renderSensorNumber(
  host: SensorsViewHost,
  entityId: string,
  labelKey: TranslationKey,
  field: "room_sensor_assist_debounce_seconds" | "room_sensor_assist_max_delta",
  value: number,
  min: number,
  max: number,
  step: number,
  unit: string,
  options: { inactive?: boolean } = {},
) {
  const disabled = host._settingsSaving || Boolean(options.inactive);
  return html`
    <label class=${`sensor-config-row ${options.inactive ? "inactive" : ""}`}>
      ${renderSensorLabel(host, labelKey)}
      <span class="sensor-number-input">
        <input
          type="number"
          min=${String(min)}
          max=${String(max)}
          step=${String(step)}
          .value=${String(value)}
          ?disabled=${disabled}
          @change=${(event: Event) => {
            if (disabled) {
              return;
            }
            const rawValue = Number((event.currentTarget as HTMLInputElement).value);
            const boundedValue = Math.min(
              max,
              Math.max(min, Number.isFinite(rawValue) ? rawValue : value),
            );
            host._saveZonePreconditioning(entityId, {
              [field]: boundedValue,
            });
          }}
        />
        <span>${unit}</span>
      </span>
    </label>
  `;
}

function maxAssistDeltaForUnit(unit: string): number {
  return unit.toUpperCase().includes("F") ? 18 : 10;
}

function formatOptionalTemperature(
  host: SensorsViewHost,
  entityId: string,
  value?: number | null,
) {
  return typeof value === "number"
    ? host._formatTemperature(value, entityId)
    : host._t("roomSensorValueUnavailable");
}

function buildRemainingToTarget(
  host: SensorsViewHost,
  entityId: string,
  markers: TemperatureMarker[],
) {
  const targetMarker = markers.find((marker) => marker.key === "target");
  const roomMarker = markers.find((marker) => marker.key === "room");
  if (!targetMarker || !roomMarker) {
    return null;
  }

  const pendingDelta = Math.abs(targetMarker.value - roomMarker.value);
  const unit = host._temperatureUnit(entityId);
  const minimumVisibleDelta = unit.toUpperCase().includes("F") ? 0.1 : 0.05;
  if (pendingDelta < minimumVisibleDelta) {
    return null;
  }

  const value = formatTemperatureDelta(host, entityId, pendingDelta);
  return {
    label: host._t("roomSensorRemainingValue", { value }),
    left: Math.min(targetMarker.position, roomMarker.position),
    title: host._t("roomSensorRemainingToTarget"),
    value,
    width: Math.abs(targetMarker.position - roomMarker.position),
  };
}

function signedAssistDelta(
  assistDelta: number,
  direction?: RoomSensorAssistStatus["direction"],
): number {
  if (direction === "cool") {
    return -Math.abs(assistDelta);
  }
  return Math.abs(assistDelta);
}

function formatTemperatureDelta(
  host: SensorsViewHost,
  entityId: string,
  value: number,
) {
  return host._formatTemperature(Math.abs(value), entityId);
}

function formatSignedTemperatureDelta(
  host: SensorsViewHost,
  entityId: string,
  value: number,
) {
  const formatted = formatTemperatureDelta(host, entityId, value);
  if (value > 0) {
    return `+${formatted}`;
  }
  if (value < 0) {
    return `-${formatted}`;
  }
  return formatted;
}

function buildTemperatureMarkers(
  host: SensorsViewHost,
  entityId: string,
  status: RoomSensorAssistStatus,
): TemperatureMarker[] {
  const markerInputs = [
    {
      key: "target" as const,
      label: host._t("roomSensorScheduledTarget"),
      value: status.target_temperature,
    },
    {
      key: "room" as const,
      label: host._t("roomSensorRoomTemperature"),
      value: status.room_temperature,
    },
    {
      key: "climateTarget" as const,
      label: host._t("roomSensorClimateTarget"),
      value: status.climate_target_temperature ?? status.applied_temperature,
    },
    {
      key: "climate" as const,
      label: host._t("roomSensorClimateTemperature"),
      value: status.climate_temperature,
    },
  ].filter(
    (
      marker,
    ): marker is Omit<
      TemperatureMarker,
      "calloutPosition" | "formatted" | "lane" | "position" | "shifted"
    > => typeof marker.value === "number",
  );

  if (!markerInputs.length) {
    return [];
  }

  const values = markerInputs.map((marker) => marker.value);
  const minValue = Math.min(...values);
  const maxValue = Math.max(...values);
  const unit = host._temperatureUnit(entityId);
  const fallbackPadding = unit.toUpperCase().includes("F") ? 2 : 1;
  const observedRange = maxValue - minValue;
  const range = Math.max(observedRange, fallbackPadding);
  const centerValue = (minValue + maxValue) / 2;
  const lowerBound = centerValue - range * 0.58;
  const upperBound = centerValue + range * 0.58;
  const boundedRange = upperBound - lowerBound;

  const positionedMarkers = markerInputs.map((marker) => {
    return {
      ...marker,
      calloutPosition: 0,
      formatted: host._formatTemperature(marker.value, entityId),
      lane: 0,
      position: Math.max(
        0,
        Math.min(100, ((marker.value - lowerBound) / boundedRange) * 100),
      ),
      shifted: false,
    };
  });

  return applyTemperatureMarkerCalloutOffsets(positionedMarkers);
}

function applyTemperatureMarkerCalloutOffsets(
  markers: TemperatureMarker[],
): TemperatureMarker[] {
  const sortedMarkers = [...markers].sort((first, second) => first.position - second.position);
  const offsetsByKey = new Map<
    TemperatureMarker["key"],
    Pick<TemperatureMarker, "calloutPosition" | "lane" | "shifted">
  >();

  let cluster: TemperatureMarker[] = [];
  const flushCluster = () => {
    if (!cluster.length) {
      return;
    }
    const centerPosition =
      cluster.reduce((total, marker) => total + marker.position, 0) / cluster.length;
    const calloutPositions = calloutPositionsForCluster(cluster.length, centerPosition);
    cluster.forEach((marker, index) => {
      const calloutPosition = calloutPositions[index] ?? marker.position;
      offsetsByKey.set(marker.key, {
        calloutPosition,
        lane: index,
        shifted: Math.abs(calloutPosition - marker.position) > 0.5,
      });
    });
    cluster = [];
  };

  for (const marker of sortedMarkers) {
    const previous = cluster[cluster.length - 1];
    if (
      previous
      && marker.position - previous.position > TEMPERATURE_MARKER_COLLISION_DISTANCE_PERCENT
    ) {
      flushCluster();
    }
    cluster.push(marker);
  }
  flushCluster();

  return markers.map((marker) => ({
    ...marker,
    ...(offsetsByKey.get(marker.key) ?? {
      calloutPosition: marker.position,
      lane: 0,
      shifted: false,
    }),
  }));
}

function calloutPositionsForCluster(count: number, centerPosition: number): number[] {
  if (count <= 1) {
    return [clamp(centerPosition, TEMPERATURE_MARKER_CALLOUT_EDGE_PERCENT, 100 - TEMPERATURE_MARKER_CALLOUT_EDGE_PERCENT)];
  }

  const span = (count - 1) * TEMPERATURE_MARKER_CALLOUT_GAP_PERCENT;
  let firstPosition = centerPosition - span / 2;
  const minPosition = TEMPERATURE_MARKER_CALLOUT_EDGE_PERCENT;
  const maxPosition = 100 - TEMPERATURE_MARKER_CALLOUT_EDGE_PERCENT;

  if (firstPosition < minPosition) {
    firstPosition = minPosition;
  } else if (firstPosition + span > maxPosition) {
    firstPosition = maxPosition - span;
  }

  return Array.from(
    { length: count },
    (_, index) => clamp(
      firstPosition + index * TEMPERATURE_MARKER_CALLOUT_GAP_PERCENT,
      minPosition,
      maxPosition,
    ),
  );
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function formatTimeForDisplay(host: SensorsViewHost, value?: string | null) {
  if (!value) {
    return "";
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }
  const localTime = `${String(parsed.getHours()).padStart(2, "0")}:${String(parsed.getMinutes()).padStart(2, "0")}`;
  return host._formatScheduleTime(localTime);
}

function roomSensorStatusLabelKey(
  status: RoomSensorAssistStatus["status"],
): TranslationKey {
  const keys: Record<RoomSensorAssistStatus["status"], TranslationKey> = {
    assisting: "roomSensorStatusAssisting",
    blocked: "roomSensorStatusBlocked",
    disabled: "roomSensorStatusDisabled",
    holding: "roomSensorStatusHolding",
    idle: "roomSensorStatusIdle",
    not_configured: "roomSensorStatusNotConfigured",
    ready: "roomSensorStatusReady",
    unavailable: "roomSensorStatusUnavailable",
  };
  return keys[status];
}
