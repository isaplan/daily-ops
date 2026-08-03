/**
 * @registry-id: dailyOpsBuildPeriodBreakdown
 * @created: 2026-07-11T00:00:00.000Z
 * @last-modified: 2026-07-28T14:05:34.000Z
 * @description: Period breakdown bars for dashboard-bundle + venue strip graph (hour/day/week/month)
 *   Reads from snapshot hourly revenue + labor sections.
 *   NOTE: Must use order-time for today (open register), paid-time for historical (sealed days).
 *   Phase 2 TODO: Create shared resolveHourlyRevenueBasis() resolver to dedup this logic across 
 *   buildHourlyRows, buildPeriodBreakdown, buildProfitByInterval, todayRevenueDetail.
 * @last-fix: [2026-07-28] Staff = keuken+bediening stacks; seal occupancyPct on rows
 *   Prior: [2026-07-22] Keep strip staffCount/laborHours when drilldown overwrites € rows
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
  PeriodBreakdownStaffByTeamDto,
  DailyOpsLaborMetricsDto,
  DailyOpsRevenueDrilldownDto,
  VenueStripCardDto,
} from '~/types/daily-ops-dashboard'
import type { SnapshotLaborByBusinessDateHourBucket } from './dashboardBundle/laborHourMaps'
import type { StaffHourBucket } from './staffHourBuckets'
import { laborBucketForLocationHour } from './dashboardBundle/laborHourMaps'
import type { DailyOpsDashboardBundleDto } from './fetchDashboardBundle'
import { enumerateUtcDatesInclusive } from '../dailyOpsMetrics/context'
import { VENUE_STRIP_LOCATIONS } from '../venueStrip/constants'
import { bucketTeamFromName } from '../dailyOpsTeamBucket'
import { getIsoWeek, getMonthKey } from './aggregateDailyBundles'
import { hourLabel } from './drilldown/drilldownShared'
import { weekdayShortForYmd } from '~/utils/inbox/importTableQuickDates'
import { formatIsoWeekBucketLabel } from '~/utils/dailyOpsPeriodBreakdownChart'
import {
  defaultPeriodBreakdownPnlContext,
  netProfitFromHeadline,
  type PeriodBreakdownPnlContext,
} from '~/server/utils/dailyOpsInsights/pnlFromRevenueLabor'

export { applyOccupancyToPeriodBreakdown } from '~/utils/dailyOpsPeriodBreakdownOccupancy'

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

function round1(n: number): number {
  return Math.round(n * 10) / 10
}

function emptyStaffByTeam(): PeriodBreakdownStaffByTeamDto {
  return { keuken: 0, bediening: 0 }
}

function staffCountFromTeam(team: PeriodBreakdownStaffByTeamDto): number {
  return team.keuken + team.bediening
}

function staffByTeamFromStrip(venue: VenueStripCardDto): PeriodBreakdownStaffByTeamDto {
  return {
    keuken: venue.labor.keuken.workers,
    bediening: venue.labor.bediening.workers,
  }
}

function staffByTeamFromLaborTeams(
  teams: Array<{ teamName: string; workerCount: number }>,
): PeriodBreakdownStaffByTeamDto {
  const out = emptyStaffByTeam()
  for (const t of teams) {
    const bucket = bucketTeamFromName(t.teamName)
    if (bucket === 'keuken') out.keuken += t.workerCount
    else if (bucket === 'bediening') out.bediening += t.workerCount
  }
  return out
}

function meanOccupancy(
  a: number | null | undefined,
  b: number | null | undefined,
): number | null {
  const vals = [a, b].filter((x): x is number => x != null && Number.isFinite(x))
  if (vals.length === 0) return null
  return round1(vals.reduce((s, n) => s + n, 0) / vals.length)
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
    staffByTeam: emptyStaffByTeam(),
    occupancyPct: null,
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
  if (staff.byTeam) {
    row.staffByTeam = { ...staff.byTeam }
    row.staffCount = staffCountFromTeam(row.staffByTeam)
  }
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
  const staffByTeam = row.staffByTeam ?? emptyStaffByTeam()
  const staffCount =
    staffByTeam.keuken > 0 || staffByTeam.bediening > 0
      ? staffCountFromTeam(staffByTeam)
      : row.staffCount
  return {
    ...row,
    revenue: round2(row.revenue),
    laborCost: round2(row.laborCost),
    laborHours: round2(row.laborHours),
    profit: round2(row.profit),
    staffByTeam,
    staffCount,
    productivity: row.laborHours > 0 ? round2(row.revenue / row.laborHours) : null,
  }
}

function mergeRows(a: PeriodBreakdownRowDto, b: PeriodBreakdownRowDto): PeriodBreakdownRowDto {
  const staffByTeam: PeriodBreakdownStaffByTeamDto = {
    keuken: (a.staffByTeam?.keuken ?? 0) + (b.staffByTeam?.keuken ?? 0),
    bediening: (a.staffByTeam?.bediening ?? 0) + (b.staffByTeam?.bediening ?? 0),
  }
  return finalizeRow({
    bucketKey: a.bucketKey,
    bucketLabel: a.bucketLabel,
    revenue: a.revenue + b.revenue,
    laborCost: a.laborCost + b.laborCost,
    laborHours: a.laborHours + b.laborHours,
    productivity: null,
    staffCount: staffCountFromTeam(staffByTeam),
    staffByTeam,
    staffByContract: {
      ft: (a.staffByContract?.ft ?? 0) + (b.staffByContract?.ft ?? 0),
      pt: (a.staffByContract?.pt ?? 0) + (b.staffByContract?.pt ?? 0),
      zzp: (a.staffByContract?.zzp ?? 0) + (b.staffByContract?.zzp ?? 0),
    },
    occupancyPct: meanOccupancy(a.occupancyPct, b.occupancyPct),
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
      const teamTotals = emptyStaffByTeam()
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
          if (staff.byTeam) {
            teamTotals.keuken += staff.byTeam.keuken
            teamTotals.bediening += staff.byTeam.bediening
          }
        }
      }
      org.laborHours = round2(totalHours)
      if (org.laborCost <= 0 && totalLaborCost > 0) org.laborCost = round2(totalLaborCost)
      if (totalStaff > 0) {
        org.staffCount = totalStaff
        org.staffByContract = contractTotals
        if (teamTotals.keuken > 0 || teamTotals.bediening > 0) {
          org.staffByTeam = teamTotals
          org.staffCount = staffCountFromTeam(teamTotals)
        }
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

function occupancyForOrgDay(
  bundle: DailyOpsDashboardBundleDto,
  date: string,
): number | null {
  const occ = bundle.tableOccupancy
  if (!occ) return null
  const fromSeries = occ.series?.day?.find((p) => p.key === date)?.occupancyPct
  if (fromSeries != null) return fromSeries
  return occ.occupancyPct
}

function occupancyForVenueDay(
  bundle: DailyOpsDashboardBundleDto,
  locationId: string,
  date: string,
): number | null {
  const occ = bundle.tableOccupancy
  if (!occ) return null
  const day = occ.daily?.find((d) => d.date === date && d.locationId === locationId)
  if (day) return day.occupancyPct
  return occ.venues.find((v) => v.locationId === locationId)?.occupancyPct ?? null
}

export function dayRowFromDailyBundle(bundle: DailyOpsDashboardBundleDto): PeriodBreakdownRowDto {
  const date = bundle.summary.range.startDate
  const s = bundle.summary.summary
  const staffByTeam = emptyStaffByTeam()
  for (const venue of bundle.venueStrip?.venues ?? []) {
    const t = staffByTeamFromStrip(venue)
    staffByTeam.keuken += t.keuken
    staffByTeam.bediening += t.bediening
  }
  const hasTeam = staffByTeam.keuken > 0 || staffByTeam.bediening > 0
  const dayLabor = bundle.labor.daily.find((d) => d.date === date)
  return finalizeRow({
    bucketKey: date,
    bucketLabel: weekdayShortForYmd(date),
    revenue: s.totalRevenue,
    laborCost: s.totalLaborCost,
    laborHours: s.totalLaborHours,
    productivity: s.revenuePerLaborHour,
    staffByTeam: hasTeam ? staffByTeam : undefined,
    staffCount: hasTeam
      ? staffCountFromTeam(staffByTeam)
      : (dayLabor?.distinctWorkerCount ?? 0),
    occupancyPct: occupancyForOrgDay(bundle, date),
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
  const staffByTeam = staffByTeamFromStrip(venue)
  return finalizeRow({
    bucketKey: date,
    bucketLabel: weekdayShortForYmd(date),
    revenue: venue.revenue.total,
    laborCost: venue.labor.all.loaded,
    laborHours: venue.labor.gewerkt.hours,
    productivity: venue.productivity.totalPerHour,
    staffByTeam,
    staffCount: staffCountFromTeam(staffByTeam),
    occupancyPct: occupancyForVenueDay(bundle, locationId, date),
    profit: periodProfit(venue.revenue.total, venue.labor.all.loaded, pnl),
  })
}

/** Staff/hours from sealed labor when strip missing or wiped (keuken+bediening only). */
function venueStaffHoursFromLabor(
  bundle: DailyOpsDashboardBundleDto,
  locationId: string,
  date: string,
): { laborHours: number; staffCount: number; staffByTeam: PeriodBreakdownStaffByTeamDto } {
  const teams = (bundle.labor?.workersByTeamLocationByDay ?? []).filter(
    (r) => r.date === date && r.locationId === locationId,
  )
  const staffByTeam = staffByTeamFromLaborTeams(teams)
  return {
    laborHours: round2(teams.reduce((s, t) => s + (t.totalHours ?? 0), 0)),
    staffCount: staffCountFromTeam(staffByTeam),
    staffByTeam,
  }
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
    if (fromStrip) {
      byVenue.set(venue.locationId, fromStrip)
      continue
    }
    const row = emptyRow(date, label)
    const fromLabor = venueStaffHoursFromLabor(bundle, venue.locationId, date)
    row.laborHours = fromLabor.laborHours
    row.staffCount = fromLabor.staffCount
    row.staffByTeam = fromLabor.staffByTeam
    row.occupancyPct = occupancyForVenueDay(bundle, venue.locationId, date)
    byVenue.set(venue.locationId, row)
  }

  const drilldown = bundle.revenue.drilldown
  if (drilldown?.hourlyRows?.length) {
    // Drilldown locations only carry € — keep strip/labor staff+hours for Staff & Productivity.
    for (const venue of VENUE_STRIP_LOCATIONS) {
      const prev = byVenue.get(venue.locationId)!
      byVenue.set(venue.locationId, {
        ...emptyRow(date, label),
        laborHours: prev.laborHours,
        staffCount: prev.staffCount,
        staffByContract: prev.staffByContract,
        staffByTeam: prev.staffByTeam,
        occupancyPct: prev.occupancyPct,
      })
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
      if (row.staffCount <= 0 || row.laborHours <= 0) {
        const fromLabor = venueStaffHoursFromLabor(bundle, locId, date)
        if (row.laborHours <= 0) row.laborHours = fromLabor.laborHours
        if (row.staffCount <= 0) {
          row.staffCount = fromLabor.staffCount
          row.staffByTeam = fromLabor.staffByTeam
        }
      }
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
      const staffByTeam = staffByTeamFromStrip(fromStrip)
      return finalizeRow({
        bucketKey: monthKey,
        bucketLabel: monthLabel(monthKey),
        revenue: fromStrip.revenue.total,
        laborCost: fromStrip.labor.all.loaded,
        laborHours: fromStrip.labor.gewerkt.hours,
        productivity: fromStrip.productivity.totalPerHour,
        staffByTeam,
        staffCount: staffCountFromTeam(staffByTeam),
        occupancyPct:
          b.tableOccupancy?.venues.find((v) => v.locationId === venue.locationId)?.occupancyPct
          ?? null,
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
  labor: DailyOpsLaborMetricsDto,
  pnl: PeriodBreakdownPnlContext,
): PeriodBreakdownRowDto {
  const teams = labor.workersByTeamLocationByDay.filter((r) => r.date === day.date)
  const staffByTeam = staffByTeamFromLaborTeams(teams)
  const hasTeam = staffByTeam.keuken > 0 || staffByTeam.bediening > 0
  return finalizeRow({
    bucketKey: day.date,
    bucketLabel: weekdayShortForYmd(day.date),
    revenue: day.revenue,
    laborCost: day.laborCost,
    laborHours: day.hours,
    productivity: day.revenuePerLaborHour,
    staffByTeam: hasTeam ? staffByTeam : undefined,
    staffCount: hasTeam ? staffCountFromTeam(staffByTeam) : day.distinctWorkerCount,
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
  const staffByTeam = staffByTeamFromLaborTeams(teams)
  return finalizeRow({
    bucketKey: date,
    bucketLabel: weekdayShortForYmd(date),
    revenue: rev,
    laborCost,
    laborHours: hours,
    productivity: hours > 0 ? round2(rev / hours) : null,
    staffByTeam,
    staffCount: staffCountFromTeam(staffByTeam),
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
    const rows = labor.daily.map((day) => laborDayRow(day, labor, pnl))
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
      const dayRow = laborDayRow(day, labor, pnl)
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
    const dayRow = laborDayRow(day, labor, pnl)
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
