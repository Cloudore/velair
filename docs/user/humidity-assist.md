# Humidity Assist

Humidity Assist keeps rooms below a dew-point or relative-humidity target while
Velair holds a warm "rest" schedule, typically while the home is empty. Instead
of cooling continuously, it pulses individual climates colder for bounded runs
whenever a room's reading drifts above its target, then returns each climate to
whatever Velair would normally apply. It was designed for humid climates where
cabinets, furniture, and fabrics need dry air far more than they need cold air.

Humidity Assist is local and event-driven. Velair listens to the configured
sensors, the optional gate entity, and its own zone control changes, and arms
one timer per zone for the next minimum/maximum run or rest boundary. It does
not poll.

## Concepts

- **Zone**: a managed climate with its own humidity sensor, target, pulse
  setpoint, and priority flag.
- **Pulse**: a bounded cooling run. Velair sends the zone's pulse temperature,
  pulse HVAC mode (`cool` or `dry`), and optional fan mode with
  `source: humidity_assist_pulse`.
- **Rest**: the normal state between pulses. When a pulse ends Velair re-applies
  whatever is authoritative below Humidity Assist, such as the active schedule
  block, the Profile, or Room Assist, with `source: humidity_assist_rest`. If
  nothing is authoritative (no block is active), Velair restores the climate
  state captured before the pulse.
- **Raw and median**: the live sensor reading and the rolling median of readings
  inside the median window. Decisions use both so a single noisy sample cannot
  start or stop a pulse.
- **Priority room**: rooms with furniture, cabinets, or instruments. They pulse
  first, are never held back by the gate, and standard rooms yield to them while
  they are waiting for a free slot.
- **Gate entity**: an optional on/off entity, such as an `input_boolean` set by a
  cost or energy budget automation. While it is `on`, only priority rooms and
  emergencies may pulse.
- **Initial pull-down**: for a window after Humidity Assist is enabled for a
  zone, the effective target is lowered by an offset and pulses may run longer.
  This dries the room quickly right after departure.
- **Compliance**: every enabled zone has both its raw and median reading at or
  below its target. It is exposed as `binary_sensor.velair_humidity_assist_compliant`.

## Setup

1. Open the **Humidity** tab.
2. Expand a climate, select its **Humidity sensor**, and choose whether it
   reports a **Dew point** (temperature in the climate unit) or **Relative
   humidity** (percent).
3. Set the **Target**, the **Pulse temperature**, and optionally the pulse
   mode, fan mode, and **Priority room** flag.
4. Enable the zone with the switch in its heading. Enabling starts the initial
   pull-down window.
5. Review the **Shared parameters** at the bottom of the tab.

Every setting is also available through services and Home Assistant entities,
so a travel automation can enable Humidity Assist on departure and disable it
on arrival without touching the panel.

## Per-Zone Settings

| Setting | Default | Meaning |
| --- | --- | --- |
| `enabled` | `false` | Runs the state machine for this zone. |
| `sensor_entity_id` | none | Dew point or relative humidity `sensor.*`. A dew point sensor declaring a different temperature unit is converted at the comparison boundary. |
| `measure` | `dew_point` | `dew_point` compares temperatures in the climate unit; `relative_humidity` compares percent. |
| `target` | none | The room should stay at or below this value. |
| `priority` | `false` | Priority room, see below. |
| `pulse_temperature` | none | Setpoint applied while a pulse runs. It must fall inside the climate's supported target range. |
| `pulse_hvac_mode` | `cool` | `cool` or `dry`. |
| `pulse_fan_mode` | none | Optional fan mode sent with the pulse. |

A zone needs a sensor, a target, and a pulse temperature before it can be
enabled. The state sensor reports `disabled` with a `reason` attribute
(`no_sensor`, `no_target`, `no_pulse_temperature`) until then.

## Shared Parameters

These live in Settings and apply to every zone. Dew-point buffers and margins
are temperature differences in the climate unit (`°C` values convert to `°F`
deltas during migration); relative-humidity zones read them as percent points.

| Parameter | Default | Meaning |
| --- | --- | --- |
| `start_buffer` | `0.2` | Start threshold is the effective target minus this value. |
| `stop_buffer` | `0.6` | Stop threshold is the effective target minus this value. It is widened to at least `start_buffer + 0.2` so a pulse never stops inside its own start band. |
| `min_on_minutes` | `10` | A pulse cannot end early, or rest because of the gate, before this many minutes. |
| `max_on_minutes` | `20` | A pulse always rests after this many minutes, even while readings remain high. Never lower than `min_on_minutes`. |
| `min_off_minutes` | `10` | Rest after a pulse before the same zone may pulse again. |
| `max_simultaneous_pulses` | `2` | How many zones may pulse at once. |
| `emergency_margin_priority` | `0.3` | Excess above the base target that marks a priority room as an emergency. |
| `emergency_margin_standard` | `0.5` | Excess above the base target that marks a standard room as an emergency. |
| `median_window_minutes` | `15` | Length of the rolling median window. |
| `initial_pull_down_window_minutes` | `90` | Duration of the pull-down after a zone is enabled. `0` disables it. |
| `initial_pull_down_max_run_minutes` | `45` | Maximum pulse length while the pull-down is active. |
| `initial_pull_down_target_offset` | `0.6` | How far the effective target is lowered during the pull-down. Dew-point targets never drop below `18 °C`. |
| `gate_entity_id` | none | Optional on/off entity that suspends standard-room pulses. |

