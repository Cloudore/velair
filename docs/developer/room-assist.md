# Room Assist Internals

Room Assist lets Velair use a separate room temperature sensor for one managed climate while the real `climate.*` entity remains the actuator.

This page documents implementation details. User-facing setup and examples are documented in [Room Assist](../user/room-assist.md).

## Scope

Room Sensor Assist is optional, local, event-driven, and disabled by default.

It can run on normal scheduled temperature blocks and on blocks that Adaptive Preconditioning has already started early. It does not require Adaptive Preconditioning to be enabled.

Velair does not create a virtual climate entity, bypass device firmware, or poll temperatures continuously. If a thermostat or TRV supports binding an external sensor directly, that device-native option remains the preferred first choice.

## Stored Configuration

Room Assist configuration is stored per managed climate together with the climate's preconditioning settings for compatibility with the current storage shape:

```json
{
  "room_temperature_entity_id": "sensor.living_room_temperature",
  "room_sensor_assist_enabled": true,
  "room_sensor_assist_max_delta": 2.0,
  "room_sensor_assist_debounce_seconds": 20
}
```

Key meanings:

- `room_temperature_entity_id`: optional Home Assistant `sensor.*` temperature entity selected from the Room Assist tab.
- `room_sensor_assist_enabled`: enables runtime target assistance. Selecting a sensor alone does not make it operational.
- `room_sensor_assist_max_delta`: caps how far Velair may temporarily move the target sent to the climate entity while preserving the scheduled target as the real user target.
- `room_sensor_assist_debounce_seconds`: waits this many seconds after relevant room sensor or climate state changes before recalculating assistance. The supported range is `0` to `300` seconds.

The maximum assist delta is normalized with a broad bound so Celsius and Fahrenheit installations can both configure useful limits. The frontend should display values using the Home Assistant temperature unit.

## Effective Temperature Source

When `room_temperature_entity_id` is configured and `room_sensor_assist_enabled` is true, Velair treats the selected room sensor as the effective room temperature source for:

- Room Sensor Assist calculations;
- Adaptive Preconditioning direction checks;
- Adaptive Preconditioning initial and observed learning temperatures;
- active preconditioning learning-session listeners;
- pre-start replanning callbacks.

When Room Sensor Assist is disabled, the selected sensor remains stored but is not used as the effective room temperature source. Velair falls back to the climate entity's own `current_temperature`.

Stored Adaptive Preconditioning observations include `temperature_source: "room_sensor"` and `room_temperature_entity_id` only when a room sensor was actually used. Older observations and climate-temperature observations keep their compact shape.

## Runtime Status

The schedule response exposes a runtime-only `room_sensor_assist` snapshot for the panel and Lovelace card. It is derived from Home Assistant state and scheduler state when the response is built. It is not persisted as history.

This status can include:

- whether assistance is idle, unavailable, or assisting;
- the active scheduled target and HVAC mode;
- whether the active block was started early by Adaptive Preconditioning;
- the configured room sensor value;
- the climate entity's own temperature reading;
- the temporary target currently applied to the climate;
- the assist delta and refresh timing.

## Assistance Lifecycle

Assistance is active only while Velair has applied a managed schedule target for that climate.

During that time, Velair listens to state changes from:

- the configured room temperature sensor;
- the managed climate entity.

Those listeners exist only while assistance is relevant. They are removed when the scheduler state, zone state, schedule block, sensor state, or feature state means assistance is no longer active.

When assistance refreshes during an active Adaptive Preconditioning session, the preconditioning session target is authoritative until `target_when`. If the runtime learning session is not available but Room Sensor Assist already has an active assisted state, that runtime target is still used before falling back to the previous clock-based schedule block. This prevents Room Sensor Assist from recalculating against the previous block while a future block has already been started early.

## Target Calculation

For heat:

```text
pending_delta = target_temperature - room_temperature
assist_delta = clamp(pending_delta, 0, room_sensor_assist_max_delta)
applied_target = climate_current_temperature + assist_delta
```

For cool:

```text
pending_delta = room_temperature - target_temperature
assist_delta = clamp(pending_delta, 0, room_sensor_assist_max_delta)
applied_target = climate_current_temperature - assist_delta
```

If `pending_delta <= minimum_delta_temperature`, Velair applies a non-driving hold target based on the climate entity's own `current_temperature`, aligned to the climate temperature step. For heating this hold target is rounded down; for cooling it is rounded up.

Velair keeps the runtime state and listeners active while the scheduled block remains active, so assistance can start again if the room sensor moves away from the scheduled target later.

The applied target is bounded by the climate entity's min/max target temperatures and aligned to the climate entity's `target_temp_step`. For heating, Velair rounds the assisted target down to the nearest supported step; for cooling, it rounds up to the nearest supported step. This keeps the temporary target valid for the device without making assistance more aggressive than the calculated delta.

Velair ignores target movements smaller than the climate entity's `target_temp_step`.

## Clearing And Restoring

Assistance is cleared when:

- the scheduler leaves auto mode;
- a zone boost starts;
- a zone is paused;
- a scheduled `Off` block is applied;
- the schedule changes or is cleared;
- Room Sensor Assist is disabled;
- the room sensor or climate temperature is missing or non-numeric;
- the active HVAC mode cannot be interpreted as heating or cooling.

When assistance is cleared because the block or Velair control path ends, Velair restores the real scheduled target when possible.

## Automation Events

Velair emits the standard `velair_event` Home Assistant event.

Room Assist emits:

- `room_sensor_assist_updated`: Velair applied a temporary assisted climate target.
- `room_sensor_assist_restored`: Velair stopped driving the assisted target because the room reached target or assistance ended.

The event payload includes the climate entity, room sensor entity, scheduled target, applied target, measured temperatures, assist delta, direction, HVAC mode, and reason when those values are available.

## API Summary

Room Assist settings are updated through the same per-climate preconditioning API payload because they share the current storage object:

```ts
await hass.connection.sendMessagePromise({
  type: "velair/update_zone_preconditioning",
  entity_id: "climate.living_room",
  preconditioning: {
    room_temperature_entity_id: "sensor.living_room_temperature",
    room_sensor_assist_enabled: true,
    room_sensor_assist_max_delta: 2.0,
    room_sensor_assist_debounce_seconds: 20
  }
});
```

Automation services are also available:

- `velair.enable_room_sensor_assist`
- `velair.disable_room_sensor_assist`

The detailed WebSocket contract is documented in [WebSocket API](api.md).

## Limitations

Room Sensor Assist depends on Home Assistant state updates from the selected room sensor and the managed climate entity. If those entities do not publish useful updates, Velair cannot infer intermediate room movement.

The climate entity remains responsible for the actual hardware behavior. Velair can request target changes, but device firmware, valve logic, compressor protection, HVAC mode support, min/max target limits, and vendor-specific behavior still apply.
