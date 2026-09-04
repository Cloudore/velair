# Guards

Guards are the small rules that keep a home from drifting into a bad state
after a person touched a thermostat. They never fight a hand-set value while
it is fresh, they never act on uncertain evidence, and every write goes
through Velair's own hold API, so the zone override sensor always explains
what happened.

Three families of rules live here:

- **Never off**: a head that a person turned off comes back on after a grace
  period unless it is snoozed. The recovery is a raise-only hold, so an empty
  room is warmed, not cooled, and Velair then resumes automatic control.
- **Manual release**: a Manual adjustment is ended once documented evidence
  says nobody wants it any more (credible vacancy, travel, or all owners away
  with a setpoint below the zone floor), and never before the lease.
- **Activity holds**: while an entity such as `input_boolean.cooking` is
  `on`, the zone is held at a lower-only target; when it turns off for a
  delay, the hold is released.

Guards are local and event-driven: Velair listens to the managed climates,
the occupancy and presence entities, the travel entity and the activity
entities, and arms one timer per zone for the next decision boundary. There
is no polling.

## Concepts

- **Grace**: the wait between a person turning a head off and Velair relighting
  it. Default 10 minutes.
- **Snooze**: a timed freeze (`neveroff_snooze`, action `none`) that keeps the
  head off. Default 24 hours. `velair.snooze_off` creates it and ends the
  Manual adjustment that protected the turn-off.
- **Recovery**: the raise-only hold `neveroff_recover` at the warmest of the
  previous target, the zone's last Occupancy Assist setback stage and the
  zone's minimum temperature, followed by `resume_automatic_control`. Velair
  sends the HVAC mode first, so the head turns on.
- **Lease**: a hand-set value is never released younger than this. Default
  30 minutes.
- **Credible vacancy**: the zone's occupancy entity (from Occupancy Assist)
  reports `off` continuously. The vacancy window counts from the later of the
  room going empty and the snooze or Manual adjustment starting, so a snooze
  or a hand-set value made in an already-empty room still gets its full
  window. Both clocks use `last_changed` and the persisted start, so a restart
  does not reset them. An `unknown`/`unavailable` occupancy entity is never
  evidence of vacancy.
- **House empty**: every presence entity configured for House Modes reports
  away; any `unknown`/`unavailable` entity means the house is not empty.

## Global Settings

Stored under `settings.guards`; every value is editable from the panel, the
generated entities, or `velair/update_settings`.

| Setting | Default | Meaning |
| --- | --- | --- |
| `enabled` | `true` | Master switch (`switch.velair_guards`). Off means no guard rule runs. |
| `never_off_enabled` | `true` | Enables the never-off rules. |
| `never_off_grace_minutes` | `10` | Wait before relighting a head a person turned off. |
| `never_off_snooze_minutes` | `1440` | Default duration of `velair.snooze_off`. |
| `never_off_snooze_release_vacant_minutes` | `30` | Zone occupancy `off` this long releases `neveroff_snooze` and `watchdog`; the house being empty this long releases them everywhere. Counted from the later of the vacancy and the snooze start. |
| `never_off_respect_travel` | `true` | No relight while the travel entity is `on`. The grace stays pending and the head is recovered when travel ends if it is still off. |
| `manual_release_enabled` | `true` | Enables the manual release rules. |
| `manual_lease_minutes` | `30` | A Manual adjustment is never released younger than this. |
| `manual_release_vacant_minutes` | `60` | Continuous zone vacancy that ends a Manual adjustment, counted from the later of the vacancy and the adjustment. |
| `manual_release_on_travel` | `true` | Travel turning on releases every Manual adjustment that predates it once it is older than the lease. |
| `owner_entity_ids` | `[]` | Presence entities whose absence enables the sub-floor rule. |
| `owner_away_minutes` | `4` | How long every owner must be away. |
| `manual_release_below_minimum` | `true` | With all owners away and the live setpoint below the zone's minimum temperature (by more than 0.31 °C), release the Manual adjustment so Velair re-applies a target at or above the floor. |

