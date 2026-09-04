# Humidity Assist Internals

Humidity Assist is implemented in `custom_components/velair/humidity_assist.py`.
The scheduler owns one `HumidityAssistCoordinator` and exposes a small set of
hooks; the coordinator owns the per-zone state machine, timers, listeners,
samples, and persistence. User-facing behavior is documented in
[Humidity Assist](../user/humidity-assist.md).

## Stored Configuration

Per zone, under `zones[entity_id].humidity_assist`:

```json
{
  "enabled": false,
  "sensor_entity_id": null,
  "measure": "dew_point",
  "target": null,
  "priority": false,
  "pulse_temperature": null,
  "pulse_hvac_mode": "cool",
  "pulse_fan_mode": null
}
```

Globally, under `settings.humidity_assist`:

```json
{
  "start_buffer": 0.2,
  "stop_buffer": 0.6,
  "min_on_minutes": 10,
  "max_on_minutes": 20,
  "min_off_minutes": 10,
  "max_simultaneous_pulses": 2,
  "emergency_margin_priority": 0.3,
  "emergency_margin_standard": 0.5,
  "median_window_minutes": 15,
  "initial_pull_down_window_minutes": 90,
  "initial_pull_down_max_run_minutes": 45,
  "initial_pull_down_target_offset": 0.6,
  "gate_entity_id": null
}
```

`normalize_humidity_assist_data`, `normalize_humidity_assist_settings`, and
`normalize_humidity_assist_runtime_data` in `models.py` are tolerant: garbage
values fall back to defaults, out-of-range values are clamped, and
`max_on_minutes` is never below `min_on_minutes`. Both zone-creation paths in
`normalize_schedule_data` and `normalize_panel_settings` call them.

## Unit Handling

- `pulse_temperature` is an absolute temperature. `storage.py` converts it during
  migration and snaps it to the climate target grid, `api.py` exports and
  imports it with the zone, and the scheduler validates it against the climate's
  supported range on every update.
- A dew-point `target` is an absolute temperature in the runtime unit.
- The five buffer/margin/offset settings are temperature differences
  (`HUMIDITY_ASSIST_DELTA_SETTINGS` in `storage.py`) converted with
  `temperature_delta`; fresh Fahrenheit models use rounded defaults.
- Relative-humidity zones are unitless. The literal constants of the ported
  controller (`0.2`, `0.05`, `0.15`, `0.4`, `0.31`, `18 °C`) are Celsius values
  scaled with `temperature_delta` for dew-point zones and used as percent points
  otherwise.
- A dew-point sensor that declares a different unit is converted at the reading
  boundary with `absolute_temperature`.

## Runtime State

`_ZoneRuntime` keeps, per zone:

- `state` and `decision` (the decision that started the phase) plus
  `last_evaluation` (the most recent ladder result);
- `phase_started_at`, `last_pulse_started_at`, `last_pulse_ended_at`, and
  `pull_down_started_at`;
- `last_median`, the bounded `samples` list `(timestamp, value)`, and the
  `median_history` used for `median_previous`;
- `previous_state`, the climate snapshot captured before a pulse;
- `activation_override`, set when the zone is enabled so the first start ignores
  `min_off_minutes`, mirroring the source controller's activation trigger;
- `rest_align_done`, the per-phase guard for `rest_align`;
- the armed timer and its `next_transition_at`.

The persisted subset (`state`, `decision`, the four timestamps, `last_median`,
`previous_state`) is written to `scheduler data["humidity_assist_runtime"]`
keyed by climate entity and saved with the scheduler data on every transition.
The coordinator loads it in its constructor so the delivery-authority tier is
correct before `async_start` runs; a persisted `pulsing` record without a start
timestamp degrades to `waiting`.

## Samples And Medians

`_handle_state_change` records a sample from every tracked sensor state change.
The list is trimmed to the median window and to `MAX_SAMPLES`. `rolling_median`
computes the median of samples inside the window on demand; when no sample is
inside the window the raw reading is used. `median_previous` is the most recent
recorded median at least `PREVIOUS_MEDIAN_AGE` (two minutes) old, which
reproduces the source controller's two-minute cadence regardless of how often
Velair evaluates; it falls back to the oldest recorded median, then to the
persisted `last_median`, then to the current median.

## Evaluation

`async_evaluate` serializes through an `asyncio.Lock`; an evaluation requested
while one is running is re-run afterwards. `_async_evaluate_locked`:

1. computes `_ZoneFacts` for every zone (readiness, blocking authority,
   climate availability, readings, thresholds, pull-down, gate, emergency,
   `two_high`, `low_and_not_rising`, age, effective on/off limits);
2. derives `priority_waiting` and the current `active_count`;
3. sorts zones by priority first, then largest excess, then entity id;
4. decides each zone with `_decide`, adjusting `active_count` as zones start or
   rest so the cap is respected within the same pass;
5. applies transitions with `_async_apply_transition`;
6. records medians, updates compliance, reschedules timers, persists if any
   record changed, and writes entity state if anything changed.

