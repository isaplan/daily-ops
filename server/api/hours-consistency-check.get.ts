/**
 * Compares aggregation row totals to sum of raw records per (date, location).
 * Returns which rows have mismatches and documents possible causes.
 * Uses shared EITJE_HOURS_ADD_FIELDS + labor period (Amsterdam date of shift start) like aggregation rebuild.
 */
import { getDb } from '../utils/db'
import {
  EITJE_AGG_ADD_VENUE_KEY,
  EITJE_HOURS_ADD_FIELDS,
  EITJE_LABOR_PERIOD_FROM_SHIFT_START_FIELD,
  EITJE_LABOR_SHIFT_START_FIELD,
  getUtcDayRange,
} from '../utils/eitjeHours'
import { ObjectId } from 'mongodb'

function padUtcRange (dayStart: Date, dayEnd: Date, padDays: number): { lo: Date; hi: Date } {
  const lo = new Date(dayStart)
  lo.setUTCDate(lo.getUTCDate() - padDays)
  const hi = new Date(dayEnd)
  hi.setUTCDate(hi.getUTCDate() + padDays)
  return { lo, hi }
}

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
      EITJE_AGG_ADD_VENUE_KEY,
      {
        $group: {
          _id: { period: '$period', venueKey: '$venueKey' },
          location_name: { $max: '$location_name' },
          total_hours: { $sum: '$total_hours' },
          record_count: { $sum: '$record_count' },
        },
      },
      {
        $project: {
          _id: 0,
          date: '$_id.period',
          location_id: { $toString: '$_id.venueKey' },
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

    const escapeRegex = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    const endpointName = endpoint === 'planning_shifts' ? 'planning_shifts' : 'time_registration_shifts'

    for (const row of rows) {
      const dateStr = typeof row.date === 'string' ? row.date.slice(0, 10) : new Date(row.date).toISOString().slice(0, 10)
      const locationIdParam = row.location_id != null ? String(row.location_id) : undefined
      const isHexObjectId = Boolean(locationIdParam && /^[a-f0-9]{24}$/i.test(locationIdParam))
      const venueLabel = row.location_name ?? 'Unknown'

      let match: Record<string, unknown>
      const { dayStart, dayEnd } = getUtcDayRange(dateStr)
      const { lo, hi } = padUtcRange(dayStart, dayEnd, 2)
      const dateCondition = { date: { $gte: lo, $lte: hi } }

      if (isHexObjectId && locationIdParam) {
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
        const locationClauses: Record<string, unknown>[] = []
        if (locationIdObj) locationClauses.push({ locationId: locationIdObj })
        locationClauses.push({ locationId: locIdStr })
        if (eitjeIds.length) locationClauses.push({ environmentId: { $in: eitjeIds } })
        match = {
          endpoint: endpointName,
          $and: [dateCondition, { $or: locationClauses }],
        }
      } else if (venueLabel && venueLabel !== 'Unknown') {
        const esc = escapeRegex(venueLabel.trim())
        match = {
          endpoint: endpointName,
          $and: [
            dateCondition,
            {
              $or: [
                { 'extracted.locationName': { $regex: `^${esc}$`, $options: 'i' } },
                { 'rawApiResponse.location_name': { $regex: `^${esc}$`, $options: 'i' } },
                { 'rawApiResponse.environment_name': { $regex: `^${esc}$`, $options: 'i' } },
                { 'rawApiResponse.environment.name': { $regex: `^${esc}$`, $options: 'i' } },
              ],
            },
          ],
        }
      } else {
        match = {
          endpoint: endpointName,
          $and: [dateCondition],
        }
      }

      const rawSumPipeline: unknown[] = [
        { $match: match },
        { $addFields: { ...EITJE_HOURS_ADD_FIELDS, ...EITJE_LABOR_SHIFT_START_FIELD } },
        { $addFields: EITJE_LABOR_PERIOD_FROM_SHIFT_START_FIELD },
        { $match: { period: dateStr } },
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
      possible_causes: `When row total ≠ sum of raw records, common causes: (1) Labor period is Amsterdam calendar date of shift ISO start; padded raw window must include those docs. (2) Location: raw uses environmentId, aggregation uses unified locationId – mismatched eitjeIds. (3) Duplicates in raw vs grouped aggregation buckets. (4) Hours formula: break_minutes or start/end rounding.`,
    }
  } catch (error) {
    console.error('[hours-consistency-check]', error)
    throw createError({ statusCode: 500, message: 'Consistency check failed' })
  }
})
