/**
 * @registry-id: dailyOpsPatchTodayRevenueFromBork
 * @created: 2026-06-06T18:00:00.000Z
 * @last-modified: 2026-07-01T12:00:00.000Z
 * @description: Refresh open register-day snapshot revenue from freshest Bork order-time aggregates
 * @last-fix: [2026-07-01] Today headline = order-time (`bork_sales_by_order_hour`), not paid business-day
 *   Prior: [2026-06-07] max(aggregate, raw) for sync lag; ADR-010
 * @adr-ref: ADR-004, ADR-010
 *
 * @exports-to:
 * ✓ server/utils/dailyOpsSnapshot/fetchDashboardBundle.ts
 */

import type { Db } from 'mongodb'
import type { DailyOpsSnapshotRevenueSection } from '~/types/daily-ops-snapshot'
import type { DailyOpsMetricsContext } from '../../dailyOpsMetrics/context'
import { fetchBorkOrderTimeRangeTotals } from '../../dailyOpsRevenue/borkRevenueRead'
import { isTodayBusinessDate } from '../../venueStrip/liveRevenue'
import { snapshotRound2 } from './shared'

export async function patchTodayRevenueRowsFromBork(
  db: Db,
  ctx: DailyOpsMetricsContext,
  revenueRows: DailyOpsSnapshotRevenueSection[],
): Promise<void> {
  if (ctx.startDate !== ctx.endDate || !isTodayBusinessDate(ctx.startDate)) return

  await Promise.all(
    revenueRows.map(async (row) => {
      const agg = await fetchBorkOrderTimeRangeTotals(db, {
        startDate: ctx.startDate,
        endDate: ctx.endDate,
        locationId: row.locationId,
      })

      const ex = snapshotRound2(agg.revenue)
      const inc = snapshotRound2(agg.revenueIncVat)
      if (ex <= 0 && inc <= 0) return

      row.totals = {
        ex_vat: ex,
        inc_vat: inc,
        vat: snapshotRound2(inc - ex),
      }
      row.leadSource = 'bork'
      row.borkTotals = {
        ...(row.borkTotals ?? { quantity: 0, record_count: 0 }),
        ex_vat: ex,
        inc_vat: inc,
        vat: snapshotRound2(inc - ex),
        quantity: agg.itemsCount,
      }
    }),
  )
}
