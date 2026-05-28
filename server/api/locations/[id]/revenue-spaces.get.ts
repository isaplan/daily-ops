/**
 * @registry-id: locationsRevenueSpacesGetApi
 * @created: 2026-05-28T00:00:00.000Z
 * @last-modified: 2026-05-28T00:00:00.000Z
 * @description: GET /api/locations/:id/revenue-spaces — per-location table→space config
 * @last-fix: [2026-05-28] Initial
 *
 * @exports-to:
 * ✓ components/daily-ops/DailyOpsRevenueSpaceConfigModal.vue
 */

import { ObjectId } from 'mongodb'
import { getDb } from '../../../utils/db'
import { loadLocationRevenueSpaces } from '../../../utils/locationSpaceResolver'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, statusMessage: 'Missing id' })
  if (!ObjectId.isValid(id)) throw createError({ statusCode: 404, statusMessage: 'Location not found' })

  const db = await getDb()
  const oid = new ObjectId(id)
  const location = await db.collection('locations').findOne({ _id: oid }, { projection: { name: 1 } })
  if (!location) throw createError({ statusCode: 404, statusMessage: 'Location not found' })

  const { spaces, seeded } = await loadLocationRevenueSpaces(db, id, { seedIfEmpty: true })
  return {
    success: true,
    data: {
      locationId: id,
      locationName: String(location.name ?? ''),
      spaces,
      seeded,
    },
  }
})
