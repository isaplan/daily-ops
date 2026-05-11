/**
 * @registry-id: dailyOpsEitjeStaffCreateMemberPost
 * @created: 2026-05-11T17:50:00.000Z
 * @last-modified: 2026-05-12T00:00:00.000Z
 * @description: Creates a member from Eitje staff row — mirrors POST /api/members insert semantics
 * @last-fix: [2026-05-12] contract_start_date / contract_end_date for worker profile (members page)
 *
 * @exports-to:
 * ✓ pages/daily-ops/inbox/eitje-staff.vue (modal create flow)
 */

import { ObjectId } from 'mongodb'
import { getDb } from '../../../utils/db'
import { parseOptionalYmdToDate } from '../../../utils/parseOptionalYmdToDate'

export default defineEventHandler(async (event) => {
  const body = await readBody<{
    employee_name: string
    email?: string
    support_id: string
    hourly_rate?: number
    contract_type?: string
    contract_start_date?: string
    contract_end_date?: string
    location_id?: string
    team_id?: string
  }>(event)

  if (!body?.employee_name?.trim()) {
    throw createError({ statusCode: 400, statusMessage: 'employee_name is required' })
  }
  if (!body?.support_id?.trim()) {
    throw createError({ statusCode: 400, statusMessage: 'support_id is required' })
  }

  /** Same semantics as POST /api/members (server/api/members/index.post.ts) */
  const name = body.employee_name.trim()
  const db = await getDb()
  const now = new Date()
  let email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : ''
  const supRaw = body.support_id.trim()
  if (!email) {
    email = `support-${supRaw.replace(/[^\w.-]/g, '_')}@noreply.local`
  }
  const doc: Record<string, unknown> = {
    name,
    email,
    roles: [{ role: 'kitchen_staff', scope: 'team', grantedAt: now }],
    is_active: true,
    created_at: now,
    updated_at: now,
  }

  const existing = await db.collection('members').findOne({ support_id: supRaw })
  if (existing) {
    throw createError({
      statusCode: 409,
      statusMessage: 'A member already exists for this support_id',
    })
  }
  doc.support_id = supRaw

  const hr =
    typeof body.hourly_rate === 'number' && Number.isFinite(body.hourly_rate) ? body.hourly_rate : undefined
  if (hr !== undefined) doc.hourly_rate = hr
  const ct = typeof body.contract_type === 'string' ? body.contract_type.trim() : ''
  if (ct) doc.contract_type = ct

  const csd = parseOptionalYmdToDate(body.contract_start_date)
  if (csd) doc.contract_start_date = csd
  const ced = parseOptionalYmdToDate(body.contract_end_date)
  if (ced) doc.contract_end_date = ced

  if (body.location_id) {
    try {
      doc.location_id = new ObjectId(body.location_id)
    } catch {
      doc.location_id = undefined
    }
  }
  if (body.team_id) {
    try {
      doc.team_id = new ObjectId(body.team_id)
    } catch {
      doc.team_id = undefined
    }
  }

  const result = await db.collection('members').insertOne(doc)
  const inserted = await db.collection('members').findOne({ _id: result.insertedId })
  const data = inserted
    ? {
        _id: String(inserted._id),
        name: inserted.name,
        email: inserted.email,
        location_id: inserted.location_id ? String(inserted.location_id) : undefined,
        team_id: inserted.team_id ? String(inserted.team_id) : undefined,
        support_id: typeof inserted.support_id === 'string' ? inserted.support_id : undefined,
        hourly_rate:
          typeof (inserted as { hourly_rate?: unknown }).hourly_rate === 'number'
            ? (inserted as { hourly_rate: number }).hourly_rate
            : undefined,
        contract_type:
          typeof (inserted as { contract_type?: unknown }).contract_type === 'string'
            ? (inserted as { contract_type: string }).contract_type
            : undefined,
        contract_start_date: (inserted as { contract_start_date?: Date }).contract_start_date
          ? new Date((inserted as { contract_start_date: Date }).contract_start_date).toISOString()
          : undefined,
        contract_end_date: (inserted as { contract_end_date?: Date }).contract_end_date
          ? new Date((inserted as { contract_end_date: Date }).contract_end_date).toISOString()
          : undefined,
        is_active: inserted.is_active,
      }
    : { _id: String(result.insertedId), name: doc.name as string, email }
  return { success: true as const, data }
})
