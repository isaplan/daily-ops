/**
 * @registry-id: dailyOpsPeriodBreakdownOccupancy
 * @created: 2026-07-28T14:40:00.000Z
 * @last-modified: 2026-08-09T17:45:00.000Z
 * @description: Join sealed tableOccupancy onto periodBreakdown rows (client + write path)
 * @last-fix: [2026-08-09] Hour grain: never stamp day venue % — null until tablesByHour exists
 *   Prior: [2026-07-29] Prefer venue hourly[] for hour grain (real active÷total)
 * @adr-ref: ADR-013, ADR-017
 *
 * @exports-to:
 * ✓ server/utils/dailyOpsSnapshot/buildPeriodBreakdown.ts
 * ✓ components/daily-ops/DailyOpsPeriodBreakdownChart.vue
 */

import type {
  PeriodBreakdownDto,
  PeriodBreakdownGranularity,
  PeriodBreakdownRowDto,
} from '~/types/daily-ops-dashboard'
import type { DailyOpsTableOccupancyKpisDto } from '~/types/daily-ops-venue-tables'

/** Normalize hour bucket keys so "9" and "09" both match. */
export function occupancyBucketLookupKeys(bucketKey: string, grain: PeriodBreakdownGranularity): string[] {
  const keys = [bucketKey]
  if (grain === 'hour') {
    const n = Number(bucketKey)
    if (Number.isFinite(n) && n >= 0 && n <= 23) {
      keys.push(String(n), String(n).padStart(2, '0'))
    }
  }
  return [...new Set(keys)]
}

function seriesForGrain(
  occupancy: DailyOpsTableOccupancyKpisDto,
  grain: PeriodBreakdownGranularity,
) {
  if (grain === 'hour') return occupancy.series?.hour
  if (grain === 'day') return occupancy.series?.day
  if (grain === 'week') return occupancy.series?.week
  return occupancy.series?.month
}

function occupancyFromSeries(
  occupancy: DailyOpsTableOccupancyKpisDto,
  grain: PeriodBreakdownGranularity,
  bucketKey: string,
): number | null | undefined {
  const series = seriesForGrain(occupancy, grain)
  if (!series?.length) return undefined
  for (const key of occupancyBucketLookupKeys(bucketKey, grain)) {
    const hit = series.find((p) => p.key === key)
    if (hit) return hit.occupancyPct
  }
  return undefined
}

function occupancyFromHourlyVenue(
  occupancy: DailyOpsTableOccupancyKpisDto,
  locationId: string,
  bucketKey: string,
): number | null | undefined {
  if (!occupancy.hourly?.length) return undefined
  const hour = Number(bucketKey)
  if (!Number.isFinite(hour)) return undefined
  const hit = occupancy.hourly.find(
    (h) => h.locationId === locationId && h.calendarHour === hour,
  )
  return hit ? hit.occupancyPct : undefined
}

/**
 * Seal / fill bezettingsgraad onto period-breakdown rows from tableOccupancy.
 * Skips rows that already have occupancyPct (sealed write wins).
 */
export function applyOccupancyToPeriodBreakdown(
  breakdown: PeriodBreakdownDto,
  occupancy: DailyOpsTableOccupancyKpisDto | undefined | null,
): PeriodBreakdownDto {
  if (!occupancy) return breakdown
  const grain = breakdown.granularity

  const patchRow = (row: PeriodBreakdownRowDto, locationId?: string): PeriodBreakdownRowDto => {
    // Hour grain = hour→day cascade leaf. Only real tablesByHour / series.hour — never day %.
    if (grain === 'hour') {
      if (locationId) {
        const fromHourly = occupancyFromHourlyVenue(occupancy, locationId, row.bucketKey)
        if (fromHourly !== undefined) {
          return { ...row, occupancyPct: fromHourly ?? null }
        }
      }
      const fromSeries = occupancyFromSeries(occupancy, 'hour', row.bucketKey)
      if (fromSeries !== undefined) {
        return { ...row, occupancyPct: fromSeries ?? null }
      }
      if (row.occupancyPct != null) return row
      return { ...row, occupancyPct: null }
    }

    if (row.occupancyPct != null) return row

    if (locationId && grain === 'day' && occupancy.daily?.length) {
      const day = occupancy.daily.find(
        (d) => d.date === row.bucketKey && d.locationId === locationId,
      )
      if (day) return { ...row, occupancyPct: day.occupancyPct }
    }

    const fromSeries = occupancyFromSeries(occupancy, grain, row.bucketKey)
    if (fromSeries !== undefined) {
      return { ...row, occupancyPct: fromSeries ?? null }
    }

    if (locationId) {
      const venueOcc = occupancy.venues.find((v) => v.locationId === locationId)?.occupancyPct
      if (venueOcc != null) return { ...row, occupancyPct: venueOcc }
    }

    return { ...row, occupancyPct: occupancy.occupancyPct }
  }

  return {
    ...breakdown,
    rows: breakdown.rows.map((r) => patchRow(r)),
    byVenue: breakdown.byVenue.map((v) => ({
      ...v,
      rows: v.rows.map((r) => patchRow(r, v.locationId)),
    })),
  }
}
