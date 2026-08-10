/**
 * @registry-id: dailyOpsBuildTableOccupancySummary
 * @created: 2026-07-20T00:00:00.000Z
 * @last-modified: 2026-08-09T17:45:00.000Z
 * @description: Active tables + bezettingsgraad — hour→day→week→month cascade (real hourly)
 * @last-fix: [2026-08-09] Open Today: warm bork tablesByHour when snapshot schema v1 missing hours
 *   Prior: [2026-07-29] Real series.hour + hourly[] from snapshot tablesByHour
 * @adr-ref: ADR-004, ADR-013, ADR-017
 *
 * @exports-to:
 * ✓ server/utils/dailyOpsVenueTables/fetchTableOccupancyKpis.ts
 * ✓ server/utils/dailyOpsWeeklyReport/buildWeeklyTableOccupancy.ts
 * ✓ server/utils/dailyOpsSnapshot/fetchDashboardBundle.ts
 */

import type { Db } from 'mongodb'
import type {
  DailyOpsTableOccupancyDayDto,
  DailyOpsTableOccupancyHourDto,
  DailyOpsTableOccupancyKpisDto,
  DailyOpsTableOccupancyVenueDto,
  DailyOpsOccupancySeriesPoint,
} from '../../../types/daily-ops-venue-tables'
import { DAILY_OPS_SNAPSHOT_COLLECTIONS } from '../../../types/daily-ops-snapshot'
import { isOpenRegisterBusinessDate } from '~/utils/dailyOpsBusinessDate'
import { extractBorkTableNumber } from '../bork/extractBorkTableNumber'
import { fetchBorkTableDayRows } from '../bork/fetchBorkTableDayRows'
import { enumerateUtcDatesInclusive } from '../dailyOpsMetrics/context'
import { VENUE_STRIP_LOCATIONS } from '../venueStrip/constants'
import {
  DAILY_OPS_VENUE_TABLES_COLLECTION,
  ensureVenueTablesIndex,
  normalizeLocationId,
} from './collection'
import {
  buildOccupancySeriesByGrain,
  combineDailyOccupancyPoints,
} from './buildOccupancySeries'
import { hourLabel } from '../dailyOpsSnapshot/drilldown/drilldownShared'

/** Register business_hour 0..23 → Amsterdam calendar hour (08:00 start). */
function calendarHourFromBusinessHour (businessHour: number): number {
  return (businessHour + 8) % 24
}

/**
 * Today-only: fill missing hour maps from warm `bork_sales_by_table` (live path).
 * Sealed days must already have snapshot `tablesByHour` (hour→day cascade).
 */
async function fillOpenDayHourMapsFromWarmBork (
  db: Db,
  locationIds: string[],
  businessDate: string,
  hourByLocDate: Map<string, Map<string, Map<number, number>>>,
): Promise<void> {
  if (!isOpenRegisterBusinessDate(businessDate)) return

  await Promise.all(
    locationIds.map(async (locationId) => {
      const existing = hourByLocDate.get(locationId)?.get(businessDate)
      if (existing && existing.size > 0) return

      const rows = await fetchBorkTableDayRows(db, businessDate, locationId)
      if (!rows.length) return

      const hourMap = new Map<number, number>()
      const byBusinessHour = new Map<number, Set<string>>()
      for (const r of rows) {
        const doc = r as Record<string, unknown>
        const tableNum = extractBorkTableNumber(doc)
        if (!tableNum) continue
        const bh = Number(doc.business_hour)
        if (!Number.isFinite(bh) || bh < 0 || bh > 23) continue
        const set = byBusinessHour.get(bh) ?? new Set<string>()
        set.add(tableNum)
        byBusinessHour.set(bh, set)
      }
      for (const [bh, set] of byBusinessHour) {
        hourMap.set(calendarHourFromBusinessHour(bh), set.size)
      }
      if (hourMap.size === 0) return

      const byDate = hourByLocDate.get(locationId) ?? new Map<string, Map<number, number>>()
      byDate.set(businessDate, hourMap)
      hourByLocDate.set(locationId, byDate)
    }),
  )
}

