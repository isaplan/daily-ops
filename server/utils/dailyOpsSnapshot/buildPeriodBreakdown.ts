/**
 * @registry-id: dailyOpsBuildPeriodBreakdown
 * @created: 2026-07-11T00:00:00.000Z
 * @last-modified: 2026-07-13T01:03:00.000Z
 * @description: Period breakdown bars for dashboard-bundle + venue strip graph (hour/day/week/month)
 *   Reads from snapshot hourly revenue + labor sections.
 *   NOTE: Must use order-time for today (open register), paid-time for historical (sealed days).
 *   Phase 2 TODO: Create shared resolveHourlyRevenueBasis() resolver to dedup this logic across 
 *   buildHourlyRows, buildPeriodBreakdown, buildProfitByInterval, todayRevenueDetail.
 * @last-fix: [2026-07-14] Period breakdown profit via ADR-014 net-profit SSOT
 * @adr-ref: ADR-004, ADR-013, ADR-014
 * @data-source: snapshot-write-only
 * @write-cache-json: daily_ops_read_cache · dashboard-bundle · periodBreakdown slice
 *
 * @exports-to:
 * ✓ server/utils/dailyOpsSnapshot/fetchDashboardBundle.ts
 * ✓ server/utils/dailyOpsSnapshot/aggregateDailyBundles.ts
 */

import type {
  PeriodBreakdownDto,
  PeriodBreakdownGranularity,
  PeriodBreakdownRowDto,
  PeriodBreakdownStaffByContractDto,
  DailyOpsLaborMetricsDto,
  DailyOpsRevenueDrilldownDto,
} from '~/types/daily-ops-dashboard'
import type { SnapshotLaborByBusinessDateHourBucket } from './dashboardBundle/laborHourMaps'
import type { StaffHourBucket } from './staffHourBuckets'
import { laborBucketForLocationHour } from './dashboardBundle/laborHourMaps'
import type { DailyOpsDashboardBundleDto } from './fetchDashboardBundle'
import { enumerateUtcDatesInclusive } from '../dailyOpsMetrics/context'
import { VENUE_STRIP_LOCATIONS } from '../venueStrip/constants'
import { getIsoWeek, getMonthKey } from './aggregateDailyBundles'
import { hourLabel } from './drilldown/drilldownShared'
import { weekdayShortForYmd } from '~/utils/inbox/importTableQuickDates'
import { formatIsoWeekBucketLabel } from '~/utils/dailyOpsPeriodBreakdownChart'
import {
  defaultPeriodBreakdownPnlContext,
  netProfitFromHeadline,
  type PeriodBreakdownPnlContext,
} from '~/server/utils/dailyOpsInsights/pnlFromRevenueLabor'

function periodProfit(
  revenue: number,
  laborCost: number,
  pnl: PeriodBreakdownPnlContext,
): number {
  return netProfitFromHeadline(revenue, laborCost, pnl.categoryTotals, pnl.assumptions)
}

function round2(n: number): number {
  return Math.round(n * 100) / 100
}

function emptyRow(key: string, label: string): PeriodBreakdownRowDto {
  return {
    bucketKey: key,
    bucketLabel: label,
    revenue: 0,
    laborCost: 0,
    laborHours: 0,
    productivity: null,
    staffCount: 0,
    staffByContract: { ft: 0, pt: 0, zzp: 0 },
    profit: 0,
  }
}

function applyStaffBucket(
  row: PeriodBreakdownRowDto,
  staff?: StaffHourBucket,
): void {
  if (!staff || staff.staffCount <= 0) return
  row.staffCount = staff.staffCount
  row.staffByContract = { ...staff.byContract }
}

function applyLaborHourBucket(
  row: PeriodBreakdownRowDto,
  bucket: SnapshotLaborByBusinessDateHourBucket,
): void {
  row.laborHours = bucket.hours
  if (row.laborCost <= 0 && bucket.loadedCost > 0) {
    row.laborCost = round2(bucket.loadedCost)
  }
}

