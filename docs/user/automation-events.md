# Automation Events

Velair emits raw, transient Home Assistant events for runtime changes. The raw
event-bus payload exists only while Home Assistant delivers it; Velair does not
provide an event archive or replay API. Opening or refreshing the Velair panel
does not emit these events.

Diagnostics is separate. For enabled categories it can retain a sanitized
summary of selected events in a bounded in-memory history of at most 100
entries. That history is cleared whenever Velair or Home Assistant restarts, is
not Recorder history, and does not change or extend the lifetime of the
original automation event.

All events use:

```yaml
event_type: velair_event
```

Filter `event_data.event` and, for zone events, `event_data.entity_id`:

```yaml
triggers:
  - trigger: event
    event_type: velair_event
    event_data:
      event: climate_target_applied
      entity_id: climate.living_room
```

Every payload contains `domain: velair` and one of the event names below.

## External Climate Change Detected

`external_climate_change_detected` is emitted when a managed climate changes
HVAC mode or setpoint and the change cannot be attributed to a Velair climate
action. It is observational: `non-Velair` does not necessarily mean a person,
because a remote or another automation may be the source.

Detection covers `hvac_mode`, scalar `temperature`, and native
`target_temp_low`/`target_temp_high`. Environmental readings and fan, preset,
swing, or humidity options do not produce this event. Transitions to or from
`unknown` and `unavailable` are ignored. See
[External Changes and Manual Adjustment](manual-control.md) for the attribution
model, limitations, policies, and complete timelines.

```yaml
domain: velair
event: external_climate_change_detected
entity_id: climate.living_room
changed_fields: [hvac_mode, temperature]
previous:
  hvac_mode: "off"
  temperature: 24
current:
  hvac_mode: "cool"
  temperature: 23
policy: keep_automatic
```

`policy` is the policy that governs the change. During an active Manual
adjustment it remains that session's policy even if the future default in
Settings has since changed. `keep_automatic` means Velair did not create Manual
adjustment and instead re-resolved its current authority. Therefore that
detection does not have a matching `zone_control_changed` entry event.

`zone_control_changed` is emitted when the zone enters Manual adjustment or
returns to automatic control. Its `control_mode` is `manual` or `automatic` and
is deliberately separate from Velair Mode Manual.

```yaml
domain: velair
event: zone_control_changed
entity_id: climate.living_room
control_mode: manual
previous_control_mode: automatic
policy: for_duration
source: external_change
duration_minutes: 60
started_at: "2026-08-20T18:00:00+02:00"
until: "2026-08-20T19:00:00+02:00"
```

`source` is `external_change` when an outside adjustment created the session
and `explicit` when the panel or `velair.enter_manual_adjustment` captured the
live climate state. `duration_minutes` is present only for `for_duration`.

An `until_resumed` entry omits `until`. The automatic exit payload contains
`reason: expired`; an explicit exit contains `reason: resumed`. Exiting Manual
adjustment does not remove any independent pause reason that may still block
physical schedule delivery.

The equivalent service actions are:

```yaml
action: velair.set_external_change_policy
data:
  entity_id: climate.living_room
  policy: for_duration
  duration_minutes: 60
```

```yaml
action: velair.resume_automatic_control
data:
  entity_id: climate.living_room
```

## Diagnostic Issue Changed

`diagnostic_issue_changed` is emitted when a verifiable diagnostic issue is
detected or resolved. Velair establishes the issues present at startup as a
baseline, so restarting Home Assistant does not emit a burst of already-active
issues. Unchanged issues are deduplicated.

The issue identity consists of `code`, an optional managed climate
`entity_id`, and an optional sensor `purpose`. The payload contains no raw
exception message, Profile/Mode/pause identifier, or inferred cause. `change`
is `detected` or `resolved`; `severity` is `warning` or `error`.

```yaml
domain: velair
event: diagnostic_issue_changed
change: detected
severity: error
code: delivery_exhausted
entity_id: climate.living_room
```

For example, notify whenever Velair detects a new error:

```yaml
alias: Notify about new Velair errors
triggers:
  - trigger: event
    event_type: velair_event
    event_data:
      event: diagnostic_issue_changed
      change: detected
      severity: error
actions:
  - action: notify.notify
    data:
      message: "Velair detected an error. Open Diagnostics for details."
```