## Per-Zone Settings

Stored under each zone's `guards` key and edited through
`velair/update_zone_guards`.

| Setting | Default | Meaning |
| --- | --- | --- |
| `never_off_enabled` | `true` | Never-off rules apply to this zone. |
| `manual_release_below_minimum_action` | `release` | What rule (c) does: `release` returns the zone to Velair's schedule; `floor_hold` lands the room exactly on the zone's minimum temperature instead (see below). |
| `activity_holds` | `[]` | Up to ten holds `{entity_id, temperature, constraint, hvac_mode, release_delay_minutes, pause_id, label}`. |

An activity hold defaults to `constraint: lower_only`, `hvac_mode: cool`,
`release_delay_minutes: 10` and `pause_id: activity`. The temperature must be
inside the climate's supported range.

## Rules

### Never off

1. Velair observes `external_climate_change_detected` with the head now
   `off`, or finds the head `off` when it starts while no `neveroff_snooze`
   or `travel_off` pause exists.
2. The grace starts and `never_off_grace_started` is emitted. The state
   sensor shows `off_grace` with `grace_ends_at`.
3. The grace is cancelled when the head comes back on, when a snooze or a
   `travel_off` freeze appears, or when Velair itself intends the head to be
   off (a `turn_off` block or pause).
4. When the grace ends and the head is still off, Velair holds
   `neveroff_recover` raise-only at `max(previous target, setback stage 3,
   minimum temperature)`, using the previous HVAC mode when the climate
   supports it, then resumes automatic control. `never_off_recovered` is
   emitted and the state sensor shows `recovering` while the hold exists.
   Occupancy Assist releases the hold on its final arrival stage.
5. If the head is still off after another grace period (for example the
   device rejected the command), the cycle repeats.

`velair.snooze_off` freezes the zone for the requested duration, ends the
Manual adjustment and emits `never_off_snoozed`. A snoozed head turned on by a
person releases the snooze and enters a Manual adjustment so the new setting
is protected. The snooze is released early when the zone is vacant, or the
house empty, for `never_off_snooze_release_vacant_minutes`; the same rule
releases the external `watchdog` hold.

The never-off rule is designed for the **Manual until resumed** external
change policy of the home doctrine. With **Keep automatic** Velair relights the
head immediately on its own; the grace is then cancelled as soon as the head
reports on.

### Manual release

For a zone in Manual adjustment (and with the lease elapsed) Velair calls
`resume_automatic_control` and emits `manual_hold_released` with `reason`:

| Reason | Condition |
| --- | --- |
| `vacant` | The zone's occupancy entity has been `off` for `manual_release_vacant_minutes`. |
| `travel` | The travel entity turned on after the Manual adjustment started. |
| `below_minimum` | Every owner entity has been away for `owner_away_minutes` and the live setpoint is below the zone minimum temperature minus 0.31 °C. |

Uncertain inputs (`unknown`, `unavailable`, missing entities, an empty owner
list) never release anything. A zone without an occupancy entity is never
considered vacant.

#### Floor hold instead of a release

