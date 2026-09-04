import { html } from "lit";
import type { VelairViewHost } from "../host-types";
import type { ScheduleResponse } from "../types";
import "../components/presence/presence-view-element";

type PresenceViewHost = Pick<
  VelairViewHost,
  "hass" | "_data" | "_applyScheduleData" | "_showError" | "_currentTimelineNow"
>;

/**
 * Presence tab / card view (docs/dev/home-policy-spec.md §6).
 *
 * The body lives in `<velair-presence-view>`; this function only binds the
 * hosting card: the visible zones (card `entities` / `zone_order` scoping),
 * the initially selected zone (`selected_entity`), and the notice plumbing.
 */
export function renderPresenceView(host: PresenceViewHost, zoneIds: string[], selectedEntity?: string) {
  return html`<velair-presence-view
    .hass=${host.hass}
    .data=${host._data}
    .zoneIds=${zoneIds}
    .initialEntity=${selectedEntity ?? ""}
    .timelineNow=${host._currentTimelineNow?.() ?? new Date()}
    @presence-data-changed=${(event: CustomEvent<ScheduleResponse>) => host._applyScheduleData(event.detail, { forceDraft: false })}
    @presence-error=${(event: CustomEvent<string | null>) => host._showError(event.detail ?? undefined)}
  ></velair-presence-view>`;
}
