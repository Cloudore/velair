import { html, nothing } from "lit";
import type { TranslationKey } from "../../translations";
import type { GuardStatus, HouseModeStatus, OccupancyAssistStatus } from "../../types";
import type { PresenceFormContext } from "./form-rows";
import { guardStateLabelKey, houseModeLabelKey, occupancyStateLabelKey } from "./presence-settings";

type ChipTone = "neutral" | "good" | "info" | "primary" | "warning" | "error";

const OCCUPANCY_ICONS: Record<string, string> = {
  disabled: "mdi:motion-sensor-off",
  unavailable: "mdi:alert-circle-outline",
  occupied: "mdi:account-check-outline",
  arriving_1: "mdi:account-arrow-right-outline",
  comfort: "mdi:sofa-outline",
  vacant: "mdi:account-off-outline",
  setback_1: "mdi:thermometer-chevron-up",
  setback_2: "mdi:thermometer-chevron-up",
  setback_3: "mdi:thermometer-chevron-up",
  blocked: "mdi:hand-back-right-outline",
};

const OCCUPANCY_TONES: Record<string, ChipTone> = {
  disabled: "neutral",
  unavailable: "error",
  occupied: "good",
  arriving_1: "info",
  comfort: "good",
  vacant: "neutral",
  setback_1: "primary",
  setback_2: "primary",
  setback_3: "primary",
  blocked: "warning",
};

const HOUSE_MODE_ICONS: Record<string, string> = {
  home: "mdi:home-account",
  away: "mdi:home-export-outline",
  away_deep: "mdi:home-clock-outline",
  travel: "mdi:airplane",
  sleep: "mdi:weather-night",
  disabled: "mdi:home-off-outline",
};

const HOUSE_MODE_TONES: Record<string, ChipTone> = {
  home: "good",
  away: "primary",
  away_deep: "primary",
  travel: "info",
  sleep: "info",
  disabled: "neutral",
};

const GUARD_ICONS: Record<string, string> = {
  idle: "mdi:shield-check-outline",
  off_grace: "mdi:shield-half-full",
  snoozed: "mdi:alarm-snooze",
  recovering: "mdi:shield-refresh-outline",
  manual_watch: "mdi:hand-back-right-outline",
  activity_hold: "mdi:stove",
  floor_hold: "mdi:arrow-collapse-down",
};

const GUARD_TONES: Record<string, ChipTone> = {
  idle: "neutral",
  off_grace: "warning",
  snoozed: "info",
  recovering: "primary",
  manual_watch: "warning",
  activity_hold: "primary",
  floor_hold: "info",
};

export function minutesUntil(value: string | null | undefined, now: Date): number | undefined {
  if (!value) {
    return undefined;
  }
  const when = new Date(value).getTime();
  if (!Number.isFinite(when)) {
    return undefined;
  }
  return Math.max(0, Math.ceil((when - now.getTime()) / 60_000));
}

function renderChip(kind: string, icon: string, tone: ChipTone, label: string, title: string, detail?: string) {
  return html`
    <span class=${`presence-chip chip-${kind} tone-${tone}`} title=${title}>
      <ha-icon icon=${icon}></ha-icon>
      <span>${label}</span>
      ${detail ? html`<small>${detail}</small>` : nothing}
    </span>
  `;
}

export function renderOccupancyChip(ctx: PresenceFormContext, status: OccupancyAssistStatus, now: Date) {
  const label = ctx.t(occupancyStateLabelKey(status.state) as TranslationKey);
  const minutes = minutesUntil(status.next_stage_at, now);
  const detail = minutes === undefined
    ? undefined
    : minutes === 0 ? ctx.t("presenceNextStageNow") : ctx.t("presenceNextStageIn", { minutes });
  const title = [
    `${ctx.t("presenceOccupancyChipTitle")}: ${label}`,
    status.blocked_by ? `${ctx.t("presenceBlockedBy")}: ${status.blocked_by}` : "",
    status.last_action ? `${ctx.t("presenceLastAction")}: ${status.last_action}` : "",
  ].filter(Boolean).join("\n");
  return renderChip(
    "occupancy",
    OCCUPANCY_ICONS[status.state] ?? "mdi:motion-sensor",
    OCCUPANCY_TONES[status.state] ?? "neutral",
    label,
    title,
    detail,
  );
}

export function renderHouseModeChip(ctx: PresenceFormContext, status: HouseModeStatus, now: Date) {
  const label = ctx.t(houseModeLabelKey(status.state) as TranslationKey);
  const minutes = minutesUntil(status.next_stage_at, now);
  const detail = status.sleeping && status.state !== "sleep"
    ? ctx.t("presenceHouseModeSleep")
    : minutes === undefined
      ? undefined
      : minutes === 0 ? ctx.t("presenceNextStageNow") : ctx.t("presenceNextStageIn", { minutes });
  return renderChip(
    "house-mode",
    HOUSE_MODE_ICONS[status.state] ?? "mdi:home-outline",
    HOUSE_MODE_TONES[status.state] ?? "neutral",
    label,
    `${ctx.t("presenceHouseModeChipTitle")}: ${label}`,
    detail,
  );
}

export function renderGuardChip(ctx: PresenceFormContext, status: GuardStatus, now: Date) {
  const label = ctx.t(guardStateLabelKey(status.state) as TranslationKey);
  const until = status.state === "off_grace"
    ? status.grace_ends_at
    : status.state === "snoozed"
      ? status.snooze_until
      : status.state === "manual_watch"
        ? status.manual_release_at
        : undefined;
  const minutes = minutesUntil(until, now);
  const detail = minutes === undefined
    ? undefined
    : minutes === 0 ? ctx.t("presenceNextStageNow") : ctx.t("presenceNextStageIn", { minutes });
  const title = [
    `${ctx.t("presenceGuardChipTitle")}: ${label}`,
    status.activity_entity_id ? `${ctx.t("presenceActivityEntity")}: ${status.activity_entity_id}` : "",
  ].filter(Boolean).join("\n");
  return renderChip(
    "guard",
    GUARD_ICONS[status.state] ?? "mdi:shield-outline",
    GUARD_TONES[status.state] ?? "neutral",
    label,
    title,
    detail,
  );
}
