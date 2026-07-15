# Room Assist

Room Assist lets Velair use a separate room temperature sensor for one managed climate while still controlling the real `climate.*` entity.

This is useful for TRVs, radiator valves, wall thermostats, or AC units whose built-in temperature reading does not represent the real room temperature. For example, a TRV mounted next to a radiator may report `22 °C` while the room sensor still reports `20.5 °C`.

Room Assist is local and event-driven. Velair does not poll continuously and does not send sensor data outside Home Assistant.

## What It Does

Velair keeps the scheduled target as the real user target, but may temporarily adjust the target sent to the climate entity so the actuator keeps heating or cooling toward the external room sensor.

The climate entity remains the actuator. Velair does not create a virtual climate entity and does not bypass device firmware. If your thermostat or TRV supports binding an external sensor directly, that device-native option is still usually the best first choice.

## Setup

1. Open the Room Assist tab.
2. Expand the climate you want to configure.
3. Select a room temperature sensor.
4. Enable Room Sensor Assist.
5. Adjust Maximum assist delta if the default is too small for that room.
6. Adjust Refresh delay if sensor updates feel too slow or too chatty.

Selecting a room sensor alone only stores the sensor. Velair starts using it as the effective room temperature only when Room Sensor Assist is enabled.

Room Sensor Assist does not require Adaptive Preconditioning. It can run on normal scheduled blocks and on blocks that Adaptive Preconditioning has started early.

Refresh delay is the debounce applied after the room sensor or climate temperature changes. The default is `20` seconds. Set it to `0` for immediate recalculation, or up to `300` seconds to group frequent sensor updates.

## Heating Example

Scenario:

- Scheduled block: `21 °C`, `heat`
- Room sensor: `18 °C`
- Climate current temperature: `17.1 °C`
- Maximum assist delta: `5 °C`
- Climate temperature step: `0.5 °C`

Velair calculates the remaining room gap:

```text
21 - 18 = 3 °C
```

The remaining gap is below the configured maximum assist delta, so Velair uses `3 °C`.

```text
climate target = climate current temperature + assist delta
climate target = 17.1 + 3 = 20.1 °C
```

With a `0.5 °C` climate step, Velair rounds the assisted target to a supported heating target:

```text
20.1 °C -> 20.5 °C
```

The visible schedule target remains `21 °C`. The temporary `20.5 °C` target is only the value sent to the thermostat so the room sensor can keep moving toward `21 °C`.

If the room sensor later reports `21 °C`, Velair stops driving the room past the scheduled target and applies a non-driving hold target based on the climate entity's own temperature.

If the room later drops again during the same active block, Velair can assist again.

## Heating With A Capped Delta

Scenario:

- Scheduled block: `25 °C`, `heat`
- Room sensor: `18 °C`
- Climate current temperature: `17.1 °C`
- Maximum assist delta: `5 °C`

The real room gap is large:

```text
25 - 18 = 7 °C
```

Velair caps the assist delta at the configured limit:

```text
assist delta = 5 °C
climate target = 17.1 + 5 = 22.1 °C
```

After applying the climate step, the exact target may be rounded to the closest supported value for that device.

This prevents Room Assist from sending unrealistic targets to the thermostat while still keeping it open enough to heat the room.

## Cooling Example

Scenario:

- Scheduled block: `22 °C`, `cool`
- Room sensor: `24 °C`
- Climate current temperature: `25.1 °C`
- Maximum assist delta: `2 °C`
- Climate temperature step: `0.5 °C`

Velair calculates the remaining cooling gap:

```text
24 - 22 = 2 °C
```

For cooling, Velair moves the climate target below the climate current temperature:

```text
climate target = climate current temperature - assist delta
climate target = 25.1 - 2 = 23.1 °C
```

With a `0.5 °C` climate step, Velair rounds to a supported cooling target:

```text
23.1 °C -> 23 °C
```

The scheduled target remains `22 °C`. The temporary climate target is only used to help the room sensor move toward the real scheduled target.

## When Velair Does Nothing

Room Assist requires the managed climate to publish a valid positive
`target_temp_step`. If that capability is missing, Velair reports Room Assist as
unavailable with `missing_target_step` and does not infer a fallback or send an
assisted target.

Room Assist does not apply an assisted target when:

- no room sensor is selected;
- Room Sensor Assist is disabled;
- the scheduler is not in automatic mode;
- the climate is paused or boosted;
- there is no active temperature block;
- the active block is `Off`;
- the room sensor or climate temperature is unavailable or non-numeric;
- the calculated change is smaller than the climate entity's temperature step;
- the HVAC mode cannot be interpreted as heating or cooling.

In these cases Velair keeps or restores the normal scheduled target where that is safe.

## Adaptive Preconditioning

When Adaptive Preconditioning is enabled and starts a future block early, Room Assist follows that future target until the scheduled comfort time.

This matters because the current clock time may still belong to an older block. Velair treats the already-started preconditioning block as the active managed target, so Room Assist does not recalculate against the previous block.

When Room Sensor Assist is enabled, Adaptive Preconditioning also uses the selected room sensor as the effective room temperature source for decisions and learning.

## Automation Events

Velair emits the standard `velair_event` Home Assistant event.

Room Assist emits:

- `room_sensor_assist_state_changed`: Room Assist was enabled or disabled.
- `room_sensor_assist_updated`: Velair applied a temporary assisted climate target.
- `room_sensor_assist_restored`: Velair stopped driving the assisted target because the room reached target or assistance ended.

See [Automation Events](automation-events.md#room-sensor-assist-state-changed)
for complete payloads and all restoration reasons.

Example event data:

```yaml
event: room_sensor_assist_updated
entity_id: climate.living_room
room_temperature_entity_id: sensor.living_room_temperature
target_temperature: 21
applied_temperature: 20.5
room_temperature: 18
climate_temperature: 17.1
assist_delta: 3
direction: heat
hvac_mode: heat
reason: current_schedule
```

Example automation trigger:

```yaml
trigger:
  - platform: event
    event_type: velair_event
    event_data:
      event: room_sensor_assist_updated
      entity_id: climate.living_room
```

Room Assist can also be controlled from automations with:

- `velair.enable_room_sensor_assist`
- `velair.disable_room_sensor_assist`

## Lovelace

The Room Assist view is available as a Lovelace card:

```yaml
type: custom:velair-card
view: sensors
entities:
  - climate.living_room
```

The live temperature scale separates two relationships. The upper neutral line compares the room sensor with the scheduled target and labels the room as above or below that target. The lower control line compares the climate reading with the climate target: a highlighted dashed line and signed `Offset` label mean Room Assist is applying a non-zero setpoint offset, while a lighter dotted line with `Offset 0 · Holding` means no correction is currently applied. These indicators describe only the setpoint correction sent by Velair; they do not claim that the thermostat, valve, or compressor is actively heating or cooling.

In narrow dashboard columns, the live temperature scale scrolls horizontally so temperature markers remain readable.

The Room Assist Lovelace card can also hide individual parts when you want a compact dashboard-only view:

```yaml
type: custom:velair-card
view: sensors
entities:
  - climate.living_room
show_room_assist_switch: false
show_room_assist_sensor: false
show_room_assist_max_delta: false
show_room_assist_debounce: false
show_room_assist_live_status: true
```

Omitted `show_room_assist_*` options default to `true`.

## Technical Details

Developer-oriented details about storage fields, runtime status, assisted target calculation, restoration behavior, and events are documented in [Room Assist internals](../developer/room-assist.md).
