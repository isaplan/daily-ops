/**
 * @registry-id: api/staff-org/scenarios.post
 * @created: 2026-07-22T18:00:00.000Z
 * @last-modified: 2026-07-22T18:00:00.000Z
 * @description: POST /api/staff-org/scenarios — create scenario with FT roster seed
 * @last-fix: [2026-07-22] Initial create endpoint
 * @adr-ref: ADR-016
 */

import { getDb } from '~/server/utils/db'
import { createStaffOrgScenario } from '~/server/utils/staffOrg/scenarioRepo'

export default defineEventHandler(async (event) => {
  const body = await readBody<{ name?: string }>(event)
  const name = typeof body?.name === 'string' ? body.name.trim() : ''
  if (!name) {
    throw createError({ statusCode: 400, statusMessage: 'name is required' })
  }
  const db = await getDb()
  const data = await createStaffOrgScenario(db, name)
  return { success: true, data }
})
