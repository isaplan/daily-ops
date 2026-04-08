/**
 * Returns individual raw shift records for a given date (+ location) so the UI can show
 * each record and verify how totals are calculated. Reads from eitje_raw_data.
 * Raw docs use environmentId (Eitje API); aggregation uses locationId (unified ObjectId).
 * We must match raw by date and by location: either locationId or environmentId in location's eitjeIds.
 * Uses shared EITJE_HOURS_ADD_FIELDS so hours match consistency-check and hours-aggregated raw fallback.
 */
import { getDb } from '../utils/db'
import { EITJE_HOURS_ADD_FIELDS, getUtcDayRange } from '../utils/eitjeHours'
import { ObjectId } from 'mongodb'

export default defineEventHandler(async (event) => {
  try {
    const db = await getDb()
    const query = getQuery(event)
    const dateStr = query.date as string | undefined
    const locationIdParam = query.locationId as string | undefined
    const endpoint = (query.endpoint as string) || 'time_registration_shifts'

    if (!dateStr) {
      throw createError({ statusCode: 400, message: 'date is required' })
    }

    // Use UTC day range so we match the calendar day regardless of server TZ (shared with consistency-check)
    const { dayStart, dayEnd } = getUtcDayRange(dateStr)

    const dateCondition: Record<string, unknown> = {
      $or: [
        { date: { $gte: dayStart, $lte: dayEnd } },
        { date: dateStr },
      ],
    }

    const match: Record<string, unknown> = {
      endpoint: endpoint === 'planning_shifts' ? 'planning_shifts' : 'time_registration_shifts',
      $and: [dateCondition],
    }

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
      const locationClauses: Record<string, unknown>[] = []
      if (locationIdObj) locationClauses.push({ locationId: locationIdObj })
      locationClauses.push({ locationId: locIdStr })
      if (eitjeIds.length) locationClauses.push({ environmentId: { $in: eitjeIds } })
      ;(match.$and as unknown[]).push({ $or: locationClauses })
    }

    const pipeline: unknown[] = [
      { $match: match },
      {
        $addFields: {
          ...EITJE_HOURS_ADD_FIELDS,
          userId: {
            $ifNull: [
              '$extracted.userId',
              { $ifNull: ['$rawApiResponse.user_id', '$rawApiResponse.user.id'] }
            ]
          },
          teamId: {
            $ifNull: [
              '$extracted.teamId',
              { $ifNull: ['$rawApiResponse.team_id', '$rawApiResponse.team.id'] }
            ]
          },
          start: '$rawApiResponse.start',
          end: '$rawApiResponse.end',
        }
      },
      {
        $lookup: {
          from: 'unified_user',
          let: { uid: '$userId' },
          pipeline: [
            {
              $match: {
                $expr: {
                  $or: [
                    { $in: ['$$uid', { $ifNull: ['$eitjeIds', []] }] },
                    { $in: ['$$uid', { $ifNull: ['$allIdValues', []] }] },
                    { $eq: ['$primaryId', '$$uid'] }
                  ]
                }
              }
            },
            { $limit: 1 },
            { $project: { canonicalName: 1, primaryName: 1 } }
          ],
          as: 'user'
        }
      },
      {
        $lookup: {
          from: 'unified_team',
          let: { tid: '$teamId' },
          pipeline: [
            {
              $match: {
                $expr: {
                  $or: [
                    { $in: ['$$tid', { $ifNull: ['$eitjeIds', []] }] },
                    { $in: ['$$tid', { $ifNull: ['$allIdValues', []] }] },
                    { $eq: ['$primaryId', '$$tid'] }
                  ]
                }
              }
            },
            { $limit: 1 },
            { $project: { canonicalName: 1, primaryName: 1 } }
          ],
          as: 'team'
        }
      },
      {
        $project: {
          _id: 1,
          support_id: {
            $ifNull: [
              '$extracted.supportId',
              { $ifNull: ['$rawApiResponse.support_id', '$rawApiResponse.id'] }
            ]
          },
          worker_name: {
            $ifNull: [
              { $arrayElemAt: ['$user.canonicalName', 0] },
              {
                $ifNull: [
                  { $arrayElemAt: ['$user.primaryName', 0] },
                  { $ifNull: ['$rawApiResponse.user.name', 'Unknown'] }
                ]
              }
            ]
          },
          team_name: {
            $ifNull: [
              { $arrayElemAt: ['$team.canonicalName', 0] },
              {
                $ifNull: [
                  { $arrayElemAt: ['$team.primaryName', 0] },
                  { $ifNull: ['$rawApiResponse.team.name', 'Unknown'] }
                ]
              }
            ]
          },
          start: 1,
          end: 1,
          hours: 1
        }
      },
      { $sort: { start: 1 } }
    ]

    const records = await db.collection('eitje_raw_data').aggregate(pipeline).toArray() as { _id: unknown; support_id: unknown; worker_name: string; team_name: string; start: string | null; end: string | null; hours: number }[]

    const formatted = records.map((r) => ({
      id: r._id != null ? String(r._id) : '',
      support_id: r.support_id != null ? String(r.support_id) : '',
      worker_name: r.worker_name ?? 'Unknown',
      team_name: r.team_name ?? 'Unknown',
      start: r.start ? new Date(r.start).toLocaleString(undefined, { dateStyle: 'short', timeStyle: 'short' }) : '-',
      end: r.end ? new Date(r.end).toLocaleString(undefined, { dateStyle: 'short', timeStyle: 'short' }) : '-',
      hours: Math.round((r.hours ?? 0) * 100) / 100,
    }))

    return { success: true, data: formatted }
  } catch (error) {
    if (error && typeof error === 'object' && 'statusCode' in error) throw error
    console.error('[hours-row-records]', error)
    throw createError({ statusCode: 500, message: 'Failed to fetch row records' })
  }
})
