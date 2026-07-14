/**
 * @description: Overlay history for period-breakdown trend/median (GET enrich only, bars unchanged)
 * @last-modified: 2026-07-14T00:40:00.000Z
 * @last-fix: [2026-07-14] Skip enrich for single-day hour chart (no averages UI)
 * @adr-ref: ADR-004, ADR-013
 * @exports-to:
 * ✓ server/api/daily-ops/metrics/bundle.get.ts
 */

import type { Db } from 'mongodb'
import type { PeriodBreakdownDto, PeriodBreakdownVenueDto } from '~/types/daily-ops-dashboard'
import { addCalendarDaysYmd } from '~/utils/dailyOpsBusinessDate'
import { PERIOD_HOUR_OVERLAY_LOOKBACK_DAYS } from '~/utils/dailyOpsPeriodBreakdownAverages'
import { STAFF_YEAR_DATA_START } from '~/utils/dailyOpsStaffNav/modes'
import { VENUE_STRIP_LOCATIONS } from '../venueStrip/constants'
import {
  aggregateDailyBundles,
  enumerateMonthKeys,
  monthEndYmd,
} from './aggregateDailyBundles'
import { aggregatePeriodBreakdown } from './buildPeriodBreakdown'
import { loadDailyBundlesInRange, readCachedBundle } from './cacheCascade'
import type { DailyOpsDashboardBundleDto } from './fetchDashboardBundle'

async function loadMonthBundleParts(
  db: Db,
  startDate: string,
  endDate: string,
  locationId: string,
): Promise<DailyOpsDashboardBundleDto[]> {
  const parts: DailyOpsDashboardBundleDto[] = []
  for (const mk of enumerateMonthKeys(startDate, endDate)) {
    const monthly = await readCachedBundle(db, 'monthly', mk, locationId)
    if (monthly) {
      parts.push(monthly)
      continue
    }
    const mStart = `${mk}-01`
    const mEnd = monthEndYmd(mk)
    const dailies = await loadDailyBundlesInRange(db, mStart, mEnd, locationId)
    if (dailies.length > 0) {
      parts.push(
        aggregateDailyBundles(dailies, { startDate: mStart, endDate: mEnd, label: mk }),
      )
    }
  }
  return parts
}

function mergeHourHistoryFromDailies(
  dailies: DailyOpsDashboardBundleDto[],
): PeriodBreakdownVenueDto[] {
  const venueRows = new Map<string, PeriodBreakdownVenueDto['rows']>()
  for (const venue of VENUE_STRIP_LOCATIONS) {
    venueRows.set(venue.locationId, [])
  }

  for (const bundle of dailies) {
    const date = bundle.summary.range.startDate
    const pb = bundle.periodBreakdown
    if (pb?.granularity !== 'hour') continue
    for (const v of pb.byVenue) {
      const acc = venueRows.get(v.locationId) ?? []
      for (const row of v.rows) {
        acc.push({
          ...row,
          bucketKey: `${date}T${row.bucketKey}`,
        })
      }
      venueRows.set(v.locationId, acc)
    }
  }

  return VENUE_STRIP_LOCATIONS.map((venue) => ({
    locationId: venue.locationId,
    locationName: venue.locationName,
    rows: venueRows.get(venue.locationId) ?? [],
  }))
}

export async function enrichPeriodBreakdownAverageHistory(
  db: Db,
  _periodStartDate: string,
  endDate: string,
  locationId: string | undefined,
  breakdown: PeriodBreakdownDto,
): Promise<PeriodBreakdownDto> {
  if (breakdown.averageHistory) return breakdown

  const loc = locationId ?? 'all'

  if (breakdown.granularity === 'day') {
    return breakdown
  }

  if (breakdown.granularity === 'hour' && _periodStartDate === endDate) {
    return breakdown
  }

  if (breakdown.granularity === 'hour') {
    const historyStart = addCalendarDaysYmd(endDate, -(PERIOD_HOUR_OVERLAY_LOOKBACK_DAYS - 1))
    const dailies = await loadDailyBundlesInRange(db, historyStart, endDate, loc)
    const byVenue = mergeHourHistoryFromDailies(dailies)
    const totalRows = byVenue.reduce((n, v) => n + v.rows.length, 0)
    if (totalRows < 2) return breakdown
    return {
      ...breakdown,
      averageHistory: { startDate: historyStart, endDate, byVenue },
    }
  }

  const historyStart = STAFF_YEAR_DATA_START
  let historyBreakdown: PeriodBreakdownDto | undefined

  if (breakdown.granularity === 'month') {
    const monthParts = await loadMonthBundleParts(db, historyStart, endDate, loc)
    if (monthParts.length < 2) return breakdown
    historyBreakdown = aggregatePeriodBreakdown(monthParts, historyStart, endDate)
  } else {
    const dailies = await loadDailyBundlesInRange(db, historyStart, endDate, loc)
    if (dailies.length < 2) return breakdown
    historyBreakdown = aggregatePeriodBreakdown(dailies, historyStart, endDate)
  }

  if (!historyBreakdown) return breakdown

  return {
    ...breakdown,
    averageHistory: {
      startDate: historyStart,
      endDate,
      byVenue: historyBreakdown.byVenue,
    },
  }
}
