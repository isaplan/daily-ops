/**
 * @registry-id: dailyOpsStaffPlusminSummaryGet
 * @created: 2026-06-25T14:00:00.000Z
 * @last-modified: 2026-08-09T01:00:00.000Z
 * @description: Staff plus/min summary — period-cache day nodes + members contracts
 * @last-fix: [2026-08-09] Period-cache only (no live Eitje on GET)
 * @adr-ref: ADR-004, ADR-010, ADR-013, PERIOD_CACHE_ADR L2
 * @data-source: period-cache
 * @read-cache-json: daily_ops_period_cache · level=day · staff.workers
 *
 * @imports-from:
 *   - server/utils/dailyOpsPeriodCache/resolvePlusminFromPeriodCache.ts
 * @exports-to:
 *   ✓ composables/useDailyOpsStaffPlusmin.ts
 */

import { getDb } from '../../../utils/db'
import { parseStaffPlusminInput } from '../../../utils/dailyOpsStaff/parseStaffPlusminInput'
import { resolvePlusminFromPeriodCache } from '../../../utils/dailyOpsPeriodCache/resolvePlusminFromPeriodCache'
import type { DailyOpsStaffPlusminSummaryDto } from '~/types/daily-ops-staff'

export default defineEventHandler(async (event): Promise<DailyOpsStaffPlusminSummaryDto> => {
  setResponseHeader(event, 'Cache-Control', 'no-store')
  const input = parseStaffPlusminInput(getQuery(event) as Record<string, unknown>)
  const db = await getDb()
  return resolvePlusminFromPeriodCache(db, input)
})
