"""Scheduler application, override, service, and portability behavior tests."""

from __future__ import annotations

import asyncio
from datetime import datetime, timedelta, timezone
from types import SimpleNamespace
import unittest
from unittest.mock import Mock

from .helpers import (
    ACTION_SET_TEMPERATURE,
    ACTION_TURN_OFF,
    DEFAULT_PRECONDITIONING_MAX_LEAD_MINUTES,
    DEFAULT_SCHEDULE_TEMPLATES_VERSION,
    EVENT_TYPE_BOOST_ENDED,
    EVENT_TYPE_BOOST_STARTED,
    EVENT_TYPE_CLIMATE_TARGET_APPLIED,
    EVENT_TYPE_COMFORT_ASSESSMENT_CHANGED,
    EVENT_TYPE_PRECONDITIONING_OBSERVATION_RECORDED,
    EVENT_TYPE_PRECONDITIONING_PLAN_CANCELLED,
    EVENT_TYPE_PRECONDITIONING_PLAN_UPDATED,
    EVENT_TYPE_ROOM_SENSOR_ASSIST_RESTORED,
    EVENT_TYPE_ROOM_SENSOR_ASSIST_STATE_CHANGED,
    EVENT_TYPE_ROOM_SENSOR_ASSIST_UPDATED,
    EVENT_TYPE_SCHEDULER_MODE_CHANGED,
    EVENT_TYPE_ZONE_PAUSED,
    EVENT_TYPE_ZONE_RESUMED,
    EVENT_VELAIR,
    FakeClimateManager,
    FakeHass,
    MODE_AUTO,
    MODE_PAUSED,
    NOW,
    VelairScheduler,
    ZONE_PAUSE_ACTION_TURN_OFF,
    empty_week_schedule,
    normalize_schedule_data,
    normalize_panel_settings,
    normalize_preconditioning_data,
    scheduler_module,
)


def _preconditioning_sample(
    mode: str,
    quality: str,
    minutes: int,
    *,
    delta_t: float = 3,
    created_at: str = "2026-05-19T19:00:00+00:00",
) -> dict[str, object]:
    """Return one stored adaptive preconditioning sample."""
    reached = quality == "complete"
    target_temp = 21.0 if mode == "heat" else 23.0
    initial_temp = target_temp - delta_t if mode == "heat" else target_temp + delta_t
    return {
        "entity_id": "climate.salon",
        "mode": mode,
        "created_at": created_at,
        "scheduled_time": "2026-05-19T20:00:00+00:00",
        "start_time": "2026-05-19T18:00:00+00:00",
        "target_temp": target_temp,
        "initial_temp": initial_temp,
        "observed_temp": target_temp,
        "outdoor_temp_start": None,
        "outdoor_temp_target": None,
        "delta_t": delta_t,
        "startup_minutes": minutes,
        "reached": reached,
        "minutes_to_reach": minutes if reached else None,
        "quality": quality,
    }


def _preconditioning_learning(
    samples: list[dict[str, object]],
) -> dict[str, dict[str, list[dict[str, object]]]]:
    """Return stored learning data split by preconditioning direction."""
    return {
        "heat": {
            "observations": [
                sample for sample in samples if sample.get("mode") == "heat"
            ]
        },
        "cool": {
            "observations": [
                sample for sample in samples if sample.get("mode") == "cool"
            ]
        },
    }


def _stored_preconditioning_observations(
    data: dict[str, object],
    entity_id: str,
    direction: str,
) -> list[dict[str, object]]:
    """Return stored observations for one scheduler test direction."""
    return (
        data.get("preconditioning_learning", {})
        .get(entity_id, {})
        .get(direction, {})
        .get("observations", [])
    )


class VelairSchedulerComfortTest(unittest.IsolatedAsyncioTestCase):
    """Verify local comfort monitoring status and events."""

    def setUp(self) -> None:
        self.entity_id = "climate.salon"
        self.hass = FakeHass()
        self.climate = FakeClimateManager()
        self.save_count = 0
        self.data = normalize_schedule_data(
            {
                "zones": {
                    self.entity_id: {
                        "enabled": True,
                        "schedule": empty_week_schedule(),
                    }
                }
            },
            [self.entity_id],
        )
        self.scheduler = VelairScheduler(
            self.hass,
            self.data,
            self.climate,
            self._async_save,
        )

    async def _async_save(self) -> None:
        self.save_count += 1

    async def test_comfort_assessment_uses_climate_and_configured_sensors(self) -> None:
        self.hass.states[self.entity_id] = SimpleNamespace(
            state="heat",
            attributes={"current_temperature": 22, "current_humidity": 45},
        )
        self.hass.states["sensor.salon_co2"] = SimpleNamespace(
            state="850",
            attributes={},
        )
        await self.scheduler.async_update_zone_comfort(
            self.entity_id,
            {
                "enabled": True,
                "co2_entity_id": "sensor.salon_co2",
                "temperature_min": 20,
                "temperature_max": 24,
                "humidity_min": 40,
                "humidity_max": 60,
                "co2_attention": 1000,
                "co2_poor": 1500,
            },
        )

        assessment = self.scheduler.get_comfort_assessments()[self.entity_id]

        self.assertEqual(assessment["condition"], "comfortable")
        self.assertEqual(assessment["air_quality"], "good")
        self.assertEqual(assessment["data_quality"], "complete")
        self.assertEqual(assessment["data_issues"], [])
        self.assertEqual(assessment["temperature"]["value"], 22.0)
        self.assertEqual(assessment["humidity"]["value"], 45.0)
        self.assertEqual(assessment["co2"]["value"], 850.0)

    async def test_comfort_listener_tracks_only_enabled_zones(self) -> None:
        self.hass.states[self.entity_id] = SimpleNamespace(
            state="heat",
            attributes={"current_temperature": 22},
        )

        self.assertEqual(self.scheduler._comfort_candidate_entities(), set())

        await self.scheduler.async_update_zone_comfort(
            self.entity_id,
            {
                "enabled": True,
                "temperature_entity_id": "sensor.salon_temperature",
            },
        )

        self.assertEqual(
            self.scheduler._comfort_candidate_entities(),
            {self.entity_id, "sensor.salon_temperature"},
        )

    async def test_comfort_ignores_disabled_humidity_source(self) -> None:
        self.hass.states[self.entity_id] = SimpleNamespace(
            state="heat",
            attributes={"current_temperature": 22, "current_humidity": 75},
        )
        await self.scheduler.async_update_zone_comfort(
            self.entity_id,
            {
                "enabled": True,
                "humidity_enabled": False,
                "humidity_entity_id": "sensor.salon_humidity",
            },
        )

        assessment = self.scheduler.get_comfort_assessments()[self.entity_id]

        self.assertEqual(assessment["condition"], "comfortable")
        self.assertEqual(
            assessment["humidity"]["availability"],
            "not_monitored",
        )
        self.assertEqual(assessment["data_quality"], "complete")
        self.assertNotIn(
            "sensor.salon_humidity",
            self.scheduler._comfort_candidate_entities(),
        )

    async def test_comfort_assessment_change_fires_automation_event(self) -> None:
        self.hass.states["sensor.salon_temperature"] = SimpleNamespace(
            state="22",
            attributes={},
        )
        await self.scheduler.async_update_zone_comfort(
            self.entity_id,
            {
                "enabled": True,
                "temperature_entity_id": "sensor.salon_temperature",
                "temperature_min": 20,
                "temperature_max": 24,
            },
        )
        self.hass.bus.events.clear()

        self.hass.states["sensor.salon_temperature"] = SimpleNamespace(
            state="26",
            attributes={},
        )
        self.scheduler._handle_comfort_state_change(
            SimpleNamespace(data={"entity_id": "sensor.salon_temperature"})
        )

        self.assertEqual(len(self.hass.bus.events), 1)
        event_type, event_data = self.hass.bus.events[0]
        self.assertEqual(event_type, EVENT_VELAIR)
        self.assertEqual(
            event_data["event"],
            EVENT_TYPE_COMFORT_ASSESSMENT_CHANGED,
        )
        self.assertEqual(event_data["entity_id"], self.entity_id)
        self.assertEqual(event_data["condition"], "hot")
        self.assertEqual(event_data["air_quality"], "not_monitored")
        self.assertEqual(event_data["data_quality"], "complete")
        self.assertEqual(event_data["data_issues"], [])

    async def test_comfort_event_reports_partial_assessment_when_sensor_is_missing(self) -> None:
        self.hass.states[self.entity_id] = SimpleNamespace(
            state="heat",
            attributes={"current_temperature": 22},
        )
        self.hass.states["sensor.salon_humidity"] = SimpleNamespace(
            state="45",
            attributes={},
        )
        await self.scheduler.async_update_zone_comfort(
            self.entity_id,
            {
                "enabled": True,
                "humidity_entity_id": "sensor.salon_humidity",
                "temperature_min": 20,
                "temperature_max": 24,
                "humidity_min": 40,
                "humidity_max": 60,
            },
        )
        self.hass.bus.events.clear()

        del self.hass.states["sensor.salon_humidity"]
        self.scheduler._handle_comfort_state_change(
            SimpleNamespace(data={"entity_id": "sensor.salon_humidity"})
        )

        self.assertEqual(len(self.hass.bus.events), 1)
        _, event_data = self.hass.bus.events[0]
        self.assertEqual(
            event_data["event"],
            EVENT_TYPE_COMFORT_ASSESSMENT_CHANGED,
        )
        self.assertEqual(event_data["condition"], "temperature_comfortable")
        self.assertEqual(event_data["data_quality"], "partial")
        self.assertEqual(event_data["data_issues"], ["humidity_missing"])

    async def test_comfort_uses_current_humidity_when_temperature_is_missing(self) -> None:
        self.hass.states[self.entity_id] = SimpleNamespace(
            state="heat",
            attributes={"current_humidity": 45},
        )
        await self.scheduler.async_update_zone_comfort(
            self.entity_id,
            {
                "enabled": True,
                "temperature_min": 20,
                "temperature_max": 24,
                "humidity_min": 40,
                "humidity_max": 60,
            },
        )

        assessment = self.scheduler.get_comfort_assessments()[self.entity_id]

        self.assertEqual(assessment["condition"], "humidity_comfortable")
        self.assertEqual(assessment["temperature"]["availability"], "missing")
        self.assertEqual(assessment["humidity"]["condition"], "comfortable")
        self.assertEqual(assessment["data_quality"], "partial")
        self.assertEqual(
            assessment["data_issues"],
            ["temperature_missing"],
        )

    async def test_comfort_uses_climate_humidity_attribute(self) -> None:
        self.hass.states[self.entity_id] = SimpleNamespace(
            state="heat",
            attributes={"current_temperature": 22, "humidity": 45},
        )
        await self.scheduler.async_update_zone_comfort(
            self.entity_id,
            {"enabled": True},
        )

        assessment = self.scheduler.get_comfort_assessments()[self.entity_id]

        self.assertEqual(assessment["condition"], "comfortable")
        self.assertEqual(assessment["humidity"]["availability"], "current")
        self.assertEqual(assessment["humidity"]["value"], 45.0)
        self.assertEqual(assessment["data_quality"], "complete")

    async def test_comfort_marks_exposed_non_numeric_humidity_as_missing(self) -> None:
        self.hass.states[self.entity_id] = SimpleNamespace(
            state="heat",
            attributes={
                "current_temperature": 22,
                "current_humidity": "unknown",
            },
        )
        await self.scheduler.async_update_zone_comfort(
            self.entity_id,
            {"enabled": True},
        )

        assessment = self.scheduler.get_comfort_assessments()[self.entity_id]

        self.assertEqual(assessment["condition"], "temperature_comfortable")
        self.assertEqual(assessment["humidity"]["availability"], "missing")
        self.assertEqual(assessment["data_quality"], "partial")
        self.assertEqual(assessment["data_issues"], ["humidity_missing"])

    async def test_comfort_has_no_readings_when_all_sources_are_stale(self) -> None:
        original_now = scheduler_module.dt_util.now
        now = datetime(2026, 7, 8, 18, 0, tzinfo=timezone.utc)
        scheduler_module.dt_util.now = lambda: now
        self.addCleanup(setattr, scheduler_module.dt_util, "now", original_now)
        stale_updated = now - timedelta(minutes=121)
        self.hass.states[self.entity_id] = SimpleNamespace(
            state="heat",
            attributes={"current_humidity": 45},
            last_updated=stale_updated,
        )
        await self.scheduler.async_update_zone_comfort(
            self.entity_id,
            {
                "enabled": True,
                "stale_after_minutes": 120,
            },
        )

        assessment = self.scheduler.get_comfort_assessments()[self.entity_id]

        self.assertEqual(assessment["condition"], "no_readings")
        self.assertEqual(assessment["temperature"]["availability"], "stale")
        self.assertEqual(assessment["humidity"]["availability"], "stale")
        self.assertEqual(assessment["data_quality"], "stale")
        self.assertEqual(
            assessment["data_issues"],
            ["humidity_stale", "temperature_stale"],
        )

    async def test_comfort_value_change_refreshes_state_without_automation_event(self) -> None:
        original_dispatcher = scheduler_module.async_dispatcher_send
        dispatcher = Mock()
        scheduler_module.async_dispatcher_send = dispatcher
        self.addCleanup(
            setattr,
            scheduler_module,
            "async_dispatcher_send",
            original_dispatcher,
        )
        self.hass.states["sensor.salon_humidity"] = SimpleNamespace(
            state="40",
            attributes={},
        )
        await self.scheduler.async_update_zone_comfort(
            self.entity_id,
            {
                "enabled": True,
                "humidity_entity_id": "sensor.salon_humidity",
                "humidity_min": 40,
                "humidity_max": 60,
            },
        )
        self.hass.bus.events.clear()
        dispatcher.reset_mock()

        self.hass.states["sensor.salon_humidity"] = SimpleNamespace(
            state="45",
            attributes={},
        )
        self.scheduler._handle_comfort_state_change(
            SimpleNamespace(data={"entity_id": "sensor.salon_humidity"})
        )

        dispatcher.assert_called_once()
        self.assertEqual(self.hass.bus.events, [])
        assessment = self.scheduler.get_comfort_assessments()[self.entity_id]
        self.assertEqual(assessment["condition"], "humidity_comfortable")
        self.assertEqual(assessment["humidity"]["value"], 45.0)

    def test_comfort_combines_temperature_and_humidity_conditions(self) -> None:
        combinations = {
            ("cold", "dry"): "cold_and_dry",
            ("cold", "comfortable"): "cold",
            ("cold", "humid"): "cold_and_humid",
            ("comfortable", "dry"): "dry",
            ("comfortable", "comfortable"): "comfortable",
            ("comfortable", "humid"): "humid",
            ("hot", "dry"): "hot_and_dry",
            ("hot", "comfortable"): "hot",
            ("hot", "humid"): "hot_and_humid",
        }

        for (temperature, humidity), expected in combinations.items():
            with self.subTest(temperature=temperature, humidity=humidity):
                condition = self.scheduler._comfort_environment_condition(
                    {
                        "availability": "current",
                        "condition": temperature,
                    },
                    {
                        "availability": "current",
                        "condition": humidity,
                    },
                )
                self.assertEqual(condition, expected)

    async def test_comfort_reports_each_air_quality_level(self) -> None:
        self.hass.states[self.entity_id] = SimpleNamespace(
            state="heat",
            attributes={"current_temperature": 22},
        )
        self.hass.states["sensor.salon_co2"] = SimpleNamespace(
            state="850",
            attributes={},
        )
        await self.scheduler.async_update_zone_comfort(
            self.entity_id,
            {
                "enabled": True,
                "co2_entity_id": "sensor.salon_co2",
                "co2_attention": 1000,
                "co2_poor": 1500,
            },
        )

        for value, expected in ((850, "good"), (1200, "elevated"), (1700, "poor")):
            with self.subTest(value=value):
                self.hass.states["sensor.salon_co2"] = SimpleNamespace(
                    state=str(value),
                    attributes={},
                )
                assessment = self.scheduler.get_comfort_assessments()[self.entity_id]
                self.assertEqual(assessment["air_quality"], expected)

    async def test_comfort_enable_preserves_existing_sensor_config(self) -> None:
        await self.scheduler.async_update_zone_comfort(
            self.entity_id,
            {
                "enabled": False,
                "temperature_entity_id": "sensor.salon_temperature",
                "humidity_entity_id": "sensor.salon_humidity",
                "co2_entity_id": "sensor.salon_co2",
            },
        )

        settings = await self.scheduler.async_update_zone_comfort(
            self.entity_id,
            {"enabled": True},
        )

        self.assertTrue(settings["enabled"])
        self.assertTrue(settings["humidity_enabled"])
        self.assertEqual(settings["temperature_entity_id"], "sensor.salon_temperature")
        self.assertEqual(settings["humidity_entity_id"], "sensor.salon_humidity")
        self.assertEqual(settings["co2_entity_id"], "sensor.salon_co2")


