/**
 * @registry-id: dailyOpsRevenueFetchOrderPaymentRhythm
 * @created: 2026-05-20T00:00:00.000Z
 * @last-modified: 2026-08-09T15:50:00.000Z
 * @description: Order/payment rhythm by hour from period-cache byHour qty
 * @last-fix: [2026-08-09] ZERO GET — period-cache only (no snapshot hourly section)
 * @adr-ref: ADR-004, PERIOD_CACHE_ADR L2
 *
 * @exports-to:
 * ✓ server/api/daily-ops/revenue/order-payment-rhythm.get.ts
 * ✓ server/api/daily-ops/productivity/order-payment-rhythm.get.ts
 */

import type { Db } from 'mongodb'
import type { DailyOpsOrderPaymentRhythmPoint, DailyOpsRevenueQueryContext } from '~/types/daily-ops-revenue'
import { loadPeriodDayNodesForRange } from '../dailyOpsPeriodCache/loadPeriodDayNodesForRange'

/** Order counts approximated from period-cache day byHour qty (write SSOT). */
export async function fetchOrderPaymentRhythm (
  db: Db,
  ctx: DailyOpsRevenueQueryContext,
): Promise<DailyOpsOrderPaymentRhythmPoint[]> {
  const orderByHour = Array.from({ length: 24 }, () => 0)
  const nodes = await loadPeriodDayNodesForRange(db, {
    startDate: ctx.startDate,
    endDate: ctx.endDate,
    locationId: ctx.locationId ?? 'all',
  })

  for (const n of nodes) {
    for (const h of n.revenue.byHour ?? []) {
      const hour = Number(h.hour)
      if (hour >= 0 && hour < 24) {
        orderByHour[hour]! += Number(h.qty ?? 0)
      }
    }
  }

  return orderByHour.map((orderCount, hour) => ({
    hour,
    orderCount,
    paymentCount: orderCount,
  }))
}