For aggregate health, use the **Diagnostics status** sensor instead. Its entity
ID can be changed in Home Assistant, so select it from the automation editor:

```yaml
triggers:
  - trigger: state
    entity_id: sensor.velair_diagnostics_status
    to: "error"
```

## Profile Changed

`profile_changed` is emitted after a different set of climate profiles, or
Default schedules, has been persisted. Directly selecting the same active set
can move the native Mode entity to Manual, but emits no `profile_changed` event
because the effective profiles did not change.

```yaml
domain: velair
event: profile_changed
profile_ids:
  - away
  - bedrooms
previous_profile_ids: []
source: select
```

`source` identifies where the effective selection originated. Public values are
`panel`, `service`, and `select`; internal lifecycle operations may publish a
more specific value such as `profile_deleted` or `mode_updated`.
The ordered ID lists describe the complete new and previous active sets. An
empty `profile_ids` list represents Default.

For example, this automation reacts when the Profile with ID `away` becomes
part of the active set:

```yaml
alias: Notify when Away profile becomes active
triggers:
  - trigger: event
    event_type: velair_event
    event_data:
      event: profile_changed
conditions:
  - condition: template
    value_template: "{{ 'away' in trigger.event.data.profile_ids }}"
actions:
  - action: notify.notify
    data:
      message: Away profile is active
```

To react when Velair returns to Default schedules, use a template condition that
checks `trigger.event.data.profile_ids == []`.

## Scheduler Mode Changed

`scheduler_mode_changed` is emitted when the global mode or pause expiry changes,
including automatic expiry. Repeating the same mode and expiry does not emit it.

```yaml
domain: velair
event: scheduler_mode_changed
mode: paused
previous_mode: auto
paused_until: "2026-07-09T18:30:00+02:00"
paused_started_at: "2026-07-09T17:00:00+02:00"
```

## Climate Target Applied

`climate_target_applied` is emitted after Velair applies a scheduled target,
turn-off action, restored schedule, startup schedule, or `velair.set_temperature`.
Unsupported optional settings are omitted.

```yaml
domain: velair
event: climate_target_applied
entity_id: climate.bedroom
action: set_temperature
temperature: 23
hvac_mode: cool
fan_mode: low
preset_mode: sleep
swing_mode: off
swing_horizontal_mode: center
humidity: 50
weekday: thursday
start: "22:30"
target_when: "2026-07-09T22:30:00+02:00"
source: scheduled_event
```

Common `source` values are `scheduled_event`, `current_schedule`,
`schedule_saved`, `scheduler_resumed`, `startup`, `service_set_temperature`,
`boost_ended`, `zone_paused`, `zone_resumed`, `zone_pause_expired`, and
`zone_limits_updated`.

For a range target, `temperature` is omitted and the event contains both limits:

```yaml
target_temp_low: 20
target_temp_high: 24
hvac_mode: heat_cool
```

When the zone's [temperature limits](usage.md#zone-temperature-limits) changed
the delivered value, the payload reports the applied target as usual and adds
`limited_by: zone_limits` plus the requested value. A scalar target adds
`requested_temperature`; a range adds `requested_target_temp_low` and/or
`requested_target_temp_high` for each end that was clamped. These keys are
absent when nothing was limited.

```yaml
temperature: 21
limited_by: zone_limits
requested_temperature: 19
```
## Delivery Outcome