export function occupancyPct(active: number, total: number): number | null {
  if (total <= 0) return null
  return Math.round((active / total) * 1000) / 10
}

function round1(n: number): number {
  return Math.round(n * 10) / 10
}

function mean(nums: number[]): number | null {
  if (nums.length === 0) return null
  return round1(nums.reduce((s, n) => s + n, 0) / nums.length)
}

export type BuildTableOccupancyOpts = {
  startDate: string
  endDate: string
  locationId?: string
  period?: string
}

function buildOrgHourSeries(
  hourly: DailyOpsTableOccupancyHourDto[],
): DailyOpsOccupancySeriesPoint[] {
  const byHour = new Map<number, { active: number; total: number }>()
  for (const row of hourly) {
    const cur = byHour.get(row.calendarHour) ?? { active: 0, total: 0 }
    cur.active += row.activeTables
    cur.total += row.totalTables
    byHour.set(row.calendarHour, cur)
  }
  return Array.from({ length: 24 }, (_, calendarHour) => {
    const cur = byHour.get(calendarHour) ?? { active: 0, total: 0 }
    return {
      key: String(calendarHour),
      label: hourLabel(calendarHour),
      activeTables: cur.active,
      totalTables: cur.total,
      occupancyPct: occupancyPct(cur.active, cur.total),
    }
  })
}

function withSeries(
  dto: DailyOpsTableOccupancyKpisDto,
  hourly?: DailyOpsTableOccupancyHourDto[],
): DailyOpsTableOccupancyKpisDto {
  const dayPoints = dto.daily?.length
    ? combineDailyOccupancyPoints(dto.daily)
    : [{
        key: dto.range.startDate,
        label: dto.range.startDate,
        activeTables: dto.activeTables,
        totalTables: dto.totalTables,
        occupancyPct: dto.occupancyPct,
      }]
  const series = buildOccupancySeriesByGrain(dayPoints)
  if (hourly?.length) {
    series.hour = buildOrgHourSeries(hourly)
  }
  return {
    ...dto,
    ...(hourly?.length ? { hourly } : {}),
    series,
  }
}