## The Decision Ladder

Velair evaluates every enabled zone whenever a sensor changes (debounced by
20 seconds), the gate changes, a zone's control state changes (Manual
adjustment, pause, Boost, Profile, scheduler mode), a setting is saved, or a
per-zone timer fires. Zones are evaluated in order: priority rooms first, then
by the largest excess above target. For each zone it derives:

- `effective_target`: the target, minus the pull-down offset while the
  pull-down is active.
- `start_threshold = effective_target - start_buffer`
- `stop_threshold = effective_target - stop_buffer` (widened as above)
- `median_previous`: the median recorded at least two minutes earlier.
- `predictive_high`: the median is within `0.2` of the start threshold and has
  risen by more than `0.05` since `median_previous`.
- `two_high`: the median and the previous median are both at or above the
  start threshold, or the raw reading is at or above the effective target, or
  `predictive_high`.
- `low_and_not_rising`: the median is at or below the stop threshold, the raw
  reading is within `0.15` above it, and the median is not rising; or the raw
  reading is at or below the stop threshold, the median is below the start
  threshold and falling; or the raw reading is `0.4` below the stop threshold
  and the median is at or below the base target and not rising.
- `emergency_high`: the larger of raw and median is at or above the base target
  plus the zone's emergency margin.
- `gated`: the gate entity is `on`, the zone is not in its pull-down, the zone
  is not a priority room, and it is not an emergency.

Then it walks the ladder and records the first matching decision:

| Order | Condition | Decision | Resulting state |
| --- | --- | --- | --- |
| 1 | No sensor, target, or pulse temperature, or the zone is disabled | `disabled` | `disabled` |
| 2 | Manual adjustment, a pause with action `none` or `turn_off`, a Boost, a Profile pause, the scheduler not in automatic mode, or external execution | `manual_hold` | `blocked_manual` |
| 3 | The climate entity is unknown or unavailable | `unavailable` | `unavailable` (an active pulse ends) |
| 4 | Pulsing and the run reached the maximum on time | `rest_max` | `resting` |
| 5 | Pulsing, past the minimum on time, and `low_and_not_rising` | `rest_low` | `resting` |
| 6 | Pulsing, past the minimum on time, and `gated` | `rest_budget` | `resting` |
| 7 | Pulsing otherwise | `hold_active` | `pulsing` |
| 8 | The sensor has no usable reading | `unavailable` | `unavailable` |
| 9 | `two_high`, the minimum off time has elapsed (or the zone was just enabled), the zone is allowed to start, and fewer than the maximum zones are pulsing | `start` | `pulsing` |
| 10 | The thermostat still reports the pulse setpoint after a pulse ended | `rest_align` | `resting`, `blocked_gate`, or `waiting` |
| 11 | Otherwise | `hold_rest` | `resting` while the minimum off time runs, `blocked_gate` while gated, else `waiting` |

"Allowed to start" means: the zone is a priority room, or no priority room is
waiting to start and the zone is either not gated or is an emergency. The
maximum on time is the larger of `max_on_minutes`, `min_on_minutes`, and, during
the pull-down, `initial_pull_down_max_run_minutes`.

The state sensor's `decision` attribute names the decision that started the
current phase; `last_evaluation` shows the most recent evaluation, including
`hold_active` and `hold_rest`.

## Priority, Arbitration, And The Gate

- Priority rooms are evaluated first and take pulse slots first. While a
  priority room is eligible but has not started, standard rooms do not start.
- Standard rooms are then ordered by their excess above target, so the wettest
  room wins the remaining slots.
- While the gate entity is `on`, standard rooms neither start nor continue a
  pulse past the minimum on time, unless they are an emergency. Priority rooms
  ignore the gate. Zones inside their initial pull-down also ignore the gate.

The gate contract is intentionally simple: any entity whose state is `on`
blocks. A typical source is an `input_boolean` that a cost-tracking automation
turns on when the daily cooling budget is exhausted and off at midnight.

## Authority

A pulse sits between Boost and the effective schedule in Velair's delivery
authority stack:

1. A zone pause with action `none` (freeze) or `turn_off` wins over a pulse.
2. Manual adjustment wins over a pulse; the zone reports `blocked_manual`.
3. Boost wins over a pulse.
4. A pulse wins over Profile pauses, the effective schedule, and Room Assist.
   Room Assist is suppressed for the zone while it pulses and refreshes when
   the pulse ends.

Every transition invalidates pending climate delivery for the zone, so an
in-flight schedule write can never land on top of a pulse or vice versa.

## Restart Continuity