`delivery_outcome` is emitted only for climates where **Confirm delivery** is
enabled in Settings. After Home Assistant accepts a Velair call sequence,
Velair watches the climate entity's own state until it reports the requested
HVAC mode and target, or the confirmation timeout expires. `outcome` is
`confirmed` when the entity converged, or `unconfirmed` when every configured
attempt timed out. `attempts` counts how many times the current intent was
sent, including the first delivery. `requested` describes the target that was
actually sent; `observed` is the entity's reported state when the outcome was
decided. See [Confirming delivery](resilient-climate-delivery.md#confirming-delivery).

```yaml
domain: velair
event: delivery_outcome
entity_id: climate.bedroom
outcome: unconfirmed
attempts: 3
source: scheduled_event
requested:
  hvac_mode: cool
  temperature: 24
observed:
  hvac_mode: cool
  temperature: 26
```

For a range target, `requested` and `observed` contain `target_temp_low` and
`target_temp_high` instead of `temperature`; a turn-off delivery requests
`hvac_mode: "off"` without a temperature. A `requested.hvac_mode` of `null`
means the block kept the current mode, so any non-off mode was acceptable.
This event does not change the meaning of `climate_target_applied`, which is
still emitted when the call sequence is accepted.

## Preconditioning Plan Updated

`preconditioning_plan_updated` is emitted when a new early-start plan is
published or any of its calculation inputs or results change. Identical
recalculations are deduplicated. Planning during startup can emit this event;
calculating data only for a panel response does not.

```yaml
domain: velair
event: preconditioning_plan_updated
entity_id: climate.living_room
scheduled_when: "2026-01-15T07:00:00+01:00"
preconditioning_when: "2026-01-15T05:35:00+01:00"
lead_minutes: 85
direction: heat
target_kind: scalar
target_boundary: temperature
boundary_temperature: 21
target_temperature: 21
current_temperature: 17.8
temperature_delta: 3.2
hvac_mode: heat
preset_mode: comfort
model_source: history
complete_sample_count: 12
partial_sample_count: 3
invalid_sample_count: 1
similar_sample_count: 8
comfort_percentile: 90
used_outdoor_temperature: true
outdoor_temperature: -1.5
weekday: thursday
start: "07:00"
preconditioning_diagnostics:
  direction: heat
  target_kind: scalar
  target_boundary: temperature
  boundary_temperature: 21
  current_temperature: 17.8
  delta_temperature: 3.2
  complete_sample_count: 12
  partial_sample_count: 3
  invalid_sample_count: 1
  similar_sample_count: 8
  comfort_percentile: 90
  complete_rate_minutes_per_degree: 23.4
  complete_estimate_minutes: 74.88
  partial_floor_minutes: 82
  combined_estimate_minutes: 82
  rounded_estimate_minutes: 85
  final_lead_minutes: 85
  limited_by_min_start: false
  limited_by_max_lead: false
  source: history
  used_outdoor_temperature: true
  initial_model_lead_minutes: 110
```

For a native range plan, `target_temperature` is `null` and the payload includes
the complete `target_temp_low` and `target_temp_high` pair. `target_kind` is
`range`, `target_boundary` is `low` or `high`, and `boundary_temperature` is the
single effective boundary used by the predictor. `temperature_delta` is measured
against that boundary. Scalar plans keep `target_kind: scalar` and
`target_boundary: temperature`.

For example, a heating prediction for a `20–24 °C` range includes:

```yaml
direction: heat
target_kind: range
target_boundary: low
boundary_temperature: 20
target_temperature: null
target_temp_low: 20
target_temp_high: 24
current_temperature: 18
temperature_delta: 2
hvac_mode: heat_cool
```

## Preconditioning Plan Cancelled

`preconditioning_plan_cancelled` is emitted once when a previously published
plan no longer exists, for example after a schedule edit, a smaller temperature
gap, disabling preconditioning, or leaving automatic mode. It repeats the last
published plan so an automation can identify what was cancelled.

```yaml
domain: velair
event: preconditioning_plan_cancelled
entity_id: climate.living_room
scheduled_when: "2026-01-15T07:00:00+01:00"
preconditioning_when: "2026-01-15T05:35:00+01:00"
lead_minutes: 85
direction: heat
target_kind: scalar
target_boundary: temperature
boundary_temperature: 21
target_temperature: 21
current_temperature: 17.8
temperature_delta: 3.2
hvac_mode: heat
preset_mode: comfort
model_source: history
complete_sample_count: 12
partial_sample_count: 3
invalid_sample_count: 1
similar_sample_count: 8
comfort_percentile: 90
used_outdoor_temperature: true
outdoor_temperature: -1.5
weekday: thursday
start: "07:00"
preconditioning_diagnostics:
  direction: heat
  target_kind: scalar
  target_boundary: temperature
  boundary_temperature: 21
  current_temperature: 17.8
  delta_temperature: 3.2
  complete_sample_count: 12
  partial_sample_count: 3
  invalid_sample_count: 1
  similar_sample_count: 8
  comfort_percentile: 90
  complete_rate_minutes_per_degree: 23.4
  complete_estimate_minutes: 74.88
  partial_floor_minutes: 82
  combined_estimate_minutes: 82
  rounded_estimate_minutes: 85
  final_lead_minutes: 85
  limited_by_min_start: false
  limited_by_max_lead: false
  source: history
  used_outdoor_temperature: true
  initial_model_lead_minutes: 110
reason: no_longer_planned
```

`reason` is `no_longer_planned` when recalculation removes one plan and
`scheduler_not_auto` when pausing or stopping automatic scheduling.

## Preconditioning Observation Recorded

`preconditioning_observation_recorded` is emitted after a learning observation
has been validated, trimmed to the configured history size, and persisted.
`quality` can be `complete`, `partial`, or `invalid`.

```yaml
domain: velair
event: preconditioning_observation_recorded
entity_id: climate.living_room
direction: heat
created_at: "2026-01-15T06:52:00+01:00"
scheduled_time: "2026-01-15T07:00:00+01:00"
start_time: "2026-01-15T05:35:00+01:00"
target_temp: 21
initial_temp: 17.8
observed_temp: 20.8
outdoor_temp_start: -2.1
outdoor_temp_target: -1.5
temperature_source: room_sensor
room_temperature_entity_id: sensor.living_room_temperature
delta_t: 3.2
startup_minutes: 85
reached: true
minutes_to_reach: 77
quality: complete
stored_sample_count: 16
```

An invalid observation also includes `invalid_reason`.

## Comfort Assessment Changed

`comfort_assessment_changed` is emitted when `condition`, `air_quality`,
`data_quality`, or `data_issues` changes. Numeric movement inside the same
assessment still refreshes the Velair UI but does not flood the event bus.

```yaml
domain: velair
event: comfort_assessment_changed
entity_id: climate.office
condition: hot_and_humid
air_quality: elevated
data_quality: complete
data_issues: []
temperature:
  metric: temperature
  availability: current
  condition: hot
  source: sensor
  entity_id: sensor.office_temperature
  value: 27.1
  min: 20
  max: 24
humidity:
  metric: humidity
  availability: current
  condition: humid
  source: sensor
  entity_id: sensor.office_humidity
  value: 67
  min: 40
  max: 60
co2:
  metric: co2
  availability: current
  condition: elevated
  source: sensor
  entity_id: sensor.office_co2
  value: 1180
  attention: 1000
  max: 1500
```

## Room Sensor Assist State Changed

`room_sensor_assist_state_changed` is emitted when Room Assist is enabled or
disabled through the panel, Lovelace card, API, or service. Repeating the same
state does not emit it.

```yaml
domain: velair
event: room_sensor_assist_state_changed
entity_id: climate.living_room
enabled: true
previous_enabled: false
room_temperature_entity_id: sensor.living_room_temperature
deadband: 0.3
max_delta: 3
debounce_seconds: 20
```

## Room Sensor Assist Updated

`room_sensor_assist_updated` is emitted only after Room Assist sends a changed
temporary target to the climate. Movements smaller than the climate target step
do not emit it.

```yaml
domain: velair
event: room_sensor_assist_updated
entity_id: climate.living_room
room_temperature_entity_id: sensor.living_room_temperature
target_temperature: 21
applied_temperature: 23.5
room_temperature: 18
climate_temperature: 20.5
assist_delta: 3
applied_offset: 3
direction: heat
hvac_mode: heat
hysteresis_phase: towards_upper
hysteresis_target: 21.3
deadband_low: 20.7
deadband_high: 21.3
reason: scheduled_event
```

For a fixed scalar `heat` or `cool` target with a non-zero deadband, the four
hysteresis fields identify the committed runtime phase, its active edge, and
the complete switching band. They are omitted for a zero deadband, scalar
automatic modes, and native ranges. The phase remains unchanged while the room
crosses the scheduled center and reverses only after the external sensor
reaches the opposite edge.

When the scheduled target protects a fixed heating or cooling result, the
scalar update adds two optional fields:

```yaml
target_temperature: 22
calculated_temperature: 20
applied_temperature: 22
scheduled_target_guard: cooling_floor
direction: cool
```

`calculated_temperature` is the supported target before scheduled protection.
Existing event automations remain compatible because the fields are additive
and omitted when the protection is not active.

For a native range, scalar target fields are omitted and both complete bands
are reported:

```yaml
target_temp_low: 19
target_temp_high: 24
applied_target_temp_low: 23
applied_target_temp_high: 28
room_temperature: 18
climate_temperature: 22
assist_delta: 1
range_shift: 4
direction: heat
hvac_mode: heat_cool
```

## Room Sensor Assist Restored

`room_sensor_assist_restored` is emitted when Room Assist stops managing its
temporary target and restores the normal scheduled target where possible. For
a fixed heating or cooling cycle, reaching the active deadband edge remains
part of `room_sensor_assist_updated`; it reverses the hysteresis phase and can
change the signed `applied_offset`. The scheduled target remains the safety
boundary during the non-driving phase even if the climate entity's own reading
drifts. If target-step rounding makes a new thermostat command unnecessary,
the phase still changes in live status but no update event is emitted, as
described above. `reason` explains an emitted transition.

```yaml
domain: velair
event: room_sensor_assist_restored
entity_id: climate.living_room
room_temperature_entity_id: sensor.living_room_temperature
target_temperature: 21
applied_temperature: 21
room_temperature: 21.1
climate_temperature: 20.5
assist_delta: 0
applied_offset: 0
direction: heat
hvac_mode: heat
reason: assist_disabled
```

Other reasons include `assist_disabled`, `boost_started`, `manual_target`,
`missing_temperature`, `no_active_target`, `not_auto`, `schedule_changed`,
`schedule_cleared`, `scheduler_mode_changed`, `scheduler_stopped`,
`settings_updated`, `turn_off`, `unsupported_mode`, `zone_paused`, and
`zone_unavailable`. `unsupported_temperature_range` remains possible for a
legacy scalar target that cannot be applied while the effective climate mode
requires a native range; valid range blocks are supported.

## Humidity Assist State Changed

`humidity_assist_state_changed` is emitted whenever a zone's Humidity Assist
state machine enters a different state, or when a transition decision such as
`start`, `rest_low`, `rest_max`, `rest_budget`, or `rest_align` is applied.
Repeating the same state without a transition does not emit it. `decision`
names the ladder branch that produced the new state; `raw` and `median` are the
readings in the zone's unit (dew point in the climate unit or relative humidity
in percent) and `next_transition_at` is the next timer boundary Velair will
evaluate, or `null` when no timer is armed. See
[Humidity Assist](humidity-assist.md) for the complete decision ladder.

