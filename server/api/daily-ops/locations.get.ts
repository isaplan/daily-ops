/**
 * @registry-id: daily-ops-locations-api
 * @created: 2026-04-12T00:00:00.000Z
 * @last-modified: 2026-07-02T00:00:00.000Z
 * @description: Fetch unified locations for Daily Ops UI (incl. chartColor from unified_location).
 * @last-fix: [2026-07-02] ADR-013 read-cache metadata
 *
 * @adr-ref: ADR-013
 * @data-source: direct-db
 * @read-cache-json: none
 *
 * @exports-to:
 * ✓ components/daily-ops/DailyOpsDashboardShell.vue => /api/daily-ops/locations
 * ✓ composables/useDailyOpsLocationChartColors.ts
 */

import { getDb } from '../../utils/db'
import { fetchDailyOpsLocationRows } from '../../utils/dailyOpsLocationChartColors'
import type { DailyOpsLocationsResponseDto } from '~/types/daily-ops-locations'

export default defineEventHandler(async (): Promise<DailyOpsLocationsResponseDto> => {
  try {
    const db = await getDb()
    const data = await fetchDailyOpsLocationRows(db)
    return { success: true, data }
  } catch (error) {
    return {
      success: false,
      data: [],
      error: String(error),
    }
  }
})