Phase timestamps (`phase_started_at`, `last_pulse_started_at`,
`last_pulse_ended_at`, `pull_down_started_at`), the last median, and the
climate snapshot captured before a pulse are persisted with Velair's data. A
zone that was pulsing when Home Assistant restarted resumes its pulse with the
original start time, so the minimum and maximum on boundaries still apply, and
the startup schedule application delivers the pulse setpoint again.

## Entities

For a climate named "Guest room" (`climate.midea_3`) Velair creates:

| Entity | Meaning |
| --- | --- |
| `sensor.velair_guest_room_humidity_assist` | State enum (`disabled`, `unavailable`, `blocked_manual`, `blocked_gate`, `waiting`, `pulsing`, `resting`) with `decision`, `target`, `effective_target`, `raw`, `median`, `excess`, `priority`, `phase_started_at`, `next_transition_at`, `pulse_temperature`, `sensor_entity_id`, `gate_active`, and `pull_down_active` attributes. |
| `switch.velair_guest_room_humidity_assist` | Enables the zone. |
| `switch.velair_guest_room_humidity_priority` | Marks it as a priority room. |
| `number.velair_guest_room_humidity_target` | The target, in the climate unit for dew points or percent for relative humidity. |

Global entities:

| Entity | Meaning |
| --- | --- |
| `binary_sensor.velair_humidity_assist_compliant` | `on` when every enabled zone has raw and median at or below its target. `off` when no zone is enabled. |
| `number.velair_humidity_assist_start_buffer`, `..._stop_buffer`, `..._min_on_minutes`, `..._max_on_minutes`, `..._min_off_minutes`, `..._max_simultaneous_pulses`, `..._emergency_margin_priority`, `..._emergency_margin_standard`, `..._median_window_minutes`, `..._initial_pull_down_window_minutes`, `..._initial_pull_down_max_run_minutes`, `..._initial_pull_down_target_offset` | The shared parameters. |

The Overview zone card shows **Drying** while a zone is pulsing.

## Services

### `velair.enable_humidity_assist`

Enable one or more zones. Without `entity_id` it enables every climate that
already has a humidity sensor configured.

```yaml
action: velair.enable_humidity_assist
data:
  entity_id:
    - climate.living_room
    - climate.guest_room
```

### `velair.disable_humidity_assist`

Disable one or more zones, or every configured zone when `entity_id` is
omitted. An active pulse ends and the normal target is restored.

```yaml
action: velair.disable_humidity_assist
```

### `velair.set_humidity_assist`

Update any per-zone field. Only the provided fields change.

```yaml
action: velair.set_humidity_assist
data:
  entity_id: climate.guest_room
  sensor_entity_id: sensor.guest_room_dew_point
  measure: dew_point
  target: 22
  priority: false
  pulse_temperature: 24
  pulse_hvac_mode: cool
  pulse_fan_mode: auto
```

## Automation Event

`humidity_assist_state_changed` is documented with its payload in
[Automation Events](automation-events.md#humidity-assist-state-changed).

## Example: Travel Automation

Enable Humidity Assist for every configured zone when the home switches to
travel mode and disable it on arrival. The rest setpoint is the Travel Profile's
schedule; the pulses cool each room to 24 °C only when needed.

```yaml
alias: Travel moisture control
triggers:
  - trigger: state
    entity_id: input_boolean.travel_mode
actions:
  - choose:
      - conditions:
          - condition: state
            entity_id: input_boolean.travel_mode
            state: "on"
        sequence:
          - action: velair.activate_profile
            data:
              profile_id: travel
          - action: velair.enable_humidity_assist
      - conditions:
          - condition: state
            entity_id: input_boolean.travel_mode
            state: "off"
        sequence:
          - action: velair.disable_humidity_assist
          - action: velair.deactivate_profile
```

Pair it with a budget guard that turns the gate entity on:

```yaml
alias: Cooling budget exhausted
triggers:
  - trigger: numeric_state
    entity_id: sensor.travel_incremental_cooling_cost
    above: 4.75
actions:
  - action: input_boolean.turn_on
    target:
      entity_id: input_boolean.travel_hvac_budget_exhausted
```

and notify when the home is not compliant for long:

```yaml
alias: Rooms staying humid
triggers:
  - trigger: state
    entity_id: binary_sensor.velair_humidity_assist_compliant
    to: "off"
    for: "02:00:00"
actions:
  - action: notify.notify
    data:
      message: "At least one room is above its dew-point target."
```

## Lovelace

The Humidity tab is available as a card:

```yaml
type: custom:velair-card
view: humidity
entities:
  - climate.guest_room
```

## Limitations

- Velair pulses the climate through its target and HVAC mode. Device firmware,
  compressor protection, and minimum run times still apply.
- Humidity Assist evaluates its own rolling median from sensor state changes.
  A sensor that does not publish updates cannot start or stop pulses.
- There is no built-in cost model. The gate entity is the integration point for
  external budgets.

Implementation details live in
[Humidity Assist internals](../developer/humidity-assist.md).
