import type { Db } from 'mongodb'
import type {
  DailyOpsRevenueQueryContext,
  DailyOpsRevenueTimeseriesDto,
  DailyOpsRevenueTimeseriesPoint,
} from '~/types/daily-ops-revenue'
import { buildRevenueDailySeries } from './fetchRevenueDailySeries'

function round2(n: number): number {
  return Math.round(n * 100) / 100
}

function bucketKey(date: string, granularity: 'week' | 'month' | 'quarter'): string {
  const d = new Date(`${date}T12:00:00Z`)
  if (granularity === 'month' || granularity === 'quarter') {
    const q = granularity === 'quarter' ? Math.floor(d.getUTCMonth() / 3) + 1 : null
    if (q) return `${d.getUTCFullYear()}-Q${q}`
    return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`
  }
  const day = d.getUTCDay()
  const diff = day === 0 ? -6 : 1 - day
  d.setUTCDate(d.getUTCDate() + diff)
  return d.toISOString().slice(0, 10)
}

function aggregatePoints(
  daily: DailyOpsRevenueTimeseriesPoint[],
  granularity: 'day' | 'week' | 'month' | 'quarter',
): DailyOpsRevenueTimeseriesPoint[] {
  if (granularity === 'day') return daily
  const map = new Map<string, { revenue: number; itemsCount: number }>()
  for (const p of daily) {
    const key = bucketKey(p.date, granularity === 'quarter' ? 'quarter' : granularity)
    const cur = map.get(key) ?? { revenue: 0, itemsCount: 0 }
    cur.revenue += p.revenue
    cur.itemsCount += p.itemsCount
    map.set(key, cur)
  }
  return [...map.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, v]) => ({
      date,
      revenue: round2(v.revenue),
      itemsCount: v.itemsCount,
    }))
}

export async function fetchRevenueTimeseries(
  db: Db,
  ctx: DailyOpsRevenueQueryContext,
  granularity: 'day' | 'week' | 'month' | 'quarter' = 'day',
): Promise<DailyOpsRevenueTimeseriesDto> {
  const dailyCurrent = await buildRevenueDailySeries(
    db,
    ctx.startDate,
    ctx.endDate,
    ctx.locationId,
  )
  const current = aggregatePoints(dailyCurrent, granularity)

  let compare: DailyOpsRevenueTimeseriesDto['compare']
  if (ctx.compareStartDate && ctx.compareEndDate) {
    const dailyCmp = await buildRevenueDailySeries(
      db,
      ctx.compareStartDate,
      ctx.compareEndDate,
      ctx.compareLocationId ?? ctx.locationId,
    )
    compare = aggregatePoints(dailyCmp, granularity)
  }

  return {
    granularity,
    current,
    compare,
    compareLabel: ctx.compareLabel,
  }
}
