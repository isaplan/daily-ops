/**
 * @registry-id: locationsRevenueSpacesPutApi
 * @created: 2026-05-28T00:00:00.000Z
 * @last-modified: 2026-05-28T00:00:00.000Z
 * @description: PUT /api/locations/:id/revenue-spaces — replace all spaces for a location
 * @last-fix: [2026-05-28] Initial
 *
 * @exports-to:
 * ✓ components/daily-ops/DailyOpsRevenueSpaceConfigModal.vue
 */

import { ObjectId } from 'mongodb'
import { getDb } from '../../../utils/db'
import { slugifySpaceId } from '../../../utils/locationSpaceResolver'
import type { LocationRevenueSpace, LocationRevenueSpacesPutBody } from '../../../../types/location-revenue-spaces'

function normalizePutSpaces(raw: LocationRevenueSpace[]): LocationRevenueSpace[] {
  const seen = new Set<string>()
  const spaces = raw
    .map((space) => {
      const name = String(space.name ?? '').trim()
      if (!name) return null
      let id = String(space.id ?? '').trim() || slugifySpaceId(name)
      while (seen.has(id)) id = `${id}-${seen.size}`
      seen.add(id)
      const tableRanges = (space.tableRanges ?? [])
        .map((r) => ({ min: Math.trunc(Number(r.min)), max: Math.trunc(Number(r.max)) }))
        .filter((r) => Number.isFinite(r.min) && Number.isFinite(r.max) && r.min <= r.max)
      const individualTables = (space.individualTables ?? [])
        .map((t) => Math.trunc(Number(t)))
        .filter((t) => Number.isFinite(t) && t > 0)
      return { id, name, tableRanges, individualTables }
    })
    .filter((s): s is LocationRevenueSpace => s != null)

  if (!spaces.some((s) => s.id === 'overig')) {
    spaces.push({ id: 'overig', name: 'Overig', tableRanges: [], individualTables: [] })
  }
  return spaces
}

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, statusMessage: 'Missing id' })
  if (!ObjectId.isValid(id)) throw createError({ statusCode: 404, statusMessage: 'Location not found' })

  const body = await readBody<LocationRevenueSpacesPutBody>(event)
  if (!Array.isArray(body?.spaces)) {
    throw createError({ statusCode: 400, statusMessage: 'spaces array required' })
  }

  const db = await getDb()
  const oid = new ObjectId(id)
  const spaces = normalizePutSpaces(body.spaces)
  const result = await db.collection('locations').updateOne(
    { _id: oid },
    { $set: { revenue_spaces: spaces, updated_at: new Date() } },
  )
  if (result.matchedCount === 0) throw createError({ statusCode: 404, statusMessage: 'Location not found' })

  return { success: true, data: { locationId: id, spaces } }
})
