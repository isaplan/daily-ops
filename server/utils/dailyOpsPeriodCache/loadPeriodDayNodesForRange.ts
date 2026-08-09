/**
 * @registry-id: dailyOpsPeriodCacheLoadDayNodesRange
 * @created: 2026-08-09T00:45:00.000Z
 * @last-modified: 2026-08-09T00:45:00.000Z
 * @description: Load period-cache day nodes for an inclusive date range
 * @last-fix: [2026-08-09] Shared range reader for revenue/staff GET cutovers
 * @adr-ref: PERIOD_CACHE_ADR L2
 * @data-source: period-cache
 * @read-cache-json: daily_ops_period_cache · level=day
 *
 * @exports-to:
 * ✓ server/utils/dailyOpsRevenue/fetchRevenueRange.ts
 * ✓ server/utils/dailyOpsRevenue/fetchRevenueDailySeries.ts
 * ✓ server/utils/dailyOpsRevenue/fetchHourlyMatrix.ts
 * ✓ server/utils/dailyOpsStaff/fetchStaffDailyLabor.ts
 */

import type { Db } from 'mongodb'
import type { DailyOpsPeriodNode } from '~/types/daily-ops-period-cache'
import { addCalendarDaysYmd } from '~/utils/dailyOpsBusinessDate'
import { DAILY_OPS_PERIOD_CACHE_COLLECTION } from './store'

export async function loadPeriodDayNodesForRange (
  db: Db,
  opts: { startDate: string; endDate: string; locationId: string },
): Promise<DailyOpsPeriodNode[]> {
  const locationId = opts.locationId || 'all'
  const rows = await db
    .collection(DAILY_OPS_PERIOD_CACHE_COLLECTION)
    .find({
      locationId,
      level: 'day',
      periodKey: { $gte: opts.startDate, $lte: opts.endDate },
    })
    .toArray()

  const byKey = new Map<string, DailyOpsPeriodNode>()
  for (const row of rows) {
    const node = row as unknown as DailyOpsPeriodNode
    byKey.set(node.periodKey, node)
  }

  const ordered: DailyOpsPeriodNode[] = []
  let cursor = opts.startDate
  while (cursor <= opts.endDate) {
    const hit = byKey.get(cursor)
    if (hit) ordered.push(hit)
    cursor = addCalendarDaysYmd(cursor, 1)
  }
  return ordered
}

export function expectedDayCount (startDate: string, endDate: string): number {
  let n = 0
  let cursor = startDate
  while (cursor <= endDate) {
    n += 1
    cursor = addCalendarDaysYmd(cursor, 1)
  }
  return n
}
