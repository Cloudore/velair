import type { RoomSensorAssistStatus } from "../types";

export function signedAssistDelta(delta: number, direction?: RoomSensorAssistStatus["direction"]): number {
  return direction === "cool" ? -Math.abs(delta) : Math.abs(delta);
}
