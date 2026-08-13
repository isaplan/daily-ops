/**
 * @registry-id: dailyOpsStaffLeaveCalendarGet
 * @created: 2026-08-13T14:13:52.000Z
 * @last-modified: 2026-08-13T14:37:54.000Z
 * @description: Staff leave year Gantt — leave_requests + ziek + FT/PT/ZZP
 * @last-fix: [2026-08-13] Year=YYYY Gantt spans
 * @adr-ref: ADR-004
 * @data-source: direct-db
 * @read-cache-json: none
 *
 * @imports-from:
 *   - server/utils/dailyOpsStaff/buildLeaveCalendar.ts
 * @exports-to:
 *   ✓ composables/useDailyOpsStaffLeaveCalendar.ts
 */

import { getDb } from '../../../utils/db'
import {
  buildLeaveCalendar,
  parseYear,
} from '../../../utils/dailyOpsStaff/buildLeaveCalendar'
import type { DailyOpsStaffLeaveCalendarDto } from '~/types/daily-ops-staff'
import { amsterdamOpenRegisterBusinessDateYmd } from '~/utils/dailyOpsBusinessDate'

function yearFromAnchor (anchor: string): number {
  return Number(anchor.slice(0, 4))
}

export default defineEventHandler(async (event): Promise<DailyOpsStaffLeaveCalendarDto> => {
  setResponseHeader(event, 'Cache-Control', 'no-store')
  const query = getQuery(event)
  const rawYear = typeof query.year === 'string' || typeof query.year === 'number'
    ? query.year
    : null
  const anchor = typeof query.anchor === 'string' ? query.anchor : amsterdamOpenRegisterBusinessDateYmd()
  const year = rawYear != null && parseYear(rawYear)
    ? Number(rawYear)
    : yearFromAnchor(anchor)
  if (!parseYear(year)) {
    throw createError({ statusCode: 400, statusMessage: 'year must be YYYY' })
  }
  const locationId = typeof query.locationId === 'string' && query.locationId !== 'all'
    ? query.locationId
    : typeof query.location === 'string' && query.location !== 'all'
      ? query.location
      : null

  try {
    const db = await getDb()
    return await buildLeaveCalendar(db, { year, locationId })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Failed to build leave calendar'
    if (msg.includes('year must be')) {
      throw createError({ statusCode: 400, statusMessage: msg })
    }
    throw createError({ statusCode: 500, statusMessage: msg })
  }
})
