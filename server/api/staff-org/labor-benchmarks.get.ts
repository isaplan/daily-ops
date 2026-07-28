/**
 * @registry-id: staffOrgLaborBenchmarksGet
 * @created: 2026-07-23T10:40:00.000Z
 * @last-modified: 2026-07-27T17:20:00.000Z
 * @description: GET labor % + food/bev shares from last 12 sealed P&L months for Staff Org seed
 * @last-fix: [2026-07-27] Rolling 12m sealed avg + FT/PT/ZZP from Lonen lines
 * @adr-ref: ADR-016
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