class VelairSchedulerSavedScheduleTest(unittest.IsolatedAsyncioTestCase):
    """Verify when saved schedules should be applied immediately."""

    def setUp(self) -> None:
        self.entity_id = "climate.salon"
        self.hass = FakeHass()
        self.climate = FakeClimateManager()
        self.save_count = 0
        self.data = self._make_data()
        self.scheduler = VelairScheduler(
            self.hass,
            self.data,
            self.climate,
            self._async_save,
        )

    async def _async_save(self) -> None:
        self.save_count += 1

    def _make_data(self, mode: str = MODE_AUTO):
        return {
            "version": 1,
            "global_": {
                "mode": mode,
                "paused_until": None,
                "paused_started_at": None,
            },
            "zones": {
                self.entity_id: {
                    "enabled": True,
                    "schedule": empty_week_schedule(),
                    "override": None,
                }
            },
            "settings": normalize_panel_settings(None, [self.entity_id]),
            "templates": [],
            "templates_seeded": True,
        }

    async def test_temperature_migration_blocks_mode_changes_before_side_effects(
        self,
    ) -> None:
        self.scheduler._room_sensor_assist_states[self.entity_id] = object()
        self.scheduler.set_temperature_migration_blocked(True)

        for mode, apply_current_schedule in (
            (MODE_PAUSED, False),
            (MODE_AUTO, True),
        ):
            with self.subTest(mode=mode):
                with self.assertRaisesRegex(ValueError, "Temperature migration"):
                    await self.scheduler.async_set_mode(
                        mode,
                        apply_current_schedule=apply_current_schedule,
                    )

        self.assertEqual(self.data["global_"]["mode"], MODE_AUTO)
        self.assertEqual(self.climate.calls, [])
        self.assertEqual(self.save_count, 0)
        self.assertIn(self.entity_id, self.scheduler._room_sensor_assist_states)

    async def test_queued_timer_does_not_apply_after_migration_block(self) -> None:
        self.data["zones"][self.entity_id]["schedule"]["tuesday"] = [
            {
                "start": "18:00",
                "action": ACTION_SET_TEMPERATURE,
                "temperature": 21,
                "hvac_mode": "heat",
            }
        ]
        self.scheduler.set_temperature_migration_blocked(True)

        await self.scheduler._handle_timer(NOW)

        self.assertEqual(self.climate.calls, [])

    async def test_queued_turn_off_keeps_assist_recovery_state_when_blocked(self) -> None:
        assist_state = object()
        self.scheduler._room_sensor_assist_states[self.entity_id] = assist_state
        self.scheduler.set_temperature_migration_blocked(True)
        event = scheduler_module.ClimateEvent(
            entity_id=self.entity_id,
            when=NOW,
            temperature=None,
            weekday="tuesday",
            start="18:00",
            action=ACTION_TURN_OFF,
        )

        await self.scheduler._async_apply_event(event)

        self.assertIs(
            self.scheduler._room_sensor_assist_states[self.entity_id], assist_state
        )
        self.assertEqual(self.climate.calls, [])

    async def test_saving_today_applies_current_block(self) -> None:
        await self.scheduler.async_set_daily_schedule(
            self.entity_id,
            "tuesday",
            [
                {
                    "start": "17:00",
                    "action": ACTION_SET_TEMPERATURE,
                    "temperature": 21,
                    "hvac_mode": "heat",
                }
            ],
        )

        self.assertEqual(
            self.climate.calls,
            [("set_temperature", self.entity_id, 21, True, "heat")],
        )

    async def test_saving_today_applies_supported_optional_climate_settings(self) -> None:
        self.climate.climate_options[self.entity_id] = {
            "fan_mode": ["auto", "low"],
            "preset_mode": ["sleep"],
            "swing_mode": ["off", "vertical"],
            "swing_horizontal_mode": ["auto"],
            "humidity": ["30", "60"],
        }

        await self.scheduler.async_set_daily_schedule(
            self.entity_id,
            "tuesday",
            [
                {
                    "start": "17:00",
                    "action": ACTION_SET_TEMPERATURE,
                    "temperature": 24,
                    "hvac_mode": "cool",
                    "fan_mode": "low",
                    "preset_mode": "sleep",
                    "swing_mode": "vertical",
                    "swing_horizontal_mode": "auto",
                    "humidity": 50,
                }
            ],
        )

        self.assertEqual(
            self.climate.calls,
            [
                (
                    "set_temperature",
                    self.entity_id,
                    24,
                    True,
                    "cool",
                    {
                        "fan_mode": "low",
                        "humidity": 50.0,
                        "preset_mode": "sleep",
                        "swing_mode": "vertical",
                        "swing_horizontal_mode": "auto",
                    },
                )
            ],
        )

    async def test_saving_schedule_drops_unsupported_optional_climate_settings(self) -> None:
        self.climate.climate_options[self.entity_id] = {
            "fan_mode": ["auto"],
            "preset_mode": ["eco"],
            "swing_mode": ["off"],
            "humidity": ["30", "60"],
        }

        await self.scheduler.async_set_daily_schedule(
            self.entity_id,
            "wednesday",
            [
                {
                    "start": "22:00",
                    "action": ACTION_SET_TEMPERATURE,
                    "temperature": 24,
                    "hvac_mode": "cool",
                    "fan_mode": "low",
                    "preset_mode": "sleep",
                    "swing_mode": "vertical",
                    "swing_horizontal_mode": "auto",
                    "humidity": 80,
                }
            ],
        )

        self.assertEqual(
            self.data["zones"][self.entity_id]["schedule"]["wednesday"],
            [
                {
                    "start": "22:00",
                    "action": ACTION_SET_TEMPERATURE,
                    "temperature": 24.0,
                    "hvac_mode": "cool",
                }
            ],
        )

    async def test_schedule_application_fires_automation_event(self) -> None:
        await self.scheduler.async_set_daily_schedule(
            self.entity_id,
            "tuesday",
            [
                {
                    "start": "17:00",
                    "action": ACTION_SET_TEMPERATURE,
                    "temperature": 21,
                    "hvac_mode": "heat",
                }
            ],
        )

        self.assertIn(
            (
                EVENT_VELAIR,
                {
                    "domain": "velair",
                    "event": EVENT_TYPE_CLIMATE_TARGET_APPLIED,
                    "entity_id": self.entity_id,
                    "action": ACTION_SET_TEMPERATURE,
                    "temperature": 21.0,
                    "hvac_mode": "heat",
                    "weekday": "tuesday",
                    "start": "17:00",
                    "source": "schedule_saved",
                },
            ),
            self.hass.bus.events,
        )

    async def test_schedule_application_writes_logbook_when_available(self) -> None:
        self.hass.services.logbook_enabled = True
        self.hass.states[self.entity_id] = SimpleNamespace(
            attributes={"friendly_name": "Salon"}
        )
        self.data["zones"][self.entity_id]["schedule"]["tuesday"] = [
            {
                "start": "17:00",
                "action": ACTION_SET_TEMPERATURE,
                "temperature": 21,
                "hvac_mode": "heat",
            }
        ]

        await self.scheduler.async_apply_current_schedule()

        self.assertEqual(
            self.hass.services.calls,
            [
                (
                    "logbook",
                    "log",
                    {
                        "name": "Velair",
                        "message": "Adjusted Salon to 21 °C (Heat)",
                        "entity_id": self.entity_id,
                    },
                    False,
                )
            ],
        )

    async def test_pause_writes_spanish_logbook_entry_when_available(self) -> None:
        self.hass.config.language = "es"
        self.hass.services.logbook_enabled = True

        await self.scheduler.async_set_mode(
            MODE_PAUSED,
            paused_until="2026-05-19T19:00:00+00:00",
        )

        self.assertEqual(
            self.hass.services.calls[-1],
            (
                "logbook",
                "log",
                {
                    "name": "Velair",
                    "message": "Planificador pausado hasta 2026-05-19T19:00:00+00:00",
                },
                False,
            ),
        )

    async def test_scheduler_mode_change_fires_automation_event(self) -> None:
        await self.scheduler.async_set_mode(
            MODE_PAUSED,
            paused_until="2026-05-19T19:00:00+00:00",
        )

        self.assertIn(
            (
                EVENT_VELAIR,
                {
                    "domain": "velair",
                    "event": EVENT_TYPE_SCHEDULER_MODE_CHANGED,
                    "mode": MODE_PAUSED,
                    "previous_mode": MODE_AUTO,
                    "paused_until": "2026-05-19T19:00:00+00:00",
                    "paused_started_at": NOW.isoformat(),
                },
            ),
            self.hass.bus.events,
        )

    async def test_boost_stores_start_time_for_timeline_visibility(self) -> None:
        self.climate.snapshots[self.entity_id] = {
            "hvac_mode": "heat",
            "temperature": 20,
        }

        await self.scheduler.async_set_zone_boost(
            self.entity_id,
            23,
            "2026-05-19T20:00:00+00:00",
            hvac_mode="heat",
        )

        override = self.data["zones"][self.entity_id]["override"]

        self.assertIsNotNone(override)
        self.assertEqual(override["started_at"], NOW.isoformat())
        self.assertEqual(override["until"], "2026-05-19T20:00:00+00:00")
        self.assertEqual(
            self.scheduler.get_zone_override_status(self.entity_id),
            {
                "state": "boost",
                "started_at": NOW.isoformat(),
                "until": "2026-05-19T20:00:00+00:00",
                "action": None,
            },
        )
        self.assertEqual(
            override["previous_state"],
            {
                "hvac_mode": "heat",
                "temperature": 20,
            },
        )
        self.assertEqual(
            self.climate.calls,
            [("set_temperature", self.entity_id, 23, True, "heat")],
        )
        self.assertIn(
            (
                EVENT_VELAIR,
                {
                    "domain": "velair",
                    "event": EVENT_TYPE_BOOST_STARTED,
                    "entity_id": self.entity_id,
                    "temperature": 23,
                    "hvac_mode": "heat",
                    "started_at": NOW.isoformat(),
                    "until": "2026-05-19T20:00:00+00:00",
                },
            ),
            self.hass.bus.events,
        )

    async def test_expired_boost_restores_previous_state_without_current_block(
        self,
    ) -> None:
        previous_state = {"hvac_mode": "cool", "temperature": 19}
        self.data["zones"][self.entity_id]["override"] = {
            "type": "boost",
            "started_at": "2026-05-19T17:00:00+00:00",
            "until": "2026-05-19T17:30:00+00:00",
            "temperature": 23,
            "hvac_mode": "heat",
            "previous_state": previous_state,
        }

        await self.scheduler._handle_timer(NOW)

        self.assertIsNone(self.data["zones"][self.entity_id]["override"])
        self.assertEqual(
            self.climate.calls,
            [("restore_state", self.entity_id, previous_state)],
        )
        self.assertIn(
            (
                EVENT_VELAIR,
                {
                    "domain": "velair",
                    "event": EVENT_TYPE_BOOST_ENDED,
                    "entity_id": self.entity_id,
                    "temperature": 23,
                    "hvac_mode": "heat",
                    "started_at": "2026-05-19T17:00:00+00:00",
                    "until": "2026-05-19T17:30:00+00:00",
                    "reason": "expired",
                    "restoration": {
                        "type": "previous_state",
                        "state": previous_state,
                    },
                },
            ),
            self.hass.bus.events,
        )

    async def test_expired_boost_applies_current_explicit_schedule_block(self) -> None:
        self.data["zones"][self.entity_id]["schedule"]["tuesday"] = [
            {
                "start": "17:00",
                "action": ACTION_SET_TEMPERATURE,
                "temperature": 21,
                "hvac_mode": "heat",
            }
        ]
        self.data["zones"][self.entity_id]["override"] = {
            "type": "boost",
            "started_at": "2026-05-19T17:00:00+00:00",
            "until": "2026-05-19T17:30:00+00:00",
            "temperature": 23,
            "hvac_mode": "heat",
            "previous_state": {"hvac_mode": "cool", "temperature": 19},
        }

        await self.scheduler._handle_timer(NOW)

        self.assertEqual(
            self.climate.calls,
            [("set_temperature", self.entity_id, 21.0, True, "heat")],
        )

    async def test_expired_boost_restores_previous_state_for_keep_block(self) -> None:
        previous_state = {"hvac_mode": "cool", "temperature": 19}
        self.data["zones"][self.entity_id]["schedule"]["tuesday"] = [
            {
                "start": "17:00",
                "action": ACTION_SET_TEMPERATURE,
                "temperature": 21,
            }
        ]
        self.data["zones"][self.entity_id]["override"] = {
            "type": "boost",
            "started_at": "2026-05-19T17:00:00+00:00",
            "until": "2026-05-19T17:30:00+00:00",
            "temperature": 23,
            "hvac_mode": "heat",
            "previous_state": previous_state,
        }

        await self.scheduler._handle_timer(NOW)

        self.assertEqual(
            self.climate.calls,
            [("restore_state", self.entity_id, previous_state)],
        )

    async def test_expired_boost_applies_current_turn_off_block(self) -> None:
        self.data["zones"][self.entity_id]["schedule"]["tuesday"] = [
            {
                "start": "17:00",
                "action": ACTION_TURN_OFF,
            }
        ]
        self.data["zones"][self.entity_id]["override"] = {
            "type": "boost",
            "started_at": "2026-05-19T17:00:00+00:00",
            "until": "2026-05-19T17:30:00+00:00",
            "temperature": 23,
            "hvac_mode": "heat",
            "previous_state": {"hvac_mode": "cool", "temperature": 19},
        }

        await self.scheduler._handle_timer(NOW)

        self.assertEqual(self.climate.calls, [("turn_off", self.entity_id)])

    async def test_cancel_boost_applies_current_explicit_schedule_block(self) -> None:
        self.data["zones"][self.entity_id]["schedule"]["tuesday"] = [
            {
                "start": "17:00",
                "action": ACTION_SET_TEMPERATURE,
                "temperature": 21,
                "hvac_mode": "heat",
            }
        ]
        self.climate.snapshots[self.entity_id] = {
            "hvac_mode": "cool",
            "temperature": 19,
        }
        await self.scheduler.async_set_zone_boost(
            self.entity_id,
            23,
            "2026-05-19T20:00:00+00:00",
            hvac_mode="cool",
        )

        await self.scheduler.async_cancel_zone_boost(self.entity_id)

        self.assertIsNone(self.data["zones"][self.entity_id]["override"])
        self.assertEqual(
            self.climate.calls,
            [
                ("set_temperature", self.entity_id, 23, True, "cool"),
                ("set_temperature", self.entity_id, 21.0, True, "heat"),
            ],
        )
        self.assertIn(
            (
                EVENT_VELAIR,
                {
                    "domain": "velair",
                    "event": EVENT_TYPE_BOOST_ENDED,
                    "entity_id": self.entity_id,
                    "temperature": 23,
                    "hvac_mode": "cool",
                    "started_at": NOW.isoformat(),
                    "until": "2026-05-19T20:00:00+00:00",
                    "reason": "manual",
                    "restoration": {
                        "type": "schedule",
                        "source": "boost_ended",
                        "target": {
                            "action": ACTION_SET_TEMPERATURE,
                            "temperature": 21.0,
                            "hvac_mode": "heat",
                            "weekday": "tuesday",
                            "start": "17:00",
                        },
                    },
                },
            ),
            self.hass.bus.events,
        )

    async def test_temporary_pause_expiration_fires_mode_change_event(self) -> None:
        await self.scheduler.async_set_mode(
            MODE_PAUSED,
            paused_until="2026-05-19T19:00:00+00:00",
        )

        await self.scheduler._handle_timer(
            datetime(2026, 5, 19, 19, 0, tzinfo=timezone.utc)
        )

        self.assertIn(
            (
                EVENT_VELAIR,
                {
                    "domain": "velair",
                    "event": EVENT_TYPE_SCHEDULER_MODE_CHANGED,
                    "mode": MODE_AUTO,
                    "previous_mode": MODE_PAUSED,
                    "paused_until": None,
                    "paused_started_at": NOW.isoformat(),
                },
            ),
            self.hass.bus.events,
        )

    async def test_manual_temperature_can_fire_service_automation_event(self) -> None:
        await self.scheduler.async_set_temperature(
            self.entity_id,
            22,
            ensure_on=True,
            hvac_mode="heat",
            event_source="service_set_temperature",
        )

        self.assertIn(
            (
                EVENT_VELAIR,
                {
                    "domain": "velair",
                    "event": EVENT_TYPE_CLIMATE_TARGET_APPLIED,
                    "entity_id": self.entity_id,
                    "action": ACTION_SET_TEMPERATURE,
                    "temperature": 22,
                    "hvac_mode": "heat",
                    "source": "service_set_temperature",
                },
            ),
            self.hass.bus.events,
        )

    async def test_replacing_boost_preserves_original_previous_state(self) -> None:
        original_state = {"hvac_mode": "cool", "temperature": 19}
        self.climate.snapshots[self.entity_id] = original_state
        await self.scheduler.async_set_zone_boost(
            self.entity_id,
            22,
            "2026-05-19T19:00:00+00:00",
            hvac_mode="heat",
        )
        self.climate.snapshots[self.entity_id] = {
            "hvac_mode": "heat",
            "temperature": 22,
        }

        await self.scheduler.async_set_zone_boost(
            self.entity_id,
            24,
            "2026-05-19T20:00:00+00:00",
            hvac_mode="heat",
        )
        await self.scheduler.async_cancel_zone_boost(self.entity_id)

        self.assertEqual(
            self.climate.calls[-1],
            ("restore_state", self.entity_id, original_state),
        )

    async def test_cancel_boost_restores_previous_state_without_current_block(
        self,
    ) -> None:
        previous_state = {"hvac_mode": "cool", "temperature": 19}
        self.climate.snapshots[self.entity_id] = previous_state
        await self.scheduler.async_set_zone_boost(
            self.entity_id,
            23,
            "2026-05-19T20:00:00+00:00",
            hvac_mode="heat",
        )

        await self.scheduler.async_cancel_zone_boost(self.entity_id)

        self.assertEqual(
            self.climate.calls,
            [
                ("set_temperature", self.entity_id, 23, True, "heat"),
                ("restore_state", self.entity_id, previous_state),
            ],
        )

    async def test_cancel_boost_restores_previous_state_for_keep_block(self) -> None:
        previous_state = {"hvac_mode": "cool", "temperature": 19}
        self.climate.snapshots[self.entity_id] = previous_state
        self.data["zones"][self.entity_id]["schedule"]["tuesday"] = [
            {
                "start": "17:00",
                "action": ACTION_SET_TEMPERATURE,
                "temperature": 21,
            }
        ]
        await self.scheduler.async_set_zone_boost(
            self.entity_id,
            23,
            "2026-05-19T20:00:00+00:00",
            hvac_mode="heat",
        )

        await self.scheduler.async_cancel_zone_boost(self.entity_id)

        self.assertEqual(
            self.climate.calls[-1],
            ("restore_state", self.entity_id, previous_state),
        )

    async def test_cancel_boost_is_idempotent_without_active_boost(self) -> None:
        await self.scheduler.async_cancel_zone_boost(self.entity_id)

        self.assertEqual(self.save_count, 0)
        self.assertEqual(self.climate.calls, [])

    async def test_boost_requires_a_restorable_climate_state(self) -> None:
        with self.assertRaisesRegex(ValueError, "state is unavailable"):
            await self.scheduler.async_set_zone_boost(
                self.entity_id,
                23,
                "2026-05-19T20:00:00+00:00",
                hvac_mode="heat",
            )

        self.assertIsNone(self.data["zones"][self.entity_id]["override"])
        self.assertEqual(self.climate.calls, [])

    async def test_temperature_limits_are_enforced_for_saved_blocks(self) -> None:
        self.climate.limits[self.entity_id] = (18.0, 22.0)

        with self.assertRaisesRegex(ValueError, "Temperature must be between 18 and 22"):
            await self.scheduler.async_set_daily_schedule(
                self.entity_id,
                "tuesday",
                [
                    {
                        "start": "17:00",
                        "action": ACTION_SET_TEMPERATURE,
                        "temperature": 16,
                    }
                ],
            )

    async def test_update_settings_persists_order_and_temperature_limits(self) -> None:
        await self.scheduler.async_update_settings(
            {
                "first_weekday": "sunday",
                "zone_order": [self.entity_id],
                "min_temperature": 12,
                "max_temperature": 28,
            }
        )

        self.assertEqual(self.save_count, 1)
        self.assertEqual(
            self.data["settings"],
            {
                "first_weekday": "sunday",
                "zone_order": [self.entity_id],
                "min_temperature": 12.0,
                "max_temperature": 28.0,
            },
        )

    async def test_portable_import_replaces_selected_sections(self) -> None:
        next_zones = {
            self.entity_id: {
                "enabled": True,
                "schedule": {
                    **empty_week_schedule(),
                    "monday": [
                        {
                            "start": "08:00",
                            "action": ACTION_SET_TEMPERATURE,
                            "temperature": 20,
                            "hvac_mode": "heat",
                        }
                    ],
                },
                "override": None,
            }
        }
        next_templates = [
            {
                "key": "portable",
                "name": "Portable",
                "blocks": [
                    {
                        "start": "08:00",
                        "action": ACTION_SET_TEMPERATURE,
                        "temperature": 20,
                    }
                ],
            }
        ]
        next_settings = normalize_panel_settings(
            {"first_weekday": "sunday", "zone_order": [self.entity_id]},
            [self.entity_id],
        )

        await self.scheduler.async_replace_portable_data(
            zones=next_zones,
            templates=next_templates,
            settings=next_settings,
        )

        self.assertEqual(self.save_count, 1)
        self.assertEqual(self.data["zones"], next_zones)
        self.assertEqual(self.data["templates"], next_templates)
        self.assertTrue(self.data["templates_seeded"])
        self.assertEqual(self.data["settings"], next_settings)

    async def test_portable_import_can_replace_templates_only(self) -> None:
        original_zones = self.data["zones"]
        original_settings = self.data["settings"]
        next_templates = [
            {
                "key": "portable",
                "name": "Portable",
                "blocks": [
                    {
                        "start": "08:00",
                        "action": ACTION_SET_TEMPERATURE,
                        "temperature": 20,
                        "hvac_mode": "heat",
                    }
                ],
            }
        ]

        await self.scheduler.async_replace_portable_data(templates=next_templates)

        self.assertEqual(self.save_count, 1)
        self.assertIs(self.data["zones"], original_zones)
        self.assertIs(self.data["settings"], original_settings)
        self.assertEqual(self.data["templates"], next_templates)
        self.assertTrue(self.data["templates_seeded"])
        self.assertEqual(
            self.data["templates_seeded_version"],
            DEFAULT_SCHEDULE_TEMPLATES_VERSION,
        )

    async def test_portable_learning_import_preserves_unlisted_climates(self) -> None:
        imported = _preconditioning_learning(
            [_preconditioning_sample("heat", "complete", 35)]
        )
        existing = _preconditioning_learning(
            [_preconditioning_sample("cool", "complete", 50)]
        )
        self.data["preconditioning_learning"] = {
            self.entity_id: _preconditioning_learning([]),
            "climate.other": existing,
        }

        await self.scheduler.async_replace_portable_data(
            preconditioning_learning={self.entity_id: imported},
        )

        self.assertEqual(self.save_count, 1)
        self.assertEqual(
            self.data["preconditioning_learning"][self.entity_id],
            imported,
        )
        self.assertIs(
            self.data["preconditioning_learning"]["climate.other"],
            existing,
        )

    async def test_reset_data_replaces_entire_model_with_defaults(self) -> None:
        self.data["zones"][self.entity_id]["schedule"]["monday"] = [
            {
                "start": "08:00",
                "action": ACTION_SET_TEMPERATURE,
                "temperature": 21,
            }
        ]
        self.data["templates"] = [
            {
                "key": "custom",
                "name": "Custom",
                "blocks": [
                    {
                        "start": "08:00",
                        "action": ACTION_SET_TEMPERATURE,
                        "temperature": 21,
                    }
                ],
            }
        ]

        default_data = normalize_schedule_data(None, [self.entity_id])
        await self.scheduler.async_reset_data(default_data)

        self.assertEqual(self.save_count, 1)
        self.assertEqual(self.data, default_data)
        self.assertEqual(self.data["zones"][self.entity_id]["schedule"]["monday"], [])
        self.assertNotIn(
            "custom",
            {template["key"] for template in self.data["templates"]},
        )

    async def test_saving_other_day_does_not_apply_previous_day_block(self) -> None:
        await self.scheduler.async_set_daily_schedule(
            self.entity_id,
            "monday",
            [
                {
                    "start": "17:00",
                    "action": ACTION_SET_TEMPERATURE,
                    "temperature": 22,
                    "hvac_mode": "heat",
                }
            ],
        )

        self.assertEqual(self.climate.calls, [])

    async def test_copying_schedule_to_today_applies_current_block(self) -> None:
        self.data["zones"][self.entity_id]["schedule"]["monday"] = [
            {
                "start": "17:00",
                "action": ACTION_SET_TEMPERATURE,
                "temperature": 20,
                "hvac_mode": "cool",
            }
        ]

        await self.scheduler.async_copy_day_schedule(
            self.entity_id,
            "monday",
            ["tuesday", "wednesday"],
        )

        self.assertEqual(
            self.climate.calls,
            [("set_temperature", self.entity_id, 20, True, "cool")],
        )

    async def test_copying_schedule_without_today_does_not_apply(self) -> None:
        self.data["zones"][self.entity_id]["schedule"]["monday"] = [
            {
                "start": "17:00",
                "action": ACTION_SET_TEMPERATURE,
                "temperature": 20,
            }
        ]

        await self.scheduler.async_copy_day_schedule(
            self.entity_id,
            "monday",
            ["wednesday"],
        )

        self.assertEqual(self.climate.calls, [])

    async def test_saving_today_does_not_apply_when_scheduler_is_paused(self) -> None:
        self.data["global_"]["mode"] = MODE_PAUSED

        await self.scheduler.async_set_daily_schedule(
            self.entity_id,
            "tuesday",
            [
                {
                    "start": "17:00",
                    "action": ACTION_SET_TEMPERATURE,
                    "temperature": 21,
                }
            ],
        )

        self.assertEqual(self.climate.calls, [])

    async def test_saving_today_does_not_override_active_boost(self) -> None:
        self.data["zones"][self.entity_id]["override"] = {
            "type": "boost",
            "until": "2026-05-19T19:00:00+00:00",
            "temperature": 24,
            "hvac_mode": "heat",
        }

        await self.scheduler.async_set_daily_schedule(
            self.entity_id,
            "tuesday",
            [
                {
                    "start": "17:00",
                    "action": ACTION_SET_TEMPERATURE,
                    "temperature": 21,
                    "hvac_mode": "heat",
                }
            ],
        )

        self.assertEqual(self.climate.calls, [])

    async def test_zone_pause_does_not_report_as_active_boost(self) -> None:
        await self.scheduler.async_pause_zone(self.entity_id)

        self.assertEqual(self.scheduler.get_active_overrides(), {})
        self.assertEqual(
            self.scheduler.get_zone_override_status(self.entity_id),
            {
                "state": "paused",
                "started_at": NOW.isoformat(),
                "until": None,
                "action": "none",
            },
        )
        self.assertIn(
            (
                EVENT_VELAIR,
                {
                    "domain": "velair",
                    "event": EVENT_TYPE_ZONE_PAUSED,
                    "entity_id": self.entity_id,
                    "started_at": NOW.isoformat(),
                    "until": None,
                    "action": "none",
                },
            ),
            self.hass.bus.events,
        )

    async def test_zone_pause_skips_current_schedule_application(self) -> None:
        self.data["zones"][self.entity_id]["schedule"]["tuesday"] = [
            {
                "start": "17:00",
                "action": ACTION_SET_TEMPERATURE,
                "temperature": 21,
                "hvac_mode": "heat",
            }
        ]

        await self.scheduler.async_pause_zone(self.entity_id)
        await self.scheduler.async_apply_current_schedule(self.entity_id)

        self.assertEqual(self.climate.calls, [])

    async def test_zone_pause_turn_off_action_turns_climate_off(self) -> None:
        await self.scheduler.async_pause_zone(
            self.entity_id,
            action=ZONE_PAUSE_ACTION_TURN_OFF,
        )

        self.assertEqual(self.climate.calls, [("turn_off", self.entity_id)])
        self.assertIn(
            (
                EVENT_VELAIR,
                {
                    "domain": "velair",
                    "event": EVENT_TYPE_CLIMATE_TARGET_APPLIED,
                    "entity_id": self.entity_id,
                    "action": ACTION_TURN_OFF,
                    "temperature": None,
                    "hvac_mode": None,
                    "weekday": None,
                    "start": None,
                    "source": "zone_paused",
                },
            ),
            self.hass.bus.events,
        )

    async def test_resume_zone_applies_current_schedule(self) -> None:
        self.data["zones"][self.entity_id]["schedule"]["tuesday"] = [
            {
                "start": "17:00",
                "action": ACTION_SET_TEMPERATURE,
                "temperature": 21,
                "hvac_mode": "heat",
            }
        ]
        await self.scheduler.async_pause_zone(self.entity_id)
        self.climate.calls.clear()
        self.hass.bus.events.clear()

        await self.scheduler.async_resume_zone(self.entity_id)

        self.assertIsNone(self.data["zones"][self.entity_id]["override"])
        self.assertEqual(
            self.climate.calls,
            [("set_temperature", self.entity_id, 21, True, "heat")],
        )
        self.assertIn(
            (
                EVENT_VELAIR,
                {
                    "domain": "velair",
                    "event": EVENT_TYPE_ZONE_RESUMED,
                    "entity_id": self.entity_id,
                    "started_at": NOW.isoformat(),
                    "until": None,
                    "action": "none",
                    "reason": "manual",
                },
            ),
            self.hass.bus.events,
        )

    async def test_expired_zone_pause_applies_current_schedule(self) -> None:
        self.data["zones"][self.entity_id]["schedule"]["tuesday"] = [
            {
                "start": "17:00",
                "action": ACTION_SET_TEMPERATURE,
                "temperature": 21,
                "hvac_mode": "heat",
            }
        ]
        self.data["zones"][self.entity_id]["override"] = {
            "type": "pause",
            "started_at": "2026-05-19T17:00:00+00:00",
            "until": "2026-05-19T17:30:00+00:00",
            "action": "none",
        }

        await self.scheduler._handle_timer(NOW)

        self.assertIsNone(self.data["zones"][self.entity_id]["override"])
        self.assertEqual(
            self.climate.calls,
            [("set_temperature", self.entity_id, 21, True, "heat")],
        )
        self.assertIn(
            (
                EVENT_VELAIR,
                {
                    "domain": "velair",
                    "event": EVENT_TYPE_ZONE_RESUMED,
                    "entity_id": self.entity_id,
                    "started_at": "2026-05-19T17:00:00+00:00",
                    "until": "2026-05-19T17:30:00+00:00",
                    "action": "none",
                    "reason": "expired",
                },
            ),
            self.hass.bus.events,
        )

    async def test_saving_today_turn_off_block_applies_turn_off(self) -> None:
        await self.scheduler.async_set_daily_schedule(
            self.entity_id,
            "tuesday",
            [
                {
                    "start": "17:00",
                    "action": ACTION_TURN_OFF,
                }
            ],
        )

        self.assertEqual(self.climate.calls, [("turn_off", self.entity_id)])

    async def test_temporary_pause_stores_and_clears_started_at(self) -> None:
        await self.scheduler.async_set_mode(
            MODE_PAUSED,
            paused_until="2026-05-19T19:00:00+00:00",
        )

        self.assertEqual(
            self.data["global_"]["paused_started_at"],
            NOW.isoformat(),
        )

        await self.scheduler.async_set_mode(MODE_AUTO)

        self.assertIsNone(self.data["global_"]["paused_started_at"])

    async def test_resuming_does_not_apply_previous_day_blocks(self) -> None:
        self.data["global_"]["mode"] = MODE_PAUSED
        self.data["zones"][self.entity_id]["schedule"]["monday"] = [
            {
                "start": "08:00",
                "action": ACTION_SET_TEMPERATURE,
                "temperature": 21,
                "hvac_mode": "heat",
            }
        ]

        await self.scheduler.async_set_mode(MODE_AUTO, apply_current_schedule=True)

        self.assertEqual(self.climate.calls, [])

    async def test_resuming_applies_today_current_block(self) -> None:
        self.data["global_"]["mode"] = MODE_PAUSED
        self.data["zones"][self.entity_id]["schedule"]["tuesday"] = [
            {
                "start": "17:00",
                "action": ACTION_SET_TEMPERATURE,
                "temperature": 21,
                "hvac_mode": "heat",
            }
        ]

        await self.scheduler.async_set_mode(MODE_AUTO, apply_current_schedule=True)

        self.assertEqual(
            self.climate.calls,
            [("set_temperature", self.entity_id, 21, True, "heat")],
        )

    async def test_start_can_apply_current_schedule_when_enabled(self) -> None:
        self.data["zones"][self.entity_id]["schedule"]["tuesday"] = [
            {
                "start": "17:00",
                "action": ACTION_SET_TEMPERATURE,
                "temperature": 19,
                "hvac_mode": "heat",
            }
        ]

        await self.scheduler.async_start(apply_current_schedule=True)

        self.assertEqual(
            self.climate.calls,
            [("set_temperature", self.entity_id, 19, True, "heat")],
        )

    async def test_start_does_not_apply_current_schedule_by_default(self) -> None:
        self.data["zones"][self.entity_id]["schedule"]["tuesday"] = [
            {
                "start": "17:00",
                "action": ACTION_SET_TEMPERATURE,
                "temperature": 19,
                "hvac_mode": "heat",
            }
        ]

        await self.scheduler.async_start()

        self.assertEqual(self.climate.calls, [])


