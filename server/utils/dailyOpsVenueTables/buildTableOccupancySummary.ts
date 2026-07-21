/**
 * @registry-id: dailyOpsBuildTableOccupancySummary
 * @created: 2026-07-20T00:00:00.000Z
 * @last-modified: 2026-07-20T00:00:00.000Z
 * @description: Active tables + bezettingsgraad (daily or avg-of-daily for ranges)
 * @last-fix: [2026-07-20] Avg daily occupancy for multi-day periods
 * @adr-ref: ADR-004, ADR-013
 *
 * @exports-to:
 * ✓ server/utils/dailyOpsVenueTables/fetchTableOccupancyKpis.ts
 * ✓ server/utils/dailyOpsWeeklyReport/buildWeeklyTableOccupancy.ts
 * ✓ server/utils/dailyOpsSnapshot/fetchDashboardBundle.ts
 */

import type { Db } from 'mongodb'
import type {
  DailyOpsTableOccupancyDayDto,
  DailyOpsTableOccupancyKpisDto,
  DailyOpsTableOccupancyVenueDto,
} from '../../../types/daily-ops-venue-tables'
import { DAILY_OPS_SNAPSHOT_COLLECTIONS } from '../../../types/daily-ops-snapshot'
import { enumerateUtcDatesInclusive } from '../dailyOpsMetrics/context'
import { VENUE_STRIP_LOCATIONS } from '../venueStrip/constants'
import {
  DAILY_OPS_VENUE_TABLES_COLLECTION,
  ensureVenueTablesIndex,
  normalizeLocationId,
} from './collection'

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
        { projection: { locationId: 1, businessDate: 1, tables: 1 } },
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

  /** locationId → businessDate → Set<tableNum> */
  const activeByLocDate = new Map<string, Map<string, Set<string>>>()
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
  }

  const daily: DailyOpsTableOccupancyDayDto[] = []
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

    const avgActive = mean(dayActives) ?? 0
    return {
      locationId: v.locationId,
      locationName: v.locationName,
      activeTables: avgActive,
      totalTables,
      occupancyPct: mean(dayPcts),
    }
  })

  const activeTables = round1(venueDtos.reduce((sum, v) => sum + v.activeTables, 0))
  const totalTables = venueDtos.reduce((sum, v) => sum + v.totalTables, 0)
  const venuePcts = venueDtos.map((v) => v.occupancyPct).filter((p): p is number => p != null)

  return {
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
  }
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
  const activeTables = round1(list.reduce((s, v) => s + v.activeTables, 0))
  const totalTables = list.reduce((s, v) => s + v.totalTables, 0)
  const pcts = list.map((v) => v.occupancyPct).filter((p): p is number => p != null)

  return {
    range,
    activeTables,
    totalTables,
    occupancyPct: mean(pcts),
    venues: list,
    aggregation: 'avg_daily',
  }
}
