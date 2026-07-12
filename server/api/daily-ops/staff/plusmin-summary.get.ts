/**
 * @registry-id: dailyOpsStaffPlusminSummaryGet
 * @created: 2026-06-25T14:00:00.000Z
 * @last-modified: 2026-07-02T00:00:00.000Z
 * @description: Staff plus/min summary — read-cache only (ADR-013); live mongo until cache built
 * @last-fix: [2026-07-02] ADR-013 read-cache metadata
 * @adr-ref: ADR-004, ADR-010, ADR-013
 * @data-source: read-cache
 * @read-cache-json: daily_ops_read_cache · profile=staff-plusmin · levels=monthly|yearly
 *
 * @imports-from:
 *   - server/utils/dailyOpsStaff/fetchStaffPlusminSummary.ts
 * @exports-to:
 *   ✓ composables/useDailyOpsStaffPlusmin.ts
 */

import { getDb } from '../../../utils/db'
import { parseStaffPlusminInput } from '../../../utils/dailyOpsStaff/parseStaffPlusminInput'
import { fetchStaffPlusminSummary } from '../../../utils/dailyOpsStaff/fetchStaffPlusminSummary'
import type { DailyOpsStaffPlusminSummaryDto } from '~/types/daily-ops-staff'

export default defineEventHandler(async (event): Promise<DailyOpsStaffPlusminSummaryDto> => {
  setResponseHeader(event, 'Cache-Control', 'no-store')
  const input = parseStaffPlusminInput(getQuery(event) as Record<string, unknown>)
  const db = await getDb()
  return fetchStaffPlusminSummary(db, input)
})