export async function buildTableOccupancySummary(
  db: Db,
  opts: BuildTableOccupancyOpts,
): Promise<DailyOpsTableOccupancyKpisDto> {
  await ensureVenueTablesIndex(db)

  const venues = VENUE_STRIP_LOCATIONS.filter((v) =>
    opts.locationId ? v.locationId === opts.locationId : true,
  )
  const locationIds = venues.map((v) => v.locationId)
  const dates = enumerateUtcDatesInclusive(opts.startDate, opts.endDate)
  const multiDay = dates.length > 1
  const singleDay = !multiDay

  const [catalogRows, snapshotDocs] = await Promise.all([
    db
      .collection(DAILY_OPS_VENUE_TABLES_COLLECTION)
      .find(
        { locationId: { $in: locationIds } },
        { projection: { locationId: 1, tableNum: 1 } },
      )
      .toArray(),
    db
      .collection(DAILY_OPS_SNAPSHOT_COLLECTIONS.revenueTablesSection)
      .find(
        {
          locationId: { $in: locationIds },
          businessDate: { $gte: opts.startDate, $lte: opts.endDate },
        },
        { projection: { locationId: 1, businessDate: 1, tables: 1, tablesByHour: 1 } },
      )
      .toArray(),
  ])

  const totalByLocation = new Map<string, number>()
  for (const row of catalogRows) {
    const locationId = normalizeLocationId(row.locationId)
    const tableNum = String(row.tableNum ?? '').trim()
    if (!locationId || !tableNum) continue
    totalByLocation.set(locationId, (totalByLocation.get(locationId) ?? 0) + 1)
  }

  const activeByLocDate = new Map<string, Map<string, Set<string>>>()
  const hourByLocDate = new Map<string, Map<string, Map<number, number>>>()

  for (const doc of snapshotDocs) {
    const locationId = normalizeLocationId(doc.locationId)
    const businessDate = String(doc.businessDate ?? '').trim()
    if (!locationId || !businessDate) continue
    const byDate = activeByLocDate.get(locationId) ?? new Map<string, Set<string>>()
    const set = byDate.get(businessDate) ?? new Set<string>()
    const tables = Array.isArray(doc.tables) ? doc.tables : []
    for (const t of tables) {
      const tableNum = String((t as { tableNum?: unknown })?.tableNum ?? '').trim()
      if (tableNum) set.add(tableNum)
    }
    byDate.set(businessDate, set)
    activeByLocDate.set(locationId, byDate)

    const byHourRows = Array.isArray(doc.tablesByHour) ? doc.tablesByHour : []
    if (byHourRows.length > 0) {
      const byDateHour = hourByLocDate.get(locationId) ?? new Map<string, Map<number, number>>()
      const hourMap = byDateHour.get(businessDate) ?? new Map<number, number>()
      for (const h of byHourRows) {
        const calendarHour = Number(
          (h as { calendarHour?: unknown }).calendarHour
          ?? (((Number((h as { businessHour?: unknown }).businessHour) || 0) + 8) % 24),
        )
        const active = Number((h as { activeTables?: unknown }).activeTables ?? 0)
        if (!Number.isFinite(calendarHour) || calendarHour < 0 || calendarHour > 23) continue
        hourMap.set(calendarHour, Math.max(hourMap.get(calendarHour) ?? 0, active))
      }
      byDateHour.set(businessDate, hourMap)
      hourByLocDate.set(locationId, byDateHour)
    }
  }

  // Open Today: schema-v1 snapshots lack tablesByHour — derive hour leaf from warm Bork.
  if (singleDay && dates[0]) {
    await fillOpenDayHourMapsFromWarmBork(db, locationIds, dates[0], hourByLocDate)
  }

  const daily: DailyOpsTableOccupancyDayDto[] = []
  const hourly: DailyOpsTableOccupancyHourDto[] = []
  const venueDtos: DailyOpsTableOccupancyVenueDto[] = venues.map((v) => {
    const totalTables = totalByLocation.get(v.locationId) ?? 0
    const byDate = activeByLocDate.get(v.locationId) ?? new Map<string, Set<string>>()
    const dayActives: number[] = []
    const dayPcts: number[] = []

    for (const date of dates) {
      const activeTables = byDate.get(date)?.size ?? 0
      const pct = occupancyPct(activeTables, totalTables)
      dayActives.push(activeTables)
      if (pct != null) dayPcts.push(pct)
      daily.push({
        date,
        locationId: v.locationId,
        locationName: v.locationName,
        activeTables,
        totalTables,
        occupancyPct: pct,
      })

      if (singleDay) {
        const hourMap = hourByLocDate.get(v.locationId)?.get(date)
        if (hourMap) {
          for (let calendarHour = 0; calendarHour < 24; calendarHour += 1) {
            const active = hourMap.get(calendarHour) ?? 0
            hourly.push({
              calendarHour,
              locationId: v.locationId,
              locationName: v.locationName,
              activeTables: active,
              totalTables,
              occupancyPct: occupancyPct(active, totalTables),
            })
          }
        }
      }
    }

    if (!multiDay) {
      const activeTables = dayActives[0] ?? 0
      return {
        locationId: v.locationId,
        locationName: v.locationName,
        activeTables,
        totalTables,
        occupancyPct: occupancyPct(activeTables, totalTables),
      }
    }

    return {
      locationId: v.locationId,
      locationName: v.locationName,
      activeTables: mean(dayActives) ?? 0,
      totalTables,
      occupancyPct: mean(dayPcts),
    }
  })

  const activeTables = round1(venueDtos.reduce((sum, v) => sum + v.activeTables, 0))
  const totalTables = venueDtos.reduce((sum, v) => sum + v.totalTables, 0)
  const venuePcts = venueDtos.map((v) => v.occupancyPct).filter((p): p is number => p != null)

  return withSeries(
    {
      range: {
        period: opts.period ?? (multiDay ? 'range' : 'day'),
        startDate: opts.startDate,
        endDate: opts.endDate,
      },
      activeTables,
      totalTables,
      occupancyPct: multiDay
        ? mean(venuePcts)
        : occupancyPct(Math.round(activeTables), totalTables),
      venues: venueDtos,
      daily: multiDay ? daily : undefined,
      aggregation: multiDay ? 'avg_daily' : 'day',
    },
    singleDay && hourly.length > 0 ? hourly : undefined,
  )
}

