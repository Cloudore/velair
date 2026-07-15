import type { ScheduleZone } from "../types";

const GRID_TOLERANCE = 0.0001;

export function incompatibleScheduleTargetCount(
  zones: Record<string, ScheduleZone>,
  limitsFor: (entityId: string) => [number, number],
  stepFor: (entityId: string) => number | undefined,
): number {
  let count = 0;
  for (const [entityId, zone] of Object.entries(zones)) {
    const step = stepFor(entityId);
    if (step === undefined || !Number.isFinite(step) || step <= 0) {
      continue;
    }
    const [minimum, maximum] = limitsFor(entityId);
    for (const blocks of Object.values(zone.schedule)) {
      for (const block of blocks) {
        const temperature = block.temperature;
        if (typeof temperature !== "number" || !Number.isFinite(temperature)) {
          continue;
        }
        const outsideRange = temperature < minimum || temperature > maximum;
        const offGrid = Math.abs(
          temperature / step - Math.round(temperature / step),
        ) > GRID_TOLERANCE;
        if (outsideRange || offGrid) {
          count += 1;
        }
      }
    }
  }
  return count;
}
