import type { HomeAssistant } from "../../types";

export type PresenceEntityOption = {
  entityId: string;
  label: string;
};

/** Domains whose state is a plain on/off signal: occupancy, blocking, gates, sleep and travel booleans. */
export const ON_OFF_DOMAINS = ["binary_sensor", "input_boolean", "switch"] as const;
/** Domains that report `home` / `not_home`: house presence and owners. */
export const PRESENCE_DOMAINS = ["person", "device_tracker"] as const;
/** Device classes listed first when picking a zone occupancy source. */
export const OCCUPANCY_DEVICE_CLASSES = ["occupancy", "presence", "motion"] as const;

function optionsForDomains(
  hass: HomeAssistant | undefined,
  domains: readonly string[],
  selected: readonly string[],
  priority: (entityId: string, deviceClass: string | undefined) => number = () => 0,
): PresenceEntityOption[] {
  const states = hass?.states ?? {};
  const selectedSet = new Set(selected.filter(Boolean));
  const options = Object.entries(states)
    .filter(([entityId]) => selectedSet.has(entityId) || domains.some((domain) => entityId.startsWith(`${domain}.`)))
    .map(([entityId, state]) => ({
      entityId,
      label: `${state.attributes?.friendly_name ?? entityId} (${entityId})`,
      priority: priority(entityId, state.attributes?.device_class),
    }))
    .sort((left, right) => right.priority - left.priority || left.label.localeCompare(right.label))
    .map(({ entityId, label }) => ({ entityId, label }));
  for (const entityId of selectedSet) {
    if (!options.some((option) => option.entityId === entityId)) {
      options.unshift({ entityId, label: entityId });
    }
  }
  return options;
}

/** binary_sensor / input_boolean / switch entities; occupancy-class sensors float to the top. */
export function occupancyEntityOptions(hass: HomeAssistant | undefined, selected: readonly string[] = []): PresenceEntityOption[] {
  return optionsForDomains(hass, ON_OFF_DOMAINS, selected, (entityId, deviceClass) =>
    entityId.startsWith("binary_sensor.") && OCCUPANCY_DEVICE_CLASSES.includes(deviceClass as never) ? 1 : 0);
}

/** Any on/off entity, alphabetically. */
export function onOffEntityOptions(hass: HomeAssistant | undefined, selected: readonly string[] = []): PresenceEntityOption[] {
  return optionsForDomains(hass, ON_OFF_DOMAINS, selected);
}

/** person / device_tracker entities. */
export function presenceEntityOptions(hass: HomeAssistant | undefined, selected: readonly string[] = []): PresenceEntityOption[] {
  return optionsForDomains(hass, PRESENCE_DOMAINS, selected);
}

export function friendlyEntityLabel(hass: HomeAssistant | undefined, entityId: string): string {
  return hass?.states?.[entityId]?.attributes?.friendly_name ?? entityId;
}