class VelairSchedulerPreconditioningTest(unittest.IsolatedAsyncioTestCase):
    """Verify adaptive preconditioning scheduler behavior."""

    def setUp(self) -> None:
        self.entity_id = "climate.salon"
        self.hass = FakeHass()
        self.climate = FakeClimateManager()
        self.save_count = 0
        self.data = {
            "version": 1,
            "global_": {
                "mode": MODE_AUTO,
                "paused_until": None,
                "paused_started_at": None,
            },
            "zones": {
                self.entity_id: {
                    "enabled": True,
                    "schedule": empty_week_schedule(),
                    "override": None,
                    "preconditioning": {
                        "enabled": True,
                        "max_lead_minutes": 180,
                        "minimum_delta_temperature": 0.3,
                        "fallback_minutes_per_degree": 20,
                    },
                }
            },
            "settings": normalize_panel_settings(None, [self.entity_id]),
            "templates": [],
            "templates_seeded": True,
        }
        self.scheduler = VelairScheduler(
            self.hass,
            self.data,
            self.climate,
            self._async_save,
        )

    async def _async_save(self) -> None:
        self.save_count += 1

    def test_climate_reading_trusts_finite_home_assistant_value(self) -> None:
        self.climate.limits[self.entity_id] = (5, 30)
        self.climate.temperature_unit = lambda _entity_id: scheduler_module.CELSIUS
        self.hass.states[self.entity_id] = SimpleNamespace(
            state="heat",
            attributes={"current_temperature": -4},
        )
        self.assertEqual(self.scheduler._climate_current_temperature(self.entity_id), -4)

        self.climate.limits[self.entity_id] = (41, 86)
        self.climate.temperature_unit = lambda _entity_id: scheduler_module.FAHRENHEIT
        self.hass.states[self.entity_id] = SimpleNamespace(
            state="heat",
            attributes={
                "current_temperature": 158,
                "temperature": 158,
                "unit_of_measurement": scheduler_module.FAHRENHEIT,
            },
        )

        self.assertEqual(self.scheduler._climate_current_temperature(self.entity_id), 158)
        status = self.scheduler._room_sensor_assist_status(self.entity_id)
        self.assertEqual(status["climate_temperature"], 158)
        self.assertIsNone(status["climate_target_temperature"])

        self.hass.states[self.entity_id] = SimpleNamespace(
            state="heat",
            attributes={
                "current_temperature": 70,
                "temperature": 70,
                "unit_of_measurement": scheduler_module.FAHRENHEIT,
            },
        )
        status = self.scheduler._room_sensor_assist_status(self.entity_id)
        self.assertEqual(status["climate_temperature"], 70)
        self.assertEqual(status["climate_target_temperature"], 70)

    def test_climate_reading_rejects_non_finite_live_values(self) -> None:
        self.hass.states[self.entity_id] = SimpleNamespace(
            state="heat",
            attributes={
                "current_temperature": float("inf"),
                "temperature": float("nan"),
            },
        )

        self.assertIsNone(self.scheduler._climate_current_temperature(self.entity_id))
        status = self.scheduler._room_sensor_assist_status(self.entity_id)
        self.assertIsNone(status["climate_temperature"])
        self.assertIsNone(status["climate_target_temperature"])

    def test_temperature_source_only_converts_a_distinct_external_sensor(self) -> None:
        self.climate.temperature_unit = lambda _entity_id: scheduler_module.FAHRENHEIT
        climate_state = SimpleNamespace(
            state="heat",
            attributes={
                "current_temperature": 70,
                "unit_of_measurement": scheduler_module.FAHRENHEIT,
            },
        )
        sensor_state = SimpleNamespace(
            state="20",
            attributes={"unit_of_measurement": scheduler_module.CELSIUS},
        )

        self.assertEqual(
            self.scheduler._temperature_from_source_state(
                self.entity_id,
                self.entity_id,
                climate_state,
            ),
            70,
        )
        self.assertEqual(
            self.scheduler._temperature_from_source_state(
                self.entity_id,
                "sensor.room_temperature",
                sensor_state,
            ),
            68,
        )

        self.climate.temperature_unit = lambda _entity_id: scheduler_module.CELSIUS
        fahrenheit_sensor_state = SimpleNamespace(
            state="68",
            attributes={"unit_of_measurement": scheduler_module.FAHRENHEIT},
        )
        self.assertEqual(
            self.scheduler._temperature_from_source_state(
                self.entity_id,
                "sensor.room_temperature",
                fahrenheit_sensor_state,
            ),
            20,
        )

    async def test_reset_zone_preconditioning_learning_deletes_zone_observations(
        self,
    ) -> None:
        self.data["preconditioning_learning"] = {
            self.entity_id: _preconditioning_learning(
                [
                    _preconditioning_sample("heat", "complete", 30, delta_t=1),
                    _preconditioning_sample("cool", "complete", 40, delta_t=2),
                ]
            ),
            "climate.other": _preconditioning_learning(
                [
                    _preconditioning_sample("heat", "complete", 60, delta_t=2)
                ]
            ),
        }

        await self.scheduler.async_reset_zone_preconditioning_learning(
            self.entity_id,
            "heat",
        )

        heat = _stored_preconditioning_observations(
            self.data,
            self.entity_id,
            "heat",
        )
        cool = _stored_preconditioning_observations(
            self.data,
            self.entity_id,
            "cool",
        )
        self.assertEqual(heat, [])
        self.assertEqual(len(cool), 1)
        self.assertIn("climate.other", self.data["preconditioning_learning"])
        self.assertEqual(self.save_count, 1)

    async def test_reset_zone_preconditioning_settings_keeps_enablement_and_learning(
        self,
    ) -> None:
        learning = _preconditioning_learning(
            [_preconditioning_sample("heat", "complete", 30, delta_t=1)]
        )
        self.data["preconditioning_learning"] = {self.entity_id: learning}
        self.data["zones"][self.entity_id]["preconditioning"] = {
            "enabled": True,
            "max_lead_minutes": 720,
            "minimum_delta_temperature": 2,
            "learning_history_size": 500,
            "similar_sample_count": 100,
            "comfort_percentile": 95,
            "adaptive_percentile_enabled": False,
            "partial_expiry_days": 365,
            "recency_decay_days": 365,
            "min_start_minutes": 120,
            "fallback_minutes_per_degree": 120,
            "use_outdoor_temperature": False,
            "outdoor_temperature_entity_id": "sensor.outdoor",
            "room_temperature_entity_id": "sensor.salon_temperature",
            "room_sensor_assist_enabled": True,
            "room_sensor_assist_max_delta": 4,
        }

        result = await self.scheduler.async_reset_zone_preconditioning_settings(
            self.entity_id
        )

        expected = normalize_preconditioning_data(None)
        expected["enabled"] = True
        expected["room_temperature_entity_id"] = "sensor.salon_temperature"
        expected["room_sensor_assist_enabled"] = True
        expected["room_sensor_assist_max_delta"] = 4.0
        self.assertEqual(result, expected)
        self.assertEqual(
            result["max_lead_minutes"],
            DEFAULT_PRECONDITIONING_MAX_LEAD_MINUTES,
        )
        self.assertEqual(
            self.data["preconditioning_learning"][self.entity_id],
            learning,
        )
        self.assertEqual(self.save_count, 1)

    async def test_reset_zone_preconditioning_settings_rejects_unmanaged_entity(
        self,
    ) -> None:
        with self.assertRaises(ValueError):
            await self.scheduler.async_reset_zone_preconditioning_settings(
                "climate.unmanaged"
            )

        self.assertEqual(self.save_count, 0)

    async def test_reset_zone_preconditioning_settings_uses_fahrenheit_defaults(
        self,
    ) -> None:
        self.climate.temperature_unit = lambda _entity_id: "°F"
        self.data["zones"][self.entity_id]["preconditioning"] = {
            "enabled": True,
            "minimum_delta_temperature": 4,
            "fallback_minutes_per_degree": 30,
            "room_temperature_entity_id": "sensor.salon_temperature",
            "room_sensor_assist_enabled": True,
            "room_sensor_assist_max_delta": 7.2,
            "room_sensor_assist_debounce_seconds": 35,
        }

        result = await self.scheduler.async_reset_zone_preconditioning_settings(
            self.entity_id
        )

        self.assertEqual(result["minimum_delta_temperature"], 1.0)
        self.assertEqual(result["fallback_minutes_per_degree"], 14.0)
        self.assertEqual(result["room_sensor_assist_max_delta"], 7.2)
        self.assertEqual(result["room_sensor_assist_debounce_seconds"], 35)

    async def test_fahrenheit_thermal_tuning_uses_direct_runtime_bounds(self) -> None:
        self.climate.temperature_unit = lambda _entity_id: "°F"

        minimum = self.scheduler._normalize_preconditioning_for_entity(
            self.entity_id, {"fallback_minutes_per_degree": 0.6}
        )
        maximum = self.scheduler._normalize_preconditioning_for_entity(
            self.entity_id, {"fallback_minutes_per_degree": 66.7}
        )
        invalid = self.scheduler._normalize_preconditioning_for_entity(
            self.entity_id, {"fallback_minutes_per_degree": 0.5}
        )

        self.assertEqual(minimum["fallback_minutes_per_degree"], 0.6)
        self.assertEqual(maximum["fallback_minutes_per_degree"], 66.7)
        self.assertEqual(invalid["fallback_minutes_per_degree"], 14.0)

    async def test_celsius_preconditioning_updates_enforce_runtime_bounds(self) -> None:
        self.climate.temperature_unit = lambda _entity_id: scheduler_module.CELSIUS

        for values in (
            {
                "minimum_delta_temperature": 0,
                "room_sensor_assist_max_delta": 0.1,
                "fallback_minutes_per_degree": 1,
            },
            {
                "minimum_delta_temperature": 5,
                "room_sensor_assist_max_delta": 10,
                "fallback_minutes_per_degree": 120,
            },
        ):
            await self.scheduler.async_update_zone_preconditioning(
                self.entity_id, values
            )

        for key, value in (
            ("minimum_delta_temperature", -0.1),
            ("minimum_delta_temperature", 5.1),
            ("room_sensor_assist_max_delta", 0),
            ("room_sensor_assist_max_delta", 10.1),
            ("fallback_minutes_per_degree", 0.9),
            ("fallback_minutes_per_degree", 120.1),
        ):
            with self.subTest(key=key, value=value):
                with self.assertRaisesRegex(ValueError, "must be between"):
                    await self.scheduler.async_update_zone_preconditioning(
                        self.entity_id, {key: value}
                    )

        self.assertEqual(self.save_count, 2)

    async def test_fahrenheit_preconditioning_updates_enforce_runtime_bounds(self) -> None:
        self.climate.temperature_unit = lambda _entity_id: scheduler_module.FAHRENHEIT

        for values in (
            {
                "minimum_delta_temperature": 0,
                "room_sensor_assist_max_delta": 0.1,
                "fallback_minutes_per_degree": 0.6,
            },
            {
                "minimum_delta_temperature": 9,
                "room_sensor_assist_max_delta": 18,
                "fallback_minutes_per_degree": 66.7,
            },
        ):
            await self.scheduler.async_update_zone_preconditioning(
                self.entity_id, values
            )

        for key, value in (
            ("minimum_delta_temperature", -0.1),
            ("minimum_delta_temperature", 9.1),
            ("room_sensor_assist_max_delta", 0),
            ("room_sensor_assist_max_delta", 18.1),
            ("fallback_minutes_per_degree", 0.5),
            ("fallback_minutes_per_degree", 66.8),
        ):
            with self.subTest(key=key, value=value):
                with self.assertRaisesRegex(ValueError, "must be between"):
                    await self.scheduler.async_update_zone_preconditioning(
                        self.entity_id, {key: value}
                    )

        self.assertEqual(self.save_count, 2)

    async def test_fahrenheit_comfort_missing_or_invalid_uses_runtime_defaults(self) -> None:
        self.climate.temperature_unit = lambda _entity_id: "°F"

        missing = self.scheduler._normalize_comfort_for_entity(self.entity_id, None)
        invalid = self.scheduler._normalize_comfort_for_entity(
            self.entity_id,
            {"temperature_min": 90, "temperature_max": 70},
        )

        self.assertEqual(
            (missing["temperature_min"], missing["temperature_max"]),
            (68.0, 75.0),
        )
        self.assertEqual(
            (invalid["temperature_min"], invalid["temperature_max"]),
            (68.0, 75.0),
        )

    async def test_reset_zone_preconditioning_learning_rejects_unmanaged_entity(
        self,
    ) -> None:
        with self.assertRaises(ValueError):
            await self.scheduler.async_reset_zone_preconditioning_learning(
                "climate.unmanaged",
                "heat",
            )

        self.assertEqual(self.save_count, 0)

    async def test_reset_zone_preconditioning_learning_rejects_unknown_direction(
        self,
    ) -> None:
        with self.assertRaises(ValueError):
            await self.scheduler.async_reset_zone_preconditioning_learning(
                self.entity_id,
                "dry",
            )

        self.assertEqual(self.save_count, 0)

    def test_adaptive_heating_preconditioning_moves_apply_time_earlier(self) -> None:
        self.hass.states[self.entity_id] = SimpleNamespace(
            state="heat",
            attributes={"current_temperature": 18},
        )
        self.data["zones"][self.entity_id]["schedule"]["tuesday"] = [
            {
                "start": "20:00",
                "action": ACTION_SET_TEMPERATURE,
                "temperature": 21,
                "hvac_mode": "heat",
            }
        ]

        event = self.scheduler.calculate_next_event(NOW)

        self.assertIsNotNone(event)
        self.assertEqual(event.when, datetime(2026, 5, 19, 18, 30, tzinfo=timezone.utc))
        self.assertEqual(
            event.target_when,
            datetime(2026, 5, 19, 20, 0, tzinfo=timezone.utc),
        )
        self.assertEqual(event.start, "20:00")

    def test_preconditioning_uses_configured_room_temperature_sensor(self) -> None:
        self.hass.states[self.entity_id] = SimpleNamespace(
            state="heat",
            attributes={"current_temperature": 20},
        )
        self.hass.states["sensor.salon_temperature"] = SimpleNamespace(
            state="18",
            attributes={"unit_of_measurement": "°C"},
        )
        self.data["zones"][self.entity_id]["preconditioning"].update(
            {
                "room_temperature_entity_id": "sensor.salon_temperature",
                "room_sensor_assist_enabled": True,
            }
        )
        self.data["zones"][self.entity_id]["schedule"]["tuesday"] = [
            {
                "start": "20:00",
                "action": ACTION_SET_TEMPERATURE,
                "temperature": 21,
                "hvac_mode": "heat",
            }
        ]

        event = self.scheduler.calculate_next_event(NOW)

        self.assertIsNotNone(event)
        self.assertEqual(event.when, datetime(2026, 5, 19, 18, 30, tzinfo=timezone.utc))

    def test_preconditioning_replan_listens_to_room_temperature_sensor(self) -> None:
        self.hass.states[self.entity_id] = SimpleNamespace(
            state="heat",
            attributes={"current_temperature": 20},
        )
        self.hass.states["sensor.salon_temperature"] = SimpleNamespace(
            state="18",
            attributes={"unit_of_measurement": "°C"},
        )
        self.data["zones"][self.entity_id]["preconditioning"].update(
            {
                "room_temperature_entity_id": "sensor.salon_temperature",
                "room_sensor_assist_enabled": True,
            }
        )
        self.data["zones"][self.entity_id]["schedule"]["tuesday"] = [
            {
                "start": "20:00",
                "action": ACTION_SET_TEMPERATURE,
                "temperature": 21,
                "hvac_mode": "heat",
            }
        ]
        self.scheduler.async_schedule_next_event()

        self.scheduler._handle_preconditioning_replan_state_change(
            SimpleNamespace(
                data={
                    "entity_id": "sensor.salon_temperature",
                    "new_state": SimpleNamespace(
                        state="18.5",
                        attributes={"unit_of_measurement": "°C"},
                    ),
                }
            )
        )

        self.assertIsNotNone(self.scheduler._unsub_preconditioning_replan_timer)

    def test_calculating_preconditioning_for_display_does_not_fire_event(self) -> None:
        self.hass.states[self.entity_id] = SimpleNamespace(
            state="heat",
            attributes={"current_temperature": 18},
        )
        self.data["zones"][self.entity_id]["schedule"]["tuesday"] = [
            {
                "start": "20:00",
                "action": ACTION_SET_TEMPERATURE,
                "temperature": 21,
                "hvac_mode": "heat",
            }
        ]

        event = self.scheduler.calculate_next_event(NOW)

        self.assertIsNotNone(event)
        self.assertEqual(self.hass.bus.events, [])

    def test_scheduling_fires_preconditioning_plan_only_when_it_changes(self) -> None:
        self.hass.states[self.entity_id] = SimpleNamespace(
            state="heat",
            attributes={"current_temperature": 18},
        )
        self.data["zones"][self.entity_id]["schedule"]["tuesday"] = [
            {
                "start": "20:00",
                "action": ACTION_SET_TEMPERATURE,
                "temperature": 21,
                "hvac_mode": "heat",
            }
        ]

        self.scheduler.async_schedule_next_event()
        self.scheduler.async_schedule_next_event()

        planned = [
            data
            for event_type, data in self.hass.bus.events
            if event_type == EVENT_VELAIR
            and data["event"] == EVENT_TYPE_PRECONDITIONING_PLAN_UPDATED
        ]
        self.assertEqual(len(planned), 1)
        self.assertEqual(
            planned[0],
            {
                "domain": "velair",
                "event": EVENT_TYPE_PRECONDITIONING_PLAN_UPDATED,
                "entity_id": self.entity_id,
                "scheduled_when": "2026-05-19T20:00:00+00:00",
                "preconditioning_when": "2026-05-19T18:30:00+00:00",
                "lead_minutes": 90,
                "direction": "heat",
                "target_temperature": 21.0,
                "current_temperature": 18.0,
                "temperature_delta": 3.0,
                "hvac_mode": "heat",
                "model_source": "initial_model",
                "complete_sample_count": 0,
                "partial_sample_count": 0,
                "invalid_sample_count": 0,
                "similar_sample_count": 0,
                "comfort_percentile": 80,
                "used_outdoor_temperature": False,
                "preconditioning_diagnostics": {
                    "direction": "heat",
                    "delta_temperature": 3.0,
                    "complete_sample_count": 0,
                    "partial_sample_count": 0,
                    "invalid_sample_count": 0,
                    "similar_sample_count": 0,
                    "comfort_percentile": 80,
                    "complete_rate_minutes_per_degree": None,
                    "complete_estimate_minutes": 90,
                    "partial_floor_minutes": 0,
                    "combined_estimate_minutes": 90,
                    "rounded_estimate_minutes": 90,
                    "final_lead_minutes": 90,
                    "limited_by_min_start": False,
                    "limited_by_max_lead": False,
                    "source": "initial_model",
                    "used_outdoor_temperature": False,
                    "initial_model_lead_minutes": 90,
                },
                "outdoor_temperature": None,
                "weekday": "tuesday",
                "start": "20:00",
            },
        )

        self.hass.states[self.entity_id] = SimpleNamespace(
            state="heat",
            attributes={"current_temperature": 20},
        )
        self.scheduler.async_schedule_next_event()

        planned = [
            data
            for event_type, data in self.hass.bus.events
            if event_type == EVENT_VELAIR
            and data["event"] == EVENT_TYPE_PRECONDITIONING_PLAN_UPDATED
        ]
        self.assertEqual(len(planned), 2)
        self.assertEqual(planned[-1]["preconditioning_when"], "2026-05-19T19:10:00+00:00")
        self.assertEqual(planned[-1]["lead_minutes"], 50)
        self.assertEqual(planned[-1]["temperature_delta"], 1.0)

    def test_removed_preconditioning_plan_fires_one_cancellation_event(self) -> None:
        self.hass.states[self.entity_id] = SimpleNamespace(
            state="heat",
            attributes={"current_temperature": 18},
        )
        self.data["zones"][self.entity_id]["schedule"]["tuesday"] = [
            {
                "start": "20:00",
                "action": ACTION_SET_TEMPERATURE,
                "temperature": 21,
                "hvac_mode": "heat",
            }
        ]
        self.scheduler.async_schedule_next_event()
        self.hass.bus.events.clear()

        self.data["zones"][self.entity_id]["schedule"]["tuesday"] = []
        self.scheduler.async_schedule_next_event()
        self.scheduler.async_schedule_next_event()

        cancelled = [
            data
            for event_type, data in self.hass.bus.events
            if event_type == EVENT_VELAIR
            and data["event"] == EVENT_TYPE_PRECONDITIONING_PLAN_CANCELLED
        ]
        self.assertEqual(len(cancelled), 1)
        self.assertEqual(cancelled[0]["entity_id"], self.entity_id)
        self.assertEqual(cancelled[0]["scheduled_when"], "2026-05-19T20:00:00+00:00")
        self.assertEqual(
            cancelled[0]["preconditioning_when"],
            "2026-05-19T18:30:00+00:00",
        )
        self.assertEqual(cancelled[0]["lead_minutes"], 90)
        self.assertEqual(cancelled[0]["reason"], "no_longer_planned")

    async def test_leaving_auto_mode_cancels_published_preconditioning_plan(
        self,
    ) -> None:
        self.hass.states[self.entity_id] = SimpleNamespace(
            state="heat",
            attributes={"current_temperature": 18},
        )
        self.data["zones"][self.entity_id]["schedule"]["tuesday"] = [
            {
                "start": "20:00",
                "action": ACTION_SET_TEMPERATURE,
                "temperature": 21,
                "hvac_mode": "heat",
            }
        ]
        self.scheduler.async_schedule_next_event()
        self.hass.bus.events.clear()

        await self.scheduler.async_set_mode(MODE_PAUSED)

        cancelled = [
            data
            for event_type, data in self.hass.bus.events
            if event_type == EVENT_VELAIR
            and data["event"] == EVENT_TYPE_PRECONDITIONING_PLAN_CANCELLED
        ]
        self.assertEqual(len(cancelled), 1)
        self.assertEqual(cancelled[0]["entity_id"], self.entity_id)
        self.assertEqual(cancelled[0]["reason"], "scheduler_not_auto")

    def test_cooling_plan_event_reports_history_model(self) -> None:
        self.hass.states[self.entity_id] = SimpleNamespace(
            state="cool",
            attributes={"current_temperature": 26},
        )
        self.data["preconditioning_learning"] = {
            self.entity_id: _preconditioning_learning(
                [
                    _preconditioning_sample("cool", "complete", minutes, delta_t=3)
                    for minutes in (60, 65, 70, 75, 80)
                ]
            )
        }
        self.data["zones"][self.entity_id]["schedule"]["tuesday"] = [
            {
                "start": "20:00",
                "action": ACTION_SET_TEMPERATURE,
                "temperature": 23,
                "hvac_mode": "cool",
            }
        ]

        self.scheduler.async_schedule_next_event()

        planned = next(
            data
            for event_type, data in self.hass.bus.events
            if event_type == EVENT_VELAIR
            and data["event"] == EVENT_TYPE_PRECONDITIONING_PLAN_UPDATED
        )
        self.assertEqual(planned["direction"], "cool")
        self.assertEqual(planned["model_source"], "history")
        self.assertEqual(planned["complete_sample_count"], 5)
        self.assertEqual(planned["similar_sample_count"], 5)
        self.assertEqual(
            planned["preconditioning_diagnostics"]["source"],
            "history",
        )

    def test_disabled_preconditioning_registers_no_temperature_listener(self) -> None:
        original_tracker = scheduler_module.async_track_state_change_event
        tracker = Mock(return_value=Mock())
        scheduler_module.async_track_state_change_event = tracker
        self.addCleanup(
            setattr,
            scheduler_module,
            "async_track_state_change_event",
            original_tracker,
        )
        self.hass.states[self.entity_id] = SimpleNamespace(
            state="heat",
            attributes={"current_temperature": 18},
        )
        self.data["zones"][self.entity_id]["preconditioning"]["enabled"] = False
        self.data["zones"][self.entity_id]["schedule"]["tuesday"] = [
            {
                "start": "20:00",
                "action": ACTION_SET_TEMPERATURE,
                "temperature": 21,
                "hvac_mode": "heat",
            }
        ]

        self.scheduler.async_schedule_next_event()

        tracker.assert_not_called()
        self.assertEqual(self.scheduler._preconditioning_replan_entities, ())
        self.assertFalse(
            any(
                data.get("event") == EVENT_TYPE_PRECONDITIONING_PLAN_UPDATED
                for _, data in self.hass.bus.events
            )
        )

    async def test_enabling_preconditioning_registers_only_that_climate(self) -> None:
        original_tracker = scheduler_module.async_track_state_change_event
        tracker = Mock(return_value=Mock())
        scheduler_module.async_track_state_change_event = tracker
        self.addCleanup(
            setattr,
            scheduler_module,
            "async_track_state_change_event",
            original_tracker,
        )
        self.hass.states[self.entity_id] = SimpleNamespace(
            state="heat",
            attributes={"current_temperature": 18},
        )
        self.data["zones"][self.entity_id]["preconditioning"]["enabled"] = False
        self.data["zones"][self.entity_id]["schedule"]["tuesday"] = [
            {
                "start": "20:00",
                "action": ACTION_SET_TEMPERATURE,
                "temperature": 21,
                "hvac_mode": "heat",
            }
        ]

        await self.scheduler.async_update_zone_preconditioning(
            self.entity_id,
            {"enabled": True},
        )

        tracker.assert_called_once()
        self.assertEqual(tracker.call_args.args[1], [self.entity_id])
        self.assertEqual(
            self.scheduler._preconditioning_replan_entities,
            (self.entity_id,),
        )

    async def test_disabled_preconditioning_discards_stale_learning_session(self) -> None:
        self.hass.states[self.entity_id] = SimpleNamespace(
            state="heat",
            attributes={"current_temperature": 18},
        )
        self.data["zones"][self.entity_id]["schedule"]["tuesday"] = [
            {
                "start": "20:00",
                "action": ACTION_SET_TEMPERATURE,
                "temperature": 21,
                "hvac_mode": "heat",
            }
        ]
        event = self.scheduler.calculate_next_event(NOW)
        self.assertIsNotNone(event)
        self.scheduler._start_preconditioning_session(
            event,
            "heat",
            datetime(2026, 5, 19, 18, 30, tzinfo=timezone.utc),
        )
        self.assertIn(self.entity_id, self.scheduler._preconditioning_sessions)
        self.data["zones"][self.entity_id]["preconditioning"]["enabled"] = False

        await self.scheduler._async_observe_preconditioning_temperature(
            self.entity_id,
            datetime(2026, 5, 19, 19, 20, tzinfo=timezone.utc),
            20.8,
        )

        self.assertNotIn(self.entity_id, self.scheduler._preconditioning_sessions)
        self.assertEqual(
            _stored_preconditioning_observations(
                self.data,
                self.entity_id,
                "heat",
            ),
            [],
        )

    async def test_disabled_preconditioning_expiration_saves_no_observation(self) -> None:
        self.hass.states[self.entity_id] = SimpleNamespace(
            state="heat",
            attributes={"current_temperature": 18},
        )
        self.data["zones"][self.entity_id]["schedule"]["tuesday"] = [
            {
                "start": "20:00",
                "action": ACTION_SET_TEMPERATURE,
                "temperature": 21,
                "hvac_mode": "heat",
            }
        ]
        event = self.scheduler.calculate_next_event(NOW)
        self.assertIsNotNone(event)
        self.scheduler._start_preconditioning_session(
            event,
            "heat",
            datetime(2026, 5, 19, 18, 30, tzinfo=timezone.utc),
        )
        self.data["zones"][self.entity_id]["preconditioning"]["enabled"] = False

        await self.scheduler._async_expire_preconditioning_sessions(
            datetime(2026, 5, 19, 20, 0, tzinfo=timezone.utc)
        )

        self.assertNotIn(self.entity_id, self.scheduler._preconditioning_sessions)
        self.assertEqual(
            _stored_preconditioning_observations(
                self.data,
                self.entity_id,
                "heat",
            ),
            [],
        )

    def test_adaptive_heating_preconditioning_skips_when_target_is_already_met(self) -> None:
        self.hass.states[self.entity_id] = SimpleNamespace(
            state="heat",
            attributes={"current_temperature": 21.2},
        )
        self.data["zones"][self.entity_id]["schedule"]["tuesday"] = [
            {
                "start": "20:00",
                "action": ACTION_SET_TEMPERATURE,
                "temperature": 21,
                "hvac_mode": "heat",
            }
        ]

        event = self.scheduler.calculate_next_event(NOW)

        self.assertIsNotNone(event)
        self.assertEqual(event.when, datetime(2026, 5, 19, 20, 0, tzinfo=timezone.utc))
        self.assertIsNone(event.target_when)

    async def test_due_preconditioning_event_applies_target_temperature(self) -> None:
        self.hass.states[self.entity_id] = SimpleNamespace(
            state="heat",
            attributes={"current_temperature": 18},
        )
        self.data["zones"][self.entity_id]["schedule"]["tuesday"] = [
            {
                "start": "20:00",
                "action": ACTION_SET_TEMPERATURE,
                "temperature": 21,
                "hvac_mode": "heat",
            }
        ]

        await self.scheduler._handle_timer(
            datetime(2026, 5, 19, 18, 30, tzinfo=timezone.utc)
        )

        self.assertEqual(
            self.climate.calls,
            [("set_temperature", self.entity_id, 21.0, True, "heat")],
        )
        self.assertIn(
            (
                EVENT_VELAIR,
                {
                    "domain": "velair",
                    "event": EVENT_TYPE_CLIMATE_TARGET_APPLIED,
                    "entity_id": self.entity_id,
                    "action": ACTION_SET_TEMPERATURE,
                    "temperature": 21.0,
                    "hvac_mode": "heat",
                    "weekday": "tuesday",
                    "start": "20:00",
                    "source": "scheduled_event",
                    "target_when": "2026-05-19T20:00:00+00:00",
                },
            ),
            self.hass.bus.events,
        )

    async def test_schedule_change_reapplies_same_due_preconditioning_target(
        self,
    ) -> None:
        self.hass.states[self.entity_id] = SimpleNamespace(
            state="heat",
            attributes={"current_temperature": 18},
        )
        block = {
            "start": "19:00",
            "action": ACTION_SET_TEMPERATURE,
            "temperature": 21,
            "hvac_mode": "heat",
        }
        self.data["zones"][self.entity_id]["schedule"]["tuesday"] = [block.copy()]
        stale_event = self.scheduler.calculate_next_event(NOW)
        self.assertIsNotNone(stale_event)
        self.assertLess(stale_event.when, NOW)
        self.assertEqual(
            stale_event.target_when,
            datetime(2026, 5, 19, 19, 0, tzinfo=timezone.utc),
        )
        self.scheduler._mark_preconditioning_applied(stale_event)

        await self.scheduler.async_set_daily_schedule(
            self.entity_id,
            "tuesday",
            [block.copy()],
        )
        await asyncio.sleep(0)

        self.assertEqual(
            self.climate.calls,
            [("set_temperature", self.entity_id, 21.0, True, "heat")],
        )

    async def test_room_sensor_assist_applies_dynamic_heat_target(self) -> None:
        self.hass.states[self.entity_id] = SimpleNamespace(
            state="heat",
            attributes={"current_temperature": 22, "temperature": 22},
        )
        self.hass.states["sensor.salon_temperature"] = SimpleNamespace(
            state="20.5",
            attributes={"unit_of_measurement": "°C"},
        )
        self.data["zones"][self.entity_id]["preconditioning"].update(
            {
                "enabled": False,
                "room_temperature_entity_id": "sensor.salon_temperature",
                "room_sensor_assist_enabled": True,
                "room_sensor_assist_max_delta": 2,
            }
        )
        self.data["zones"][self.entity_id]["schedule"]["tuesday"] = [
            {
                "start": "17:00",
                "action": ACTION_SET_TEMPERATURE,
                "temperature": 22,
                "hvac_mode": "heat",
            }
        ]

        await self.scheduler.async_apply_current_schedule()

        self.assertEqual(
            self.climate.calls[-2:],
            [
                ("set_temperature", self.entity_id, 22.0, True, "heat"),
                ("set_temperature", self.entity_id, 23.5, True, "heat"),
            ],
        )
        events = [
            event_data
            for event_type, event_data in self.hass.bus.events
            if event_type == EVENT_VELAIR
            and event_data["event"] == EVENT_TYPE_ROOM_SENSOR_ASSIST_UPDATED
        ]
        self.assertEqual(events[-1]["room_temperature_entity_id"], "sensor.salon_temperature")
        self.assertEqual(events[-1]["target_temperature"], 22.0)
        self.assertEqual(events[-1]["applied_temperature"], 23.5)
        self.assertEqual(events[-1]["assist_delta"], 1.5)

    async def test_room_sensor_assist_works_without_adaptive_preconditioning(
        self,
    ) -> None:
        self.hass.states[self.entity_id] = SimpleNamespace(
            state="heat",
            attributes={"current_temperature": 17.1, "temperature": 21},
        )
        self.hass.states["sensor.salon_temperature"] = SimpleNamespace(
            state="20",
            attributes={"unit_of_measurement": "°C"},
        )
        self.data["zones"][self.entity_id]["preconditioning"].update(
            {
                "enabled": False,
                "room_temperature_entity_id": "sensor.salon_temperature",
                "room_sensor_assist_enabled": True,
                "room_sensor_assist_max_delta": 5,
            }
        )
        self.data["zones"][self.entity_id]["schedule"]["tuesday"] = [
            {
                "start": "17:00",
                "action": ACTION_SET_TEMPERATURE,
                "temperature": 25,
                "hvac_mode": "heat",
            }
        ]

        await self.scheduler.async_apply_current_schedule()

        self.assertEqual(
            self.climate.calls[-2:],
            [
                ("set_temperature", self.entity_id, 25.0, True, "heat"),
                ("set_temperature", self.entity_id, 22.0, True, "heat"),
            ],
        )

    async def test_room_sensor_assist_status_explains_active_adjustment(self) -> None:
        self.hass.states[self.entity_id] = SimpleNamespace(
            state="heat",
            attributes={"current_temperature": 17.1, "temperature": 21},
        )
        self.hass.states["sensor.salon_temperature"] = SimpleNamespace(
            state="20",
            attributes={"unit_of_measurement": "°C"},
        )
        self.data["zones"][self.entity_id]["preconditioning"].update(
            {
                "enabled": False,
                "room_temperature_entity_id": "sensor.salon_temperature",
                "room_sensor_assist_enabled": True,
                "room_sensor_assist_max_delta": 5,
            }
        )
        self.data["zones"][self.entity_id]["schedule"]["tuesday"] = [
            {
                "start": "17:00",
                "action": ACTION_SET_TEMPERATURE,
                "temperature": 25,
                "hvac_mode": "heat",
            }
        ]

        await self.scheduler.async_apply_current_schedule()

        status = self.scheduler.get_room_sensor_assist_statuses()[self.entity_id]
        self.assertEqual(status["status"], "assisting")
        self.assertEqual(status["room_temperature_entity_id"], "sensor.salon_temperature")
        self.assertEqual(status["target_temperature"], 25.0)
        self.assertEqual(status["applied_temperature"], 22.0)
        self.assertEqual(status["climate_target_temperature"], 21.0)
        self.assertEqual(status["room_temperature"], 20.0)
        self.assertEqual(status["climate_temperature"], 17.1)
        self.assertEqual(status["assist_delta"], 5.0)
        self.assertEqual(status["direction"], "heat")
        self.assertEqual(status["start"], "17:00")
        self.assertEqual(status["active_from"], "2026-05-19T18:00:00+00:00")
        self.assertIsNone(status["target_when"])

    async def test_room_sensor_assist_status_ignores_removed_active_block(
        self,
    ) -> None:
        self.hass.states[self.entity_id] = SimpleNamespace(
            state="heat",
            attributes={"current_temperature": 17.1, "temperature": 25},
        )
        self.hass.states["sensor.salon_temperature"] = SimpleNamespace(
            state="17",
            attributes={"unit_of_measurement": "°C"},
        )
        self.data["zones"][self.entity_id]["preconditioning"].update(
            {
                "enabled": False,
                "room_temperature_entity_id": "sensor.salon_temperature",
                "room_sensor_assist_enabled": True,
                "room_sensor_assist_max_delta": 8,
            }
        )
        self.data["zones"][self.entity_id]["schedule"]["tuesday"] = [
            {
                "start": "09:45",
                "action": ACTION_SET_TEMPERATURE,
                "temperature": 25,
                "hvac_mode": "heat",
            }
        ]
        await self.scheduler.async_apply_current_schedule()
        self.assertIn(self.entity_id, self.scheduler._room_sensor_assist_states)

        self.data["zones"][self.entity_id]["schedule"]["tuesday"] = []

        status = self.scheduler.get_room_sensor_assist_statuses()[self.entity_id]
        self.assertEqual(status["status"], "idle")
        self.assertIsNone(status["target_temperature"])
        self.assertIsNone(status["applied_temperature"])
        self.assertIsNone(status["start"])
        self.assertIsNone(status["active_from"])
        self.assertIsNone(status["target_when"])

    async def test_room_sensor_assist_refresh_clears_removed_active_block(
        self,
    ) -> None:
        self.hass.states[self.entity_id] = SimpleNamespace(
            state="heat",
            attributes={"current_temperature": 17.1, "temperature": 25},
        )
        self.hass.states["sensor.salon_temperature"] = SimpleNamespace(
            state="17",
            attributes={"unit_of_measurement": "°C"},
        )
        self.data["zones"][self.entity_id]["preconditioning"].update(
            {
                "enabled": False,
                "room_temperature_entity_id": "sensor.salon_temperature",
                "room_sensor_assist_enabled": True,
                "room_sensor_assist_max_delta": 8,
            }
        )
        self.data["zones"][self.entity_id]["schedule"]["tuesday"] = [
            {
                "start": "09:45",
                "action": ACTION_SET_TEMPERATURE,
                "temperature": 25,
                "hvac_mode": "heat",
            }
        ]
        await self.scheduler.async_apply_current_schedule()
        self.assertIn(self.entity_id, self.scheduler._room_sensor_assist_states)
        self.data["zones"][self.entity_id]["schedule"]["tuesday"] = []

        await self.scheduler._async_refresh_room_sensor_assist_from_current_event(
            self.entity_id
        )

        self.assertNotIn(self.entity_id, self.scheduler._room_sensor_assist_states)

    async def test_room_sensor_assist_missing_step_is_unavailable_and_only_restores(
        self,
    ) -> None:
        self.climate.steps[self.entity_id] = 0.5
        self.hass.states[self.entity_id] = SimpleNamespace(
            state="heat",
            attributes={"current_temperature": 17.1, "temperature": 25},
        )
        self.hass.states["sensor.salon_temperature"] = SimpleNamespace(
            state="20",
            attributes={"unit_of_measurement": "°C"},
        )
        self.data["zones"][self.entity_id]["preconditioning"].update(
            {
                "room_temperature_entity_id": "sensor.salon_temperature",
                "room_sensor_assist_enabled": True,
                "room_sensor_assist_max_delta": 5,
            }
        )
        self.data["zones"][self.entity_id]["schedule"]["tuesday"] = [
            {
                "start": "17:00",
                "action": ACTION_SET_TEMPERATURE,
                "temperature": 25,
                "hvac_mode": "heat",
            }
        ]
        await self.scheduler._async_refresh_room_sensor_assist(
            self.entity_id,
            target_temperature=25,
            hvac_mode="heat",
            weekday="tuesday",
            start="17:00",
            reason="test",
        )
        self.assertIn(self.entity_id, self.scheduler._room_sensor_assist_states)

        self.climate.temperature_step = lambda _entity_id: None
        status = self.scheduler._room_sensor_assist_status(self.entity_id)

        self.assertEqual(status["status"], "unavailable")
        self.assertEqual(status["reason"], "missing_target_step")
        self.assertIsNone(status["applied_temperature"])
        self.assertIsNone(status["direction"])
        self.assertEqual(status["assist_delta"], 0.0)

        self.climate.calls.clear()
        await self.scheduler._async_refresh_room_sensor_assist(
            self.entity_id,
            target_temperature=25,
            hvac_mode="heat",
            weekday="tuesday",
            start="17:00",
            reason="test",
        )

        self.assertNotIn(self.entity_id, self.scheduler._room_sensor_assist_states)
        self.assertEqual(len(self.climate.calls), 1)
        self.assertEqual(self.climate.calls[0][0], "set_temperature")
        self.assertEqual(self.climate.calls[0][2], 25)

    async def test_enable_room_sensor_assist_requires_configured_sensor(self) -> None:
        with self.assertRaisesRegex(ValueError, "requires a configured room"):
            await self.scheduler.async_set_room_sensor_assist(self.entity_id, True)

        self.data["zones"][self.entity_id]["preconditioning"].update(
            {"room_temperature_entity_id": "sensor.salon_temperature"}
        )

        await self.scheduler.async_set_room_sensor_assist(self.entity_id, True)
        await self.scheduler.async_set_room_sensor_assist(self.entity_id, True)

        self.assertTrue(
            self.data["zones"][self.entity_id]["preconditioning"][
                "room_sensor_assist_enabled"
            ]
        )
        state_events = [
            event_data
            for event_type, event_data in self.hass.bus.events
            if event_type == EVENT_VELAIR
            and event_data["event"] == EVENT_TYPE_ROOM_SENSOR_ASSIST_STATE_CHANGED
        ]
        self.assertEqual(
            state_events,
            [
                {
                    "domain": "velair",
                    "event": EVENT_TYPE_ROOM_SENSOR_ASSIST_STATE_CHANGED,
                    "entity_id": self.entity_id,
                    "enabled": True,
                    "previous_enabled": False,
                    "room_temperature_entity_id": "sensor.salon_temperature",
                    "max_delta": 2.0,
                    "debounce_seconds": 20,
                }
            ],
        )

    async def test_disable_room_sensor_assist_clears_active_assist(self) -> None:
        self.hass.states[self.entity_id] = SimpleNamespace(
            state="heat",
            attributes={"current_temperature": 17.1, "temperature": 21},
        )
        self.hass.states["sensor.salon_temperature"] = SimpleNamespace(
            state="20",
            attributes={"unit_of_measurement": "°C"},
        )
        self.data["zones"][self.entity_id]["preconditioning"].update(
            {
                "room_temperature_entity_id": "sensor.salon_temperature",
                "room_sensor_assist_enabled": True,
                "room_sensor_assist_max_delta": 5,
            }
        )
        self.data["zones"][self.entity_id]["schedule"]["tuesday"] = [
            {
                "start": "17:00",
                "action": ACTION_SET_TEMPERATURE,
                "temperature": 25,
                "hvac_mode": "heat",
            }
        ]
        await self.scheduler.async_apply_current_schedule()

        await self.scheduler.async_set_room_sensor_assist(self.entity_id, False)

        self.assertFalse(
            self.data["zones"][self.entity_id]["preconditioning"][
                "room_sensor_assist_enabled"
            ]
        )
        self.assertNotIn(self.entity_id, self.scheduler._room_sensor_assist_states)
        self.assertEqual(
            self.climate.calls[-1],
            ("set_temperature", self.entity_id, 25.0, False, "heat"),
        )
        state_event = next(
            event_data
            for event_type, event_data in self.hass.bus.events
            if event_type == EVENT_VELAIR
            and event_data["event"] == EVENT_TYPE_ROOM_SENSOR_ASSIST_STATE_CHANGED
        )
        self.assertFalse(state_event["enabled"])
        self.assertTrue(state_event["previous_enabled"])
        self.assertEqual(
            state_event["room_temperature_entity_id"],
            "sensor.salon_temperature",
        )

    async def test_room_sensor_assist_aligns_heat_target_to_climate_step(self) -> None:
        self.climate.steps[self.entity_id] = 0.5
        self.hass.states[self.entity_id] = SimpleNamespace(
            state="heat",
            attributes={"current_temperature": 17.1, "temperature": 21},
        )
        self.hass.states["sensor.salon_temperature"] = SimpleNamespace(
            state="18",
            attributes={"unit_of_measurement": "°C"},
        )
        self.data["zones"][self.entity_id]["preconditioning"].update(
            {
                "enabled": False,
                "room_temperature_entity_id": "sensor.salon_temperature",
                "room_sensor_assist_enabled": True,
                "room_sensor_assist_max_delta": 2,
            }
        )
        self.data["zones"][self.entity_id]["schedule"]["tuesday"] = [
            {
                "start": "17:00",
                "action": ACTION_SET_TEMPERATURE,
                "temperature": 21,
                "hvac_mode": "heat",
            }
        ]

        await self.scheduler.async_apply_current_schedule()

        self.assertEqual(
            self.climate.calls[-2:],
            [
                ("set_temperature", self.entity_id, 21.0, True, "heat"),
                ("set_temperature", self.entity_id, 19.0, True, "heat"),
            ],
        )

    async def test_room_sensor_assist_keeps_watching_after_heat_target_reached(
        self,
    ) -> None:
        self.climate.steps[self.entity_id] = 0.5
        self.hass.states[self.entity_id] = SimpleNamespace(
            state="heat",
            attributes={"current_temperature": 17.1, "temperature": 21},
        )
        self.hass.states["sensor.salon_temperature"] = SimpleNamespace(
            state="21.5",
            attributes={"unit_of_measurement": "°C"},
        )
        self.data["zones"][self.entity_id]["preconditioning"].update(
            {
                "enabled": False,
                "room_temperature_entity_id": "sensor.salon_temperature",
                "room_sensor_assist_enabled": True,
                "room_sensor_assist_max_delta": 2,
            }
        )
        self.data["zones"][self.entity_id]["schedule"]["tuesday"] = [
            {
                "start": "17:00",
                "action": ACTION_SET_TEMPERATURE,
                "temperature": 21,
                "hvac_mode": "heat",
            }
        ]

        await self.scheduler.async_apply_current_schedule()

        self.assertEqual(
            self.climate.calls[-2:],
            [
                ("set_temperature", self.entity_id, 21.0, True, "heat"),
                ("set_temperature", self.entity_id, 17.0, False, "heat"),
            ],
        )
        self.assertIn(self.entity_id, self.scheduler._room_sensor_assist_states)
        self.hass.states["sensor.salon_temperature"] = SimpleNamespace(
            state="19",
            attributes={"unit_of_measurement": "°C"},
        )
        self.climate.calls.clear()

        await self.scheduler._async_refresh_room_sensor_assist_from_current_event(
            self.entity_id
        )

        self.assertEqual(
            self.climate.calls,
            [("set_temperature", self.entity_id, 19.0, True, "heat")],
        )
    async def test_room_sensor_assist_recalculates_when_active_heat_target_increases(
        self,
    ) -> None:
        self.climate.steps[self.entity_id] = 0.5
        self.hass.states[self.entity_id] = SimpleNamespace(
            state="heat",
            attributes={"current_temperature": 17.1, "temperature": 21},
        )
        self.hass.states["sensor.salon_temperature"] = SimpleNamespace(
            state="21.5",
            attributes={"unit_of_measurement": "°C"},
        )
        self.data["zones"][self.entity_id]["preconditioning"].update(
            {
                "enabled": False,
                "room_temperature_entity_id": "sensor.salon_temperature",
                "room_sensor_assist_enabled": True,
                "room_sensor_assist_max_delta": 2,
            }
        )
        self.data["zones"][self.entity_id]["schedule"]["tuesday"] = [
            {
                "start": "17:00",
                "action": ACTION_SET_TEMPERATURE,
                "temperature": 21,
                "hvac_mode": "heat",
            }
        ]
        await self.scheduler.async_apply_current_schedule()
        self.climate.calls.clear()
        self.hass.states["sensor.salon_temperature"] = SimpleNamespace(
            state="22",
            attributes={"unit_of_measurement": "°C"},
        )

        await self.scheduler.async_set_daily_schedule(
            self.entity_id,
            "tuesday",
            [
                {
                    "start": "17:00",
                    "action": ACTION_SET_TEMPERATURE,
                    "temperature": 24,
                    "hvac_mode": "heat",
                }
            ],
        )

        self.assertEqual(
            self.climate.calls[-2:],
            [
                ("set_temperature", self.entity_id, 24.0, True, "heat"),
                ("set_temperature", self.entity_id, 19.0, True, "heat"),
            ],
        )

    def test_room_sensor_assist_listens_to_active_block_without_existing_state(
        self,
    ) -> None:
        original_tracker = scheduler_module.async_track_state_change_event
        tracker = Mock(return_value=Mock())
        scheduler_module.async_track_state_change_event = tracker
        self.addCleanup(
            setattr,
            scheduler_module,
            "async_track_state_change_event",
            original_tracker,
        )
        self.hass.states[self.entity_id] = SimpleNamespace(
            state="heat",
            attributes={"current_temperature": 17.1, "temperature": 21},
        )
        self.hass.states["sensor.salon_temperature"] = SimpleNamespace(
            state="20",
            attributes={"unit_of_measurement": "°C"},
        )
        self.data["zones"][self.entity_id]["preconditioning"].update(
            {
                "room_temperature_entity_id": "sensor.salon_temperature",
                "room_sensor_assist_enabled": True,
                "room_sensor_assist_max_delta": 2,
            }
        )
        self.data["zones"][self.entity_id]["schedule"]["tuesday"] = [
            {
                "start": "17:00",
                "action": ACTION_SET_TEMPERATURE,
                "temperature": 21,
                "hvac_mode": "heat",
            }
        ]

        self.scheduler.async_schedule_next_event()

        self.assertEqual(self.scheduler._room_sensor_assist_states, {})
        self.assertEqual(
            self.scheduler._room_sensor_assist_entities,
            (self.entity_id, "sensor.salon_temperature"),
        )
        self.assertIn(
            [self.entity_id, "sensor.salon_temperature"],
            [call.args[1] for call in tracker.call_args_list],
        )

    async def test_room_sensor_assist_refreshes_active_block_without_existing_state(
        self,
    ) -> None:
        self.climate.steps[self.entity_id] = 0.5
        self.hass.states[self.entity_id] = SimpleNamespace(
            state="heat",
            attributes={"current_temperature": 17.1, "temperature": 21},
        )
        self.hass.states["sensor.salon_temperature"] = SimpleNamespace(
            state="20",
            attributes={"unit_of_measurement": "°C"},
        )
        self.data["zones"][self.entity_id]["preconditioning"].update(
            {
                "room_temperature_entity_id": "sensor.salon_temperature",
                "room_sensor_assist_enabled": True,
                "room_sensor_assist_max_delta": 2,
            }
        )
        self.data["zones"][self.entity_id]["schedule"]["tuesday"] = [
            {
                "start": "17:00",
                "action": ACTION_SET_TEMPERATURE,
                "temperature": 21,
                "hvac_mode": "heat",
            }
        ]
        self.scheduler.async_schedule_next_event()
        self.assertEqual(self.scheduler._room_sensor_assist_states, {})

        self.scheduler._handle_room_sensor_assist_timer(NOW)
        await asyncio.sleep(0)

        self.assertEqual(
            self.climate.calls,
            [("set_temperature", self.entity_id, 18.0, True, "heat")],
        )

    async def test_room_sensor_assist_sensor_change_refreshes_active_block(
        self,
    ) -> None:
        self.climate.steps[self.entity_id] = 0.5
        self.hass.states[self.entity_id] = SimpleNamespace(
            state="heat",
            attributes={"current_temperature": 17.1, "temperature": 25},
        )
        self.hass.states["sensor.salon_temperature"] = SimpleNamespace(
            state="21",
            attributes={"unit_of_measurement": "°C"},
        )
        self.data["zones"][self.entity_id]["preconditioning"].update(
            {
                "room_temperature_entity_id": "sensor.salon_temperature",
                "room_sensor_assist_enabled": True,
                "room_sensor_assist_max_delta": 4,
            }
        )
        self.data["zones"][self.entity_id]["schedule"]["tuesday"] = [
            {
                "start": "17:00",
                "action": ACTION_SET_TEMPERATURE,
                "temperature": 25,
                "hvac_mode": "heat",
            }
        ]

        self.scheduler.async_schedule_next_event()
        self.assertEqual(self.climate.calls, [])

        self.scheduler._handle_room_sensor_assist_state_change(
            SimpleNamespace(data={"entity_id": "sensor.salon_temperature"})
        )
        self.assertIsNotNone(self.scheduler._unsub_room_sensor_assist_timer)
        self.scheduler._handle_room_sensor_assist_timer(NOW)
        await asyncio.sleep(0)

        self.assertEqual(
            self.climate.calls,
            [("set_temperature", self.entity_id, 21.0, True, "heat")],
        )

    async def test_room_sensor_assist_zero_debounce_refreshes_immediately(
        self,
    ) -> None:
        self.climate.steps[self.entity_id] = 0.5
        self.hass.states[self.entity_id] = SimpleNamespace(
            state="heat",
            attributes={"current_temperature": 17.1, "temperature": 25},
        )
        self.hass.states["sensor.salon_temperature"] = SimpleNamespace(
            state="21",
            attributes={"unit_of_measurement": "°C"},
        )
        self.data["zones"][self.entity_id]["preconditioning"].update(
            {
                "room_temperature_entity_id": "sensor.salon_temperature",
                "room_sensor_assist_enabled": True,
                "room_sensor_assist_max_delta": 4,
                "room_sensor_assist_debounce_seconds": 0,
            }
        )
        self.data["zones"][self.entity_id]["schedule"]["tuesday"] = [
            {
                "start": "17:00",
                "action": ACTION_SET_TEMPERATURE,
                "temperature": 25,
                "hvac_mode": "heat",
            }
        ]

        self.scheduler.async_schedule_next_event()
        self.scheduler._handle_room_sensor_assist_state_change(
            SimpleNamespace(data={"entity_id": "sensor.salon_temperature"})
        )
        await asyncio.sleep(0)

        self.assertIsNone(self.scheduler._unsub_room_sensor_assist_timer)
        self.assertEqual(
            self.climate.calls,
            [("set_temperature", self.entity_id, 21.0, True, "heat")],
        )

    async def test_room_sensor_assist_caps_heat_delta_at_max_delta(self) -> None:
        self.climate.steps[self.entity_id] = 0.5
        self.hass.states[self.entity_id] = SimpleNamespace(
            state="heat",
            attributes={"current_temperature": 17.1, "temperature": 25},
        )
        self.hass.states["sensor.salon_temperature"] = SimpleNamespace(
            state="18",
            attributes={"unit_of_measurement": "°C"},
        )
        self.data["zones"][self.entity_id]["preconditioning"].update(
            {
                "room_temperature_entity_id": "sensor.salon_temperature",
                "room_sensor_assist_enabled": True,
                "room_sensor_assist_max_delta": 6,
            }
        )
        self.data["zones"][self.entity_id]["schedule"]["tuesday"] = [
            {
                "start": "17:00",
                "action": ACTION_SET_TEMPERATURE,
                "temperature": 25,
                "hvac_mode": "heat",
            }
        ]

        self.scheduler.async_schedule_next_event()
        self.scheduler._handle_room_sensor_assist_state_change(
            SimpleNamespace(data={"entity_id": "sensor.salon_temperature"})
        )
        self.scheduler._handle_room_sensor_assist_timer(NOW)
        await asyncio.sleep(0)

        self.assertEqual(
            self.climate.calls,
            [("set_temperature", self.entity_id, 23.0, True, "heat")],
        )

    async def test_room_sensor_assist_uses_due_preconditioning_without_session(
        self,
    ) -> None:
        self.climate.steps[self.entity_id] = 0.5
        self.hass.states[self.entity_id] = SimpleNamespace(
            state="heat",
            attributes={"current_temperature": 17.1, "temperature": 20},
        )
        self.hass.states["sensor.salon_temperature"] = SimpleNamespace(
            state="22",
            attributes={"unit_of_measurement": "°C"},
        )
        self.data["zones"][self.entity_id]["preconditioning"].update(
            {
                "room_temperature_entity_id": "sensor.salon_temperature",
                "room_sensor_assist_enabled": True,
                "room_sensor_assist_max_delta": 5,
            }
        )
        self.data["zones"][self.entity_id]["schedule"]["tuesday"] = [
            {
                "start": "19:00",
                "action": ACTION_SET_TEMPERATURE,
                "temperature": 24,
                "hvac_mode": "heat",
            }
        ]

        status = self.scheduler.get_room_sensor_assist_statuses()[self.entity_id]
        self.assertEqual(status["status"], "ready")
        self.assertEqual(status["target_temperature"], 24.0)
        self.assertIsNone(status["applied_temperature"])
        self.assertEqual(status["start"], "19:00")
        self.assertEqual(status["active_from"], "2026-05-19T17:50:00+00:00")
        self.assertEqual(status["target_when"], "2026-05-19T19:00:00+00:00")

        await self.scheduler._async_refresh_room_sensor_assist_from_current_event(
            self.entity_id
        )

        self.assertEqual(
            self.climate.calls,
            [("set_temperature", self.entity_id, 19.0, True, "heat")],
        )

    async def test_room_sensor_assist_status_prefers_applied_preconditioning_time(
        self,
    ) -> None:
        self.hass.states[self.entity_id] = SimpleNamespace(
            state="heat",
            attributes={"current_temperature": 17.1, "temperature": 20},
        )
        self.hass.states["sensor.salon_temperature"] = SimpleNamespace(
            state="22",
            attributes={"unit_of_measurement": "°C"},
        )
        self.data["zones"][self.entity_id]["preconditioning"].update(
            {
                "room_temperature_entity_id": "sensor.salon_temperature",
                "room_sensor_assist_enabled": True,
                "room_sensor_assist_max_delta": 5,
            }
        )
        self.data["zones"][self.entity_id]["schedule"]["tuesday"] = [
            {
                "start": "19:00",
                "action": ACTION_SET_TEMPERATURE,
                "temperature": 24,
                "hvac_mode": "heat",
            }
        ]
        event = self.scheduler.calculate_next_event(NOW)
        self.assertIsNotNone(event)
        self.assertEqual(event.when, datetime(2026, 5, 19, 17, 50, tzinfo=timezone.utc))
        self.scheduler._mark_preconditioning_applied(event)
        self.scheduler._start_preconditioning_session(event, "heat", NOW)

        status = self.scheduler.get_room_sensor_assist_statuses()[self.entity_id]

        self.assertEqual(status["status"], "ready")
        self.assertEqual(status["target_temperature"], 24.0)
        self.assertEqual(status["start"], "19:00")
        self.assertEqual(status["active_from"], "2026-05-19T17:50:00+00:00")
        self.assertEqual(status["target_when"], "2026-05-19T19:00:00+00:00")

    async def test_room_sensor_assist_keeps_preconditioning_target_during_session(
        self,
    ) -> None:
        self.climate.steps[self.entity_id] = 0.5
        self.hass.states[self.entity_id] = SimpleNamespace(
            state="heat",
            attributes={"current_temperature": 17.1, "temperature": 21},
        )
        self.hass.states["sensor.salon_temperature"] = SimpleNamespace(
            state="18",
            attributes={"unit_of_measurement": "°C"},
        )
        self.data["zones"][self.entity_id]["preconditioning"].update(
            {
                "room_temperature_entity_id": "sensor.salon_temperature",
                "room_sensor_assist_enabled": True,
                "room_sensor_assist_max_delta": 5,
            }
        )
        self.data["zones"][self.entity_id]["schedule"]["tuesday"] = [
            {
                "start": "17:00",
                "action": ACTION_SET_TEMPERATURE,
                "temperature": 21,
                "hvac_mode": "heat",
            },
            {
                "start": "20:00",
                "action": ACTION_SET_TEMPERATURE,
                "temperature": 25,
                "hvac_mode": "heat",
            },
        ]

        await self.scheduler._handle_timer(NOW)

        self.assertEqual(
            self.climate.calls[-2:],
            [
                ("set_temperature", self.entity_id, 25.0, True, "heat"),
                ("set_temperature", self.entity_id, 22.0, True, "heat"),
            ],
        )
        self.climate.calls.clear()
        self.hass.states["sensor.salon_temperature"] = SimpleNamespace(
            state="20",
            attributes={"unit_of_measurement": "°C"},
        )

        self.scheduler._handle_room_sensor_assist_state_change(
            SimpleNamespace(data={"entity_id": "sensor.salon_temperature"})
        )
        self.scheduler._handle_room_sensor_assist_timer(NOW)
        await asyncio.sleep(0)

        self.assertEqual(self.climate.calls, [])
        self.assertEqual(
            self.scheduler._room_sensor_assist_states[self.entity_id].target_temperature,
            25.0,
        )

    async def test_room_sensor_assist_keeps_runtime_target_if_session_is_missing(
        self,
    ) -> None:
        self.climate.steps[self.entity_id] = 0.5
        self.hass.states[self.entity_id] = SimpleNamespace(
            state="heat",
            attributes={"current_temperature": 17.1, "temperature": 21},
        )
        self.hass.states["sensor.salon_temperature"] = SimpleNamespace(
            state="18",
            attributes={"unit_of_measurement": "°C"},
        )
        self.data["zones"][self.entity_id]["preconditioning"].update(
            {
                "room_temperature_entity_id": "sensor.salon_temperature",
                "room_sensor_assist_enabled": True,
                "room_sensor_assist_max_delta": 5,
            }
        )
        self.data["zones"][self.entity_id]["schedule"]["tuesday"] = [
            {
                "start": "17:00",
                "action": ACTION_SET_TEMPERATURE,
                "temperature": 21,
                "hvac_mode": "heat",
            },
            {
                "start": "20:00",
                "action": ACTION_SET_TEMPERATURE,
                "temperature": 25,
                "hvac_mode": "heat",
            },
        ]
        await self.scheduler._handle_timer(NOW)
        self.assertEqual(
            self.scheduler._room_sensor_assist_states[self.entity_id].target_temperature,
            25.0,
        )
        self.scheduler._preconditioning_sessions.pop(self.entity_id)
        self.climate.calls.clear()
        self.hass.states["sensor.salon_temperature"] = SimpleNamespace(
            state="20",
            attributes={"unit_of_measurement": "°C"},
        )

        self.scheduler._handle_room_sensor_assist_state_change(
            SimpleNamespace(data={"entity_id": "sensor.salon_temperature"})
        )
        self.scheduler._handle_room_sensor_assist_timer(NOW)
        await asyncio.sleep(0)

        self.assertEqual(self.climate.calls, [])
        self.assertEqual(
            self.scheduler._room_sensor_assist_states[self.entity_id].target_temperature,
            25.0,
        )

    async def test_room_sensor_assist_keeps_cooling_preconditioning_target(
        self,
    ) -> None:
        self.climate.steps[self.entity_id] = 0.5
        self.hass.states[self.entity_id] = SimpleNamespace(
            state="cool",
            attributes={"current_temperature": 25.1, "temperature": 24},
        )
        self.hass.states["sensor.salon_temperature"] = SimpleNamespace(
            state="26",
            attributes={"unit_of_measurement": "°C"},
        )
        self.data["zones"][self.entity_id]["preconditioning"].update(
            {
                "room_temperature_entity_id": "sensor.salon_temperature",
                "room_sensor_assist_enabled": True,
                "room_sensor_assist_max_delta": 3,
            }
        )
        self.data["zones"][self.entity_id]["schedule"]["tuesday"] = [
            {
                "start": "17:00",
                "action": ACTION_SET_TEMPERATURE,
                "temperature": 24,
                "hvac_mode": "cool",
            },
            {
                "start": "20:00",
                "action": ACTION_SET_TEMPERATURE,
                "temperature": 20,
                "hvac_mode": "cool",
            },
        ]

        await self.scheduler._handle_timer(NOW)

        self.assertEqual(
            self.climate.calls[-2:],
            [
                ("set_temperature", self.entity_id, 20.0, True, "cool"),
                ("set_temperature", self.entity_id, 22.5, True, "cool"),
            ],
        )
        self.climate.calls.clear()
        self.hass.states["sensor.salon_temperature"] = SimpleNamespace(
            state="22",
            attributes={"unit_of_measurement": "°C"},
        )

        self.scheduler._handle_room_sensor_assist_state_change(
            SimpleNamespace(data={"entity_id": "sensor.salon_temperature"})
        )
        self.scheduler._handle_room_sensor_assist_timer(NOW)
        await asyncio.sleep(0)

        self.assertEqual(
            self.climate.calls,
            [("set_temperature", self.entity_id, 23.5, True, "cool")],
        )
        self.assertEqual(
            self.scheduler._room_sensor_assist_states[self.entity_id].target_temperature,
            20.0,
        )

    async def test_room_sensor_assist_uses_climate_step_as_minimum_change(
        self,
    ) -> None:
        self.climate.steps[self.entity_id] = 0.5
        self.hass.states[self.entity_id] = SimpleNamespace(
            state="heat",
            attributes={"current_temperature": 22, "temperature": 22},
        )
        self.hass.states["sensor.salon_temperature"] = SimpleNamespace(
            state="20.1",
            attributes={"unit_of_measurement": "°C"},
        )
        self.data["zones"][self.entity_id]["preconditioning"].update(
            {
                "room_temperature_entity_id": "sensor.salon_temperature",
                "room_sensor_assist_enabled": True,
                "room_sensor_assist_max_delta": 2,
            }
        )
        self.data["zones"][self.entity_id]["schedule"]["tuesday"] = [
            {
                "start": "17:00",
                "action": ACTION_SET_TEMPERATURE,
                "temperature": 22,
                "hvac_mode": "heat",
            }
        ]
        await self.scheduler.async_apply_current_schedule()
        self.assertEqual(
            self.climate.calls[-1],
            ("set_temperature", self.entity_id, 23.5, True, "heat"),
        )
        self.climate.calls.clear()
        self.hass.states["sensor.salon_temperature"] = SimpleNamespace(
            state="20.2",
            attributes={"unit_of_measurement": "°C"},
        )

        await self.scheduler._async_refresh_room_sensor_assist_from_current_event(
            self.entity_id
        )

        self.assertEqual(self.climate.calls, [])

    async def test_room_sensor_assist_aligns_cool_target_to_climate_step(self) -> None:
        self.climate.steps[self.entity_id] = 0.5
        self.hass.states[self.entity_id] = SimpleNamespace(
            state="cool",
            attributes={"current_temperature": 25.1, "temperature": 22},
        )
        self.hass.states["sensor.salon_temperature"] = SimpleNamespace(
            state="24",
            attributes={"unit_of_measurement": "°C"},
        )
        self.data["zones"][self.entity_id]["preconditioning"].update(
            {
                "room_temperature_entity_id": "sensor.salon_temperature",
                "room_sensor_assist_enabled": True,
                "room_sensor_assist_max_delta": 2,
            }
        )
        self.data["zones"][self.entity_id]["schedule"]["tuesday"] = [
            {
                "start": "17:00",
                "action": ACTION_SET_TEMPERATURE,
                "temperature": 22,
                "hvac_mode": "cool",
            }
        ]

        await self.scheduler.async_apply_current_schedule()

        self.assertEqual(
            self.climate.calls[-2:],
            [
                ("set_temperature", self.entity_id, 22.0, True, "cool"),
                ("set_temperature", self.entity_id, 23.5, True, "cool"),
            ],
        )

    async def test_room_sensor_assist_restores_target_when_room_reaches_target(
        self,
    ) -> None:
        self.hass.states[self.entity_id] = SimpleNamespace(
            state="heat",
            attributes={"current_temperature": 22, "temperature": 22},
        )
        self.hass.states["sensor.salon_temperature"] = SimpleNamespace(
            state="20.5",
            attributes={"unit_of_measurement": "°C"},
        )
        self.data["zones"][self.entity_id]["preconditioning"].update(
            {
                "room_temperature_entity_id": "sensor.salon_temperature",
                "room_sensor_assist_enabled": True,
            }
        )
        self.data["zones"][self.entity_id]["schedule"]["tuesday"] = [
            {
                "start": "17:00",
                "action": ACTION_SET_TEMPERATURE,
                "temperature": 22,
                "hvac_mode": "heat",
            }
        ]
        await self.scheduler.async_apply_current_schedule()
        self.climate.calls.clear()
        self.hass.states["sensor.salon_temperature"] = SimpleNamespace(
            state="22",
            attributes={"unit_of_measurement": "°C"},
        )

        await self.scheduler._async_refresh_room_sensor_assist_from_current_event(
            self.entity_id
        )

        self.assertEqual(
            self.climate.calls,
            [("set_temperature", self.entity_id, 22.0, False, "heat")],
        )
        events = [
            event_data
            for event_type, event_data in self.hass.bus.events
            if event_type == EVENT_VELAIR
            and event_data["event"] == EVENT_TYPE_ROOM_SENSOR_ASSIST_RESTORED
        ]
        self.assertEqual(events[-1]["reason"], "target_reached")

    def test_late_preconditioning_window_reports_event_due_now(self) -> None:
        self.hass.states[self.entity_id] = SimpleNamespace(
            state="heat",
            attributes={"current_temperature": 18},
        )
        self.data["zones"][self.entity_id]["schedule"]["tuesday"] = [
            {
                "start": "20:00",
                "action": ACTION_SET_TEMPERATURE,
                "temperature": 21,
                "hvac_mode": "heat",
            }
        ]

        event = self.scheduler.calculate_next_event(
            datetime(2026, 5, 19, 19, 40, tzinfo=timezone.utc)
        )

        self.assertIsNotNone(event)
        self.assertEqual(event.when, datetime(2026, 5, 19, 18, 30, tzinfo=timezone.utc))
        self.assertEqual(
            event.target_when,
            datetime(2026, 5, 19, 20, 0, tzinfo=timezone.utc),
        )

    async def test_late_preconditioning_window_applies_once(self) -> None:
        self.hass.states[self.entity_id] = SimpleNamespace(
            state="heat",
            attributes={"current_temperature": 18},
        )
        self.data["zones"][self.entity_id]["schedule"]["tuesday"] = [
            {
                "start": "20:00",
                "action": ACTION_SET_TEMPERATURE,
                "temperature": 21,
                "hvac_mode": "heat",
            }
        ]

        await self.scheduler._handle_timer(
            datetime(2026, 5, 19, 19, 40, tzinfo=timezone.utc)
        )
        await self.scheduler._handle_timer(
            datetime(2026, 5, 19, 19, 41, tzinfo=timezone.utc)
        )

        self.assertEqual(
            self.climate.calls,
            [("set_temperature", self.entity_id, 21.0, True, "heat")],
        )

    async def test_late_preconditioning_window_scheduled_due_now_applies(
        self,
    ) -> None:
        due_now = datetime(2026, 5, 19, 19, 40, tzinfo=timezone.utc)
        original_now = scheduler_module.dt_util.now
        scheduler_module.dt_util.now = lambda: due_now
        self.addCleanup(setattr, scheduler_module.dt_util, "now", original_now)
        self.hass.states[self.entity_id] = SimpleNamespace(
            state="heat",
            attributes={"current_temperature": 18},
        )
        self.data["zones"][self.entity_id]["schedule"]["tuesday"] = [
            {
                "start": "20:00",
                "action": ACTION_SET_TEMPERATURE,
                "temperature": 21,
                "hvac_mode": "heat",
            }
        ]

        self.scheduler.async_schedule_next_event()
        await asyncio.sleep(0)

        self.assertEqual(
            self.climate.calls,
            [("set_temperature", self.entity_id, 21.0, True, "heat")],
        )

    def test_applied_preconditioning_window_remains_visible_until_target(
        self,
    ) -> None:
        self.hass.states[self.entity_id] = SimpleNamespace(
            state="heat",
            attributes={"current_temperature": 18},
        )
        self.data["zones"][self.entity_id]["schedule"]["tuesday"] = [
            {
                "start": "20:00",
                "action": ACTION_SET_TEMPERATURE,
                "temperature": 21,
                "hvac_mode": "heat",
            }
        ]
        event = self.scheduler.calculate_next_event(
            datetime(2026, 5, 19, 19, 40, tzinfo=timezone.utc)
        )
        self.assertIsNotNone(event)
        self.scheduler._mark_preconditioning_applied(event)

        events = self.scheduler.calculate_next_events_by_zone(
            datetime(2026, 5, 19, 19, 41, tzinfo=timezone.utc)
        )

        self.assertEqual(len(events), 1)
        self.assertEqual(events[0].entity_id, self.entity_id)
        self.assertEqual(events[0].when, datetime(2026, 5, 19, 18, 30, tzinfo=timezone.utc))
        self.assertEqual(
            events[0].target_when,
            datetime(2026, 5, 19, 20, 0, tzinfo=timezone.utc),
        )

    def test_applied_preconditioning_window_uses_target_as_next_timer(
        self,
    ) -> None:
        self.hass.states[self.entity_id] = SimpleNamespace(
            state="heat",
            attributes={"current_temperature": 18},
        )
        self.data["zones"][self.entity_id]["schedule"]["tuesday"] = [
            {
                "start": "20:00",
                "action": ACTION_SET_TEMPERATURE,
                "temperature": 21,
                "hvac_mode": "heat",
            }
        ]
        event = self.scheduler.calculate_next_event(
            datetime(2026, 5, 19, 19, 40, tzinfo=timezone.utc)
        )
        self.assertIsNotNone(event)
        self.scheduler.next_event = event
        self.scheduler._mark_preconditioning_applied(event)

        self.assertEqual(
            self.scheduler._calculate_next_action_time(
                datetime(2026, 5, 19, 19, 41, tzinfo=timezone.utc)
            ),
            datetime(2026, 5, 19, 20, 0, tzinfo=timezone.utc),
        )

    async def test_applied_preconditioning_window_is_not_reapplied(
        self,
    ) -> None:
        self.hass.states[self.entity_id] = SimpleNamespace(
            state="heat",
            attributes={"current_temperature": 18},
        )
        self.data["zones"][self.entity_id]["schedule"]["tuesday"] = [
            {
                "start": "20:00",
                "action": ACTION_SET_TEMPERATURE,
                "temperature": 21,
                "hvac_mode": "heat",
            }
        ]
        event = self.scheduler.calculate_next_event(
            datetime(2026, 5, 19, 19, 40, tzinfo=timezone.utc)
        )
        self.assertIsNotNone(event)
        self.scheduler._mark_preconditioning_applied(event)

        await self.scheduler._handle_timer(
            datetime(2026, 5, 19, 19, 41, tzinfo=timezone.utc)
        )

        self.assertEqual(self.climate.calls, [])

    async def test_late_preconditioning_window_stores_observed_learning_time(
        self,
    ) -> None:
        self.hass.states[self.entity_id] = SimpleNamespace(
            state="heat",
            attributes={"current_temperature": 18},
        )
        self.data["zones"][self.entity_id]["schedule"]["tuesday"] = [
            {
                "start": "20:00",
                "action": ACTION_SET_TEMPERATURE,
                "temperature": 21,
                "hvac_mode": "heat",
            }
        ]

        await self.scheduler._handle_timer(
            datetime(2026, 5, 19, 19, 40, tzinfo=timezone.utc)
        )
        self.hass.states[self.entity_id] = SimpleNamespace(
            state="heat",
            attributes={"current_temperature": 19.2},
        )
        await self.scheduler._handle_timer(
            datetime(2026, 5, 19, 20, 0, tzinfo=timezone.utc)
        )

        observations = _stored_preconditioning_observations(
            self.data,
            self.entity_id,
            "heat",
        )
        self.assertEqual(len(observations), 1)
        self.assertEqual(observations[0]["quality"], "partial")
        self.assertEqual(observations[0]["start_time"], "2026-05-19T19:40:00+00:00")
        self.assertEqual(observations[0]["scheduled_time"], "2026-05-19T20:00:00+00:00")
        self.assertEqual(observations[0]["startup_minutes"], 20)

    def test_adaptive_cooling_preconditioning_moves_apply_time_earlier(self) -> None:
        self.hass.states[self.entity_id] = SimpleNamespace(
            state="cool",
            attributes={"current_temperature": 26},
        )
        self.data["zones"][self.entity_id]["schedule"]["tuesday"] = [
            {
                "start": "20:00",
                "action": ACTION_SET_TEMPERATURE,
                "temperature": 23,
                "hvac_mode": "cool",
            }
        ]

        event = self.scheduler.calculate_next_event(NOW)

        self.assertIsNotNone(event)
        self.assertEqual(event.when, datetime(2026, 5, 19, 18, 30, tzinfo=timezone.utc))
        self.assertEqual(
            event.target_when,
            datetime(2026, 5, 19, 20, 0, tzinfo=timezone.utc),
        )

    def test_heat_cool_preconditioning_uses_effective_cooling_direction(self) -> None:
        self.hass.states[self.entity_id] = SimpleNamespace(
            state="heat_cool",
            attributes={"current_temperature": 26},
        )
        self.data["zones"][self.entity_id]["schedule"]["tuesday"] = [
            {
                "start": "20:00",
                "action": ACTION_SET_TEMPERATURE,
                "temperature": 23,
                "hvac_mode": "heat_cool",
            }
        ]

        event = self.scheduler.calculate_next_event(NOW)

        self.assertIsNotNone(event)
        self.assertEqual(event.hvac_mode, "heat_cool")
        self.assertEqual(event.when, datetime(2026, 5, 19, 18, 30, tzinfo=timezone.utc))
        self.assertEqual(
            event.target_when,
            datetime(2026, 5, 19, 20, 0, tzinfo=timezone.utc),
        )
        self.assertIsNotNone(event.preconditioning_diagnostics)
        assert event.preconditioning_diagnostics is not None
        self.assertEqual(event.preconditioning_diagnostics["direction"], "cool")

    def test_adaptive_preconditioning_uses_ready_learned_heating_lead(self) -> None:
        self.hass.states[self.entity_id] = SimpleNamespace(
            state="heat",
            attributes={"current_temperature": 18},
        )
        self.data["preconditioning_learning"] = {
            self.entity_id: _preconditioning_learning(
                [
                    *[
                        _preconditioning_sample("heat", "complete", minutes, delta_t=3)
                        for minutes in (60, 65, 70, 75, 80)
                    ],
                ]
            )
        }
        self.data["zones"][self.entity_id]["schedule"]["tuesday"] = [
            {
                "start": "20:00",
                "action": ACTION_SET_TEMPERATURE,
                "temperature": 21,
                "hvac_mode": "heat",
            }
        ]

        event = self.scheduler.calculate_next_event(NOW)

        self.assertIsNotNone(event)
        self.assertEqual(event.when, datetime(2026, 5, 19, 18, 45, tzinfo=timezone.utc))
        self.assertEqual(
            event.target_when,
            datetime(2026, 5, 19, 20, 0, tzinfo=timezone.utc),
        )

    def test_adaptive_preconditioning_scales_lead_by_needed_delta(self) -> None:
        self.hass.states[self.entity_id] = SimpleNamespace(
            state="heat",
            attributes={"current_temperature": 19},
        )
        self.data["preconditioning_learning"] = {
            self.entity_id: _preconditioning_learning(
                [
                    *[
                        _preconditioning_sample("heat", "complete", minutes, delta_t=2)
                        for minutes in (40, 50, 60, 70, 80)
                    ],
                ]
            )
        }
        self.data["zones"][self.entity_id]["schedule"]["tuesday"] = [
            {
                "start": "20:00",
                "action": ACTION_SET_TEMPERATURE,
                "temperature": 21,
                "hvac_mode": "heat",
            }
        ]

        event = self.scheduler.calculate_next_event(NOW)

        self.assertIsNotNone(event)
        self.assertEqual(event.when, datetime(2026, 5, 19, 18, 50, tzinfo=timezone.utc))
        self.assertEqual(
            event.target_when,
            datetime(2026, 5, 19, 20, 0, tzinfo=timezone.utc),
        )

    def test_adaptive_preconditioning_extends_lead_after_partial_attempt(
        self,
    ) -> None:
        self.hass.states[self.entity_id] = SimpleNamespace(
            state="heat",
            attributes={"current_temperature": 18},
        )
        self.data["preconditioning_learning"] = {
            self.entity_id: _preconditioning_learning(
                [
                    *[
                        _preconditioning_sample("heat", "complete", minutes, delta_t=3)
                        for minutes in (60, 65, 70, 75, 80)
                    ],
                    _preconditioning_sample("heat", "partial", 90, delta_t=3),
                ]
            )
        }
        self.data["zones"][self.entity_id]["schedule"]["tuesday"] = [
            {
                "start": "20:00",
                "action": ACTION_SET_TEMPERATURE,
                "temperature": 21,
                "hvac_mode": "heat",
            }
        ]

        event = self.scheduler.calculate_next_event(NOW)

        self.assertIsNotNone(event)
        self.assertEqual(event.when, datetime(2026, 5, 19, 18, 10, tzinfo=timezone.utc))
        self.assertEqual(
            event.target_when,
            datetime(2026, 5, 19, 20, 0, tzinfo=timezone.utc),
        )

    def test_adaptive_preconditioning_uses_initial_model_until_ready(self) -> None:
        self.hass.states[self.entity_id] = SimpleNamespace(
            state="heat",
            attributes={"current_temperature": 18},
        )
        self.data["preconditioning_learning"] = {
            self.entity_id: _preconditioning_learning(
                [
                    _preconditioning_sample("heat", "complete", 70, delta_t=3),
                    _preconditioning_sample("heat", "partial", 80, delta_t=3),
                ]
            )
        }
        self.data["zones"][self.entity_id]["schedule"]["tuesday"] = [
            {
                "start": "20:00",
                "action": ACTION_SET_TEMPERATURE,
                "temperature": 21,
                "hvac_mode": "heat",
            }
        ]

        event = self.scheduler.calculate_next_event(NOW)

        self.assertIsNotNone(event)
        self.assertEqual(event.when, datetime(2026, 5, 19, 18, 20, tzinfo=timezone.utc))

    def test_preconditioning_temperature_change_replans_next_event_after_debounce(
        self,
    ) -> None:
        self.hass.states[self.entity_id] = SimpleNamespace(
            state="heat",
            attributes={"current_temperature": 18},
        )
        self.data["zones"][self.entity_id]["schedule"]["tuesday"] = [
            {
                "start": "20:00",
                "action": ACTION_SET_TEMPERATURE,
                "temperature": 21,
                "hvac_mode": "heat",
            }
        ]
        self.scheduler.async_schedule_next_event()
        self.assertIsNotNone(self.scheduler.next_event)
        self.assertEqual(
            self.scheduler.next_event.when,
            datetime(2026, 5, 19, 18, 30, tzinfo=timezone.utc),
        )
        write_state = Mock()
        self.scheduler._async_write_state = write_state

        next_state = SimpleNamespace(
            state="heat",
            attributes={"current_temperature": 20},
        )
        self.hass.states[self.entity_id] = next_state
        self.scheduler._handle_preconditioning_replan_state_change(
            SimpleNamespace(
                data={"entity_id": self.entity_id, "new_state": next_state}
            )
        )

        self.assertIsNotNone(self.scheduler._unsub_preconditioning_replan_timer)

        self.scheduler._handle_preconditioning_replan_timer(
            datetime(2026, 5, 19, 18, 0, 30, tzinfo=timezone.utc)
        )

        self.assertIsNotNone(self.scheduler.next_event)
        self.assertEqual(
            self.scheduler.next_event.when,
            datetime(2026, 5, 19, 19, 10, tzinfo=timezone.utc),
        )
        write_state.assert_called_once_with()

    def test_sync_home_assistant_callbacks_run_on_event_loop(self) -> None:
        callbacks = (
            self.scheduler._handle_preconditioning_state_change,
            self.scheduler._handle_preconditioning_replan_state_change,
            self.scheduler._handle_preconditioning_replan_timer,
            self.scheduler._handle_room_sensor_assist_state_change,
            self.scheduler._handle_room_sensor_assist_timer,
            self.scheduler._handle_comfort_state_change,
        )

        for handler in callbacks:
            with self.subTest(handler=handler.__name__):
                self.assertTrue(
                    getattr(
                        handler.__func__,
                        "__velair_test_callback__",
                        False,
                    )
                )

    def test_preconditioning_temperature_change_ignores_small_movements(self) -> None:
        self.hass.states[self.entity_id] = SimpleNamespace(
            state="heat",
            attributes={"current_temperature": 18},
        )
        self.scheduler.async_schedule_next_event()

        next_state = SimpleNamespace(
            state="heat",
            attributes={"current_temperature": 18.1},
        )
        self.scheduler._handle_preconditioning_replan_state_change(
            SimpleNamespace(
                data={"entity_id": self.entity_id, "new_state": next_state}
            )
        )

        self.assertIsNone(self.scheduler._unsub_preconditioning_replan_timer)

    def test_preconditioning_ignores_room_sensor_when_assist_is_disabled(self) -> None:
        self.hass.states[self.entity_id] = SimpleNamespace(
            state="heat",
            attributes={"current_temperature": 21},
        )
        self.hass.states["sensor.salon_temperature"] = SimpleNamespace(
            state="18",
            attributes={"unit_of_measurement": "°C"},
        )
        self.data["zones"][self.entity_id]["preconditioning"].update(
            {
                "room_temperature_entity_id": "sensor.salon_temperature",
                "room_sensor_assist_enabled": False,
            }
        )
        self.data["zones"][self.entity_id]["schedule"]["tuesday"] = [
            {
                "start": "20:00",
                "action": ACTION_SET_TEMPERATURE,
                "temperature": 21,
                "hvac_mode": "heat",
            }
        ]

        event = self.scheduler.calculate_next_event(NOW)

        self.assertIsNotNone(event)
        self.assertEqual(event.when, datetime(2026, 5, 19, 20, 0, tzinfo=timezone.utc))
        self.assertIsNone(event.target_when)
        self.assertEqual(
            self.scheduler._temperature_source_entity_id(self.entity_id),
            self.entity_id,
        )

    def test_preconditioning_temperature_change_ignores_active_learning_session(
        self,
    ) -> None:
        self.hass.states[self.entity_id] = SimpleNamespace(
            state="heat",
            attributes={"current_temperature": 18},
        )
        self.data["zones"][self.entity_id]["schedule"]["tuesday"] = [
            {
                "start": "20:00",
                "action": ACTION_SET_TEMPERATURE,
                "temperature": 21,
                "hvac_mode": "heat",
            }
        ]
        self.scheduler.async_schedule_next_event()
        event = self.scheduler.next_event
        self.assertIsNotNone(event)
        self.scheduler._start_preconditioning_session(
            event,
            "heat",
            datetime(2026, 5, 19, 18, 30, tzinfo=timezone.utc),
        )

        next_state = SimpleNamespace(
            state="heat",
            attributes={"current_temperature": 20},
        )
        self.scheduler._handle_preconditioning_replan_state_change(
            SimpleNamespace(
                data={"entity_id": self.entity_id, "new_state": next_state}
            )
        )

        self.assertIsNone(self.scheduler._unsub_preconditioning_replan_timer)

    async def test_reached_preconditioning_target_stores_learning_observation(
        self,
    ) -> None:
        self.hass.states[self.entity_id] = SimpleNamespace(
            state="heat",
            attributes={"current_temperature": 18},
        )
        self.data["zones"][self.entity_id]["schedule"]["tuesday"] = [
            {
                "start": "20:00",
                "action": ACTION_SET_TEMPERATURE,
                "temperature": 21,
                "hvac_mode": "heat",
            }
        ]

        await self.scheduler._handle_timer(
            datetime(2026, 5, 19, 18, 30, tzinfo=timezone.utc)
        )
        await self.scheduler._async_observe_preconditioning_temperature(
            self.entity_id,
            datetime(2026, 5, 19, 19, 20, tzinfo=timezone.utc),
            20.8,
        )

        observations = _stored_preconditioning_observations(
            self.data,
            self.entity_id,
            "heat",
        )
        self.assertEqual(self.save_count, 1)
        self.assertEqual(len(observations), 1)
        self.assertEqual(
            observations[0],
            {
                "entity_id": self.entity_id,
                "mode": "heat",
                "created_at": "2026-05-19T19:20:00+00:00",
                "scheduled_time": "2026-05-19T20:00:00+00:00",
                "start_time": "2026-05-19T18:30:00+00:00",
                "target_temp": 21.0,
                "initial_temp": 18.0,
                "observed_temp": 20.8,
                "outdoor_temp_start": None,
                "outdoor_temp_target": None,
                "delta_t": 3.0,
                "startup_minutes": 90,
                "reached": True,
                "minutes_to_reach": 50,
                "quality": "complete",
            },
        )
        recorded = [
            event_data
            for event_type, event_data in self.hass.bus.events
            if event_type == EVENT_VELAIR
            and event_data["event"]
            == EVENT_TYPE_PRECONDITIONING_OBSERVATION_RECORDED
        ]
        self.assertEqual(len(recorded), 1)
        self.assertEqual(recorded[0]["entity_id"], self.entity_id)
        self.assertEqual(recorded[0]["direction"], "heat")
        self.assertEqual(recorded[0]["quality"], "complete")
        self.assertEqual(recorded[0]["minutes_to_reach"], 50)
        self.assertEqual(recorded[0]["stored_sample_count"], 1)

    async def test_active_target_reports_block_started_by_preconditioning(self) -> None:
        self.hass.states[self.entity_id] = SimpleNamespace(
            state="heat",
            attributes={"current_temperature": 18},
        )
        self.data["zones"][self.entity_id]["schedule"]["tuesday"] = [
            {
                "start": "20:00",
                "action": ACTION_SET_TEMPERATURE,
                "temperature": 21,
                "hvac_mode": "heat",
            }
        ]

        await self.scheduler._handle_timer(
            datetime(2026, 5, 19, 18, 30, tzinfo=timezone.utc)
        )

        active_target = self.scheduler.get_active_target_event(self.entity_id)
        self.assertIsNotNone(active_target)
        assert active_target is not None
        self.assertEqual(active_target.temperature, 21)
        self.assertEqual(active_target.hvac_mode, "heat")
        self.assertEqual(active_target.when, datetime(2026, 5, 19, 18, 30, tzinfo=timezone.utc))
        self.assertEqual(
            active_target.target_when,
            datetime(2026, 5, 19, 20, 0, tzinfo=timezone.utc),
        )

    async def test_recorded_observation_event_uses_final_invalid_quality(self) -> None:
        self.hass.states[self.entity_id] = SimpleNamespace(
            state="heat",
            attributes={"current_temperature": 18},
        )
        self.data["zones"][self.entity_id]["schedule"]["tuesday"] = [
            {
                "start": "20:00",
                "action": ACTION_SET_TEMPERATURE,
                "temperature": 21,
                "hvac_mode": "heat",
            }
        ]
        await self.scheduler._handle_timer(
            datetime(2026, 5, 19, 18, 30, tzinfo=timezone.utc)
        )

        await self.scheduler._async_observe_preconditioning_temperature(
            self.entity_id,
            datetime(2026, 5, 19, 18, 31, tzinfo=timezone.utc),
            20.8,
        )

        recorded = next(
            event_data
            for event_type, event_data in self.hass.bus.events
            if event_type == EVENT_VELAIR
            and event_data["event"]
            == EVENT_TYPE_PRECONDITIONING_OBSERVATION_RECORDED
        )
        self.assertEqual(recorded["quality"], "invalid")
        self.assertEqual(recorded["invalid_reason"], "out_of_bounds")
        self.assertEqual(recorded["stored_sample_count"], 1)

    async def test_preconditioning_session_stores_local_outdoor_temperature(
        self,
    ) -> None:
        self.data["zones"][self.entity_id]["preconditioning"].update(
            {
                "use_outdoor_temperature": True,
                "outdoor_temperature_entity_id": "sensor.outdoor_temperature",
            }
        )
        self.hass.states[self.entity_id] = SimpleNamespace(
            state="heat",
            attributes={"current_temperature": 18},
        )
        self.hass.states["sensor.outdoor_temperature"] = SimpleNamespace(
            state="4.5",
            attributes={},
        )
        self.data["zones"][self.entity_id]["schedule"]["tuesday"] = [
            {
                "start": "20:00",
                "action": ACTION_SET_TEMPERATURE,
                "temperature": 21,
                "hvac_mode": "heat",
            }
        ]

        await self.scheduler._handle_timer(
            datetime(2026, 5, 19, 18, 30, tzinfo=timezone.utc)
        )
        self.hass.states["sensor.outdoor_temperature"] = SimpleNamespace(
            state="5.2",
            attributes={},
        )
        await self.scheduler._async_observe_preconditioning_temperature(
            self.entity_id,
            datetime(2026, 5, 19, 19, 20, tzinfo=timezone.utc),
            20.8,
        )

        observations = _stored_preconditioning_observations(
            self.data,
            self.entity_id,
            "heat",
        )
        self.assertEqual(len(observations), 1)
        self.assertEqual(observations[0]["outdoor_temp_start"], 4.5)
        self.assertEqual(observations[0]["outdoor_temp_target"], 5.2)

    async def test_partial_preconditioning_progress_stores_learning_observation(
        self,
    ) -> None:
        self.hass.states[self.entity_id] = SimpleNamespace(
            state="heat",
            attributes={"current_temperature": 18},
        )
        self.data["zones"][self.entity_id]["schedule"]["tuesday"] = [
            {
                "start": "20:00",
                "action": ACTION_SET_TEMPERATURE,
                "temperature": 21,
                "hvac_mode": "heat",
            }
        ]

        await self.scheduler._handle_timer(
            datetime(2026, 5, 19, 18, 30, tzinfo=timezone.utc)
        )
        self.hass.states[self.entity_id] = SimpleNamespace(
            state="heat",
            attributes={"current_temperature": 19.2},
        )
        await self.scheduler._handle_timer(
            datetime(2026, 5, 19, 20, 0, tzinfo=timezone.utc)
        )

        observations = _stored_preconditioning_observations(
            self.data,
            self.entity_id,
            "heat",
        )
        self.assertEqual(len(observations), 1)
        self.assertEqual(observations[0]["quality"], "partial")
        self.assertEqual(observations[0]["delta_t"], 3.0)
        self.assertIsNone(observations[0]["minutes_to_reach"])

    async def test_active_preconditioning_session_schedules_target_expiration(
        self,
    ) -> None:
        self.hass.states[self.entity_id] = SimpleNamespace(
            state="heat",
            attributes={"current_temperature": 18},
        )
        self.data["zones"][self.entity_id]["schedule"]["tuesday"] = [
            {
                "start": "20:00",
                "action": ACTION_SET_TEMPERATURE,
                "temperature": 21,
                "hvac_mode": "heat",
            }
        ]

        await self.scheduler._handle_timer(
            datetime(2026, 5, 19, 18, 30, tzinfo=timezone.utc)
        )

        self.assertEqual(
            self.scheduler._calculate_next_action_time(
                datetime(2026, 5, 19, 18, 31, tzinfo=timezone.utc)
            ),
            datetime(2026, 5, 19, 20, 0, tzinfo=timezone.utc),
        )

    async def test_preconditioning_without_useful_progress_stores_partial_floor(self) -> None:
        self.hass.states[self.entity_id] = SimpleNamespace(
            state="heat",
            attributes={"current_temperature": 18},
        )
        self.data["zones"][self.entity_id]["schedule"]["tuesday"] = [
            {
                "start": "20:00",
                "action": ACTION_SET_TEMPERATURE,
                "temperature": 21,
                "hvac_mode": "heat",
            }
        ]

        await self.scheduler._handle_timer(
            datetime(2026, 5, 19, 18, 30, tzinfo=timezone.utc)
        )
        self.hass.states[self.entity_id] = SimpleNamespace(
            state="heat",
            attributes={"current_temperature": 18.1},
        )
        await self.scheduler._handle_timer(
            datetime(2026, 5, 19, 20, 0, tzinfo=timezone.utc)
        )

        observations = _stored_preconditioning_observations(
            self.data,
            self.entity_id,
            "heat",
        )
        self.assertEqual(len(observations), 1)
        self.assertEqual(observations[0]["quality"], "partial")
        self.assertFalse(observations[0]["reached"])

    async def test_preconditioning_learning_session_is_discarded_by_boost(self) -> None:
        self.hass.states[self.entity_id] = SimpleNamespace(
            state="heat",
            attributes={"current_temperature": 18},
        )
        self.climate.snapshots[self.entity_id] = {
            "hvac_mode": "heat",
            "temperature": 18,
        }
        self.data["zones"][self.entity_id]["schedule"]["tuesday"] = [
            {
                "start": "20:00",
                "action": ACTION_SET_TEMPERATURE,
                "temperature": 21,
                "hvac_mode": "heat",
            }
        ]

        await self.scheduler._handle_timer(
            datetime(2026, 5, 19, 18, 30, tzinfo=timezone.utc)
        )
        await self.scheduler.async_set_zone_boost(
            self.entity_id,
            23,
            "2026-05-19T19:30:00+00:00",
            hvac_mode="heat",
        )
        await self.scheduler._async_observe_preconditioning_temperature(
            self.entity_id,
            datetime(2026, 5, 19, 19, 20, tzinfo=timezone.utc),
            20.8,
        )

        observations = _stored_preconditioning_observations(
            self.data,
            self.entity_id,
            "heat",
        )
        self.assertEqual(observations, [])