function finalizeRow(row: PeriodBreakdownRowDto): PeriodBreakdownRowDto {
  return {
    ...row,
    revenue: round2(row.revenue),
    laborCost: round2(row.laborCost),
    laborHours: round2(row.laborHours),
    profit: round2(row.profit),
    productivity: row.laborHours > 0 ? round2(row.revenue / row.laborHours) : null,
  }
}

function mergeRows(a: PeriodBreakdownRowDto, b: PeriodBreakdownRowDto): PeriodBreakdownRowDto {
  return finalizeRow({
    bucketKey: a.bucketKey,
    bucketLabel: a.bucketLabel,
    revenue: a.revenue + b.revenue,
    laborCost: a.laborCost + b.laborCost,
    laborHours: a.laborHours + b.laborHours,
    productivity: null,
    staffCount: a.staffCount + b.staffCount,
    profit: a.profit + b.profit,
  })
}

function weekLabel(weekKey: string): string {
  return formatIsoWeekBucketLabel(weekKey)
}

function monthLabel(monthKey: string): string {
  const [y, m] = monthKey.split('-').map(Number)
  return new Date(Date.UTC(y!, m! - 1, 1)).toLocaleDateString('nl-NL', { month: 'short', timeZone: 'UTC' })
}

function isMonthlyPartBundle(bundle: DailyOpsDashboardBundleDto): boolean {
  const days = enumerateUtcDatesInclusive(
    bundle.summary.range.startDate,
    bundle.summary.range.endDate,
  ).length
  return days >= 20
}

export function resolveBreakdownGranularity(
  startDate: string,
  endDate: string,
  parts: DailyOpsDashboardBundleDto[],
): PeriodBreakdownGranularity {
  if (startDate === endDate) return 'hour'
  if (parts.length > 1 && parts.every(isMonthlyPartBundle)) return 'month'
  const dayCount = enumerateUtcDatesInclusive(startDate, endDate).length
  if (dayCount <= 7) return 'day'
  if (dayCount <= 31) return 'week'
  return 'month'
}

export function buildHourBreakdownFromDrilldown(
  drilldown: DailyOpsRevenueDrilldownDto | undefined,
  options?: {
    businessDate?: string
    laborByLocHour?: Map<string, SnapshotLaborByBusinessDateHourBucket>
    staffByLocHour?: Map<string, StaffHourBucket>
  },
): PeriodBreakdownDto {
  const businessDate = options?.businessDate
  const laborByLocHour = options?.laborByLocHour
  const staffByLocHour = options?.staffByLocHour
  const orgByHour = new Map<number, PeriodBreakdownRowDto>()
  const byVenueMaps = new Map<string, Map<number, PeriodBreakdownRowDto>>()

  for (let hour = 0; hour < 24; hour += 1) {
    orgByHour.set(hour, emptyRow(String(hour), hourLabel(hour)))
    for (const venue of VENUE_STRIP_LOCATIONS) {
      if (!byVenueMaps.has(venue.locationId)) {
        byVenueMaps.set(venue.locationId, new Map())
      }
      const vRow = emptyRow(String(hour), hourLabel(hour))
      byVenueMaps.get(venue.locationId)!.set(hour, vRow)

      if (businessDate && laborByLocHour) {
        const labor = laborBucketForLocationHour(laborByLocHour, venue.locationId, businessDate, hour)
        applyLaborHourBucket(vRow, labor)
      }
      if (businessDate && staffByLocHour) {
        const staff = staffByLocHour.get(`${venue.locationId}|${businessDate}|${hour}`)
        applyStaffBucket(vRow, staff)
      }
    }
  }

  for (const row of drilldown?.hourlyRows ?? []) {
    const h = row.calendarHour
    const org = orgByHour.get(h)
    if (!org) continue
    org.revenue += row.revenue
    org.laborCost += row.laborCost
    org.profit += row.profit

    for (const loc of row.locations) {
      const venueMap = byVenueMaps.get(loc.locationId)
      if (!venueMap) continue
      const vRow = venueMap.get(h)
      if (!vRow) continue
      vRow.revenue += loc.revenue
      vRow.laborCost += loc.laborCost
      vRow.profit += loc.profit
    }
  }

  if (businessDate && laborByLocHour) {
    for (let hour = 0; hour < 24; hour += 1) {
      const org = orgByHour.get(hour)
      if (!org) continue
      let totalHours = 0
      let totalLaborCost = 0
      let totalStaff = 0
      const contractTotals: PeriodBreakdownStaffByContractDto = { ft: 0, pt: 0, zzp: 0 }
      for (const venue of VENUE_STRIP_LOCATIONS) {
        const labor = laborBucketForLocationHour(laborByLocHour, venue.locationId, businessDate, hour)
        totalHours += labor.hours
        totalLaborCost += labor.loadedCost
        const staff = staffByLocHour?.get(`${venue.locationId}|${businessDate}|${hour}`)
        if (staff) {
          totalStaff += staff.staffCount
          contractTotals.ft += staff.byContract.ft
          contractTotals.pt += staff.byContract.pt
          contractTotals.zzp += staff.byContract.zzp
        }
      }
      org.laborHours = round2(totalHours)
      if (org.laborCost <= 0 && totalLaborCost > 0) org.laborCost = round2(totalLaborCost)
      if (totalStaff > 0) {
        org.staffCount = totalStaff
        org.staffByContract = contractTotals
      }
    }
  }

  const sortedHours = [...orgByHour.keys()].sort((a, b) => a - b)
  const rows = sortedHours.map((h) => finalizeRow(orgByHour.get(h)!))
  const byVenue = VENUE_STRIP_LOCATIONS.map((venue) => ({
    locationId: venue.locationId,
    locationName: venue.locationName,
    rows: sortedHours.map((h) => finalizeRow(byVenueMaps.get(venue.locationId)!.get(h)!)),
  }))

  return {
    granularity: 'hour',
    rows,
    byVenue,
    estimatesNote: drilldown?.estimatesNote,
  }
}

