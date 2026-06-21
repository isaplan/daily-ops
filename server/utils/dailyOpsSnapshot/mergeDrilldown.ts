/**
 * @registry-id: dailyOpsMergeDrilldown
 * @created: 2026-06-20T00:00:00.000Z
 * @last-modified: 2026-06-20T00:00:00.000Z
 * @description: Merge revenue drilldown DTOs when aggregating daily bundles into week/month/year
 * @last-fix: [2026-06-20] Initial — roll up hourly, spaces, top-10 from sealed daily JSON
 * @adr-ref: ADR-004, ADR-008
 *
 * @exports-to:
 * ✓ server/utils/dailyOpsSnapshot/aggregateDailyBundles.ts
 */

import type {
  DailyOpsRevenueDrilldownDto,
  DailyOpsRevenueDrilldownHourlyRowDto,
  DailyOpsRevenueDrilldownLocationHourDto,
  DailyOpsRevenueDrilldownSpaceRowDto,
  DailyOpsRevenueDrilldownTopRowDto,
} from '~/types/daily-ops-dashboard'
import { sortRevenueDrilldownSpaceRows } from '~/utils/dailyOpsVenueOrder'
import { hourLabel, roundEur } from './drilldown/drilldownShared'

function mergeTopRows(
  parts: DailyOpsRevenueDrilldownTopRowDto[][],
  limit = 10,
): DailyOpsRevenueDrilldownTopRowDto[] {
  const map = new Map<string, DailyOpsRevenueDrilldownTopRowDto>()
  for (const rows of parts) {
    for (const row of rows) {
      const key = `${row.label}|${row.subLabel ?? ''}`
      const prev = map.get(key)
      if (!prev) {
        map.set(key, {
          ...row,
          revenue: roundEur(row.revenue),
          quantity: row.quantity,
          count: row.count,
        })
        continue
      }
      prev.revenue = roundEur(prev.revenue + row.revenue)
      prev.quantity += row.quantity
      prev.count = (prev.count ?? 0) + (row.count ?? 0)
    }
  }
  return [...map.values()]
    .sort((a, b) => b.revenue - a.revenue || a.label.localeCompare(b.label))
    .slice(0, limit)
}

function mergeHourlyLocationRows(
  parts: DailyOpsRevenueDrilldownLocationHourDto[],
): DailyOpsRevenueDrilldownLocationHourDto[] {
  const map = new Map<string, DailyOpsRevenueDrilldownLocationHourDto>()
  for (const row of parts) {
    const prev = map.get(row.locationId)
    if (!prev) {
      map.set(row.locationId, { ...row })
      continue
    }
    prev.revenue = roundEur(prev.revenue + row.revenue)
    prev.laborCost = roundEur(prev.laborCost + row.laborCost)
    prev.profit = roundEur(prev.profit + row.profit)
  }
  return [...map.values()]
}

function mergeHourlyRows(
  parts: DailyOpsRevenueDrilldownHourlyRowDto[][],
): DailyOpsRevenueDrilldownHourlyRowDto[] {
  const byHour = new Map<number, DailyOpsRevenueDrilldownHourlyRowDto>()
  for (const rows of parts) {
    for (const row of rows) {
      const hour = row.calendarHour
      const prev = byHour.get(hour)
      if (!prev) {
        byHour.set(hour, {
          ...row,
          locations: row.locations.map((loc) => ({ ...loc })),
        })
        continue
      }
      prev.revenue = roundEur(prev.revenue + row.revenue)
      prev.laborCost = roundEur(prev.laborCost + row.laborCost)
      prev.cogsCost = roundEur(prev.cogsCost + row.cogsCost)
      prev.fixedCost = roundEur(prev.fixedCost + row.fixedCost)
      prev.profit = roundEur(prev.profit + row.profit)
      if (row.benchmarkRevenue != null) {
        prev.benchmarkRevenue = roundEur((prev.benchmarkRevenue ?? 0) + row.benchmarkRevenue)
        prev.benchmarkDelta =
          prev.benchmarkRevenue != null ? roundEur(prev.revenue - prev.benchmarkRevenue) : null
        prev.benchmarkStatus =
          prev.benchmarkDelta != null && prev.benchmarkDelta > 0
            ? 'above'
            : prev.benchmarkDelta != null && prev.benchmarkDelta < 0
              ? 'below'
              : 'neutral'
      }
      prev.locations = mergeHourlyLocationRows([...prev.locations, ...row.locations])
    }
  }

  const out: DailyOpsRevenueDrilldownHourlyRowDto[] = []
  for (let hour = 0; hour < 24; hour += 1) {
    const row = byHour.get(hour)
    if (!row) continue
    out.push({
      ...row,
      calendarHour: hour,
      hourLabel: hourLabel(hour),
    })
  }
  return out
}

