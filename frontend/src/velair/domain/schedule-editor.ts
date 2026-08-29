import { WEEKDAYS } from "../constants";

export type CloneDayPreset = "weekdays" | "weekend" | "all" | "clear";

export type ExternalSwitchpointCapabilities = {
  max_switchpoints_per_day: number;
  implicit_midnight_change_counts_toward_limit: boolean;
};

export type ExternalSwitchpointUsage = {
  scheduled: number;
  implicitMidnight: number;
  used: number;
  max: number;
  state: "normal" | "at-limit" | "over-limit";
};

const PRESET_DAYS: Record<Exclude<CloneDayPreset, "clear">, readonly string[]> = {
  weekdays: WEEKDAYS.slice(0, 5),
  weekend: WEEKDAYS.slice(5),
  all: WEEKDAYS,
};

/** Returns semantic weekday targets, independent of their current display order. */
export function cloneDayPresetTargets(preset: CloneDayPreset, sourceWeekday: string): Set<string> {
  if (preset === "clear") return new Set();
  return new Set(PRESET_DAYS[preset].filter((weekday) => weekday !== sourceWeekday));
}

/** Derives controller usage from a draft day without knowing the provider. */
export function externalSwitchpointUsage(
  blocks: readonly { start: string }[],
  capabilities: ExternalSwitchpointCapabilities,
): ExternalSwitchpointUsage {
  const scheduled = blocks.length;
  const implicitMidnight = capabilities.implicit_midnight_change_counts_toward_limit
    && !blocks.some((block) => block.start === "00:00")
    ? 1
    : 0;
  const used = scheduled + implicitMidnight;
  const max = capabilities.max_switchpoints_per_day;
  return {
    scheduled,
    implicitMidnight,
    used,
    max,
    state: used > max ? "over-limit" : used === max ? "at-limit" : "normal",
  };
}
