/**
 * @registry-id: dailyOpsStaffMemberWeeklyHoursGet
 * @created: 2026-06-10T12:00:00.000Z
 * @last-modified: 2026-06-10T12:00:00.000Z
 * @description: Weekly worked vs contract/planned hours for staff profile KPI
 * @last-fix: [2026-06-10] Initial endpoint
 *
 * @exports-to:
 * ✓ composables/useStaffWeeklyHours.ts
 * ✓ components/daily-ops/staff/StaffWeeklyHoursSection.vue
 */

import { ObjectId } from 'mongodb'
import { getDb } from '../../../../../utils/db'
import {
  fetchMemberWeeklyHours,
  resolveStaffHoursRange,
} from '../../../../../utils/memberWeeklyHours'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, statusMessage: 'Missing id' })

  let oid: ObjectId
  try {
    oid = new ObjectId(id)
  } catch {
    throw createError({ statusCode: 404, statusMessage: 'Member not found' })
  }

  const query = getQuery(event)
  const presetRaw = String(query.preset ?? 'ytd')
  const preset =
    presetRaw === '3m' || presetRaw === '6mo' || presetRaw === 'custom' ? presetRaw : 'ytd'
  const startQ = typeof query.start === 'string' ? query.start : undefined
  const endQ = typeof query.end === 'string' ? query.end : undefined
  const range = resolveStaffHoursRange(preset, { start: startQ, end: endQ })

  const db = await getDb()
  try {
    const data = await fetchMemberWeeklyHours(db, oid, range)
    return { success: true as const, data }
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Failed to load weekly hours'
    if (msg === 'Member not found') {
      throw createError({ statusCode: 404, statusMessage: msg })
    }
    throw createError({ statusCode: 500, statusMessage: msg })
  }
})