```yaml
domain: velair
event: humidity_assist_state_changed
entity_id: climate.guest_room
previous_state: waiting
state: pulsing
decision: start
target: 22
raw: 22.6
median: 22.4
next_transition_at: "2026-08-10T15:10:00+00:00"
```

## House Mode Changed

`house_mode_changed` is emitted whenever the whole-home mode reported by
`sensor.velair_house_mode` changes, or when sleep turns on or off while another
mode (travel, away) is reported as the state. `previous` and `state` are one
of `home`, `away`, `away_deep`, `travel`, `sleep`, or `disabled`; `sleeping`
tells whether the sleep entity is on regardless of the reported state.
`reason` names what triggered the evaluation (`start`, `state`, `timer`,
`settings`, `config`, or `rerun`). Repeating the same state does not emit it.
See [House Modes](house-modes.md).

```yaml
domain: velair
event: house_mode_changed
previous: home
state: away
sleeping: false
reason: timer
empty_since: "2026-08-10T14:00:00+00:00"
travel_since: null
sleep_since: null
```

## House Zone Parked

`house_zone_parked` is emitted for each zone that House Modes parks or freezes
while travel is on. `pause_id` is `travel_park` (a raise-only hold at the park
temperature) or `travel_off` (an indefinite freeze of a head a person turned
off); `action` mirrors the hold action and `temperature` is `null` for a
freeze. `reason` is `travel_started`, `travel_recheck`, or `head_turned_off`.