With the per-zone setting `manual_release_below_minimum_action: floor_hold`,
rule (c) does not hand the zone back to the schedule. Velair places the hold
`floor` (constraint `absolute`, label "Floor") at the zone's minimum
temperature and resumes automatic control, so the room lands exactly on the
floor the way the legacy clamp kept it. The `manual_hold_released` event
carries `action: floor_hold` and `floor_temperature`; the state sensor shows
`floor_hold`. The hold is released when any owner has been home again for
`owner_away_minutes`, when a newer Manual adjustment made on top of it ends
for any reason, or when the vacancy or travel rule would have ended the
original adjustment (counted from that adjustment's start). Velair then
delivers its normal target again.

### Activity holds

- Entity `on` → hold `pause_id` at `temperature` with the configured
  constraint and HVAC mode (`activity_hold_changed` with `active: true`).
- Entity `off` for `release_delay_minutes` → the hold is released. If the
  zone is in a Manual adjustment older than the lease, automatic control is
  resumed as well (`resumed_automatic: true`); a younger Manual adjustment
  stays in place.
- An `unknown`/`unavailable` activity entity leaves the hold as it is.

## Entities

For a climate named "Guest room" Velair creates
`sensor.velair_guest_room_guard` with state `idle`, `off_grace`, `snoozed`,
`recovering`, `manual_watch`, `floor_hold` or `activity_hold` and the attributes
`grace_ends_at`, `snooze_until`, `snooze_started_at`, `manual_since`,
`manual_release_at`, `floor_since`, `activity_entity_id`, `next_transition_at`,
`last_action` and `pause_ids`.

Global entities:

| Entity | Meaning |
| --- | --- |
| `switch.velair_guards` | Master switch. |
| `number.velair_guards_never_off_grace_minutes` | Grace before relighting. |
| `number.velair_guards_never_off_snooze_minutes` | Default snooze duration. |
| `number.velair_guards_manual_lease_minutes` | Minimum age of a Manual adjustment before any release. |
| `number.velair_guards_manual_release_vacant_minutes` | Vacancy that ends a Manual adjustment. |

## Services

### `velair.snooze_off`

Keep a head that a person turned off from relighting. `duration_minutes`
defaults to `never_off_snooze_minutes`.

```yaml
action: velair.snooze_off
data:
  entity_id: climate.guest_room
  duration_minutes: 1440
```

## Automation Events

`never_off_grace_started`, `never_off_recovered`, `never_off_snoozed`,
`manual_hold_released` and `activity_hold_changed` are documented with their
payloads in [Automation Events](automation-events.md#guards).

## Example: Notify And Offer A 24-hour Snooze

The grace event carries everything a notification needs. This automation
sends an actionable notification when a head is about to be relit and calls
`velair.snooze_off` when the person taps **Keep off 24 h**.

```yaml
alias: Velair never-off - offer a snooze
mode: parallel
triggers:
  - trigger: event
    event_type: velair_event
    event_data:
      event: never_off_grace_started
actions:
  - variables:
      climate: "{{ trigger.event.data.entity_id }}"
      action_id: "VELAIR_SNOOZE_{{ climate | replace('.', '_') }}"
  - action: notify.mobile_app_phone
    data:
      title: "{{ state_attr(climate, 'friendly_name') }} was turned off"
      message: >-
        Velair relights it at
        {{ as_timestamp(trigger.event.data.grace_ends_at) | timestamp_custom('%H:%M') }}
        unless you keep it off.
      data:
        actions:
          - action: "{{ action_id }}"
            title: "Keep off 24 h"
  - wait_for_trigger:
      - trigger: event
        event_type: mobile_app_notification_action
        event_data:
          action: "{{ action_id }}"
    timeout:
      minutes: "{{ trigger.event.data.grace_minutes }}"
    continue_on_timeout: false
  - action: velair.snooze_off
    data:
      entity_id: "{{ climate }}"
      duration_minutes: 1440
```

## Restart Continuity

The grace timestamps, the previous target and mode captured when the head
was turned off, the snooze and floor-hold starts, and the last action are
persisted under `settings.guards_runtime`. A grace that was running when Home Assistant
restarted continues from its original end time; a head found off at start
without a persisted grace gets a fresh one. Vacancy, owner-away and travel
clocks use the entities' `last_changed`, so they survive restarts as well.

## Lovelace

The Guards settings are part of the Presence view:

```yaml
type: custom:velair-card
view: presence
```

## Limitations

- Guards observe the head through Home Assistant; a turn-off that never
  reaches Home Assistant cannot start a grace.
- The futile-cooling watchdog is not part of Guards; only its `watchdog`
  pause is released by the vacancy rule.
- Guards never call `climate.*` services and never clamp a Manual adjustment
  themselves; releasing it lets Velair's normal delivery, including the zone
  limits, apply again.