export function dayRowFromDailyBundle(bundle: DailyOpsDashboardBundleDto): PeriodBreakdownRowDto {
  const date = bundle.summary.range.startDate
  const s = bundle.summary.summary
  const dayLabor = bundle.labor.daily.find((d) => d.date === date)
  return finalizeRow({
    bucketKey: date,
    bucketLabel: weekdayShortForYmd(date),
    revenue: s.totalRevenue,
    laborCost: s.totalLaborCost,
    laborHours: s.totalLaborHours,
    productivity: s.revenuePerLaborHour,
    staffCount: dayLabor?.distinctWorkerCount ?? 0,
    profit: s.profit,
  })
}

function venueDayRowFromStrip(
  bundle: DailyOpsDashboardBundleDto,
  locationId: string,
  date: string,
  pnl: PeriodBreakdownPnlContext,
): PeriodBreakdownRowDto | null {
  const venue = bundle.venueStrip?.venues.find((v) => v.locationId === locationId)
  if (!venue) return null
  return finalizeRow({
    bucketKey: date,
    bucketLabel: weekdayShortForYmd(date),
    revenue: venue.revenue.total,
    laborCost: venue.labor.all.loaded,
    laborHours: venue.labor.gewerkt.hours,
    productivity: venue.productivity.totalPerHour,
    staffCount: venue.labor.gewerkt.workers,
    profit: periodProfit(venue.revenue.total, venue.labor.all.loaded, pnl),
  })
}

function dayRowsByVenueFromDailyBundle(
  bundle: DailyOpsDashboardBundleDto,
  pnl: PeriodBreakdownPnlContext,
): Map<string, PeriodBreakdownRowDto> {
  const date = bundle.summary.range.startDate
  const label = weekdayShortForYmd(date)
  const byVenue = new Map<string, PeriodBreakdownRowDto>()

  for (const venue of VENUE_STRIP_LOCATIONS) {
    const fromStrip = venueDayRowFromStrip(bundle, venue.locationId, date, pnl)
    byVenue.set(venue.locationId, fromStrip ?? emptyRow(date, label))
  }

  const drilldown = bundle.revenue.drilldown
  if (drilldown?.hourlyRows?.length) {
    for (const venue of VENUE_STRIP_LOCATIONS) {
      byVenue.set(venue.locationId, emptyRow(date, label))
    }
    for (const hourRow of drilldown.hourlyRows) {
      for (const loc of hourRow.locations) {
        const row = byVenue.get(loc.locationId)
        if (!row) continue
        row.revenue += loc.revenue
        row.laborCost += loc.laborCost
        row.profit += loc.profit
      }
    }
    for (const [locId, row] of byVenue) {
      byVenue.set(locId, finalizeRow(row))
    }
  }

  return byVenue
}

