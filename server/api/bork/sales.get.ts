/**
 * GET /api/bork/sales — Fetch daily basis reports from inbox-bork-basis-report
 * Filters: date, location, limit
 *
 * Default sort: newest first — business `date` desc, then later-in-day via `business_hour`
 * and batch `cron_hour`, then `received_at` as tie-breaker.
 *
 * Each row is enriched with `unified_location_id` / `unified_location_name` resolved against
 * `unified_location` (+ `bork_unified_location_mapping` aliases) so the UI can group Barbea/Bar Bea,
 * lAmour/l'Amour Toujours, abbreviations, etc. under one venue.
 */

import type { BasisReportData } from '../../utils/inbox/basis-report-mapper'
import { getDb } from '../../utils/db'
import { loadUnifiedLocationGroupResolver } from '../../utils/unifiedLocationGroupResolver'

/** Order reports from most recent business moment to oldest (within-day: higher hour first). */
const SALES_LIST_SORT: Record<string, 1 | -1> = {
  date: -1,
  business_hour: -1,
  cron_hour: -1,
  received_at: -1,
}

type EnrichedBasisReport = BasisReportData & {
  unified_location_id: string | null
  unified_location_name: string | null
}

export default defineEventHandler(async (event) => {
  try {
    const query = getQuery(event)
    const date = query.date as string | undefined
    const location = query.location as string | undefined
    const limit = Math.min(parseInt(query.limit as string) || 30, 365)
    const db = await getDb()
    const collection = db.collection('inbox-bork-basis-report')

    const filter: Record<string, unknown> = {}
    if (date) filter.date = date
    if (location) filter.location = { $regex: location, $options: 'i' }

    const [reports, resolver, unifiedLocations] = await Promise.all([
      collection.find(filter).sort(SALES_LIST_SORT).limit(limit).toArray(),
      loadUnifiedLocationGroupResolver(db),
      db
        .collection('unified_location')
        .find({}, { projection: { name: 1, primaryName: 1, canonicalName: 1 } })
        .toArray(),
    ])

    const idToName = new Map<string, string>()
    for (const u of unifiedLocations) {
      const display =
        (u.canonicalName as string | undefined) ??
        (u.primaryName as string | undefined) ??
        (u.name as string | undefined) ??
        ''
      if (display) idToName.set(`u:${String(u._id)}`, display)
    }

    const enriched: EnrichedBasisReport[] = (reports as BasisReportData[]).map((r) => {
      const groupKey =
        resolver.groupKeyFromBasisLocationId(r.location_id) ??
        resolver.resolveGroupKey(r.location) ??
        resolver.resolveGroupKey(r.location_raw ?? '') ??
        null

      const isUnifiedKey = groupKey?.startsWith('u:') ?? false
      const unifiedId = isUnifiedKey ? groupKey!.slice(2) : null
      const displayName = isUnifiedKey ? idToName.get(groupKey!) ?? null : null

      return {
        ...r,
        unified_location_id: unifiedId,
        unified_location_name: displayName,
      }
    })

    return {
      success: true,
      data: enriched,
      count: enriched.length,
    }
  } catch (error) {
    throw createError({
      statusCode: 500,
      statusMessage: error instanceof Error ? error.message : 'Failed to fetch sales reports',
    })
  }
})