`_decide` is the ladder documented for users. `blocked_manual` covers a
disabled zone, scheduler not in automatic mode, migration block, external
execution, Manual adjustment, a pause override with action `none` or
`turn_off`, an active Boost, and a Profile pause. A pause action introduced by
another branch, such as `hold`, does not block pulsing.

## Transitions And Delivery

- `start`: records `last_pulse_started_at`, captures the climate snapshot,
  suppresses Room Assist for the zone, invalidates climate delivery, persists,
  fires `humidity_assist_state_changed`, writes a logbook entry, and applies the
  pulse `ClimateEvent` through `scheduler._async_apply_event(...,
  source="humidity_assist_pulse")`. The physical call path force-refreshes Room
  Assist, which drops suppression, so the coordinator re-adds it afterwards.
- `rest_max` / `rest_low` / `rest_budget`: record `last_pulse_ended_at`, release
  Room Assist, invalidate delivery, persist, fire the event, and re-apply rest.
- An interrupted pulse (blocked, unavailable, disabled) records the end without
  re-applying, except that disabling restores the rest target.
- `rest_align`: re-applies rest once per phase when the thermostat still reports
  the pulse mode and setpoint (within `0.31` scaled degrees) and there is either
  an authoritative event below the pulse tier or a captured snapshot.

`_async_apply_rest` resolves `scheduler._resolve_authoritative_delivery_event`
and delivers it with `source="humidity_assist_rest"`; when nothing is
authoritative it restores the captured snapshot through
`ClimateManager.async_restore_state`. Afterwards it queues a Room Assist refresh
for the zone.

The delivery tier itself is `HumidityAssistCoordinator.pulse_event`, called
from `VelairScheduler._resolve_authoritative_delivery_event` after the Boost
check and before the Profile-pause check. It returns the pulse `ClimateEvent`
only while the zone's state is `pulsing`.

## Timers And Listeners

`_reschedule_timers` arms at most one `async_track_point_in_time` timer per
zone at the earliest future boundary among: pulse start plus minimum on, pulse
start plus effective maximum on, pulse end plus minimum off, and the end of the
pull-down window. Timers call `async_evaluate` and are cancelled on stop.

One `async_track_state_change_event` listener tracks every enabled zone's
sensor, the climates of enabled zones, and the gate entity. Sensor changes are
debounced by `DEBOUNCE_SECONDS` (20 s); gate changes evaluate immediately. The
scheduler's `_async_write_state` also calls `schedule_refresh()`, which
coalesces one evaluation task, so pauses, Manual adjustment, Boost, Profile,
and mode changes are picked up without additional hooks.

## Scheduler Hooks

`scheduler.py` changes are additive:

- constructs the coordinator at the end of `__init__`;
- starts it at the end of `async_start`, stops it in `async_stop`, and rebuilds
  samples in `handle_temperature_unit_change`;
- adds the pulse tier to `_resolve_authoritative_delivery_event`;
- reports `drying` in `_zone_runtime_status` while pulsing;
- exposes `get_humidity_assist_statuses`, `get_humidity_assist_status`,
  `humidity_assist_compliant`, `get_humidity_assist_config`,
  `async_update_zone_humidity_assist`, `async_set_humidity_assist`, and
  `humidity_assist_candidate_entities`;
- forwards `humidity_assist` updates from `async_update_settings`.

## Entities

- `sensor.py`: `ZoneHumidityAssistStateSensor` (enum).
- `switch.py`: `ZoneHumidityAssistSwitch` and `ZoneHumidityPrioritySwitch`,
  built by `_humidity_assist_switches`.
- `number.py`: `ZoneHumidityTargetNumber` and `HumidityAssistParameterNumber`,
  built by `build_humidity_assist_number_entities`. The platform module is
  self-contained so a sibling branch can add its own number entities.
- `binary_sensor.py`: `HumidityAssistCompliantBinarySensor`.

`ZONE_ENTITY_UNIQUE_ID_SUFFIXES` in `const.py` lists the per-zone suffixes;
`entity_registry.py` purges sensor, switch, and number entities of removed
climates.

## API Summary

```ts
await hass.connection.sendMessagePromise({
  type: "velair/update_zone_humidity_assist",
  entity_id: "climate.guest_room",
  humidity_assist: { enabled: true, target: 22, pulse_temperature: 24 },
});

await hass.connection.sendMessagePromise({
  type: "velair/update_settings",
  humidity_assist: { max_simultaneous_pulses: 3 },
});
```

`velair/get_schedule` includes `humidity_assist` (per-zone runtime status) and
`humidity_assist_compliant`. Errors use the `invalid_humidity_assist` code.

## Tests

`tests/backend/test_humidity_assist.py` covers every ladder branch,
arbitration, the gate, buffer widening, the pull-down, medians, timers, restart
continuity, compliance, Fahrenheit handling, normalization, services, and the
WebSocket surface. Frontend coverage lives in
`frontend/tests/domain/humidity-assist.test.ts` and
`frontend/tests/views/humidity-view.test.ts`.