function mergeSpaces(parts: DailyOpsRevenueDrilldownSpaceRowDto[][]): DailyOpsRevenueDrilldownSpaceRowDto[] {
  const venueTotals = new Map<string, number>()
  const spaces = new Map<string, DailyOpsRevenueDrilldownSpaceRowDto>()

  for (const rows of parts) {
    for (const row of rows) {
      venueTotals.set(row.locationId, (venueTotals.get(row.locationId) ?? 0) + row.revenue)
      const key = `${row.locationId}|${row.spaceName}`
      const prev = spaces.get(key)
      if (!prev) {
        spaces.set(key, { ...row })
        continue
      }
      prev.revenue = roundEur(prev.revenue + row.revenue)
      prev.quantity += row.quantity
    }
  }

  return sortRevenueDrilldownSpaceRows(
    [...spaces.values()].map((space) => ({
      ...space,
      revenue: roundEur(space.revenue),
      pctOfVenueRevenue:
        (venueTotals.get(space.locationId) ?? 0) > 0
          ? Math.round((space.revenue / (venueTotals.get(space.locationId) ?? 1)) * 100)
          : null,
    })),
  )
}

export function mergeDrilldownDtos(
  parts: Array<DailyOpsRevenueDrilldownDto | null | undefined>,
  opts?: { coverageNote?: string | null; multiDayRange?: boolean },
): DailyOpsRevenueDrilldownDto | undefined {
  const valid = parts.filter((p): p is DailyOpsRevenueDrilldownDto => {
    if (!p) return false
    const hasHourly = (p.hourlyRows ?? []).some((r) => r.revenue > 0)
    const hasTop10 =
      (p.top10?.tables?.length ?? 0) > 0 ||
      (p.top10?.foodProducts?.length ?? 0) > 0 ||
      (p.top10?.beverageProductsOrCategories?.length ?? 0) > 0 ||
      (p.top10?.workers?.paymentTime?.length ?? 0) > 0
    return hasHourly || hasTop10 || (p.spaces?.length ?? 0) > 0
  })
  if (valid.length === 0) return undefined

  const coverageNotes = [...new Set(valid.flatMap((p) => p.coverageNotes ?? []))]
  if (opts?.coverageNote) coverageNotes.push(opts.coverageNote)

  const hourlyParts = valid.map((p) => p.hourlyRows ?? [])
  const spaceParts = valid.map((p) => p.spaces ?? [])
  const paymentWorkers = valid.map((p) => p.top10?.workers?.paymentTime ?? [])
  const orderWorkers = valid.map((p) => p.top10?.workers?.orderTime ?? [])
  const tables = valid.map((p) => p.top10?.tables ?? [])
  const food = valid.map((p) => p.top10?.foodProducts ?? [])
  const bev = valid.map((p) => p.top10?.beverageProductsOrCategories ?? [])

  return {
    estimatesNote: valid[0]!.estimatesNote,
    multiDayRange: opts?.multiDayRange ?? true,
    coverageNotes,
    hourlyRows: mergeHourlyRows(hourlyParts),
    spaces: mergeSpaces(spaceParts),
    top10: {
      workers: {
        paymentTime: mergeTopRows(paymentWorkers),
        orderTime: mergeTopRows(orderWorkers),
      },
      tables: mergeTopRows(tables),
      foodProducts: mergeTopRows(food),
      beverageProductsOrCategories: mergeTopRows(bev),
    },
  }
}
