/**
 * @registry-id: api/staff-org/weekday-revenue-share.get
 * @created: 2026-07-22T23:00:00.000Z
 * @last-modified: 2026-07-22T23:00:00.000Z
 * @description: GET weekday revenue share for a month (multi-year history)
 * @last-fix: [2026-07-22] Initial share endpoint for Staff Org day revenue
 * @adr-ref: ADR-016
 */

import { getDb } from '~/server/utils/db'
import { buildWeekdayRevenueShares } from '~/server/utils/staffOrg/weekdayRevenueShare'

export default defineEventHandler(async (event) => {
  const q = getQuery(event)
  const locationId = typeof q.locationId === 'string' ? q.locationId : ''
  const month = Number(q.month) || 9
  const yearsRaw = typeof q.years === 'string' ? q.years : '2024,2025'
  const years = yearsRaw.split(',').map((y) => Number(y.trim())).filter((y) => y >= 2020)

  if (!locationId) {
    throw createError({ statusCode: 400, statusMessage: 'locationId required' })
  }

  const db = await getDb()
  const shares = await buildWeekdayRevenueShares(db, {
    locationId,
    month,
    years: years.length ? years : [2024, 2025],
  })

  return {
    success: true,
    data: { locationId, month, years, shares },
  }
})
