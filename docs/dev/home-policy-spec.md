# Home policy modules — design contract (fork `Cloudore/velair`, branch `home`)

Status: authoritative spec for the `feat/occupancy-assist`, `feat/house-modes`, `feat/guards` and
`feat/presence-ui` branches. Written 2026-09-04. Anything not covered here follows the Humidity
Assist implementation (`custom_components/velair/humidity_assist.py`, its models, WS handlers,
entities, `frontend/src/velair/views/humidity-view.ts`, docs and tests) as the structural template.

## 1. Goal

Make the whole "home" behaviour distributable: a person installs this fork, adds their climate
entities in the config flow, then configures **occupancy sensors, presence/sleep/travel entities and
every parameter** in the velair panel (or through `number`/`switch` entities), and gets the same
results as the reference installation. No Home Assistant automation, helper or template is required
for the core behaviour. The reference installation's remaining HA automations are only *inputs*
(occupancy template sensors, a sleep-mode boolean, a travel boolean, an energy gate boolean) and
*notifications*.

Doctrine the modules implement (unchanged from the reference home):

- P1 a hand-set value is protected (velair `until_resumed` policy) until a documented release rule ends it.
- P2 an empty room only gets warmer (setbacks are `raise_only` holds).
- P3/P4 arrival cools in stages and only the rooms someone actually entered.
- P5 uncertain occupancy = hold the current state (unavailable sensors never trigger a stage).
- Never OFF: a head turned off by a person comes back on after a grace period unless snoozed.
- One writer: every write is a velair hold/pause through the existing hold API (PR-1), delivered
  and verified by the existing delivery pipeline (PR-3). Modules never call `climate.*` services.

## 2. Modules and file ownership

| Module | Branch | Owned files (new) | One-line hooks allowed in |
|---|---|---|---|
| Occupancy Assist | `feat/occupancy-assist` | `occupancy_assist.py`, `occupancy_assist_models.py`, `occupancy_assist_api.py`, `occupancy_assist_entities.py`, `tests/backend/test_occupancy_assist.py`, `docs/user/occupancy-assist.md` | `scheduler.py` (construct/start/stop/settings_changed/status getters), `models.py` (`NotRequired` fields + import), `api.py` (register call + settings payload key), `services.py`/`services.yaml`, `sensor.py`/`number.py`/`switch.py` (one builder call each), `entity_registry.py` (suffix lists), `const.py`, `translations/*.json`, `__init__.py` |
| House Modes | `feat/house-modes` | `house_modes.py`, `house_modes_models.py`, `house_modes_api.py`, `house_modes_entities.py`, `tests/backend/test_house_modes.py`, `docs/user/house-modes.md` | same list |
| Guards | `feat/guards` | `guards.py`, `guards_models.py`, `guards_api.py`, `guards_entities.py`, `tests/backend/test_guards.py`, `docs/user/guards.md` | same list |
| Presence UI | `feat/presence-ui` | `frontend/src/velair/views/presence-view.ts` (+ sub-components under `frontend/src/velair/components/presence/`), `frontend/src/velair/api/presence.ts`, tests beside them | `types.ts`, `tabs.ts`, `card-context.ts`, `card-editor.ts`, `panel.ts`, frontend translations ×10 |

Rules for every branch:

- Branch from `home` (after commit `docs: home policy spec`). Keep hooks to single lines so the
  union merge into `home` is mechanical. Put TypedDicts, normalizers and defaults in your own
  `*_models.py`; `models.py` only gains `NotRequired[...]` fields and an import.
