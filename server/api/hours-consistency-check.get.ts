/**
 * Compares aggregation row totals to sum of raw records per (date, location).
 * Returns which rows have mismatches and documents possible causes.
 * Uses shared EITJE_HOURS_ADD_FIELDS so formula matches row-records and hours-aggregated raw fallback.
 */
import { getDb } from '../utils/db'
import { EITJE_HOURS_ADD_FIELDS, getUtcDayRange } from '../utils/eitjeHours'
import { ObjectId } from 'mongodb'

export default defineEventHandler(async (event) => {
  try {
    const db = await getDb()
    const query = getQuery(event)
    const startDate = (query.startDate as string) || '2025-01-01'
    const endDate = (query.endDate as string) || new Date().toISOString().split('T')[0]
    const endpoint = (query.endpoint as string) || 'time_registration_shifts'
    const tolerance = 0.02

    const aggQuery: Record<string, unknown> = {
      period_type: 'day',
      period: { $gte: startDate, $lte: endDate },
    }
    const aggPipeline: unknown[] = [
      { $match: aggQuery },
      {
        $group: {
          _id: { period: '$period', locationId: '$locationId' },
          location_name: { $first: '$location_name' },
          total_hours: { $sum: '$total_hours' },
          record_count: { $sum: '$record_count' },
        },
      },
      {
        $project: {
          _id: 0,
          date: '$_id.period',
          location_id: '$_id.locationId',
          location_name: { $ifNull: ['$location_name', 'Unknown'] },
          total_hours: 1,
          record_count: 1,
        },
      },
    ]
    const collectionName = endpoint === 'planning_shifts' ? 'eitje_planning_registration_aggregation' : 'eitje_time_registration_aggregation'
    const rows = await db.collection(collectionName).aggregate(aggPipeline).toArray() as { date: string; location_id: unknown; location_name: string; total_hours: number; record_count: number }[]

    const mismatches: { date: string; location_name: string; location_id: string; row_total: number; raw_sum: number; raw_count: number; row_record_count: number; diff: number }[] = []
    const ok: { date: string; location_name: string }[] = []

    for (const row of rows) {
      const dateStr = typeof row.date === 'string' ? row.date.slice(0, 10) : new Date(row.date).toISOString().slice(0, 10)
      const locationIdParam = row.location_id != null ? String(row.location_id) : undefined

      let match: Record<string, unknown>
      if (locationIdParam) {
        let locationIdObj: ObjectId | null = null
        try {
          locationIdObj = new ObjectId(locationIdParam)
        } catch {
          // ignore
        }
        const locIdStr = String(locationIdParam)
        const locationDoc = await db.collection('unified_location').findOne({
          $or: [
            ...(locationIdObj ? [{ primaryId: locationIdObj }] : []),
            { allIdValues: locationIdObj },
            { allIdValues: locIdStr },
            { eitjeIds: locationIdParam },
          ].filter(Boolean),
        }) as { eitjeIds?: number[] } | null
        const eitjeIds = locationDoc?.eitjeIds ?? []
        const { dayStart, dayEnd } = getUtcDayRange(dateStr)
        const dateCondition = { $or: [{ date: { $gte: dayStart, $lte: dayEnd } }, { date: dateStr }] }
        const locationClauses: Record<string, unknown>[] = []
        if (locationIdObj) locationClauses.push({ locationId: locationIdObj })
        locationClauses.push({ locationId: locIdStr })
        if (eitjeIds.length) locationClauses.push({ environmentId: { $in: eitjeIds } })
        match = {
          endpoint: endpoint === 'planning_shifts' ? 'planning_shifts' : 'time_registration_shifts',
          $and: [dateCondition, { $or: locationClauses }],
        }
      } else {
        const { dayStart, dayEnd } = getUtcDayRange(dateStr)
        match = {
          endpoint: endpoint === 'planning_shifts' ? 'planning_shifts' : 'time_registration_shifts',
          $and: [{ $or: [{ date: { $gte: dayStart, $lte: dayEnd } }, { date: dateStr }] }],
        }
      }

      const rawSumPipeline: unknown[] = [
        { $match: match },
        { $addFields: EITJE_HOURS_ADD_FIELDS },
        { $group: { _id: null, raw_sum: { $sum: '$hours' }, raw_count: { $sum: 1 } } },
      ]
      const rawResult = await db.collection('eitje_raw_data').aggregate(rawSumPipeline).toArray() as { raw_sum: number; raw_count: number }[]
      const raw_sum = rawResult[0]?.raw_sum ?? 0
      const raw_count = rawResult[0]?.raw_count ?? 0
      const row_total = Number(row.total_hours ?? 0)
      const diff = Math.abs(raw_sum - row_total)
      if (diff > tolerance) {
        mismatches.push({
          date: dateStr,
          location_name: row.location_name ?? 'Unknown',
          location_id: locationIdParam ?? '',
          row_total,
          raw_sum: Math.round(raw_sum * 100) / 100,
          raw_count,
          row_record_count: row.record_count ?? 0,
          diff: Math.round(diff * 100) / 100,
        })
      } else {
        ok.push({ date: dateStr, location_name: row.location_name ?? 'Unknown' })
      }
    }

    return {
      success: true,
      summary: {
        total_rows: rows.length,
        ok_count: ok.length,
        mismatch_count: mismatches.length,
      },
      mismatches,
      possible_causes: `When row total ≠ sum of raw records, common causes: (1) Date/timezone: raw 'date' may be stored in local TZ so UTC day range includes different shifts. (2) Location: raw uses environmentId, aggregation uses unified locationId – mismatched eitjeIds can include/exclude different docs. (3) Duplicates: same shift stored multiple times in raw (same support_id or fallback key) so raw sum is inflated; aggregation groups by (date, location, user, team) so may count once. (4) Hours formula: break_minutes or start/end rounding differs between aggregation pipeline and raw.`,
    }
  } catch (error) {
    console.error('[hours-consistency-check]', error)
    throw createError({ statusCode: 500, message: 'Consistency check failed' })
  }
})
