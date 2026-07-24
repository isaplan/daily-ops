/**
 * @registry-id: api/staff-org/seed-from-month.post
 * @created: 2026-07-22T22:00:00.000Z
 * @last-modified: 2026-07-22T22:00:00.000Z
 * @description: POST /api/staff-org/seed-from-month — create scenario from month labor
 * @last-fix: [2026-07-22] Initial June/month seed endpoint
 * @adr-ref: ADR-016
 */

import { getDb } from '~/server/utils/db'
import { seedScenarioFromMonth } from '~/server/utils/staffOrg/seedScenarioFromMonth'
import { buildOpeningSlotHours } from '~/server/utils/staffOrg/buildOpeningSlots'
import { buildSlotMetrics } from '~/server/utils/staffOrg/buildSlotMetrics'

export default defineEventHandler(async (event) => {
  const body = await readBody<{
    name?: string
    startDate?: string
    endDate?: string
  }>(event)

  const startDate = typeof body?.startDate === 'string' ? body.startDate : '2026-06-01'
  const endDate = typeof body?.endDate === 'string' ? body.endDate : '2026-06-30'
  const name = typeof body?.name === 'string' && body.name.trim()
    ? body.name.trim()
    : `June 2026 baseline`

  if (!/^\d{4}-\d{2}-\d{2}$/.test(startDate) || !/^\d{4}-\d{2}-\d{2}$/.test(endDate)) {
    throw createError({ statusCode: 400, statusMessage: 'startDate/endDate must be YYYY-MM-DD' })
  }

  const db = await getDb()
  const scenario = await seedScenarioFromMonth(db, { name, startDate, endDate })
  const slotHours = buildOpeningSlotHours()
  const metrics = buildSlotMetrics({
    placements: scenario.placements,
    rules: scenario.locationRules,
    roster: scenario.roster,
    slotHours,
    orgAssignments: scenario.orgAssignments,
  })

  // Per-member weekly hours check for response summary
  const byMember = new Map<string, number>()
  for (const p of scenario.placements) {
    byMember.set(p.memberId, (byMember.get(p.memberId) ?? 0) + (p.hours ?? 0))
  }
  const sample = scenario.roster
    .filter((m) => byMember.has(m.memberId))
    .slice(0, 8)
    .map((m) => ({
      name: m.name,
      contract: m.weeklyContractHours,
      placedWeekHours: Math.round((byMember.get(m.memberId) ?? 0) * 10) / 10,
      days: scenario.placements.filter((p) => p.memberId === m.memberId).length,
    }))

  return {
    success: true,
    data: {
      scenario,
      slotHours,
      metrics,
      summary: {
        placementCount: scenario.placements.length,
        rosterCount: scenario.roster.length,
        uniqueMembers: byMember.size,
        sampleMembers: sample,
      },
    },
  }
})
