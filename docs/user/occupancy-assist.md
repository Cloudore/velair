# Occupancy Assist

Occupancy Assist lets an empty room drift warmer in stages and cools it back
in stages when someone actually walks in. It is the per-room half of the
"home" behaviour: give each managed climate an occupancy entity, a ladder of
setback stages, an arrival ladder, and a comfort temperature, and Velair does
the rest with its own holds. No Home Assistant automation, helper, or template
is required.

Doctrine it implements:

- **An empty room only gets warmer.** Setbacks are `raise_only` holds; they
  never cool a room and a later stage never lowers an earlier one.
- **Arrival cools in stages, only where someone entered.** Stage 1 is a
  `lower_only` hold; the final stage releases every away-style hold and
  returns the zone to its schedule.
- **Uncertain occupancy holds the current state.** An `unknown` or
  `unavailable` occupancy entity never triggers a stage and never releases
  one.
- **A hand-set value is protected.** While a zone is in Manual adjustment no
  stage is applied or released; the state keeps counting and applies the
  current stage once the adjustment ends.
- **One writer.** Every write is a Velair hold (`velair.pause_zone` semantics)
  delivered through the normal pipeline. Occupancy Assist never calls
  `climate.*` services.

Occupancy Assist is event-driven: it listens to the occupancy, blocking, and
corroboration entities, to Velair's own zone control changes, and arms one
timer per zone for the next stage boundary. Clocks are measured from the
occupancy entity's `last_changed`, so a Home Assistant restart does not reset
them.

## Setup

1. Choose (or create) an occupancy entity per room: a `binary_sensor` with
   device class occupancy, presence, or motion, or any entity whose state is
   `on` while the room is occupied and `off` otherwise.
2. Call `velair.set_occupancy_assist` (or use the WebSocket command or the
   generated number/switch entities) to set `occupancy_entity_id`, the stage
   ladders, and the comfort temperature.
3. Turn on `switch.velair_<zone>_occupancy_assist`.

The comfort temperature doubles as the room's dial: while
`sync_comfort_to_schedule` is on (the default) every change rewrites the
zone's default weekly schedule as one block at `00:00` with the comfort
temperature and the setback HVAC/fan modes ("Dial Sync"). Turn the sync off to
keep a hand-authored schedule.

## Per-Zone Settings

| Setting | Default | Meaning |
| --- | --- | --- |
| `enabled` | `false` | Master switch (`switch.velair_<zone>_occupancy_assist`). Disabling releases the setback and comfort holds. |
| `occupancy_entity_id` | none | Entity whose state `on` means occupied. |
| `blocking_entity_ids` | `[]` | While any is `on`, no setback stage is applied; stages already applied stay. |
| `corroboration_entity_ids` | `[]` | When non-empty, arrival requires the occupancy entity **and** at least one of these to be `on`. |
| `setback_stages` | `10 min → 23`, `30 min → 25`, `90 min → 26` | Up to three stages with ascending minutes. Temperatures are in the climate unit. An explicit empty list disables setbacks. |
| `setback_hvac_mode` | `cool` | HVAC mode written with each setback hold and the comfort schedule (`null` keeps the current mode). |
| `setback_fan_mode` | `auto` | Fan mode written with each setback hold and the comfort schedule (dropped when the climate does not support it). |
| `arrival_stages` | `5 min → 26`, `10 min → release` | One or two stages with ascending minutes. A stage with a temperature holds it lower-only; the last stage always releases to the schedule. |
| `arrival_exit_grace_minutes` | `2` | Leaving for less than this does not cancel an arrival stage. |
| `comfort_temperature` | `26` | The room's comfort dial, written as the default weekly schedule while sync is on. |
| `sync_comfort_to_schedule` | `true` | Dial Sync on/off. |

All temperatures must lie inside the climate's supported target range; the
service and WebSocket command reject values outside it, as they reject
non-ascending stage minutes.

## The State Machine

Velair evaluates every enabled zone on start, whenever an input entity
changes, whenever Velair's own zone control changes (Manual adjustment,
pause, Boost, Profile, scheduler mode), whenever a setting is saved, and when
a stage timer fires. Each evaluation derives:

- `occupied_since` / `vacant_since`: the occupancy entity's `last_changed`.
- `arrival_since`: `occupied_since`, or, with corroboration entities, the
  later of `occupied_since` and the moment the earliest corroborating entity
  turned `on`.
- the stage that is due by time, and the holds Velair currently owns on the
  zone (`velair_occupancy_setback` and `comfort`).

Then it walks these rules and applies the first matching one:

