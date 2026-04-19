/**
 * @registry-id: daily-ops-locations-api
 * @created: 2026-04-12T00:00:00.000Z
 * @last-modified: 2026-04-12T00:00:00.000Z
 * @description: Fetch unified locations for Daily Ops UI
 * @last-fix: [2026-04-12] Return unified ObjectIds, not Eitje IDs
 * 
 * @exports-to:
 * ✓ components/daily-ops/DailyOpsDashboardShell.vue => /api/daily-ops/locations
 */

import { getDb } from '../../utils/db'

export default defineEventHandler(async () => {
  try {
    const db = await getDb()
    const unifiedLocations = await db.collection('unified_location').find({}).toArray()

    const locations = unifiedLocations.map((doc: any) => ({
      _id: String(doc._id),
      name: doc.name ?? '',
      abbreviation: doc.abbreviation ?? '',
      eitjeId: doc.eitjeIds?.[0],
    }))

    return {
      success: true,
      data: locations,
    }
  } catch (error) {
    console.error('[daily-ops/locations] Error:', error)
    return {
      success: false,
      data: [],
      error: String(error),
    }
  }
})
