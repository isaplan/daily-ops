/**
 * @registry-id: dailyOpsRevenueFetchOrderPaymentRhythm
 * @last-modified: 2026-05-24T15:30:00.000Z
 * @last-fix: [2026-05-24] ADR-004: hourly snapshot only; no bork_raw_data on GET
 * @adr-ref: ADR-004
 */
import type { Db } from 'mongodb'
import type { DailyOpsOrderPaymentRhythmPoint, DailyOpsRevenueQueryContext } from '~/types/daily-ops-revenue'
import { DAILY_OPS_SNAPSHOT_COLLECTIONS } from '~/types/daily-ops-snapshot'

/** Order counts from revenue hourly snapshot (snapshot-only per ADR-004). */
export async function fetchOrderPaymentRhythm(
  db: Db,
  ctx: DailyOpsRevenueQueryContext,
): Promise<DailyOpsOrderPaymentRhythmPoint[]> {
  const orderByHour = Array.from({ length: 24 }, () => 0)

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

  return orderByHour.map((orderCount, hour) => ({
    hour,
    orderCount,
    paymentCount: orderCount,
  }))
}
