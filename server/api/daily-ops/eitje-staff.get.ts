/**
 * @registry-id: dailyOpsEitjeStaffHubGet
 * @created: 2026-05-11T17:50:00.000Z
 * @last-modified: 2026-06-09T12:00:00.000Z
 * @description: Lists staff from members collection (SSOT) enriched with Eitje API activity data
 * @last-fix: [2026-06-09] Paginate from cached hub rows; DB work no longer repeated per page
 *
 * @adr-ref: ADR-001, ADR-009 (Option B architecture)
 *
 * @exports-to:
 * ✓ pages/daily-ops/inbox/eitje-staff.vue (GET hub data)
 */

import { getDb } from '../../utils/db'
import {
  filterEitjeStaffHubRows,
  getEitjeStaffHubRows,
  type EitjeStaffRow,
} from '../../utils/eitjeStaffHub'

export type { EitjeStaffRow }

export default defineEventHandler(async (event) => {
  try {
    const query = getQuery(event)
    const skip = Math.max(0, parseInt(String(query.skip ?? '0'), 10) || 0)
    const limit = Math.min(200, Math.max(1, parseInt(String(query.limit ?? '50'), 10) || 50))
    const search = String(query.search ?? '').trim()
    const onlyMissingData = String(query.onlyMissingData ?? 'false') === 'true'
    const bustCache = String(query.refresh ?? 'false') === 'true'

    const db = await getDb()
    const allRows = await getEitjeStaffHubRows(db, { bustCache })
    const filtered = filterEitjeStaffHubRows(allRows, { search, onlyMissingData })

    const total = filtered.length
    const with_activity = filtered.filter((r) => r.recent_activity.total_hours > 0).length
    const missing_critical_data = filtered.filter((r) => r.missing_data.length > 0).length
    const page = filtered.slice(skip, skip + limit)

    return {
      success: true as const,
      data: page,
      pagination: { skip, limit, total },
      summary: {
        total_staff: total,
        matched: total - missing_critical_data,
        with_recent_activity: with_activity,
        missing_compensation: missing_critical_data,
        missing_critical_data,
        data_sources_note:
          'contract=members (SSOT), activity=api (last 30d from eitje_time_registration_aggregation)',
      },
    }
  } catch (error) {
    throw createError({
      statusCode: 500,
      statusMessage: error instanceof Error ? error.message : 'Failed to load Eitje staff',
    })
  }
})
