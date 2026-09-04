# Occupancy setback ladder blueprint changelog

## 1.0.0 - Velair 1.8.0

- Initial public version.
- Applies up to three Velair zone holds after a room has been empty for
  configurable times, using one owned pause ID that later stages update in
  place, and releases that hold when the room is occupied again.
- Optional helper entities override the stage minutes and temperatures so a
  dashboard slider can tune the ladder without editing the automation.
- Blocking entities, an occupied delay, an availability warning, and
  age-based reconciliation after Home Assistant starts or after Velair
  resumes the zone, without polling.
