/**
 * @registry-id: dailyOpsBorkStaffLinkPost
 * @created: 2026-05-19T14:00:00.000Z
 * @last-modified: 2026-05-19T14:00:00.000Z
 * @description: Confirm or reject Bork waiter → unified_user (and optional member) link
 * @last-fix: [2026-05-19] Initial link confirm/reject for Bork staff hub
 *
 * @adr-ref: ADR-003
 *
 * @exports-to:
 * ✓ pages/daily-ops/inbox/bork-staff.vue
 */

import { getDb } from '../../../utils/db'
import { confirmBorkUserLink, rejectBorkUserLink } from '../../../utils/borkUserLinking'

type LinkBody = {
  action?: 'confirm' | 'reject'
  bork_user_name?: string
  unified_user_id?: string
  member_id?: string
}

export default defineEventHandler(async (event) => {
  const body = (await readBody(event)) as LinkBody
  const action = body.action === 'reject' ? 'reject' : 'confirm'
  const borkUserName = String(body.bork_user_name ?? '').trim()
  const unifiedUserId = String(body.unified_user_id ?? '').trim()
  const memberId = body.member_id ? String(body.member_id).trim() : undefined

  if (!borkUserName) {
    throw createError({ statusCode: 400, statusMessage: 'bork_user_name is required' })
  }
  if (!unifiedUserId) {
    throw createError({ statusCode: 400, statusMessage: 'unified_user_id is required' })
  }

  const db = await getDb()

  if (action === 'reject') {
    await rejectBorkUserLinkSuggestion(db, { borkUserName, unifiedUserId })
    return { success: true as const, action: 'reject' as const }
  }

  const result = await confirmBorkUserLink(db, {
    borkUserName,
    unifiedUserId,
    memberId,
  })

  return {
    success: true as const,
    action: 'confirm' as const,
    data: result,
    note:
      'Mapping saved. Run Bork aggregation rebuild to backfill workerId on historical rows; until then the hub resolves sales by Bork name at read time.',
  }
})
