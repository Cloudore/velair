"""Per-zone temperature limit tests."""

from __future__ import annotations

from types import SimpleNamespace
import unittest

from .helpers import (
    ACTION_SET_TEMPERATURE,
    EVENT_TYPE_CLIMATE_TARGET_APPLIED,
    EVENT_TYPE_ROOM_SENSOR_ASSIST_UPDATED,
    EVENT_VELAIR,
    FakeClimateManager,
    FakeHass,
    VelairScheduler,
    empty_week_schedule,
    normalize_schedule_data,
)


class ZoneLimitsSchedulerTest(unittest.IsolatedAsyncioTestCase):
    """Verify limits are enforced at the single physical delivery point."""

    def setUp(self) -> None:
        self.entity_id = "climate.salon"
        self.hass = FakeHass(logbook_enabled=True)
        self.hass.states[self.entity_id] = SimpleNamespace(
            state="heat",
            attributes={"current_temperature": 20, "temperature": 20},
        )
        self.climate = FakeClimateManager()
        self.climate.limits[self.entity_id] = (5.0, 35.0)
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
        self.save_count = 0
        self.scheduler = VelairScheduler(
            self.hass,
            self.data,
            self.climate,
            self._async_save,
        )

    async def _async_save(self) -> None:
        self.save_count += 1

    def _set_block(self, temperature: float, hvac_mode: str = "heat") -> None:
        self.data["zones"][self.entity_id]["schedule"]["tuesday"] = [
            {
                "start": "17:00",
                "action": ACTION_SET_TEMPERATURE,
                "temperature": temperature,
                "hvac_mode": hvac_mode,
            }
        ]

    def _set_limits(self, minimum: float | None, maximum: float | None) -> None:
        self.data["zones"][self.entity_id]["limits"] = {
            "min_temperature": minimum,
            "max_temperature": maximum,
        }

    def _applied_events(self) -> list[dict]:
        return [
            event_data
            for event_type, event_data in self.hass.bus.events
            if event_type == EVENT_VELAIR
            and event_data["event"] == EVENT_TYPE_CLIMATE_TARGET_APPLIED
        ]

    def _service_calls(self, domain: str, service: str) -> list[dict]:
        return [
            data
            for called_domain, called_service, data, _blocking in self.hass.services.calls
            if called_domain == domain and called_service == service
        ]

    async def test_schedule_block_below_floor_is_clamped(self) -> None:
        self._set_limits(21, None)
        self._set_block(19)

        await self.scheduler.async_apply_current_schedule()

        self.assertEqual(
            self.climate.calls,
            [("set_temperature", self.entity_id, 21.0, True, "heat")],
        )
        event = self._applied_events()[-1]
        self.assertEqual(event["temperature"], 21.0)
        self.assertEqual(event["limited_by"], "zone_limits")
        self.assertEqual(event["requested_temperature"], 19.0)
        self.assertEqual(event["source"], "current_schedule")
        logbook = [
            data["message"]
            for data in self._service_calls("logbook", "log")
        ]
        self.assertTrue(any("Adjusted Salon to 21 °C" in line or "Adjusted climate.salon to 21 °C" in line for line in logbook))
        self.assertTrue(any("zone limits" in line and "requested 19 °C" in line for line in logbook))
        creates = self._service_calls("persistent_notification", "create")
        self.assertEqual(len(creates), 1)
        self.assertEqual(
            creates[0]["notification_id"],
            "velair_zone_limit_climate_salon",
        )
        self.assertIn("requested 19 °C", creates[0]["message"])
        self.assertIn("at least 21 °C", creates[0]["message"])
        self.assertIn("applied 21 °C", creates[0]["message"])

    async def test_schedule_block_above_ceiling_is_clamped(self) -> None:
        self._set_limits(None, 24)
        self._set_block(26)

        await self.scheduler.async_apply_current_schedule()

        self.assertEqual(
            self.climate.calls,
            [("set_temperature", self.entity_id, 24.0, True, "heat")],
        )
        event = self._applied_events()[-1]
        self.assertEqual(event["temperature"], 24.0)
        self.assertEqual(event["limited_by"], "zone_limits")
        self.assertEqual(event["requested_temperature"], 26.0)

    async def test_target_inside_limits_is_untouched_and_clears_notification(self) -> None:
        self._set_limits(21, 24)
        self._set_block(19)
        await self.scheduler.async_apply_current_schedule()
        self.assertEqual(len(self._service_calls("persistent_notification", "create")), 1)

        self._set_block(22)
        await self.scheduler.async_apply_current_schedule()

        self.assertEqual(
            self.climate.calls[-1],
            ("set_temperature", self.entity_id, 22.0, True, "heat"),
        )
        event = self._applied_events()[-1]
        self.assertEqual(event["temperature"], 22.0)
        self.assertNotIn("limited_by", event)
        self.assertNotIn("requested_temperature", event)
        dismissals = self._service_calls("persistent_notification", "dismiss")
        self.assertEqual(len(dismissals), 1)
        self.assertEqual(
            dismissals[0]["notification_id"],
            "velair_zone_limit_climate_salon",
        )

    async def test_same_conflict_is_announced_only_once(self) -> None:
        self._set_limits(21, None)
        self._set_block(19)

        await self.scheduler.async_apply_current_schedule()
        await self.scheduler.async_apply_current_schedule()
        self._set_block(22)
        await self.scheduler.async_apply_current_schedule()
        self._set_block(19)
        await self.scheduler.async_apply_current_schedule()

        self.assertEqual(len(self._service_calls("persistent_notification", "create")), 1)
        limited = [event for event in self._applied_events() if "limited_by" in event]
        self.assertEqual(len(limited), 3)
        logbook = [
            data["message"]
            for data in self._service_calls("logbook", "log")
            if "zone limits" in data["message"]
        ]
        self.assertEqual(len(logbook), 3)

    async def test_boost_is_clamped_to_floor(self) -> None:
        self._set_limits(21, None)
        self.climate.snapshots[self.entity_id] = {"hvac_mode": "heat", "temperature": 20}

        await self.scheduler.async_set_zone_boost(
            self.entity_id,
            19,
            "2026-05-19T20:00:00+00:00",
            hvac_mode="heat",
        )

        self.assertEqual(
            self.climate.calls,
            [("set_temperature", self.entity_id, 21.0, True, "heat")],
        )
        event = self._applied_events()[-1]
        self.assertEqual(event["source"], "boost")
        self.assertEqual(event["temperature"], 21.0)
        self.assertEqual(event["requested_temperature"], 19.0)
        self.assertEqual(event["limited_by"], "zone_limits")
        # The stored boost keeps the requested intent; delivery is clamped.
        self.assertEqual(
            self.data["zones"][self.entity_id]["override"]["temperature"], 19.0
        )

    async def test_set_temperature_service_is_clamped(self) -> None:
        self._set_limits(21, 24)

        await self.scheduler.async_set_temperature(
            self.entity_id,
            30,
            hvac_mode="heat",
            event_source="service_set_temperature",
        )

        self.assertEqual(
            self.climate.calls,
            [("set_temperature", self.entity_id, 24.0, False, "heat")],
        )
        event = self._applied_events()[-1]
        self.assertEqual(event["source"], "service_set_temperature")
        self.assertEqual(event["temperature"], 24.0)
        self.assertEqual(event["requested_temperature"], 30.0)
        self.assertEqual(event["limited_by"], "zone_limits")
        logbook = [data["message"] for data in self._service_calls("logbook", "log")]
        self.assertTrue(any("Set " in line and "24 °C" in line for line in logbook))
        self.assertTrue(any("zone limits" in line for line in logbook))

    async def test_range_target_is_clamped_on_both_ends(self) -> None:
        self.climate.temperature_range_support[self.entity_id] = True
        self.climate.hvac_modes[self.entity_id] = ["off", "heat_cool"]
        self._set_limits(20, 24)
        self.data["zones"][self.entity_id]["schedule"]["tuesday"] = [
            {
                "start": "17:00",
                "action": ACTION_SET_TEMPERATURE,
                "target_temp_low": 18,
                "target_temp_high": 26,
                "hvac_mode": "heat_cool",
            }
        ]

        await self.scheduler.async_apply_current_schedule()

        self.assertEqual(
            self.climate.calls,
            [("set_temperature_range", self.entity_id, 20.0, 24.0, True, "heat_cool")],
        )
        event = self._applied_events()[-1]
        self.assertEqual(event["target_temp_low"], 20.0)
        self.assertEqual(event["target_temp_high"], 24.0)
        self.assertEqual(event["requested_target_temp_low"], 18.0)
        self.assertEqual(event["requested_target_temp_high"], 26.0)
        self.assertEqual(event["limited_by"], "zone_limits")
        self.assertNotIn("temperature", event)

    async def test_range_with_one_end_inside_limits_reports_only_the_changed_end(self) -> None:
        self.climate.temperature_range_support[self.entity_id] = True
        self.climate.hvac_modes[self.entity_id] = ["off", "heat_cool"]
        self._set_limits(20, None)
        self.data["zones"][self.entity_id]["schedule"]["tuesday"] = [
            {
                "start": "17:00",
                "action": ACTION_SET_TEMPERATURE,
                "target_temp_low": 18,
                "target_temp_high": 23,
                "hvac_mode": "heat_cool",
            }
        ]

        await self.scheduler.async_apply_current_schedule()

        event = self._applied_events()[-1]
        self.assertEqual((event["target_temp_low"], event["target_temp_high"]), (20.0, 23.0))
        self.assertEqual(event["requested_target_temp_low"], 18.0)
        self.assertNotIn("requested_target_temp_high", event)

    async def test_room_assist_output_cannot_cross_ceiling(self) -> None:
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
        self._set_limits(None, 23)
        self._set_block(22)

        await self.scheduler.async_apply_current_schedule()

        self.assertEqual(
            self.climate.calls[-2:],
            [
                ("set_temperature", self.entity_id, 22.0, True, "heat"),
                ("set_temperature", self.entity_id, 23.0, True, "heat"),
            ],
        )
        events = [
            event_data
            for event_type, event_data in self.hass.bus.events
            if event_type == EVENT_VELAIR
            and event_data["event"] == EVENT_TYPE_ROOM_SENSOR_ASSIST_UPDATED
        ]
        self.assertEqual(events[-1]["target_temperature"], 22.0)
        self.assertEqual(events[-1]["applied_temperature"], 23.0)
        status = self.scheduler.get_room_sensor_assist_statuses()[self.entity_id]
        self.assertEqual(status["limited_by"], "maximum")
        self.assertEqual(status["limit_temperature"], 23.0)
        self.assertEqual(status["requested_temperature"], 23.5)
        create = self._service_calls("persistent_notification", "create")[-1]
        self.assertEqual(
            create["notification_id"],
            "velair_room_assist_limit_climate_salon",
        )
        self.assertIn("allowed by the Velair zone limits", create["message"])

    async def test_room_assist_output_cannot_cross_floor(self) -> None:
        self.hass.states[self.entity_id] = SimpleNamespace(
            state="cool",
            attributes={"current_temperature": 24, "temperature": 24},
        )
        self.hass.states["sensor.salon_temperature"] = SimpleNamespace(
            state="26",
            attributes={"unit_of_measurement": "°C"},
        )
        self.data["zones"][self.entity_id]["preconditioning"].update(
            {
                "enabled": False,
                "room_temperature_entity_id": "sensor.salon_temperature",
                "room_sensor_assist_enabled": True,
                "room_sensor_assist_max_delta": 3,
            }
        )
        self._set_limits(23, None)
        self._set_block(24, hvac_mode="cool")

        await self.scheduler.async_apply_current_schedule()

        self.assertEqual(
            self.climate.calls[-1],
            ("set_temperature", self.entity_id, 23.0, True, "cool"),
        )
        status = self.scheduler.get_room_sensor_assist_statuses()[self.entity_id]
        self.assertEqual(status["limited_by"], "minimum")
        self.assertEqual(status["limit_temperature"], 23.0)

    async def test_manual_adjustment_is_not_clamped(self) -> None:
        self._set_limits(21, None)
        self._set_block(22)
        await self.scheduler.async_apply_current_schedule()
        await self.scheduler.async_update_external_change_policy(
            self.entity_id, {"action": "for_duration", "duration_minutes": 30}
        )
        self.climate.calls.clear()
        self.hass.states[self.entity_id] = SimpleNamespace(
            state="heat",
            attributes={"current_temperature": 20, "temperature": 17},
        )

        await self.scheduler.async_handle_external_climate_change(
            self.entity_id,
            changed_fields=["temperature"],
            previous={"temperature": 22.0},
            current={"temperature": 17.0},
        )

        self.assertEqual(
            "manual",
            self.scheduler.get_zone_runtime_statuses()[self.entity_id]["control_mode"],
        )
        self.assertFalse(
            any(call[0] == "set_temperature" and call[2] == 21.0 for call in self.climate.calls)
        )
        self.assertFalse(
            any("limited_by" in event for event in self._applied_events()[1:])
        )

    async def test_keep_automatic_reassertion_is_clamped(self) -> None:
        self._set_limits(21, None)
        self._set_block(19)
        self.hass.states[self.entity_id] = SimpleNamespace(
            state="heat",
            attributes={"current_temperature": 20, "temperature": 17},
        )

        await self.scheduler.async_handle_external_climate_change(
            self.entity_id,
            changed_fields=["temperature"],
            previous={"temperature": 19.0},
            current={"temperature": 17.0},
        )

        self.assertEqual(
            self.climate.calls[-1],
            ("set_temperature", self.entity_id, 21.0, True, "heat"),
        )
        event = self._applied_events()[-1]
        self.assertEqual(event["source"], "external_change_reasserted")
        self.assertEqual(event["requested_temperature"], 19.0)

    async def test_limits_outside_device_range_are_rejected(self) -> None:
        with self.assertRaisesRegex(ValueError, "between 5 and 35"):
            await self.scheduler.async_update_zone_limits(
                self.entity_id, {"min_temperature": 3}
            )
        with self.assertRaisesRegex(ValueError, "between 5 and 35"):
            await self.scheduler.async_update_zone_limits(
                self.entity_id, {"max_temperature": 40}
            )
        with self.assertRaisesRegex(ValueError, "must be a number"):
            await self.scheduler.async_update_zone_limits(
                self.entity_id, {"min_temperature": "warm"}
            )
        self.assertEqual(self.save_count, 0)
        self.assertEqual(
            self.scheduler.get_zone_limits(self.entity_id),
            {"min_temperature": None, "max_temperature": None},
        )

    async def test_min_above_max_is_rejected(self) -> None:
        await self.scheduler.async_update_zone_limits(
            self.entity_id, {"max_temperature": 22}
        )
        with self.assertRaisesRegex(ValueError, "must not be greater"):
            await self.scheduler.async_update_zone_limits(
                self.entity_id, {"min_temperature": 23}
            )
        self.assertEqual(
            self.scheduler.get_zone_limits(self.entity_id),
            {"min_temperature": None, "max_temperature": 22.0},
        )

    async def test_unknown_zone_and_unchanged_limits_do_not_save(self) -> None:
        with self.assertRaisesRegex(ValueError, "not managed"):
            await self.scheduler.async_update_zone_limits(
                "climate.other", {"min_temperature": 20}
            )
        result = await self.scheduler.async_update_zone_limits(
            self.entity_id, {"min_temperature": None, "max_temperature": None}
        )
        self.assertEqual(result, {"min_temperature": None, "max_temperature": None})
        self.assertEqual(self.save_count, 0)

    async def test_update_zone_limits_snaps_to_the_climate_step(self) -> None:
        self.climate.steps[self.entity_id] = 0.5

        result = await self.scheduler.async_update_zone_limits(
            self.entity_id, {"min_temperature": 21.3, "max_temperature": 24.76}
        )

        self.assertEqual(result, {"min_temperature": 21.5, "max_temperature": 25.0})
        self.assertEqual(self.data["zones"][self.entity_id]["limits"], result)
        self.assertEqual(self.save_count, 1)

    async def test_update_zone_limits_reapplies_the_current_target(self) -> None:
        self._set_block(19)
        await self.scheduler.async_apply_current_schedule()
        self.assertEqual(self.climate.calls[-1][2], 19.0)

        await self.scheduler.async_update_zone_limits(
            self.entity_id, {"min_temperature": 21}
        )

        self.assertEqual(
            self.climate.calls[-1],
            ("set_temperature", self.entity_id, 21.0, True, "heat"),
        )
        event = self._applied_events()[-1]
        self.assertEqual(event["source"], "zone_limits_updated")
        self.assertEqual(event["requested_temperature"], 19.0)

        await self.scheduler.async_update_zone_limits(
            self.entity_id, {"min_temperature": None}
        )

        self.assertEqual(
            self.climate.calls[-1],
            ("set_temperature", self.entity_id, 19.0, True, "heat"),
        )
        self.assertNotIn("limited_by", self._applied_events()[-1])

    async def test_update_zone_limits_reapplies_an_active_boost(self) -> None:
        self.climate.snapshots[self.entity_id] = {"hvac_mode": "heat", "temperature": 20}
        await self.scheduler.async_set_zone_boost(
            self.entity_id, 19, "2026-05-19T20:00:00+00:00", hvac_mode="heat"
        )

        await self.scheduler.async_update_zone_limits(
            self.entity_id, {"min_temperature": 21}
        )

        self.assertEqual(
            self.climate.calls[-1],
            ("set_temperature", self.entity_id, 21.0, True, "heat"),
        )

    async def test_update_zone_limits_without_delivery_change_does_not_redeliver(self) -> None:
        self._set_block(22)
        await self.scheduler.async_apply_current_schedule()
        call_count = len(self.climate.calls)

        await self.scheduler.async_update_zone_limits(
            self.entity_id, {"min_temperature": 21, "max_temperature": 24}
        )

        self.assertEqual(len(self.climate.calls), call_count)
        self.assertEqual(self.save_count, 1)

    async def test_update_zone_limits_does_not_touch_a_manual_zone(self) -> None:
        self._set_block(19)
        await self.scheduler.async_update_external_change_policy(
            self.entity_id, {"action": "until_resumed", "duration_minutes": 30}
        )
        await self.scheduler.async_handle_external_climate_change(
            self.entity_id,
            changed_fields=["temperature"],
            previous={"temperature": 19.0},
            current={"temperature": 17.0},
        )
        self.climate.calls.clear()

        await self.scheduler.async_update_zone_limits(
            self.entity_id, {"min_temperature": 21}
        )

        self.assertEqual(self.climate.calls, [])

    async def test_save_failure_rolls_back_limits(self) -> None:
        async def failing_save() -> None:
            raise RuntimeError("disk full")

        self.scheduler._async_save_data = failing_save
        with self.assertRaises(RuntimeError):
            await self.scheduler.async_update_zone_limits(
                self.entity_id, {"min_temperature": 21}
            )
        self.assertEqual(
            self.scheduler.get_zone_limits(self.entity_id),
            {"min_temperature": None, "max_temperature": None},
        )

    def test_effective_limits_narrow_the_device_range(self) -> None:
        self.assertEqual(
            self.scheduler.get_effective_temperature_limits(self.entity_id),
            (5.0, 35.0),
        )
        self._set_limits(21, 24)
        self.assertEqual(
            self.scheduler.get_effective_temperature_limits(self.entity_id),
            (21.0, 24.0),
        )
        # Stored limits outside a changed device range never invert it.
        self.climate.limits[self.entity_id] = (10.0, 20.0)
        self.assertEqual(
            self.scheduler.get_effective_temperature_limits(self.entity_id),
            (20.0, 20.0),
        )

    async def test_turn_off_blocks_ignore_limits(self) -> None:
        self._set_limits(21, 24)
        self.data["zones"][self.entity_id]["schedule"]["tuesday"] = [
            {"start": "17:00", "action": "turn_off"}
        ]

        await self.scheduler.async_apply_current_schedule()

        self.assertEqual(self.climate.calls, [("turn_off", self.entity_id)])
        self.assertNotIn("limited_by", self._applied_events()[-1])


if __name__ == "__main__":
    unittest.main()