function monthRowFromBundle(bundle: DailyOpsDashboardBundleDto, monthKey: string): PeriodBreakdownRowDto {
  const s = bundle.summary.summary
  return finalizeRow({
    bucketKey: monthKey,
    bucketLabel: monthLabel(monthKey),
    revenue: s.totalRevenue,
    laborCost: s.totalLaborCost,
    laborHours: s.totalLaborHours,
    productivity: s.revenuePerLaborHour,
    staffCount: 0,
    profit: s.profit,
  })
}


export function aggregatePeriodBreakdown(
  parts: DailyOpsDashboardBundleDto[],
  startDate: string,
  endDate: string,
  pnl: PeriodBreakdownPnlContext = defaultPeriodBreakdownPnlContext(),
): PeriodBreakdownDto | undefined {
  if (parts.length === 0) return undefined

  const granularity = resolveBreakdownGranularity(startDate, endDate, parts)

  if (granularity === 'day') {
    const sorted = [...parts].sort((a, b) =>
      a.summary.range.startDate.localeCompare(b.summary.range.startDate),
    )
    const rows = sorted.map(dayRowFromDailyBundle)
    const byVenue = VENUE_STRIP_LOCATIONS.map((venue) => ({
      locationId: venue.locationId,
      locationName: venue.locationName,
      rows: sorted.map((bundle) => {
        const map = dayRowsByVenueFromDailyBundle(bundle, pnl)
        return map.get(venue.locationId) ?? emptyRow(bundle.summary.range.startDate, weekdayShortForYmd(bundle.summary.range.startDate))
      }),
    }))
    const coverageNote = parts.some((p) => (p.summary.snapshotCoverage?.missingDates?.length ?? 0) > 0)
      ? 'Partial period — some days missing from cache.'
      : null
    return { granularity, rows, byVenue, coverageNote }
  }

  if (granularity === 'week') {
    const byWeek = new Map<string, PeriodBreakdownRowDto>()
    const byVenueWeek = new Map<string, Map<string, PeriodBreakdownRowDto>>()
    for (const venue of VENUE_STRIP_LOCATIONS) {
      byVenueWeek.set(venue.locationId, new Map())
    }

    for (const bundle of parts) {
      const date = bundle.summary.range.startDate
      const weekKey = getIsoWeek(date)
      const wLabel = weekLabel(weekKey)
      const dayRow = dayRowFromDailyBundle(bundle)
      const weekRow = { ...dayRow, bucketKey: weekKey, bucketLabel: wLabel }
      const prev = byWeek.get(weekKey)
      byWeek.set(weekKey, prev ? mergeRows(prev, weekRow) : weekRow)

      const venueDayMap = dayRowsByVenueFromDailyBundle(bundle, pnl)
      for (const venue of VENUE_STRIP_LOCATIONS) {
        const vDay = venueDayMap.get(venue.locationId)!
        const vWeek = { ...vDay, bucketKey: weekKey, bucketLabel: wLabel }
        const vMap = byVenueWeek.get(venue.locationId)!
        const vPrev = vMap.get(weekKey)
        vMap.set(weekKey, vPrev ? mergeRows(vPrev, vWeek) : vWeek)
      }
    }

    const rows = [...byWeek.entries()]
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([, r]) => finalizeRow(r))
    const byVenue = VENUE_STRIP_LOCATIONS.map((venue) => ({
      locationId: venue.locationId,
      locationName: venue.locationName,
      rows: [...(byVenueWeek.get(venue.locationId) ?? new Map()).entries()]
        .sort((a, b) => a[0].localeCompare(b[0]))
        .map(([, r]) => finalizeRow(r)),
    }))
    return { granularity, rows, byVenue }
  }

  const sortedMonths = [...parts].sort((a, b) =>
    getMonthKey(a.summary.range.startDate).localeCompare(getMonthKey(b.summary.range.startDate)),
  )
  const rows = sortedMonths.map((b) => monthRowFromBundle(b, getMonthKey(b.summary.range.startDate)))
  const byVenue = VENUE_STRIP_LOCATIONS.map((venue) => ({
    locationId: venue.locationId,
    locationName: venue.locationName,
    rows: sortedMonths.map((b) => {
      const monthKey = getMonthKey(b.summary.range.startDate)
      const fromStrip = b.venueStrip?.venues.find((v) => v.locationId === venue.locationId)
      if (!fromStrip) return emptyRow(monthKey, monthLabel(monthKey))
      return finalizeRow({
        bucketKey: monthKey,
        bucketLabel: monthLabel(monthKey),
        revenue: fromStrip.revenue.total,
        laborCost: fromStrip.labor.all.loaded,
        laborHours: fromStrip.labor.gewerkt.hours,
        productivity: fromStrip.productivity.totalPerHour,
        staffCount: fromStrip.labor.gewerkt.workers,
        profit: periodProfit(fromStrip.revenue.total, fromStrip.labor.all.loaded, pnl),
      })
    }),
  }))
  return { granularity: 'month', rows, byVenue }
}

