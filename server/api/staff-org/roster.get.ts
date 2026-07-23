/**
 * @registry-id: api/staff-org/roster.get
 * @created: 2026-07-22T18:00:00.000Z
 * @last-modified: 2026-07-22T18:00:00.000Z
 * @description: GET /api/staff-org/roster — FT members for Staff Org picker
 * @last-fix: [2026-07-22] Initial roster endpoint
 * @adr-ref: ADR-016
 */

import { getDb } from '~/server/utils/db'
import { seedRosterFromMembers } from '~/server/utils/staffOrg/seedRosterFromMembers'

export default defineEventHandler(async () => {
  const db = await getDb()
  const data = await seedRosterFromMembers(db)
  return { success: true, data }
})
