/**
 * @registry-id: dailyOpsPatchTodayRevenueFromBork
 * @created: 2026-06-06T18:00:00.000Z
 * @last-modified: 2026-06-07T01:00:00.000Z
 * @description: Override open register-day snapshot revenue with freshest Bork aggregate or raw sum
 * @last-fix: [2026-06-07] max(aggregate, raw) for sync lag; ADR-010
 * @adr-ref: ADR-004, ADR-010
 *
 * @exports-to:
 * ✓ server/utils/dailyOpsSnapshot/fetchDashboardBundle.ts
 */

import type { Db } from 'mongodb'
import type { DailyOpsSnapshotRevenueSection } from '~/types/daily-ops-snapshot'
import type { DailyOpsMetricsContext } from '../../dailyOpsMetrics/context'
import { fetchBorkRangeTotals } from '../../dailyOpsRevenue/borkRevenueRead'
import { isTodayBusinessDate } from '../../venueStrip/liveRevenue'
import { sumBusinessDateFromBorkRaw } from '../../venueStrip/liveRevenueRaw'
import { snapshotRound2 } from './shared'

export async function patchTodayRevenueRowsFromBork(
  db: Db,
  ctx: DailyOpsMetricsContext,
  revenueRows: DailyOpsSnapshotRevenueSection[],
): Promise<void> {
  if (ctx.startDate !== ctx.endDate || !isTodayBusinessDate(ctx.startDate)) return

  await Promise.all(
    revenueRows.map(async (row) => {
      const [agg, raw] = await Promise.all([
        fetchBorkRangeTotals(db, {
          startDate: ctx.startDate,
          endDate: ctx.endDate,
          locationId: row.locationId,
        }),
        sumBusinessDateFromBorkRaw(db, row.locationId, ctx.startDate),
      ])

      const ex = snapshotRound2(Math.max(agg.revenue, raw?.revenue ?? 0))
      const inc = snapshotRound2(Math.max(agg.revenueIncVat, raw?.revenueIncVat ?? 0))
      if (ex <= 0 && inc <= 0) return

      row.totals = {
        ex_vat: ex,
        inc_vat: inc,
        vat: snapshotRound2(inc - ex),
      }
      row.leadSource = 'bork_api_merged'
      row.borkTotals = {
        ...(row.borkTotals ?? { quantity: 0, record_count: 0 }),
        ex_vat: ex,
        inc_vat: inc,
        vat: snapshotRound2(inc - ex),
      }
    }),
  )
}
