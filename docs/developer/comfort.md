# Environmental Comfort Internals

Environmental Comfort converts local Home Assistant readings into three independent concepts:

- `condition`: combined temperature and humidity condition;
- `air_quality`: CO2 assessment;
- `data_quality`: completeness and freshness of monitored readings.

User-facing behavior and automation examples are documented in [Environmental Comfort](../user/comfort.md).

## Scope

Comfort is monitoring-only. It does not apply climate actions, change schedules, pause zones, or select HVAC options.

## Storage

Only settings are persisted under `zones[entity_id].comfort`:

```json
{
  "enabled": false,
  "temperature_entity_id": null,
  "humidity_enabled": true,
  "humidity_entity_id": null,
  "co2_entity_id": null,
  "temperature_min": 20.0,
  "temperature_max": 24.0,
  "humidity_min": 40.0,
  "humidity_max": 60.0,
  "co2_attention": 1000,
  "co2_poor": 1500,
  "stale_after_minutes": 120
}
```

Assessments are derived at runtime and are not stored as history.

`temperature_min` and `temperature_max` are absolute temperatures stored in the
recorded runtime unit. Unit migration and portable import convert both values;
editable Comfort thresholds use the feature's valid half-degree grid after
conversion. Humidity and CO2 thresholds are unit-independent and are not part of
temperature conversion.

Temperature readings from external sensors are converted from their declared
unit to the managed climate/Home Assistant temperature unit before assessment.
The climate entity's own `current_temperature` is already at that runtime
boundary and is not converted again.

## Metric Contract

Each metric payload contains:

```json
{
  "metric": "temperature",
  "availability": "current",
  "condition": "comfortable",
  "source": "sensor",
  "entity_id": "sensor.living_room_temperature",
  "value": 22.0,
  "min": 20.0,
  "max": 24.0
}
```

`availability` is one of:

- `current`;
- `missing`;
- `stale`;
- `not_monitored`.

Temperature conditions are `cold`, `comfortable`, or `hot`.

Humidity conditions are `dry`, `comfortable`, or `humid`.

CO2 conditions are `good`, `elevated`, or `poor`.

`condition` is `null` unless availability is `current`.

## Environmental Condition

Current temperature and humidity conditions are combined:

| Temperature | Humidity | Result |
| --- | --- | --- |
| `cold` | `dry` | `cold_and_dry` |
| `cold` | `comfortable` | `cold` |
| `cold` | `humid` | `cold_and_humid` |
| `comfortable` | `dry` | `dry` |
| `comfortable` | `comfortable` | `comfortable` |
| `comfortable` | `humid` | `humid` |
| `hot` | `dry` | `hot_and_dry` |
| `hot` | `comfortable` | `hot` |
| `hot` | `humid` | `hot_and_humid` |

When only one metric is current:

- an in-range temperature becomes `temperature_comfortable` if humidity is monitored but unavailable;
- an in-range humidity becomes `humidity_comfortable`;
- an out-of-range metric keeps its specific `cold`, `hot`, `dry`, or `humid` condition.

When humidity is not monitored, an in-range temperature can produce `comfortable`.

If neither temperature nor humidity is current, the result is `no_readings`.

## Air Quality

Top-level `air_quality` mirrors the useful CO2 assessment:

- `not_monitored`;
- `unavailable`;
- `good`;
- `elevated`;
- `poor`.

It remains separate from the environmental condition so combinations do not grow into ambiguous states.

## Data Quality

`data_quality` is calculated over monitored metrics:

1. `stale` when no current metric exists and every monitored metric is stale;
2. `unavailable` when no current metric exists for any other reason;
3. `partial` when at least one metric is current and another monitored metric is missing or stale;
4. `complete` when every monitored metric is current.

`data_issues` contains machine-readable identifiers:

- `temperature_missing`;
- `temperature_stale`;
- `humidity_missing`;
- `humidity_stale`;
- `co2_missing`;
- `co2_stale`.

Optional humidity and CO2 sources with `availability: not_monitored` do not create data issues. Automatic climate humidity is considered monitored when the climate exposes either `current_humidity` or `humidity`, even if its current value is temporarily unreadable.

When `humidity_enabled` is false, humidity always returns `availability: not_monitored`. Its configured entity ID and thresholds remain persisted, but the source is excluded from listener registration, assessment calculation, and data quality.

## Freshness

Staleness uses:

```text
now - state.last_updated > stale_after_minutes
```

States without `last_updated` are treated as current for compatibility with test fakes.

There is no polling or expiry timer. Reevaluation happens after tracked state changes, Comfort setting changes, and API assessment reads.

## Runtime Listener

The scheduler registers `async_track_state_change_event` only for entities that can affect enabled Comfort zones:

- the managed climate;
- configured temperature, humidity, and CO2 sensors;
- the Room Assist sensor when used as the automatic temperature source.

When no zone has Comfort enabled, the listener is removed.

## API Response

`velair/get_schedule` includes:

```json
{
  "comfort": {
    "climate.living_room": {
      "enabled": true,
      "condition": "comfortable",
      "air_quality": "good",
      "data_quality": "complete",
      "data_issues": [],
      "temperature": {},
      "humidity": {},
      "co2": {}
    }
  }
}
```

Settings are updated through `velair/update_zone_comfort`.

## Automation Event

The scheduler emits `comfort_assessment_changed` when any of these change:

- `condition`;
- `air_quality`;
- `data_quality`;
- `data_issues`.

The event contains the complete current metric payloads. Numeric changes that remain inside the same assessment update the frontend state but do not emit an automation event.

Opening or refreshing the panel does not emit events.

The public payload contract and example are in
[Automation Events](../user/automation-events.md#comfort-assessment-changed).

## Frontend Projection

The frontend does not recalculate conditions.

It uses backend-provided assessment fields and only calculates visual marker positions:

- temperature and humidity use a range with one configured-range span of context on either side;
- marker positions are clamped to the visible plot;
- the two-dimensional map uses a nine-region projection and a compact marker with a separate value label;
- CO2 uses its attention and poor thresholds for the scale;
- when both environmental metrics are current, the UI renders a two-dimensional map;
- when only one is current, it renders a one-dimensional scale.
