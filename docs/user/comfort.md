# Environmental Comfort

The default comfortable temperature range is `20–24 °C` or the practical
whole-degree default `68–75 °F` for Fahrenheit installations.

Comfort thresholds use Home Assistant's configured temperature unit and migrate
or import with the rest of Velair's stored thermal data. A temperature sensor
that declares the other unit is converted before its reading is compared with
the managed climate's Comfort thresholds.

Environmental Comfort gives each managed climate a readable description of the room instead of a generic warning level.

It monitors locally available temperature, humidity, and CO2 readings. It does not change schedules or control devices automatically. Velair exposes the assessment in the panel, Lovelace cards, and Home Assistant events so automations can decide what to do.

## Sources

Temperature uses the first available source in this order:

1. the temperature sensor selected in the Comfort tab;
2. the Room Assist sensor configured for that climate;
3. the climate entity's `current_temperature`.

Humidity uses:

1. the humidity sensor selected in the Comfort tab;
2. the climate entity's `current_humidity` or `humidity` attribute, when available.

The default `Use automatic source` option keeps this automatic behavior. Select `Do not monitor humidity` when humidity should not influence that climate's environmental condition or data quality. The saved sensor selection is retained, but Velair does not read or listen to it while humidity monitoring is disabled.

CO2 is monitored only when a CO2 sensor is selected.

The effective entity ID appears below every selector. Optional metrics without a source are not treated as failures.

## Environmental Conditions

Temperature and humidity are classified against the configured ranges and combined into one human-readable condition:

| Temperature | Humidity | Condition |
| --- | --- | --- |
| Below range | Below range | `Cold and dry` |
| Below range | In range | `Cold` |
| Below range | Above range | `Cold and humid` |
| In range | Below range | `Dry air` |
| In range | In range | `Comfortable` |
| In range | Above range | `Humid` |
| Above range | Below range | `Hot and dry` |
| Above range | In range | `Hot` |
| Above range | Above range | `Hot and humid` |

When only one useful metric is available, Velair reports what it can establish without claiming full comfort:

- `Temperature in range`;
- `Humidity in range`;
- `Cold`, `Hot`, `Dry air`, or `Humid`.

If no useful environmental reading exists, the condition is shown as `No readings`. When every monitored source is stale, it is shown as `Readings outdated`.

## Air Quality

CO2 remains separate from temperature and humidity because it describes air quality rather than thermal comfort:

- `Good air`: below the attention threshold;
- `CO2 elevated`: at or above the attention threshold;
- `Poor air quality`: at or above the poor threshold;
- `CO2 unavailable`: a configured CO2 source cannot currently be read.

A room can therefore show, for example, `Hot and humid` together with `CO2 elevated`.

## Data Quality

Velair exposes one data-quality value:

- `complete`: every monitored metric has a current reading;
- `partial`: an assessment is available, but at least one monitored reading is missing or stale;
- `stale`: no current reading exists and every monitored source is stale;
- `unavailable`: no current reading can be used for another reason.

The interface shows a compact warning icon for non-complete data. Its tooltip identifies the affected readings.

## Visual Status

The collapsed climate row shows:

- the environmental condition;
- air quality when CO2 is monitored;
- a warning icon when readings are incomplete;
- the Comfort on/off switch.

The expanded live status uses:

- a temperature/humidity map when both readings are current;
- a single horizontal scale when only temperature or humidity is current;
- a separate CO2 scale when CO2 is monitored and current.

The temperature/humidity map uses nine subtle regions for the cold, hot, dry, humid, and combined conditions. The highlighted center is the configured comfort range. A small marker shows the current position and its label contains both readings.

On single-metric scales, the center green section is the configured comfort range. Its minimum and maximum labels align with the beginning and end of that section; the outer sections provide context for readings below or above the range.

## Lovelace

The Comfort view is available as a Lovelace card:

```yaml
type: custom:velair-card
view: comfort
```

The card can be limited to selected managed climates:

```yaml
type: custom:velair-card
view: comfort
entities:
  - climate.living_room
  - climate.bedroom
```

It can also hide local UI sections when a dashboard should focus only on the
readings you care about:

```yaml
type: custom:velair-card
view: comfort
show_comfort_configuration: false
show_comfort_temperature: true
show_comfort_humidity: false
show_comfort_co2: true
```

Omitted `show_comfort_*` options default to `true`.

Temperature, humidity, and CO2 visibility options only affect the graphs shown
in that Lovelace card. They do not change the Comfort configuration, source
selection, thresholds, automation events, or Home Assistant sensors. If both
temperature and humidity are visible but only one current reading exists, the
card falls back to the same single-metric scale used by the main Velair panel.

## Freshness

`Stale after` is the maximum age of the Home Assistant `last_updated` timestamp used by a monitored source.

Velair does not poll sensors and does not run an expiry loop. It reevaluates Comfort when a tracked entity changes, settings change, or the current state is requested.

Repeating the same displayed value only refreshes the reading if Home Assistant advances `last_updated` and exposes a state change. Some integrations keep `last_updated` unchanged when both state and attributes are identical.

## Automation Event

When the environmental condition, air quality, data quality, or data issues change, Velair emits:

```yaml
event_type: velair_event
event_data:
  event: comfort_assessment_changed
```

Example payload:

```json
{
  "domain": "velair",
  "event": "comfort_assessment_changed",
  "entity_id": "climate.living_room",
  "condition": "cold_and_humid",
  "air_quality": "elevated",
  "data_quality": "complete",
  "data_issues": [],
  "temperature": {
    "metric": "temperature",
    "availability": "current",
    "condition": "cold",
    "source": "sensor",
    "entity_id": "sensor.living_room_temperature",
    "value": 18.7,
    "min": 20.0,
    "max": 24.0
  },
  "humidity": {
    "metric": "humidity",
    "availability": "current",
    "condition": "humid",
    "source": "sensor",
    "entity_id": "sensor.living_room_humidity",
    "value": 68,
    "min": 40,
    "max": 60
  },
  "co2": {
    "metric": "co2",
    "availability": "current",
    "condition": "elevated",
    "source": "sensor",
    "entity_id": "sensor.living_room_co2",
    "value": 1200,
    "attention": 1000,
    "max": 1500
  }
}
```

Example automation:

```yaml
automation:
  - alias: "Velair poor air quality"
    triggers:
      - trigger: event
        event_type: velair_event
        event_data:
          event: comfort_assessment_changed
          air_quality: poor
    actions:
      - action: notify.mobile_app_phone
        data:
          message: >
            Poor air quality in {{ trigger.event.data.entity_id }}:
            {{ trigger.event.data.co2.value | round(0) }} ppm
```

Opening or refreshing the panel does not emit an automation event, and changes to a numeric value inside the same condition do not emit duplicates.

See [Automation Events](automation-events.md#comfort-assessment-changed) for a
complete payload and the shared `velair_event` trigger pattern.

## Performance And Privacy

Comfort is disabled by default.

When disabled for a climate, Velair registers no Comfort listeners for that climate. When enabled, it listens only to the managed climate and the selected or automatically resolved sensor entities. There is no continuous polling.

All readings and assessments remain local inside Home Assistant.
