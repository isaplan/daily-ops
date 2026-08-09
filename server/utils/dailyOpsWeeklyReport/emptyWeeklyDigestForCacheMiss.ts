/**
 * @registry-id: dailyOpsEmptyWeeklyDigest
 * @created: 2026-08-09T00:35:00.000Z
 * @last-modified: 2026-08-09T00:35:00.000Z
 * @description: Empty weekly-digest DTO for GET cache miss (no live build on GET)
 * @last-fix: [2026-08-09] PERIOD_CACHE_ADR / ADR-013 — rebuild via backfill or Monday cron only
 * @adr-ref: ADR-004, ADR-013, PERIOD_CACHE_ADR L2
 *
 * @exports-to:
 * ✓ server/api/daily-ops/analytics/weekly-digest.get.ts
 */

import type { WeeklyCompareMetric, WeeklyDigestDto, WeeklyTargetsDto } from '~/types/daily-ops-weekly-report'
import { VENUE_STRIP_LOCATIONS } from '../venueStrip/constants'
import type { WeeklyRange } from './weekRange'

const emptyTeamHours = { preOpenHours: 0, postCloseHours: 0, outsideHours: 0 }

const emptyMetric = (): WeeklyCompareMetric => ({
  value: 0,
  benchmark: 0,
  delta: 0,
  pct: null,
})

function locationNameFor (id: string): string {
  if (id === 'all') return 'All locations'
  return VENUE_STRIP_LOCATIONS.find((v) => v.locationId === id)?.locationName ?? id
}

/** Return shape for GET miss — UI shows dataGap; fix via weekly-digest backfill / cron. */
export function emptyWeeklyDigestForCacheMiss (
  range: WeeklyRange,
  locationId: string,
  targets: WeeklyTargetsDto,
): WeeklyDigestDto {
  return {
    weekKey: range.weekKey,
    label: range.label,
    startDate: range.startDate,
    endDate: range.endDate,
    locationId,
    locationName: locationNameFor(locationId),
    targets,
    coverage: {
      daysExpected: 7,
      daysFound: 0,
      missingDates: [`${range.startDate}..${range.endDate}`],
    },
    totals: {
      revenue: 0,
      revenueIncVat: 0,
      itemsCount: 0,
      laborCost: 0,
      laborHours: 0,
      laborCostPct: null,
      revenuePerHour: null,
      foodRevenue: 0,
      beverageRevenue: 0,
      pnlResult: 0,
      pnlPct: null,
      staffCount: 0,
      laborStatus: 'okay',
      pnlStatus: 'okay',
    },
    dailyBreakdown: [],
    teams: [],
    comparisons: {
      previousWeek: {
        label: 'Previous week',
        revenue: emptyMetric(),
        laborCostPct: emptyMetric(),
        pnlPct: emptyMetric(),
        occupancyPct: emptyMetric(),
      },
      rolling3Week: {
        label: 'Rolling 3 weeks',
        avgRevenue: 0,
        avgLaborCostPct: null,
        avgPnlPct: null,
        avgOccupancyPct: null,
      },
      rolling6Week: {
        label: 'Rolling 6 weeks',
        avgRevenue: 0,
        avgLaborCostPct: null,
        avgPnlPct: null,
        avgOccupancyPct: null,
      },
      rolling12Week: {
        label: 'Rolling 12 weeks',
        avgRevenue: 0,
        avgLaborCostPct: null,
        avgPnlPct: null,
        avgOccupancyPct: null,
      },
    },
    staffRankings: [],
    topProducts: [],
    upsell: [],
    hourlyLoss: [],
    spaceMargins: [],
    categoryMargins: [],
    attendance: {
      ziekHours: 0,
      ziekStaffCount: 0,
      verlofStaffCount: 0,
      verlofHours: 0,
      ziekStaff: [],
      verlofStaff: [],
    },
    staffPlusmin: {
      plusHours: 0,
      minusHours: 0,
      netDelta: 0,
      overThreshold: 0,
      underThreshold: 0,
      over: [],
      under: [],
      members: [],
    },
    openingClosing: {
      preOpenHours: 0,
      postCloseHours: 0,
      outsideHours: 0,
      keuken: emptyTeamHours,
      bediening: emptyTeamHours,
    },
    tableOccupancy: {
      activeTables: 0,
      totalTables: 0,
      occupancyPct: null,
      aggregation: 'avg_daily',
      venues: [],
    },
    dataGap: true,
    builtAt: new Date().toISOString(),
    schemaVersion: 12,
  }
}
