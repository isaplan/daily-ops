/**
 * @registry-id: dailyOpsBorkStaffHubGet
 * @created: 2026-05-19T12:00:00.000Z
 * @last-modified: 2026-05-19T12:00:00.000Z
 * @description: Lists Bork waiters with sales from bork_sales_by_worker, linked to members via unified_user
 * @last-fix: [2026-05-19] Initial hub API for Bork staff page
 *
 * @adr-ref: ADR-003
 *
 * @exports-to:
 * ✓ pages/daily-ops/inbox/bork-staff.vue (GET hub data)
 */

import { getDb } from '../../utils/db'
import {
  enrichBorkStaffRowsProductivity,
  fetchBorkStaffHubRows,
  normalizeBorkStaffDateRange,
  type BorkStaffHubRow,
} from '../../utils/memberBorkContext'

export type { BorkStaffHubRow }

export default defineEventHandler(async (event) => {
  try {
    const query = getQuery(event)
    const skip = Math.max(0, parseInt(String(query.skip ?? '0'), 10) || 0)
    const limit = Math.min(200, Math.max(1, parseInt(String(query.limit ?? '50'), 10) || 50))
    const search = String(query.search ?? '').trim()
    const locationId = String(query.location ?? '').trim() || undefined
    const includeUnmapped =
      query.include_unmapped === '1' || query.include_unmapped === 'true'
    const range = normalizeBorkStaffDateRange(
      typeof query.start === 'string' ? query.start : undefined,
      typeof query.end === 'string' ? query.end : undefined
    )

    const db = await getDb()
    const { rows: allRows, collection_suffix } = await fetchBorkStaffHubRows(db, {
      range,
      locationId,
      search,
      includeUnmapped,
    })

    const linked = allRows.filter((r) => r.link_status === 'linked').length
    const unifiedNoMember = allRows.filter((r) => r.link_status === 'unified_no_member').length
    const suggested = allRows.filter((r) => r.link_status === 'suggested').length
    const unmapped = allRows.filter((r) => r.link_status === 'unmapped').length
    const withSales = allRows.length
    const needs_rebuild = allRows.filter((r) => r.needs_rebuild).length
    const distinctLocations = [
      ...new Set(allRows.flatMap((r) => r.locations).filter(Boolean)),
    ].sort((a, b) => a.localeCompare(b, 'nl'))

    const page = allRows.slice(skip, skip + limit)
    await enrichBorkStaffRowsProductivity(db, page, range)

    return {
      success: true as const,
      data: page,
      range,
      collection_suffix,
      pagination: { skip, limit, total: allRows.length },
      summary: {
        total_with_sales: withSales,
        linked,
        unified_no_member: unifiedNoMember,
        suggested,
        unmapped,
        needs_rebuild,
        matched: linked,
        unmatched: withSales - linked,
        unmapped_bork_names: unmapped,
        distinct_locations: distinctLocations,
      },
    }
  } catch (error) {
    throw createError({
      statusCode: 500,
      statusMessage: error instanceof Error ? error.message : 'Failed to load Bork staff',
    })
  }
})
