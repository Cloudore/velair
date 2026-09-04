# Occupancy setback ladder

Move one Velair-managed climate through up to three setback stages after its room has been empty for configurable times, and release the setback when the room is occupied again. Every stage is a Velair zone hold, so the weekly schedule is never edited and a manual adjustment or another pause keeps precedence.

<p>
  <a href="https://my.home-assistant.io/redirect/blueprint_import/?blueprint_url=https%3A%2F%2Fraw.githubusercontent.com%2Fcgonfer%2Fvelair%2Fmain%2Fblueprints%2Fautomation%2Fvelair%2Foccupancy_setback.yaml"><img src="https://my.home-assistant.io/badges/blueprint_import.svg" alt="Open Home Assistant and import the Occupancy setback ladder blueprint" height="28"></a>
  <a href="https://raw.githubusercontent.com/cgonfer/velair/main/blueprints/automation/velair/occupancy_setback.yaml"><img src="https://img.shields.io/badge/YAML_source-View-24292F?style=for-the-badge&amp;logo=github&amp;logoColor=white" alt="View the Occupancy setback ladder YAML source"></a>
</p>

[View changelog](../../../blueprints/changelogs/occupancy_setback.md) · [Back to the blueprint index](../blueprints.md)

## When to use it

Use this blueprint when an empty room should drift gently towards an energy-saving temperature in steps instead of jumping to one setback, and return to its schedule when somebody comes back. It suits cooling homes (raise the target while empty) and heating homes (lower it) alike, one automation per room.

## Requirements

- Blueprint version 1.0.0, Velair 1.8.0 or newer, and Home Assistant 2024.6.0
  or newer. Velair 1.8.0 supplies the zone holds (`velair.pause_zone` with
  `action: hold`) used by every stage.
- One climate entity already managed by Velair.
- One consolidated occupancy entity for the room. `on` or `home` must mean
  occupied and `off` or `not_home` must mean empty. A group, template binary
  sensor, or helper that already combines motion, presence, and phone
  location works best.

## Configuration

- **Managed thermostat:** the Velair-managed climate for this room.
- **Room occupancy:** the consolidated occupancy entity.
- **Setback stages:** for each stage, how many minutes the room must stay empty and the temperature to hold. Stage 2 and stage 3 can be disabled.
- **Live dials (optional):** helper entities (`input_number`, `number`, or `sensor`) that override the stage minutes and temperatures. When set, the blueprint reads them every time a stage is evaluated, so a dashboard slider tunes the ladder without editing the automation.
- **How stages combine with the schedule:** `Raise only` keeps the warmer of the stage and the schedule target (cooling setbacks), `Lower only` keeps the cooler one (heating setbacks), `Exact` replaces the schedule target.
- **HVAC mode while held** and **Fan mode while held:** optional modes applied with every stage.
- **Release when the room is occupied again:** remove the hold on occupancy. Turn it off when another automation, for example an arrival comfort ramp, owns the release.
- **Pause ID:** a stable ownership identifier. Keep the default for one automation per room, or use a different ID for each automation that targets the same thermostat.
- **Blocking entities:** while any of them reports `on`, `home`, `playing`, or `paused`, no stage is applied and an existing stage is left unchanged. Use it for sleep or guest helpers, bed sensors, or a media player in the room.
- **Occupied delay:** how long the room must stay occupied before the hold is released.
- **Availability warning delay:** how long occupancy must remain `unknown` or `unavailable` before a Home Assistant notification. The default is 5 minutes.

## Example

For a guest room in a cooling home whose schedule keeps 24 °C:

```text
Managed thermostat: climate.guest_room
Room occupancy: binary_sensor.guest_room_occupancy
Stage 1 after: 10 minutes → 23 °C
Stage 2 after: 30 minutes → 25 °C
Stage 3 after: 90 minutes → 26 °C
How stages combine with the schedule: Raise only
Blocking entities:
  - input_boolean.guest_mode
Pause ID: velair_occupancy_setback
```

After ten empty minutes the ladder creates a raise-only hold at 23 °C, which leaves the 24 °C schedule target untouched. After thirty minutes the same hold moves to 25 °C, and after ninety minutes to 26 °C. When somebody enters the room, the hold is released and Velair applies the schedule again. While guest mode is on, nothing changes.

