/**
 * @registry-id: dailyOpsOpenShiftLabor
 * @created: 2026-06-08T00:00:00.000Z
 * @last-modified: 2026-06-09T00:00:00.000Z
 * @description: Open-shift elapsed hours (start → now) for today's register business day
 * @adr-ref: ADR-010
 *
 * @exports-to:
 * ✓ server/utils/eitjeHours.ts (Mongo stage builder)
 * ✓ server/utils/venueStrip/workerShiftTimes.ts
 * ✓ server/utils/venueStrip/openShiftLaborOverlay.ts
 */

/** Elapsed worked hours from shift start until `now`, minus break minutes. */
export function elapsedOpenShiftHours(
  startAt: Date,
  now: Date = new Date(),
  breakMinutes = 0,
): number {
  if (Number.isNaN(startAt.getTime())) return 0
  const endMs = now.getTime()
  const rawMs = endMs - startAt.getTime()
  if (rawMs <= 0) return 0
  const breakMs = Math.max(0, breakMinutes) * 60_000
  const workedMs = Math.max(0, rawMs - breakMs)
  return Math.round((workedMs / 3_600_000) * 100) / 100
}

export function round2(n: number): number {
  return Math.round(n * 100) / 100
}

/** Scale loaded cost linearly when hours change (same €/h). */
export function scaleLoadedCostForHours(
  previousHours: number,
  previousLoaded: number,
  nextHours: number,
): number {
  if (nextHours <= 0) return 0
  if (previousHours > 0 && previousLoaded > 0) {
    return round2((previousLoaded / previousHours) * nextHours)
  }
  return 0
}

/** Loaded cost from cost-per-hour when no prior row exists. */
export function loadedCostFromCph(hours: number, costPerHour: number): number {
  if (hours <= 0 || costPerHour <= 0) return 0
  return round2(hours * costPerHour)
}
