import type { Db } from 'mongodb'
import type { DailyOpsRevenueLocationDto, DailyOpsRevenueQueryContext } from '~/types/daily-ops-revenue'
import { VENUE_STRIP_LOCATIONS } from '../venueStrip/constants'
import { fetchRevenueRangeForDates } from './fetchRevenueRange'

function round2(n: number): number {
  return Math.round(n * 100) / 100
}

export async function fetchLocationSplit(
  db: Db,
  ctx: DailyOpsRevenueQueryContext,
): Promise<DailyOpsRevenueLocationDto[]> {
  const venues = ctx.locationId
    ? VENUE_STRIP_LOCATIONS.filter((v) => v.locationId === ctx.locationId)
    : [...VENUE_STRIP_LOCATIONS]

  const rows: DailyOpsRevenueLocationDto[] = []
  let totalRev = 0

  for (const v of venues) {
    const t = await fetchRevenueRangeForDates(db, ctx.startDate, ctx.endDate, v.locationId)
    totalRev += t.revenue
    rows.push({
      locationId: v.locationId,
      locationName: v.locationName,
      revenue: round2(t.revenue),
      revenueIncVat: round2(t.revenueIncVat),
      borkRevenueIncVat: round2(t.borkRevenueIncVat),
      itemsCount: t.itemsCount,
      revenuePerItem: t.itemsCount > 0 ? round2(t.revenue / t.itemsCount) : 0,
      pctOfTotal: 0,
    })
  }

  for (const r of rows) {
    r.pctOfTotal = totalRev > 0 ? round2((r.revenue / totalRev) * 100) : 0
  }

  if (ctx.compareStartDate && ctx.compareEndDate) {
    for (const r of rows) {
      const cmp = await fetchRevenueRangeForDates(db, ctx.compareStartDate!, ctx.compareEndDate!, r.locationId)
      r.compareRevenue = round2(cmp.revenue)
      r.comparePct = cmp.revenue > 0 ? round2(((r.revenue - cmp.revenue) / cmp.revenue) * 100) : null
    }
  }

  return rows.sort((a, b) => b.revenue - a.revenue)
}
