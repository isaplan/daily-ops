import type { Db } from 'mongodb'
import type { DailyOpsOrderPaymentRhythmPoint, DailyOpsRevenueQueryContext } from '~/types/daily-ops-revenue'
import { DAILY_OPS_SNAPSHOT_COLLECTIONS } from '~/types/daily-ops-snapshot'

/** Order count from hourly snapshot; payment count approximated from raw tickets ActualDate hour. */
export async function fetchOrderPaymentRhythm(
  db: Db,
  ctx: DailyOpsRevenueQueryContext,
): Promise<DailyOpsOrderPaymentRhythmPoint[]> {
  const orderByHour = Array.from({ length: 24 }, () => 0)
  const payByHour = Array.from({ length: 24 }, () => 0)

  const filter: Record<string, unknown> = {
    businessDate: { $gte: ctx.startDate, $lte: ctx.endDate },
  }
  if (ctx.locationId) filter.locationId = ctx.locationId

  const hourlySnaps = await db
    .collection(DAILY_OPS_SNAPSHOT_COLLECTIONS.revenueHourlySection)
    .find(filter)
    .toArray()

  for (const snap of hourlySnaps) {
    const hourly = (snap as { hourly?: Array<{ business_hour: number; record_count?: number; quantity?: number }> })
      .hourly
    if (!hourly) continue
    for (const h of hourly) {
      const hour = Number(h.business_hour)
      if (hour >= 0 && hour < 24) {
        orderByHour[hour]! += Number(h.record_count ?? h.quantity ?? 0)
      }
    }
  }

  const suffix = resolveBorkAggReadSuffix()
  const rawFilter: Record<string, unknown> = {
    endpoint: 'bork_daily',
    date: {
      $gte: new Date(`${ctx.startDate}T00:00:00.000Z`),
      $lte: new Date(`${ctx.endDate}T23:59:59.999Z`),
    },
  }
  if (ctx.locationId) rawFilter.locationId = ctx.locationId

  const rawDocs = await db
    .collection('bork_raw_data')
    .find(rawFilter)
    .project({ rawApiResponse: 1 })
    .limit(200)
    .toArray()

  for (const doc of rawDocs) {
    const tickets = (doc as { rawApiResponse?: unknown[] }).rawApiResponse
    if (!Array.isArray(tickets)) continue
    for (const ticket of tickets) {
      const t = ticket as { ActualDate?: number; Time?: string }
      if (t.ActualDate && t.ActualDate !== 10101) {
        const d = new Date((t.ActualDate - 25569) * 86400000)
        const hour = d.getUTCHours()
        if (hour >= 0 && hour < 24) payByHour[hour]!++
      } else if (t.Time) {
        const hour = Number(t.Time.slice(0, 2))
        if (hour >= 0 && hour < 24) payByHour[hour]!++
      }
    }
  }

  return orderByHour.map((orderCount, hour) => ({
    hour,
    orderCount,
    paymentCount: payByHour[hour]!,
  }))
}