class VelairSchedulerZoneRuntimeStatusTest(unittest.TestCase):
    """Verify Overview runtime projection precedence and fields."""

    def setUp(self) -> None:
        self.entity_id = "climate.salon"
        self.data = helpers_data = normalize_schedule_data(None, [self.entity_id])
        self.scheduler = VelairScheduler(FakeHass(), helpers_data, FakeClimateManager(), Mock())
        self.scheduler._room_sensor_assist_status = Mock(return_value={"room_temperature": 20.0, "applied_temperature": 22.0})
        self.scheduler._iter_current_events = Mock(return_value=[])
        self.scheduler.get_active_target_event = Mock(return_value=None)
        self.scheduler._current_hvac_mode = Mock(return_value="heat")
        self.scheduler._hass.states[self.entity_id] = SimpleNamespace(
            state="heat",
            attributes={"current_temperature": 20.0, "temperature": 22.0},
        )

    def test_stopped_and_paused_take_precedence_over_boost(self) -> None:
        self.scheduler._get_active_zone_override = Mock(return_value={"type": "boost", "temperature": 23.0})
        self.data["global_"]["mode"] = "off"
        self.assertEqual(self.scheduler._zone_runtime_status(self.entity_id)["state"], "stopped")
        self.data["global_"]["mode"] = MODE_PAUSED
        self.assertEqual(self.scheduler._zone_runtime_status(self.entity_id)["state"], "paused")

    def test_boost_projects_primary_values_and_until(self) -> None:
        self.scheduler._get_active_zone_override = Mock(return_value={"type": "boost", "temperature": 23.0, "until": "2026-05-19T20:00:00+00:00"})
        result = self.scheduler._zone_runtime_status(self.entity_id)
        self.assertEqual(result["state"], "boost")
        self.assertEqual((result["room_temperature"], result["target_temperature"], result["applied_temperature"]), (20.0, 23.0, 22.0))
        self.assertEqual(result["hvac_mode"], "heat")
        self.assertEqual(result["until"], "2026-05-19T20:00:00+00:00")

    def test_idle_uses_current_climate_target_as_fallback(self) -> None:
        self.scheduler._get_active_zone_override = Mock(return_value=None)
        self.scheduler._hass.states[self.entity_id] = SimpleNamespace(
            state="heat",
            attributes={"current_temperature": 19.0, "temperature": 21.5},
        )

        result = self.scheduler._zone_runtime_status(self.entity_id)

        self.assertEqual(result["state"], "idle")
        self.assertEqual(result["target_temperature"], 21.5)

    def test_idle_rejects_a_climate_target_outside_supported_limits(self) -> None:
        self.scheduler._get_active_zone_override = Mock(return_value=None)
        self.scheduler._room_sensor_assist_status = Mock(return_value={})
        self.scheduler._climate_manager.limits[self.entity_id] = (41, 86)
        self.scheduler._climate_manager.temperature_unit = (
            lambda _entity_id: scheduler_module.FAHRENHEIT
        )
        self.scheduler._hass.states[self.entity_id] = SimpleNamespace(
            state="cool",
            attributes={
                "current_temperature": 72.3,
                "temperature": 145,
                "unit_of_measurement": scheduler_module.FAHRENHEIT,
            },
        )

        result = self.scheduler._zone_runtime_status(self.entity_id)

        self.assertAlmostEqual(result["room_temperature"], 72.3)
        self.assertIsNone(result["target_temperature"])
        self.assertIsNone(result["applied_temperature"])

    def test_room_temperature_uses_climate_when_room_assist_is_disabled(self) -> None:
        self.scheduler._get_active_zone_override = Mock(return_value=None)
        self.data["zones"][self.entity_id]["preconditioning"].update(
            {
                "room_temperature_entity_id": "sensor.salon_temperature",
                "room_sensor_assist_enabled": False,
            }
        )
        self.scheduler._hass.states["sensor.salon_temperature"] = SimpleNamespace(
            state="18.0",
            attributes={},
        )

        result = self.scheduler._zone_runtime_status(self.entity_id)

        self.assertEqual(result["room_temperature"], 20.0)

    def test_room_temperature_uses_sensor_when_room_assist_is_enabled(self) -> None:
        self.scheduler._get_active_zone_override = Mock(return_value=None)
        self.data["zones"][self.entity_id]["preconditioning"].update(
            {
                "room_temperature_entity_id": "sensor.salon_temperature",
                "room_sensor_assist_enabled": True,
            }
        )
        self.scheduler._hass.states["sensor.salon_temperature"] = SimpleNamespace(
            state="18.0",
            attributes={},
        )

        result = self.scheduler._zone_runtime_status(self.entity_id)

        self.assertEqual(result["room_temperature"], 18.0)

    def test_preconditioning_precedes_scheduled_and_exposes_interval(self) -> None:
        self.scheduler._get_active_zone_override = Mock(return_value=None)
        now = scheduler_module.dt_util.now()
        event = SimpleNamespace(temperature=21.0, when=now - timedelta(minutes=30), target_when=now + timedelta(minutes=30))
        self.scheduler.get_active_target_event = Mock(return_value=event)
        self.scheduler._iter_current_events = Mock(return_value=[SimpleNamespace(temperature=20.0, target_when=None)])
        result = self.scheduler._zone_runtime_status(self.entity_id)
        self.assertEqual(result["state"], "preconditioning")
        self.assertEqual(result["target_temperature"], 21.0)
        self.assertEqual(result["active_from"], event.when.isoformat())
        self.assertEqual(result["target_when"], event.target_when.isoformat())

