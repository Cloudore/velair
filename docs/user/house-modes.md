# House Modes

House Modes turns whole-home presence, sleep, and travel signals into Velair
holds. When everyone has left, rooms are warmed in stages; when the sleep
switch turns on, bedrooms get their night targets; before bedtime an optional
pre-sleep hold cools the rooms you are about to use; and while you travel every
head is parked warm, hand-turned-off heads stay off, and Humidity Assist keeps
the house dry.

Everything is written through Velair's hold API, so House Modes never fights
the schedule, Manual adjustment, Boost, or the other assist modules. It never
calls a `climate.*` service. The only non-climate call it can make is
`homeassistant.turn_off` on the travel entity you configured, and only when
**Travel auto-exit on arrival** is on.

House Modes is local and event-driven: it listens to the presence, corroboration,
sleep, and travel entities and arms one timer for the next boundary (away stage,
arrival release, corroboration quiet window, pre-sleep time, or travel
re-check). It does not poll.

## Doctrine

- A hand-set value is protected. Zones in a fresh Manual adjustment are skipped,
  and a head you turned off before or during travel stays off until a person
  turns it on.
- An empty house only gets warmer: away and travel holds are `raise_only`.
- Uncertain occupancy holds the current state. A presence, corroboration,
  sleep, or travel entity that is `unknown` or `unavailable` never makes the
  house empty or asleep, never applies a stage, and never releases a hold.
