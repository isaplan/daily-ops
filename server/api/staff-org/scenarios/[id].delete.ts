/**
 * @registry-id: api/staff-org/scenarios/[id].delete
 * @created: 2026-07-22T18:00:00.000Z
 * @last-modified: 2026-07-22T18:00:00.000Z
 * @description: DELETE /api/staff-org/scenarios/:id — hard delete scenario
 * @last-fix: [2026-07-22] Initial delete endpoint
 * @adr-ref: ADR-016
 */

import { getDb } from '~/server/utils/db'
import { deleteStaffOrgScenario } from '~/server/utils/staffOrg/scenarioRepo'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, statusMessage: 'id required' })

  const db = await getDb()
  const ok = await deleteStaffOrgScenario(db, id)
  if (!ok) throw createError({ statusCode: 404, statusMessage: 'Scenario not found' })
  return { success: true }
})