- New WS commands are registered from your `*_api.py` by one `register_<module>_ws(hass)` call in
  `api.py`. Zone/global settings for your module are stored under one key in velair storage
  (`zones[entity_id]["occupancy_assist"]`, `settings["house_modes"]`, `settings["guards"]`, and
  per-zone `zones[entity_id]["house_modes"]`, `zones[entity_id]["guards"]`), normalized with the
  tolerant-normalizer idiom (unknown keys dropped, missing keys defaulted, units migrated through
  `storage.py`'s temperature tables like `humidity_assist` does).
- Runtime state that must survive restart is persisted under `settings["<module>_runtime"]`
  exactly like `humidity_assist_runtime` (timestamps as ISO strings).
- All writes go through `scheduler.async_pause_zone(...)` / `async_resume_zone(...)` /
  `async_resume_automatic_control(...)` / `async_set_daily_schedule` — never through `hass.services`
  for the climate domain. Use `source="<module>"` and the pause ids in §7.
- Entities: `sensor` (runtime state, attributes), `switch` (enable), `number` (parameters), built by
  `build_<module>_sensors/switches/numbers(hass, entry)` in your `*_entities.py`, translation keys
  under `entity.<platform>.<key>`, unique ids `f"{entry_id}_{zone_key}_{suffix}"`, suffixes added to
  `ZONE_ENTITY_UNIQUE_ID_SUFFIXES` so `entity_registry.cleanup_entity_registry` retires them.
- Services declared in `services.yaml` with full `fields` + English descriptions; translations for
  all 10 backend files (English text is fine in the community languages, key parity is enforced by
  tests). Add `velair_event` types to `docs/user/automation-events.md` and the doc-contract test.
- Tests: one test per decision branch, restart continuity, unavailable-sensor behaviour, °F
  conversion, event payloads. `python3.13 -m unittest discover -s tests` must be green before the
  final commit. Do not touch the committed frontend bundle on backend branches.
- Timers: use `homeassistant.helpers.event.async_track_point_in_utc_time` /
  `async_call_later`, all cancelled in `async_stop`. Every decision is re-evaluated on HA start,
  on any input entity state change (via `async_track_state_change_event`), and on
  `SIGNAL_SCHEDULER_UPDATED` when your settings changed.

## 3. Occupancy Assist (per zone)

Settings `zones[entity_id]["occupancy_assist"]`:

| key | type | default | meaning |
|---|---|---|---|
| `enabled` | bool | false | master switch (`switch.velair_<zone>_occupancy_assist`) |
| `occupancy_entity_id` | str or None | None | `binary_sensor` (device_class occupancy/presence/motion) or any entity whose state is `on`/`off`; `on` = occupied |
| `blocking_entity_ids` | list[str] | [] | while any is `on`, no setback stage is applied (existing stages stay) |
| `corroboration_entity_ids` | list[str] | [] | arrival requires the occupancy entity **and** (if the list is non-empty) at least one of these to be `on` |
| `setback_stages` | list of `{after_minutes: int, temperature: float}` | `[{10,23},{30,25},{90,26}]` | up to 3, ascending minutes |
| `setback_hvac_mode` | str or None | `"cool"` | hvac_mode written with each setback hold (None = keep) |
| `setback_fan_mode` | str or None | `"auto"` | |
| `arrival_stages` | list of `{after_minutes: int, temperature: float or None}` | `[{5, 26}, {10, None}]` | stage 1 = lower-only hold at `temperature`; the last stage with `temperature: None` means "release to schedule" |
| `arrival_exit_grace_minutes` | int | 2 | leaving for less than this does not cancel an arrival stage |
| `comfort_temperature` | float | 26 | written as the zone's default weekly schedule (one block 00:00, `setback_hvac_mode`/`setback_fan_mode`) whenever it changes; this is the "Dial Sync" behaviour |
| `sync_comfort_to_schedule` | bool | true | set false to keep a hand-authored schedule |

Numbers (per zone, settable from dashboards): `number.velair_<zone>_setback_{1,2,3}_minutes`,
`number.velair_<zone>_setback_{1,2,3}_temperature`, `number.velair_<zone>_arrival_{1,2}_minutes`,
`number.velair_<zone>_arrival_1_temperature`, `number.velair_<zone>_comfort_temperature`.
Switch: `switch.velair_<zone>_occupancy_assist`. Sensor `sensor.velair_<zone>_occupancy_assist`
with states `disabled | unavailable | occupied | arriving_1 | comfort | vacant | setback_1 |
setback_2 | setback_3 | blocked` and attributes `occupancy_entity_id`, `occupied_since`,
`vacant_since`, `stage`, `next_stage_at`, `next_temperature`, `blocked_by`, `last_action`,
`last_action_at`.

State machine (evaluate on every relevant change and on timers):

1. Source unavailable/unknown → `unavailable`; apply nothing, release nothing (P5).
2. Occupancy `off` for `stage.after_minutes` (measured from the source's `last_changed`, so a
   restart does not reset the clock) and no blocking entity `on` → hold
   `pause_id=velair_occupancy_setback`, `action=hold`, `constraint=raise_only`,
   `temperature=stage.temperature`, `hvac_mode/fan_mode` from settings, `label="setback stage n"`.
   Replacing the same pause id updates in place (PR-1 semantics). A stage never lowers.
3. Occupancy `on` (+ corroboration if configured) for `arrival_stages[0].after_minutes` →
   hold `pause_id=comfort`, `constraint=lower_only`, `temperature=arrival_1.temperature`; the
   setback hold is **left in place** (fold order makes the later lower-only hold win).
4. Arrival final stage reached → `resume_zone` for pause ids `velair_occupancy_setback`,
   `away_1h`, `away_6h`, `neveroff_recover`, `presleep`, then `comfort` → schedule (= comfort).
5. Occupancy `off` before the final stage: if it stays off longer than
   `arrival_exit_grace_minutes`, release `comfort` (the standing setback returns), else ignore.
6. `enabled` → false: release `velair_occupancy_setback` and `comfort` for the zone, state `disabled`.
7. Manual adjustment active on the zone (override sensor `manual`): no stage is applied or
   released; state keeps counting (attribute `blocked_by: manual`). Guards own manual release.

Events: `velair_event` type `occupancy_assist_state_changed` with `entity_id`, `previous`,
`state`, `stage`, `temperature`, `reason`.

Service: `velair.set_occupancy_assist` (`entity_id`, any settings keys) and the existing
`enable/disable` pattern is not needed — the switch and the WS command are enough.

WS: `velair/update_zone_occupancy_assist` `{entity_id, occupancy_assist: {...}}`; the zone payload
of `velair/get_zone_settings` (or its equivalent) gains `occupancy_assist` and
`velair/get_status` gains `occupancy_assist: {entity_id: status}`.

## 4. House Modes (global + per zone)

Global settings `settings["house_modes"]`:

| key | default | meaning |
|---|---|---|
| `presence_entity_ids` | [] | `person`/`device_tracker`; house is empty when **all** are `not_home` (P5: any `unknown/unavailable` = not empty) |
| `presence_corroboration_entity_ids` | [] | optional "someone is physically here" sensors (e.g. BLE room presence); when non-empty, empty also requires all of them `off` for `presence_corroboration_quiet_minutes` (15) |
| `away_after_minutes` | 60 | stage 1 |
| `away_deep_after_minutes` | 360 | stage 2 (0 disables) |
| `arrival_release_minutes` | 3 | any presence entity `home` for this long releases both away holds on every zone |
| `sleep_entity_id` | None | `input_boolean`/`binary_sensor`; `on` = sleep |
| `presleep_time` | `"21:00"` | optional pre-sleep hold time (`None` disables) |
| `presleep_duration_minutes` | 240 | |
| `travel_entity_id` | None | `on` = travel mode |
| `travel_park_temperature` | 29 | |
| `travel_park_hvac_mode` / `travel_park_fan_mode` | `cool` / `auto` | |
| `travel_freeze_off_heads` | true | heads that are `off` when travel starts get `travel_off` (action none) and stay off until a person turns them on |
| `travel_enable_humidity_assist` | true | calls the existing Humidity Assist enable/disable on entry/exit |
| `travel_auto_exit_on_arrival` | false | when a presence entity turns `home`, velair turns the travel entity off (`homeassistant.turn_off` on that entity — the only non-climate service call allowed, and only on the configured entity) |

Per zone `zones[entity_id]["house_modes"]`:

| key | default | meaning |
|---|---|---|
| `away_enabled` | true | |
| `away_temperature` | 26 | raise-only hold `away_1h` (cool/auto from the zone's setback modes) |
| `away_deep_temperature` | None | raise-only hold `away_6h`; None = zone skipped at stage 2 |
| `sleep_enabled` | true | |
| `sleep_temperature` | 26 | hold `sleep` |
| `sleep_constraint` | `raise_only` | `absolute` for the bedroom that must actually cool |
| `sleep_fan_mode` | None | e.g. `high` for the master bedroom |
| `sleep_minimum_temperature` | None | while asleep the zone's `minimum_temperature` limit (PR-2) is temporarily replaced by this value and restored on wake |
| `presleep_temperature` | None | lower-only hold `presleep` at `presleep_time` (None = skip zone) |
| `travel_park_enabled` | true | |

Numbers: `number.velair_<zone>_away_temperature`, `number.velair_<zone>_away_deep_temperature`,
`number.velair_<zone>_sleep_temperature`, `number.velair_<zone>_sleep_minimum_temperature`,
`number.velair_<zone>_presleep_temperature`; global `number.velair_house_away_after_minutes`,
`number.velair_house_away_deep_after_minutes`, `number.velair_house_arrival_release_minutes`,
`number.velair_travel_park_temperature`. Switches: `switch.velair_house_modes` (master),
`switch.velair_<zone>_away_setback`, `switch.velair_<zone>_sleep_hold`. Sensor
`sensor.velair_house_mode` with states `home | away | away_deep | travel | sleep | disabled`
(travel wins over away, sleep is reported as an attribute `sleeping: true` when combined) and
attributes `empty_since`, `next_stage_at`, `travel_since`, `sleep_since`, `zones_parked`,
`zones_frozen`.

Rules:

- Away stage 1: house empty for `away_after_minutes` → for each enabled zone whose head is not
  `off`, no manual adjustment younger than the Guards lease, and not blocked by its occupancy
  blocking entities: hold `away_1h` raise-only at `away_temperature`. Stage 2 the same with
  `away_6h` at `away_deep_temperature` for zones that have one. Arrival (`arrival_release_minutes`)
  releases both ids on every zone. A zone skipped at stage 1 is retried at stage 2 only.
- Sleep on: hold `sleep` per enabled zone (`sleep_constraint`, `sleep_fan_mode`, `sleep_temperature`,
  hvac from setback mode), apply `sleep_minimum_temperature`, release `presleep`. Zones with an
  active manual adjustment are skipped. Sleep off: release `sleep` everywhere and restore limits.
- Pre-sleep: at `presleep_time` hold `presleep` lower-only for `presleep_duration_minutes` on zones
  with `presleep_temperature`; skipped while travel or house empty.
- Travel on: heads that are `off` **and** in a manual adjustment → `travel_off` (action none,
  indefinite); every other enabled zone → `travel_park` raise-only when the house is empty (re-check
  every 30 min and on every presence change, plus HA start); enable Humidity Assist if configured.
  Travel off: release `travel_park`, keep `travel_off` on heads still `off`, disable Humidity Assist.
  `external_climate_change_detected` with previous `off` → on while `travel_off` exists → release
  `travel_off` and `enter_manual_adjustment`. On → `off` while travel on → `travel_off`.
- Events: `house_mode_changed` (`previous`, `state`, `reason`), `house_zone_parked`.

WS: `velair/update_settings` gains `house_modes`; `velair/update_zone_house_modes`; status gains
`house_mode`.

## 5. Guards

Global `settings["guards"]`:

| key | default | meaning |
|---|---|---|
| `never_off_enabled` | true | |
| `never_off_grace_minutes` | 10 | |
| `never_off_snooze_minutes` | 1440 | |
| `never_off_snooze_release_vacant_minutes` | 30 | zone occupancy `off` this long releases `neveroff_snooze` and `watchdog`; house empty this long releases them everywhere |
| `never_off_respect_travel` | true | no relight while travel is on |
| `manual_release_enabled` | true | |
| `manual_lease_minutes` | 30 | a hand-set value is never released younger than this |
| `manual_release_vacant_minutes` | 60 | credible vacancy (zone occupancy `off`, continuous) that ends a manual adjustment |
| `manual_release_on_travel` | true | travel on releases every manual adjustment older than the lease |
| `owner_entity_ids` | [] | presence entities whose absence enables the sub-floor rule |
| `owner_away_minutes` | 4 | |
| `manual_release_below_minimum` | true | when all owners are away and the live setpoint is below the zone's `minimum_temperature`, release the manual adjustment (velair re-applies ≥ floor) |

Per zone `zones[entity_id]["guards"]`: `never_off_enabled` (true), `activity_holds`: list of
`{entity_id, temperature, constraint (lower_only), hvac_mode (cool), release_delay_minutes (10),
pause_id ("activity"), label}` — the generalized "cooking" rule: entity `on` → hold; entity `off`
for the delay → release (and `resume_automatic_control` only if the manual adjustment is older
than the lease). Numbers: `number.velair_guards_never_off_grace_minutes`,
`number.velair_guards_never_off_snooze_minutes`, `number.velair_guards_manual_lease_minutes`,
`number.velair_guards_manual_release_vacant_minutes`. Switch `switch.velair_guards`. Sensor
`sensor.velair_<zone>_guard` with state `idle | off_grace | snoozed | recovering | manual_watch |
activity_hold` and attributes `grace_ends_at`, `snooze_until`, `manual_since`,
`manual_release_at`, `activity_entity_id`.

Rules:

- Never-off: `external_climate_change_detected` with `current.hvac_mode == off` (or the head found
  `off` at start while no `neveroff_snooze`/`travel_off` pause exists) → wait
  `never_off_grace_minutes`; if still off and no snooze → hold `neveroff_recover` raise-only at
  `max(previous target, zone setback stage 3, minimum_temperature)` then
  `resume_automatic_control` (velair sends mode first). Service `velair.snooze_off`
  (`entity_id`, `duration_minutes` default = snooze setting) → `neveroff_snooze` (action none) +
  `resume_automatic_control`; a snoozed head turned on by a person → release snooze +
  `enter_manual_adjustment`. Event `never_off_grace_started`, `never_off_recovered`,
  `never_off_snoozed` so an HA blueprint can notify and offer the snooze action.
- Manual release: for a zone in manual adjustment, release with `resume_automatic_control` when
  (a) zone occupancy `off` continuously for `manual_release_vacant_minutes` **and** manual age ≥
  lease, or (b) travel turned on and age ≥ lease, or (c) owners away ≥ `owner_away_minutes` and
  setpoint < `minimum_temperature` − 0.31 and age ≥ lease. Restart-safe: the vacancy clock uses
  the occupancy entity's `last_changed`.
- Activity holds as above. Watchdog (futile cooling) is **not** ported; it stays an HA blueprint.

WS: `velair/update_settings` gains `guards`; `velair/update_zone_guards`; status gains `guards`.

## 6. Presence UI (frontend)

New panel view + card view `presence` (add to `VelairPanelView`, `tabs.ts`, `card-context.ts`
`isCardView`, card editor list). Layout: a zone selector (reuse the pattern of the humidity view),
then three sections per zone: **Occupancy** (entity pickers via `ha-entity-picker` /
`ha-selector`, stage editors as rows "after N min → T°", arrival rows, comfort temperature, sync
toggle), **House modes** (per-zone away/sleep/presleep/travel fields) and **Guards** (activity holds
list). A global panel section (house presence entities, away timings, sleep/travel entities,
travel park, never-off and manual release parameters) lives at the top of the view. Every field
writes through the WS commands in §3–§5 with optimistic UI and error toasts like the humidity view.
Show the runtime state chips (`sensor` states above) at the top of each zone. Translations for all
10 frontend languages (English strings; key parity test). Unit tests for the view rendering and
the API client. `npm run test && npx tsc --noEmit && npm run build` green; commit the rebuilt
bundle **only** on this branch.

## 7. Pause ids, precedence and cross-module contract

Holds fold in `started_at` order with their constraints (PR-1). Precedence inside velair:
`turn_off` pause > freeze (`action: none`, incl. the reserved manual adjustment) > holds (folded)
> schedule. Modules coordinate only through these ids:

| pause_id | owner | released by | constraint |
|---|---|---|---|
| `velair_occupancy_setback` | Occupancy Assist | Occupancy Assist arrival final stage; disable | raise_only |
| `comfort` | Occupancy Assist | Occupancy Assist (final stage, exit grace, disable) | lower_only |
| `away_1h`, `away_6h` | House Modes | House Modes arrival; Occupancy Assist final stage | raise_only |
| `travel_park` | House Modes | House Modes travel off | raise_only |
| `travel_off` | House Modes (action none) | House Modes on human turn-on | freeze |
| `neveroff_snooze` | Guards (action none, timed) | expiry; Guards vacancy/house-empty release; human turn-on | freeze |
| `neveroff_recover` | Guards | Occupancy Assist final stage | raise_only |
| `presleep` | House Modes (timed) | House Modes sleep on/off; Occupancy Assist final stage; expiry | lower_only |
| `sleep` | House Modes | House Modes sleep off | absolute or raise_only |
| `activity` (configurable) | Guards | Guards | lower_only |
| `watchdog` | external (HA blueprint) | expiry; Guards vacancy release | raise_only |
| `velair.manual_adjustment` | velair policy | Guards manual release; never-off paths | freeze |

Everything a module needs from another module is read from velair state (override sensor
attributes, `get_zone_override_status`, pause ids), never from HA helpers.

## 8. Reference-home mapping (for the configuration script, not for the code)

| reference helper | module setting |
|---|---|
| `binary_sensor.<room>_occupied_for_climate` | `occupancy_entity_id` |
| `clim_<room>_stage{1,2,3}_{min,temp}` | `setback_stages` |
| `clim_<room>_comfort1_{min,temp}`, `comfort2_min`, `comfort2` | `arrival_stages`, `comfort_temperature` |
| `clim_<room>_sleep_temp`, `clim_master_floor_sleep` | `sleep_temperature`, `sleep_minimum_temperature` (master `sleep_constraint: absolute`, `sleep_fan_mode: high`) |
| stage-3 temp, `clim_hold_away_deep` | `away_temperature`, `away_deep_temperature` (K/G/B/L only) |
| `input_boolean.sleep_mode`, `climate_travel_mode`, `travel_auto_exit_on_arrival` | `sleep_entity_id`, `travel_entity_id`, `travel_auto_exit_on_arrival` |
| `travel_rest_temperature` | `travel_park_temperature` |
| trackers Izzat/Marianne + Bermuda | `presence_entity_ids`, `presence_corroboration_entity_ids`, `owner_entity_ids` |
| den projector, `guest_mode`, `sleep_mode`+bed | `blocking_entity_ids` |
| `kitchen_cooking_mode` | `activity_holds` on the kitchen zone (25, lower_only, 10 min) |
| never-off 10 min / 24 h / 30 min | guards numbers |
| Manual-Respect 30 min / 60 min / owner-away 4 min | guards numbers |