- One writer. Every action is a Velair hold or pause with a fixed `pause_id`
  (see [Pause ids](#pause-ids)), delivered and verified by the normal delivery
  pipeline.

## Global Settings

Stored under `settings.house_modes`, edited in the Presence tab, through
`velair/update_settings`, or through the generated entities.

| Setting | Default | Meaning |
| --- | --- | --- |
| `enabled` | `false` | Master switch (`switch.velair_house_modes`). Turning it off releases every House Modes hold and restores swapped minimums. |
| `presence_entity_ids` | `[]` | `person` or `device_tracker` entities. The house is empty only when **all** of them are `not_home`. Any `unknown`/`unavailable` entity means "not empty". |
| `presence_corroboration_entity_ids` | `[]` | Optional "someone is physically here" sensors (BLE room presence, motion). When set, empty additionally requires all of them `off` for the quiet window. An `on` or unavailable sensor means "not empty". |
| `presence_corroboration_quiet_minutes` | `15` | Quiet window for the corroboration sensors. |
| `away_after_minutes` | `60` | Away stage 1 delay, measured from the moment the last person left (the entity's `last_changed`, so a restart does not reset it). |
| `away_deep_after_minutes` | `360` | Away stage 2 delay. `0` disables stage 2. |
| `arrival_release_minutes` | `3` | Any presence entity `home` this long releases both away holds on every zone. |
| `sleep_entity_id` | none | `input_boolean` or `binary_sensor`; `on` means asleep. |
| `presleep_time` | `21:00` | Wall time of the pre-sleep hold, `null` disables it. |
| `presleep_duration_minutes` | `240` | Length of the pre-sleep hold. |
| `travel_entity_id` | none | `on` means travel mode. |
| `travel_park_temperature` | `29` | Raise-only park target while travelling and the house is empty. |
| `travel_park_hvac_mode` / `travel_park_fan_mode` | `cool` / `auto` | Modes written with the park hold. `null` keeps the current mode. |
| `travel_freeze_off_heads` | `true` | Heads that are `off` **and** in Manual adjustment when travel starts (or are turned off by hand during travel) get the `travel_off` freeze. |
| `travel_enable_humidity_assist` | `true` | Enables Humidity Assist for every zone that has a sensor configured when travel starts, and disables the zones House Modes enabled when travel ends. Zones you enabled yourself are left alone. |
| `travel_auto_exit_on_arrival` | `false` | When a presence entity turns `home` during travel, Velair turns the travel entity off. |

## Per-Zone Settings

Stored under each zone's `house_modes` key, edited through
`velair/update_zone_house_modes` or the generated entities.

| Setting | Default | Meaning |
| --- | --- | --- |
| `away_enabled` | `true` | Zone takes part in away staging (`switch.velair_<zone>_away_setback`). |
| `away_temperature` | `26` | Raise-only hold `away_1h` at stage 1. |
| `away_deep_temperature` | none | Raise-only hold `away_6h` at stage 2. `null` skips the zone at stage 2. |
| `sleep_enabled` | `true` | Zone takes part in sleep (`switch.velair_<zone>_sleep_hold`). |
| `sleep_temperature` | `26` | Hold `sleep`. |
| `sleep_constraint` | `raise_only` | `absolute` for a bedroom that must actually cool. |
| `sleep_fan_mode` | none | Fan mode written with the sleep hold, e.g. `high`. |
| `sleep_minimum_temperature` | none | While asleep the zone's minimum limit (`number.velair_<zone>_minimum_temperature`) is temporarily replaced by this value and restored on wake. If you change the minimum yourself while asleep, your value is kept. |
| `presleep_temperature` | none | Lower-only hold `presleep` at `presleep_time`. `null` skips the zone. |
| `travel_park_enabled` | `true` | Zone is parked and frozen during travel. |

The hold HVAC and fan modes come from the zone's Occupancy Assist setback modes
(`setback_hvac_mode`, `setback_fan_mode`, defaults `cool` / `auto`); a mode the
climate does not support is dropped and the hold is written without it.

## Rules

### Presence

The house is empty when every presence entity is `not_home` and, if
corroboration sensors are configured, every one of them has been `off` for the
quiet window. `empty_since` is the later of the last departure and the end of
the quiet window. Someone is home when at least one presence entity is `home`;
`unknown`, `unavailable`, and zone names other than `home`/`not_home` count as
"not empty" but do not count as "home" for arrival release.

### Away staging

- Stage 1 (`away_after_minutes`): for each enabled zone whose head is not
  `off`, is available, has no Manual adjustment younger than the Guards lease
  (`settings.guards.manual_lease_minutes`, default 30), and none of whose
  Occupancy Assist blocking entities is `on`: hold `away_1h` raise-only at
  `away_temperature`.
- Stage 2 (`away_deep_after_minutes`): the same guards; zones with an
  `away_deep_temperature` get `away_6h`, and a zone skipped at stage 1 is
  retried for `away_1h`. Zones are not retried between stages.
- Arrival (`arrival_release_minutes` of any presence entity `home`) releases
  `away_1h` and `away_6h` on every zone.
- Away staging is suspended while travel is on; the travel park already covers
  an empty house.

### Sleep and pre-sleep

- Sleep on: every enabled zone that is not in Manual adjustment gets the
  `sleep` hold with its constraint, fan mode, and temperature; the zone
  minimum is swapped to `sleep_minimum_temperature` when set; `presleep` is
  released everywhere first.
- Sleep off: `sleep` is released everywhere and swapped minimums are restored.
- Pre-sleep: once a day at `presleep_time`, zones with a `presleep_temperature`
  get a lower-only `presleep` hold for `presleep_duration_minutes`. It is
  skipped for the day while travel is on, the house is empty, or sleep is
  already on, and for zones in Manual adjustment. A restart inside the window
  applies the remaining duration.

### Travel

- Travel on: heads that are `off` and in Manual adjustment get the indefinite
  `travel_off` freeze (`travel_freeze_off_heads`). Every other enabled zone gets
  the raise-only `travel_park` hold as soon as the house is empty. Velair
  re-checks on every presence change, every 30 minutes, and on start; while a
  presence entity is definitely `home` the park is lifted, and it returns when
  the house is empty again. Humidity Assist is enabled if configured.
- Travel off: `travel_park` is released everywhere, `travel_off` stays on heads
  that are still `off`, and Humidity Assist is disabled for the zones House
  Modes enabled.
- A head with `travel_off` that a person turns on: the freeze is released and
  the zone enters Manual adjustment so the hand-set state is protected.
- A head turned off by hand while travel is on gets `travel_off` once Velair's
  external-change policy has created the Manual adjustment (with the
  `keep_automatic` policy the target is re-asserted instead, so nothing is
  frozen).

## Pause ids

| pause_id | action | constraint | released by |
| --- | --- | --- | --- |
| `away_1h`, `away_6h` | hold | raise_only | arrival, master switch off, zone switch off (Occupancy Assist's arrival final stage may release them too) |
| `sleep` | hold | `sleep_constraint` | sleep off, master switch off, zone switch off |
| `presleep` | hold, timed | lower_only | expiry, sleep on, master switch off |
| `travel_park` | hold | raise_only | travel off, presence `home`, master switch off |
| `travel_off` | none (freeze) | - | a person turning the head on, travel off while the head is on, master switch off |

## Entities

Global:

| Entity | Meaning |
| --- | --- |
| `sensor.velair_house_mode` | `home`, `away`, `away_deep`, `travel`, `sleep`, or `disabled`. Travel wins over away; `sleeping: true` is reported as an attribute when sleep combines with another state. Attributes: `empty_since`, `next_stage_at`, `travel_since`, `sleep_since`, `zones_parked`, `zones_frozen`, `zones_away`, `zones_sleeping`, `zones_presleep`, `away_stage`, `presence_empty`, `presence_certain`, `next_evaluation_at`, `last_action`, `last_action_at`. |
| `switch.velair_house_modes` | Master switch. |
| `number.velair_house_away_after_minutes`, `number.velair_house_away_deep_after_minutes`, `number.velair_house_arrival_release_minutes` | Away timings. |
| `number.velair_travel_park_temperature` | Park target in the climate unit. |

Per zone (for a climate named "Guest room"):

| Entity | Meaning |
| --- | --- |
| `switch.velair_guest_room_away_setback` | `away_enabled` |
| `switch.velair_guest_room_sleep_hold` | `sleep_enabled` |
| `number.velair_guest_room_away_temperature` | `away_temperature` |
| `number.velair_guest_room_away_deep_temperature` | `away_deep_temperature`; setting it to the climate's minimum clears it |
| `number.velair_guest_room_sleep_temperature` | `sleep_temperature` |
| `number.velair_guest_room_sleep_minimum_temperature` | `sleep_minimum_temperature`; the climate's minimum clears it |
| `number.velair_guest_room_presleep_temperature` | `presleep_temperature`; the climate's minimum clears it |

## Restart Continuity

The runtime record (`settings.house_modes_runtime`) persists the away stage,
`empty_since`, sleep and travel timestamps, the pre-sleep day marker, the
minimums swapped for sleep, and the Humidity Assist zones House Modes enabled.
Away delays are measured from the presence entities' `last_changed`, so a
restart inside the away window applies the missed stage immediately and a
restart during sleep or travel neither re-applies nor releases anything until
the input actually changes.

## Automation Events

`house_mode_changed` and `house_zone_parked` are documented with their payloads
in [Automation Events](automation-events.md#house-mode-changed).

## WebSocket

```ts
await hass.connection.sendMessagePromise({
  type: "velair/update_settings",
  house_modes: {
    presence_entity_ids: ["person.izzat", "person.marianne"],
    presence_corroboration_entity_ids: ["binary_sensor.anyone_ble_home"],
    sleep_entity_id: "input_boolean.sleep_mode",
    travel_entity_id: "input_boolean.climate_travel_mode",
    travel_auto_exit_on_arrival: true,
    enabled: true
  }
});

await hass.connection.sendMessagePromise({
  type: "velair/update_zone_house_modes",
  entity_id: "climate.master_bedroom",
  house_modes: {
    sleep_constraint: "absolute",
    sleep_fan_mode: "high",
    sleep_minimum_temperature: 22,
    away_deep_temperature: 28
  }
});
```

Only provided fields change. Temperatures must fall inside the climate's own
target range; violations return `invalid_house_modes`. The schedule response
carries the normalized global settings in `settings.house_modes` and the
runtime status, including every zone's normalized settings, in `house_mode`.

## Limitations

- Presence uses the `home`/`not_home` states only. A `person` in a named zone
  is treated as "not empty" but not as "home".
- The pre-sleep hold is a once-a-day event. Changing `presleep_time` to an
  earlier time after today's window started does not re-fire it today.
- Never-off recovery, manual release, and the other Guards belong to the Guards
  module; House Modes only reads the manual lease from `settings.guards`.