function laborDayRow(
  day: {
    date: string
    revenue: number
    laborCost: number
    hours: number
    distinctWorkerCount: number
    revenuePerLaborHour: number | null
  },
  pnl: PeriodBreakdownPnlContext,
): PeriodBreakdownRowDto {
  return finalizeRow({
    bucketKey: day.date,
    bucketLabel: weekdayShortForYmd(day.date),
    revenue: day.revenue,
    laborCost: day.laborCost,
    laborHours: day.hours,
    productivity: day.revenuePerLaborHour,
    staffCount: day.distinctWorkerCount,
    profit: periodProfit(day.revenue, day.laborCost, pnl),
  })
}

function venueDayRowFromLabor(
  labor: DailyOpsLaborMetricsDto,
  venue: (typeof VENUE_STRIP_LOCATIONS)[number],
  date: string,
  pnl: PeriodBreakdownPnlContext,
): PeriodBreakdownRowDto {
  const rev =
    labor.revenueByLocationDay.find((r) => r.date === date && r.locationId === venue.locationId)?.revenue ?? 0
  const teams = labor.workersByTeamLocationByDay.filter(
    (r) => r.date === date && r.locationId === venue.locationId,
  )
  const laborCost = teams.reduce((s, t) => s + t.totalCost, 0)
  const hours = teams.reduce((s, t) => s + t.totalHours, 0)
  const staffCount = teams.reduce((s, t) => s + t.workerCount, 0)
  return finalizeRow({
    bucketKey: date,
    bucketLabel: weekdayShortForYmd(date),
    revenue: rev,
    laborCost,
    laborHours: hours,
    productivity: hours > 0 ? round2(rev / hours) : null,
    staffCount,
    profit: periodProfit(rev, laborCost, pnl),
  })
}

