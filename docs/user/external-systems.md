# External schedule execution

Velair normally owns both schedule storage and climate execution. For compatible
climates, **Settings → External systems** can instead publish the effective
weekly schedule to a controller that executes it independently.

The section is shown when Velair detects a supported Home Assistant integration
with a compatible managed climate, or when a zone already has an external owner.
Choose the external system for a zone to persist external ownership before
Velair uploads the full week. A failed upload does not restore local execution:
the zone remains external
and shows the publication error so two schedulers never compete.
After a successful Home Assistant service call, Velair reports the schedule as
published: this means the external integration accepted the request. Velair
does not claim whether the physical controller has applied it.

External execution is deliberately schedule-only. Velair does not send any
climate action to an external zone, including startup/current schedule delivery,
Boost, pause/resume, Manual adjustment, Room Assist, or adaptive preconditioning.
Profiles and Modes are supported only as schedule selection: `normal` publishes
the zone's Default week and `schedule` publishes the Profile week. Pause behavior
is unavailable for external zones. Selecting Default, a Profile, or a Mode, and
editing an active Profile, publishes the newly effective full week after the
selection has been persisted. A publication failure does not undo the global
Profile or Mode selection and does not affect local zones.
Selecting Default, a Profile, or a Mode again also starts one new publication
when the current runtime state is `failed` or has no successful publication.
Velair does not retry automatically; this publication is caused only by the
explicit selection.

## Evohome via ramses_cc

The first supported system uses the `ramses_cc.set_zone_schedule` Home Assistant
service. Velair has no Python dependency on `ramses_cc` and communicates only
through Home Assistant services.

Settings and the Profile editor derive these conditions from the controller capabilities and list
them once under the external controller, even when several zones use it.
Current limits:

- heating schedules with one scalar setpoint per switchpoint;
- exactly seven weekdays, preserving Velair's weekly continuity;
- no turn-off blocks, temperature ranges, cooling modes, or climate options;
- at most six translated switchpoints per day;
- when the first block starts after `00:00`, Velair inserts a midnight
  continuity switchpoint and that implicit change counts toward the daily
  maximum;
- times on the controller's 5-minute grid;
- temperatures are converted to Celsius for the controller payload.

Detection requires the set-schedule service, a loaded `ramses_cc` config entry,
and a managed `climate` entity that advertises heating and scalar-temperature
support. Home Assistant's public entity metadata does not distinguish every
Evohome zone from every other `ramses_cc` climate. The service call is therefore
the final compatibility check, and an error is kept as a visible publication
failure.

This integration path has been developed with automated service simulations.
Real Evohome/ramses_cc feedback is important before treating the behavior as
fully validated on hardware.

Publication has only three runtime states: **publishing**, **published**, and
**failed**. Before the first publication in the current Home Assistant runtime,
there is no publication state. The state is not persisted and is independent
from whether the provider is currently available.

Velair does not call `get_zone_schedule`, add delays, retry automatically, or poll. Those
mechanisms would still not let Velair make a provider-neutral claim about what
physical hardware is executing.
