/**
 * @registry-id: api/staff-org/scenarios/[id].patch
 * @created: 2026-07-22T18:00:00.000Z
 * @last-modified: 2026-07-23T01:10:00.000Z
 * @description: PATCH /api/staff-org/scenarios/:id — name/status/rules/placements/org
 * @last-fix: [2026-07-23] Accepts orgAssignments for TeamBuilder
 * @adr-ref: ADR-016
 */

import { getDb } from '~/server/utils/db'
import {
  patchStaffOrgScenario,
  type StaffOrgScenarioPatch,
} from '~/server/utils/staffOrg/scenarioRepo'
import { buildOpeningSlotHours } from '~/server/utils/staffOrg/buildOpeningSlots'
import { buildSlotMetrics } from '~/server/utils/staffOrg/buildSlotMetrics'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, statusMessage: 'id required' })

  const body = await readBody<StaffOrgScenarioPatch>(event)
  const db = await getDb()
  const scenario = await patchStaffOrgScenario(db, id, body ?? {})
  if (!scenario) throw createError({ statusCode: 404, statusMessage: 'Scenario not found' })

  const slotHours = buildOpeningSlotHours()
  const metrics = buildSlotMetrics({
    placements: scenario.placements,
    rules: scenario.locationRules,
    roster: scenario.roster,
    slotHours,
  })

  return { success: true, data: { scenario, slotHours, metrics } }
})