```yaml
domain: velair
event: house_zone_parked
entity_id: climate.guest_room
pause_id: travel_park
action: hold
temperature: 29
reason: travel_started
## Guards

The [Guards](guards.md) emit five events. All are zone events with
`entity_id`; none is emitted while the Guards master switch is off.

### Never Off Grace Started

`never_off_grace_started` is emitted when a managed climate is found `off`
outside Velair's own intent (a person turned it off, or it was off when Velair
started) and the never-off grace begins. `previous_target` and
`previous_hvac_mode` are the values the head had before the turn-off when they
are known; `snooze_minutes` is the default duration a `velair.snooze_off`
action would use, so a notification can offer it. Re-evaluating an unchanged
grace does not emit it again.

```yaml
domain: velair
event: never_off_grace_started
entity_id: climate.guest_room
grace_started_at: "2026-09-04T21:00:00+02:00"
grace_ends_at: "2026-09-04T21:10:00+02:00"
grace_minutes: 10
previous_target: 24
previous_hvac_mode: cool
snooze_minutes: 1440
```

### Never Off Recovered

`never_off_recovered` is emitted when the grace ends with the head still off
and Velair holds `neveroff_recover` raise-only, then resumes automatic control.
`temperature` is the hold target (the warmest of the previous target, the
zone's last setback stage and its minimum temperature); it is `null` when no
usable value existed and Velair only resumed automatic control.

```yaml
domain: velair
event: never_off_recovered
entity_id: climate.guest_room
temperature: 26
hvac_mode: cool
constraint: raise_only
pause_id: neveroff_recover
previous_target: 24
recovered_at: "2026-09-04T21:10:00+02:00"
```

### Never Off Snoozed

`never_off_snoozed` is emitted when `velair.snooze_off` freezes a zone with the
`neveroff_snooze` pause. `source` is `service`.

```yaml
domain: velair
event: never_off_snoozed
entity_id: climate.guest_room
snooze_until: "2026-09-05T21:03:00+02:00"
duration_minutes: 1440
source: service
```

### Manual Hold Released

`manual_hold_released` is emitted when a Guards rule ends a Manual adjustment
through `resume_automatic_control`. `reason` is `vacant`, `travel` or
`below_minimum`; `age_minutes` is the age of the adjustment when it was
released and is always at least the lease. `action` is `release`, or
`floor_hold` when the zone's `manual_release_below_minimum_action` placed the
`floor` hold instead (the payload then adds `floor_temperature`). A matching
`zone_control_changed` event with `reason: resumed` follows.

```yaml
domain: velair
event: manual_hold_released
entity_id: climate.guest_room
reason: vacant
action: release
manual_since: "2026-09-04T19:00:00+02:00"
age_minutes: 62.5
released_at: "2026-09-04T20:02:30+02:00"
```

### Activity Hold Changed

`activity_hold_changed` is emitted when an activity entity turning `on` engages
a hold (`active: true`) and when the entity has been `off` for the release
delay and the hold is released (`active: false`). `resumed_automatic` is
`true` only when the release also ended a Manual adjustment older than the
lease.

```yaml
domain: velair
event: activity_hold_changed
entity_id: climate.kitchen
activity_entity_id: input_boolean.cooking
pause_id: activity
active: false
temperature: 25
constraint: lower_only
resumed_automatic: true
## Occupancy Assist State Changed