/** Average sealed daily occupancy payloads (dashboard week/month/year rollup). */
export function averageTableOccupancyPayloads(
  parts: DailyOpsTableOccupancyKpisDto[],
  range: { period: string; startDate: string; endDate: string },
): DailyOpsTableOccupancyKpisDto | undefined {
  if (parts.length === 0) return undefined

  const venueIds = VENUE_STRIP_LOCATIONS.map((v) => v.locationId)
  const venues: DailyOpsTableOccupancyVenueDto[] = venueIds.map((locationId) => {
    const name = VENUE_STRIP_LOCATIONS.find((v) => v.locationId === locationId)?.locationName ?? locationId
    const rows = parts
      .map((p) => p.venues.find((v) => v.locationId === locationId))
      .filter((v): v is DailyOpsTableOccupancyVenueDto => v != null)
    const actives = rows.map((r) => r.activeTables)
    const totals = rows.map((r) => r.totalTables)
    const pcts = rows.map((r) => r.occupancyPct).filter((p): p is number => p != null)
    return {
      locationId,
      locationName: name,
      activeTables: mean(actives) ?? 0,
      totalTables: totals.length > 0 ? Math.max(...totals) : 0,
      occupancyPct: mean(pcts),
    }
  })

  const filtered = venues.filter((v) =>
    parts.some((p) => p.venues.some((x) => x.locationId === v.locationId)),
  )
  const list = filtered.length > 0 ? filtered : venues
  const activeSum = round1(list.reduce((s, v) => s + v.activeTables, 0))
  const totalSum = list.reduce((s, v) => s + v.totalTables, 0)
  const pcts = list.map((v) => v.occupancyPct).filter((p): p is number => p != null)

  const daily: DailyOpsTableOccupancyDayDto[] = []
  for (const p of parts) {
    if (p.daily?.length) {
      daily.push(...p.daily)
      continue
    }
    for (const v of p.venues) {
      daily.push({
        date: p.range.startDate,
        locationId: v.locationId,
        locationName: v.locationName,
        activeTables: v.activeTables,
        totalTables: v.totalTables,
        occupancyPct: v.occupancyPct,
      })
    }
  }

  const looksYearly = range.period === 'year' || range.period === 'this-year'
    || (range.startDate.endsWith('-01-01') && range.endDate.slice(5, 7) === '12')
  const avgMonthlyOccupancyPct = looksYearly
    ? mean(
      parts
        .map((p) => p.avgMonthlyOccupancyPct ?? p.occupancyPct)
        .filter((n): n is number => n != null),
    )
    : undefined

  return withSeries({
    range,
    activeTables: activeSum,
    totalTables: totalSum,
    occupancyPct: mean(pcts),
    venues: list,
    daily: daily.length ? daily : undefined,
    aggregation: 'avg_daily',
    ...(avgMonthlyOccupancyPct != null ? { avgMonthlyOccupancyPct } : {}),
  })
}
