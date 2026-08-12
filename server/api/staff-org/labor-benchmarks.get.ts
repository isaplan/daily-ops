/**
 * @registry-id: staffOrgLaborBenchmarksGet
 * @created: 2026-07-23T10:40:00.000Z
 * @last-modified: 2026-08-12T00:50:00.000Z
 * @description: GET labor % + cost envelope from last 12 sealed P&L months for Staff Org seed
 * @last-fix: [2026-08-12] Phase 2: return Finance cost envelope on seed payload
 * @adr-ref: ADR-016, ADR-022
 */

import { getDb } from '~/server/utils/db'
import { buildStaffOrgLaborBenchmarks } from '~/server/utils/staffOrg/laborBenchmarks'

export default defineEventHandler(async () => {
  const db = await getDb()
  const data = await buildStaffOrgLaborBenchmarks(db)
  return {
    success: true,
    data,
  }
})