`occupancy_assist_state_changed` is emitted whenever a zone's Occupancy Assist
state machine enters a different state or stage: `disabled`, `unavailable`,
`occupied`, `arriving_1`, `comfort`, `vacant`, `setback_1`, `setback_2`,
`setback_3`, or `blocked`. Repeating the same state does not emit it.
`previous` is the state that was left, `stage` the stage number inside the
new state (setback 1–3, arrival 1) or `null`, `temperature` the hold target
that state writes in the climate unit (or `null` when the state releases to
the schedule or writes nothing), and `reason` the branch that produced it:
`source_unavailable`, `occupied`, `awaiting_corroboration`, `arrival_stage`,
`arrival_complete`, `exit_grace`, `vacant`, `setback_stage`,
`blocking_entity`, or `disabled`. See [Occupancy Assist](occupancy-assist.md)
for the complete state machine.

```yaml
domain: velair
event: occupancy_assist_state_changed
entity_id: climate.guest_room
previous: vacant
state: setback_1
stage: 1
temperature: 23
reason: setback_stage
```

## Boost Started

`boost_started` is emitted after a boost target and override have been applied
and persisted. Replacing an active boost emits another `boost_started`.

Range boosts use `target_temp_low` and `target_temp_high` instead of
`temperature`. Their restoration payload preserves the same target form.

