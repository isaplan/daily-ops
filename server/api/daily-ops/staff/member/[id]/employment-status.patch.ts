/**
 * @registry-id: dailyOpsStaffEmploymentStatusPatch
 * @created: 2026-06-12T12:00:00.000Z
 * @last-modified: 2026-06-12T12:00:00.000Z
 * @description: Manual override for staff hub employment status (still working / left)
 * @last-fix: [2026-06-12] Created for Jens-style false positives on no-longer-working KPI
 *
 * @exports-to:
 * ✓ components/daily-ops/staff/StaffMemberProfilePanel.vue
 */

import { ObjectId } from 'mongodb'
import { getDb } from '../../../../../utils/db'
import { invalidateEitjeStaffHubCache } from '../../../../../utils/eitjeStaffHub'
import type { StaffEmploymentOverride } from '../../../../../../types/staff-employment'

const VALID: StaffEmploymentOverride[] = ['auto', 'still_working', 'no_longer_working']

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, statusMessage: 'Missing id' })

  let oid: ObjectId
  try {
    oid = new ObjectId(id)
  } catch {
    throw createError({ statusCode: 404, statusMessage: 'Member not found' })
  }

  const body = await readBody<{ staff_employment_override?: StaffEmploymentOverride }>(event)
  const raw = body?.staff_employment_override
  if (!raw || !VALID.includes(raw)) {
    throw createError({
      statusCode: 400,
      statusMessage: 'staff_employment_override must be auto, still_working, or no_longer_working',
    })
  }

  const db = await getDb()
  const update =
    raw === 'auto'
      ? { $unset: { staff_employment_override: '' }, $set: { updated_at: new Date() } }
      : { $set: { staff_employment_override: raw, updated_at: new Date() } }

  const result = await db.collection('members').updateOne({ _id: oid }, update)
  if (result.matchedCount === 0) {
    throw createError({ statusCode: 404, statusMessage: 'Member not found' })
  }

  invalidateEitjeStaffHubCache()

  return {
    success: true as const,
    data: { staff_employment_override: raw === 'auto' ? null : raw },
  }
})