export function buildPeriodBreakdownFromLaborMetrics(
  labor: DailyOpsLaborMetricsDto,
  startDate: string,
  endDate: string,
  pnl: PeriodBreakdownPnlContext = defaultPeriodBreakdownPnlContext(),
): PeriodBreakdownDto {
  const granularity = resolveBreakdownGranularity(startDate, endDate, [])

  if (granularity === 'day') {
    const rows = labor.daily.map((day) => laborDayRow(day, pnl))
    const byVenue = VENUE_STRIP_LOCATIONS.map((venue) => ({
      locationId: venue.locationId,
      locationName: venue.locationName,
      rows: labor.daily.map((day) => venueDayRowFromLabor(labor, venue, day.date, pnl)),
    }))
    return { granularity, rows, byVenue }
  }

  if (granularity === 'week') {
    const byWeek = new Map<string, PeriodBreakdownRowDto>()
    const byVenueWeek = new Map<string, Map<string, PeriodBreakdownRowDto>>()
    for (const venue of VENUE_STRIP_LOCATIONS) {
      byVenueWeek.set(venue.locationId, new Map())
    }

    for (const day of labor.daily) {
      const weekKey = getIsoWeek(day.date)
      const wLabel = weekLabel(weekKey)
      const dayRow = laborDayRow(day, pnl)
      const weekRow = { ...dayRow, bucketKey: weekKey, bucketLabel: wLabel }
      const prev = byWeek.get(weekKey)
      byWeek.set(weekKey, prev ? mergeRows(prev, weekRow) : weekRow)

      for (const venue of VENUE_STRIP_LOCATIONS) {
        const vDay = venueDayRowFromLabor(labor, venue, day.date, pnl)
        const vWeek = { ...vDay, bucketKey: weekKey, bucketLabel: wLabel }
        const vMap = byVenueWeek.get(venue.locationId)!
        const vPrev = vMap.get(weekKey)
        vMap.set(weekKey, vPrev ? mergeRows(vPrev, vWeek) : vWeek)
      }
    }

    const rows = [...byWeek.entries()]
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([, r]) => finalizeRow(r))
    const byVenue = VENUE_STRIP_LOCATIONS.map((venue) => ({
      locationId: venue.locationId,
      locationName: venue.locationName,
      rows: [...(byVenueWeek.get(venue.locationId) ?? new Map()).entries()]
        .sort((a, b) => a[0].localeCompare(b[0]))
        .map(([, r]) => finalizeRow(r)),
    }))
    return { granularity, rows, byVenue }
  }

  const byMonth = new Map<string, PeriodBreakdownRowDto>()
  const byVenueMonth = new Map<string, Map<string, PeriodBreakdownRowDto>>()
  for (const venue of VENUE_STRIP_LOCATIONS) {
    byVenueMonth.set(venue.locationId, new Map())
  }

  for (const day of labor.daily) {
    const monthKey = getMonthKey(day.date)
    const mLabel = monthLabel(monthKey)
    const dayRow = laborDayRow(day, pnl)
    const monthRow = { ...dayRow, bucketKey: monthKey, bucketLabel: mLabel }
    const prev = byMonth.get(monthKey)
    byMonth.set(monthKey, prev ? mergeRows(prev, monthRow) : monthRow)

    for (const venue of VENUE_STRIP_LOCATIONS) {
      const vDay = venueDayRowFromLabor(labor, venue, day.date, pnl)
      const vMonth = { ...vDay, bucketKey: monthKey, bucketLabel: mLabel }
      const vMap = byVenueMonth.get(venue.locationId)!
      const vPrev = vMap.get(monthKey)
      vMap.set(monthKey, vPrev ? mergeRows(vPrev, vMonth) : vMonth)
    }
  }

  const rows = [...byMonth.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([, r]) => finalizeRow(r))
  const byVenue = VENUE_STRIP_LOCATIONS.map((venue) => ({
    locationId: venue.locationId,
    locationName: venue.locationName,
    rows: [...(byVenueMonth.get(venue.locationId) ?? new Map()).entries()]
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([, r]) => finalizeRow(r)),
  }))
  return { granularity: 'month', rows, byVenue }
}

export function buildPeriodBreakdownForBundle(
  bundle: DailyOpsDashboardBundleDto,
  parts?: DailyOpsDashboardBundleDto[],
  pnl: PeriodBreakdownPnlContext = defaultPeriodBreakdownPnlContext(),
): PeriodBreakdownDto | undefined {
  const { startDate, endDate } = bundle.summary.range
  if (startDate === endDate) {
    return buildHourBreakdownFromDrilldown(bundle.revenue.drilldown, {
      businessDate: startDate,
    })
  }
  if (parts && parts.length > 0) {
    return aggregatePeriodBreakdown(parts, startDate, endDate, pnl)
  }
  return aggregatePeriodBreakdown([bundle], startDate, endDate, pnl)
}