```yaml
domain: velair
event: boost_started
entity_id: climate.bedroom
temperature: 22
hvac_mode: cool
fan_mode: high
preset_mode: comfort
swing_mode: vertical
swing_horizontal_mode: wide
humidity: 48
started_at: "2026-07-09T14:00:00+02:00"
until: "2026-07-09T15:30:00+02:00"
```

## Boost Ended

`boost_ended` is emitted when a boost expires or is cancelled. `reason` is
`expired` or `manual`. `restoration` describes the state Velair then applies.

```yaml
domain: velair
event: boost_ended
entity_id: climate.bedroom
temperature: 22
hvac_mode: cool
fan_mode: high
preset_mode: comfort
swing_mode: vertical
swing_horizontal_mode: wide
humidity: 48
started_at: "2026-07-09T14:00:00+02:00"
until: "2026-07-09T15:30:00+02:00"
reason: manual
restoration:
  type: schedule
  source: boost_ended
  target:
    action: set_temperature
    temperature: 24
    hvac_mode: cool
    fan_mode: low
    preset_mode: sleep
    swing_mode: off
    swing_horizontal_mode: center
    humidity: 50
    weekday: thursday
    start: "15:00"
```

`restoration.type` can be `schedule`, `previous_state`, or `none`. A scheduled
restoration also emits `climate_target_applied` with `source: boost_ended`.

## Zone Paused

`zone_paused` is emitted when a managed zone changes from zero reasons to one.
If `action` is
`turn_off`, `climate_target_applied` is emitted first for that turn-off.

```yaml
domain: velair
event: zone_paused
entity_id: climate.guest_room
started_at: "2026-07-09T12:00:00+02:00"
until: "2026-07-12T18:00:00+02:00"
action: turn_off
pause_id: velair_window_guard
```

`zone_pause_added`, `zone_pause_updated`, and `zone_pause_removed` describe
individual reason changes and include `pause_id` when identified. An exact
identified replay emits no event. Legacy and manual reasons omit the ID.
Reasons with `action: hold` also carry `temperature` (or `target_temp_low` and
`target_temp_high`), `constraint`, and, when set, `hvac_mode`, `fan_mode`, and
`label`; `zone_paused` and `zone_resumed` mirror the latest hold's fields.

```yaml
domain: velair
event: zone_pause_added
entity_id: climate.guest_room
started_at: "2026-07-09T12:00:00+02:00"
until: null
action: turn_off
pause_id: velair_window_guard
```

```yaml
domain: velair
event: zone_pause_updated
entity_id: climate.guest_room
started_at: "2026-07-09T12:00:00+02:00"
until: null
action: hold
pause_id: vacancy
temperature: 26.0
constraint: raise_only
hvac_mode: cool
fan_mode: auto
label: vacant 30 min
```

```yaml
domain: velair
event: zone_pause_removed
entity_id: climate.guest_room
started_at: "2026-07-09T12:00:00+02:00"
until: "2026-07-09T18:00:00+02:00"
action: turn_off
pause_id: velair_window_guard
reason: expired
```

## Zone Resumed

`zone_resumed` is emitted only when the final reason is removed manually or
expires.
When the current schedule is reapplied, a later `climate_target_applied` event
describes that target.

```yaml
domain: velair
event: zone_resumed
entity_id: climate.guest_room
started_at: "2026-07-09T12:00:00+02:00"
until: "2026-07-12T18:00:00+02:00"
action: turn_off
pause_id: velair_window_guard
reason: expired
```

## Operations Without Runtime Events

Creating templates, changing panel preferences, importing data, and resetting
settings update configuration but do not emit runtime automation events.
Schedule edits do not have a dedicated configuration event, although they can
produce plan cancellation/update events or `climate_target_applied` when they
change the currently active target.

## Delivery Meaning

An applied event is emitted only after Home Assistant accepts the complete
mode, target, and supported-option call sequence for the current Velair
intention. Failed or superseded attempts do not emit it. The event confirms
command acceptance, not that the physical equipment has already reached the
requested temperature or HVAC state. Climates with optional delivery
confirmation additionally emit `delivery_outcome` once the entity's reported
state has, or has not, converged.