## How it works

Home Assistant observes the empty condition with one native template trigger per stage, each with its own `for` duration read from the stage minutes or the optional dial entity when the room becomes empty. If the room is occupied before a duration ends, Home Assistant resets that timer and no stage runs. When a timer completes, the short action checks the occupancy and blocking entities again, then calls `velair.pause_zone` with `action: hold`, the configured Pause ID, the stage temperature, and the constraint. Because every stage reuses the same Pause ID, Velair updates the hold in place and keeps its original start time; the hold label records the stage.

An occupied template trigger with the occupied delay calls `velair.resume_zone` with the same Pause ID, which removes only this automation's hold and lets Velair apply the current schedule immediately. Availability diagnostics use their own trigger: if occupancy remains `unknown` or `unavailable` for the warning delay, one automation-scoped persistent notification explains that stages are not applied or released, and a recovery trigger dismisses it. The deterministic notification ID means later executions update the same warning instead of producing duplicates.

After Home Assistant starts, and whenever Velair reports `zone_resumed` for this thermostat, one reconciliation execution reads how long the occupancy entity has been in its current state. It applies the highest stage already due, then waits interruptibly for the remaining stages, stopping immediately if the room becomes occupied. Home Assistant restores an entity's state without its pre-restart history, so after a restart the age is measured from startup and the ladder begins again from zero. There is no polling.

## Safety and precedence

The blueprint creates its hold with the configured **Pause ID**. Its default is `velair_occupancy_setback`; Velair persists that ownership independently for every thermostat.

- A manual adjustment, a plain pause, or a `turn_off` pause in Velair keeps precedence over any hold. The ladder never fights them; when they are removed, Velair delivers the hold again on its own.
- Occupancy releases only the hold carrying the same Pause ID. Holds owned by other automations remain.
- With `Raise only` or `Lower only`, a stage can never move the target the wrong way relative to the schedule, so a warmer or cooler schedule block always wins in that direction.
- `unknown` and `unavailable` occupancy never counts as empty or occupied. Stages are not applied or released until a valid state returns.
- Blocking entities suspend new stages without removing an existing hold.

Each stage is an individual service call, and the occupancy and blocking state are checked again immediately before every call. A Home Assistant service error is recorded in the automation trace, and `continue_on_error` keeps the automation healthy.

## Limitations

- One automation manages one thermostat. Create one automation per room; use different Pause IDs only when several automations must target the same thermostat.
- A dial change is read when the room becomes empty or a stage is evaluated. Changing a minutes dial while the room is already empty does not shorten a timer that is already running.
- Velair rejects a stage temperature outside the thermostat's supported range; keep the dials within the device limits.
- Interruptible startup reconciliation begins from the occupancy entity's restored state and cannot recover pre-restart timer history.
- Notifications depend on Home Assistant's built-in `persistent_notification` integration.
- Up to 20 runs may overlap. Home Assistant emits a warning if a pathological event burst fills those slots; normal condition-triggered runs remain short.

## Troubleshooting

- If no stage applies, confirm the occupancy entity reports `off` or `not_home` while the room is empty and stays empty longer than the stage minutes, and that no blocking entity is active.
- If the target does not change on stage 1, remember that `Raise only` and `Lower only` keep the schedule target when it is already beyond the stage temperature. Check the zone override sensor's `effective_temperature`.
- If the room stays held after somebody returns, confirm the occupancy entity reports `on` or `home`, that **Release when the room is occupied again** is on, and that the active hold carries this automation's Pause ID. The zone override sensor lists every active hold.
- If a service reports an unmanaged entity, add that climate to Velair.
- If an availability warning remains after recovery, verify that the occupancy entity produced a new state event, or run the automation to re-evaluate.

## Updating and customizing

Re-import the rolling `main` URL to install a compatible update. Version 1
updates preserve existing input names, and any new input has a default, so no
automation migration is required. A future breaking version will use a new
filename and major version instead of replacing this URL. Velair never edits
Home Assistant automations or `.storage` to migrate a blueprint. Use **Take
control** only when the installation needs custom behavior beyond the provided
stages, dials, blocking entities, and delays; the independent automation then
stops receiving blueprint updates.
