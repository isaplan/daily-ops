/**
 * @registry-id: dailyOpsEitjeStaffHubGet
 * @created: 2026-05-11T17:50:00.000Z
 * @last-modified: 2026-06-28T02:30:00.000Z
 * @description: Lists staff from members collection (SSOT) enriched with Eitje API activity data
 * @last-fix: [2026-06-28] Historical inactive staff + activity filter query param
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
  summarizeStaffHubRows,
  type EitjeStaffRow,
  type StaffHubActivityFilter,
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
    const activityRaw = String(query.activity ?? 'all').trim().toLowerCase()
    const activity: StaffHubActivityFilter =
      activityRaw === 'inactive' || activityRaw === 'all' || activityRaw === 'active_missing_90d'
        ? activityRaw
        : 'active'

    const db = await getDb()
    const allRows = await getEitjeStaffHubRows(db, { bustCache })
    const summaryAll = summarizeStaffHubRows(allRows)
    const filtered = filterEitjeStaffHubRows(allRows, { search, onlyMissingData, activity })

    const total = filtered.length
    const page = filtered.slice(skip, skip + limit)

    return {
      success: true as const,
      data: page,
      pagination: { skip, limit, total },
      summary: {
        ...summaryAll,
        matched: summaryAll.total_staff - summaryAll.missing_critical_data,
        with_recent_activity: summaryAll.active_count,
        missing_compensation: summaryAll.missing_critical_data,
        active_missing_90d: summaryAll.active_missing_90d,
        data_sources_note:
          'employment=members (Eitje master active + contract end); activity=Eitje agg trailing 30d/90d',
      },
    }
  } catch (error) {
    throw createError({
      statusCode: 500,
      statusMessage: error instanceof Error ? error.message : 'Failed to load Eitje staff',
    })
  }
})
