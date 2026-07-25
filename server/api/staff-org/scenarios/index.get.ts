/**
 * @registry-id: api/staff-org/scenarios.get
 * @created: 2026-07-22T18:00:00.000Z
 * @last-modified: 2026-07-22T18:00:00.000Z
 * @description: GET /api/staff-org/scenarios — list Staff Org scenarios
 * @last-fix: [2026-07-22] Initial list endpoint
 * @adr-ref: ADR-016
 */

import { getDb } from '~/server/utils/db'
import { listStaffOrgScenarios } from '~/server/utils/staffOrg/scenarioRepo'

export default defineEventHandler(async () => {
  const db = await getDb()
  const data = await listStaffOrgScenarios(db)
  return { success: true, data }
})