| Order | Condition | State | Action |
| --- | --- | --- | --- |
| 1 | Zone or Occupancy Assist disabled, or no occupancy entity | `disabled` | Release both owned holds once. |
| 2 | Occupancy entity `unknown`/`unavailable`/missing | `unavailable` | Nothing is applied or released. |
| 3 | Occupancy `on`, corroboration required but absent | `occupied` | Wait (attribute `reason: awaiting_corroboration`). |
| 4 | Occupancy `on` for less than the first arrival stage | `occupied` | Wait for `next_stage_at`. |
| 5 | Occupancy `on` for at least a stage with a temperature | `arriving_1` | Hold `comfort`, `lower_only`, at that temperature. The setback hold stays; the later lower-only hold wins the fold. |
| 6 | Occupancy `on` for at least the final stage | `comfort` | Release `velair_occupancy_setback`, `away_1h`, `away_6h`, `neveroff_recover`, `presleep`, then `comfort` (once per arrival). |
| 7 | Occupancy `off` while the `comfort` hold exists, for less than the exit grace | `arriving_1` | Keep everything. |
| 8 | Occupancy `off` past the exit grace with the `comfort` hold present | (continues below) | Release `comfort`; the standing setback returns. |
| 9 | Occupancy `off` and a blocking entity is `on` | `blocked` | No new stage; existing stages stay (`blocked_by: <entity_id>`). |
| 10 | Occupancy `off` for less than the first setback stage | `vacant` | Wait for `next_stage_at`. |
| 11 | Occupancy `off` for at least stage *n* | `setback_n` | Hold `velair_occupancy_setback`, `raise_only`, at the larger of the stage temperature and the temperature already held (a stage never lowers), with the setback HVAC and fan modes and label `setback stage n`. Replacing the same hold updates it in place. |

Manual adjustment (the zone's override sensor reports `manual`), a pause with
action `none` or `turn_off`, a Boost, a Profile pause, external execution, or
the scheduler not being in automatic mode block every write and release; the
state keeps counting and the sensor reports `blocked_by: manual` (or `pause`,
`boost`, `profile`, `external_execution`, `scheduler_paused`). Guards own the
release of Manual adjustment.

## Restart Continuity

Stage clocks come from the occupancy entity's `last_changed`, so a zone that
was empty for 40 minutes before a restart is at stage 2 immediately after it.
The last state, stage, and whether the arrival release already happened are
persisted with Velair's data (`occupancy_assist_runtime`) so a restart neither
repeats the arrival release nor emits a spurious state change.

## Entities

For a climate named "Guest room" Velair creates:

| Entity | Meaning |
| --- | --- |
| `sensor.velair_guest_room_occupancy_assist` | State enum (`disabled`, `unavailable`, `occupied`, `arriving_1`, `comfort`, `vacant`, `setback_1`, `setback_2`, `setback_3`, `blocked`) with attributes `occupancy_entity_id`, `occupied_since`, `vacant_since`, `stage`, `next_stage_at`, `next_temperature`, `blocked_by`, `last_action`, `last_action_at`, `reason`, and `hold_temperature`. |
| `switch.velair_guest_room_occupancy_assist` | Enables the zone. |
| `number.velair_guest_room_setback_1_minutes`, `..._setback_2_minutes`, `..._setback_3_minutes` | Minutes of vacancy before each setback stage. |
| `number.velair_guest_room_setback_1_temperature`, `..._setback_2_temperature`, `..._setback_3_temperature` | Temperature of each setback stage, in the climate unit. |
| `number.velair_guest_room_arrival_1_minutes`, `..._arrival_2_minutes` | Minutes of occupancy before each arrival stage. |
| `number.velair_guest_room_arrival_1_temperature` | Temperature of the first arrival stage. |
| `number.velair_guest_room_comfort_temperature` | The comfort dial (Dial Sync). |

A number for a stage that does not exist yet reads as unknown; setting it
creates the missing earlier stages from the defaults.

## Service

### `velair.set_occupancy_assist`

Update any per-zone field. Only the provided fields change.

```yaml
action: velair.set_occupancy_assist
data:
  entity_id: climate.guest_room
  enabled: true
  occupancy_entity_id: binary_sensor.guest_room_occupied_for_climate
  blocking_entity_ids:
    - input_boolean.guest_mode
  corroboration_entity_ids:
    - binary_sensor.guest_room_phone_present
  setback_stages:
    - after_minutes: 10
      temperature: 23
    - after_minutes: 30
      temperature: 25
    - after_minutes: 90
      temperature: 26
  setback_hvac_mode: cool
  setback_fan_mode: auto
  arrival_stages:
    - after_minutes: 5
      temperature: 26
    - after_minutes: 10
      temperature: null
  arrival_exit_grace_minutes: 2
  comfort_temperature: 24
  sync_comfort_to_schedule: true
```

## WebSocket

`velair/update_zone_occupancy_assist` takes `entity_id` and an
`occupancy_assist` object with the same keys as the service and returns the
full schedule response. Each zone in that response carries its
`occupancy_assist` settings and the response's `occupancy_assist` key maps
each managed climate to its runtime status (the sensor's state and
attributes).

## Automation Event

`occupancy_assist_state_changed` is documented with its payload in
[Automation Events](automation-events.md#occupancy-assist-state-changed).

## Pause Ids and Other Modules

Occupancy Assist owns two pause ids: `velair_occupancy_setback` (raise-only)
and `comfort` (lower-only). The arrival final stage also releases `away_1h`,
`away_6h`, `neveroff_recover`, and `presleep`, which House Modes and Guards
own, so a room someone entered returns to comfort even while the house is
"away". Holds fold in start order, which is why the later lower-only
`comfort` hold wins over a standing raise-only setback without removing it.

## Temperature Units

Stage and comfort temperatures are stored in the climate unit and converted
with the other absolute temperatures when the Home Assistant unit system
changes or a portable export is imported into a different unit.

## Limitations

- Occupancy Assist trusts the occupancy entity. Debounce flapping sensors
  upstream; every `on`/`off` transition restarts the corresponding clock.
- A blocking entity only prevents new setback stages; it does not release one
  that is already applied.
- Never-off recovery, house-wide away/travel/sleep holds, and Manual
  adjustment release belong to the Guards and House Modes modules.
