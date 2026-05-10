/**
 * Worker × team breakdown for a calendar day (+ optional location).
 *
 * For `time_registration_shifts` we read **eitje_raw_data**, dedupe by Eitje shift id (`support_id` / `id`),
 * then aggregate per worker + team. Summing duplicate **aggregation** rows (same shift, many `locationId`
 * fragments) was inflating hours past 24h per person — raw + dedupe matches physical shifts.
 *
 * For `planning_shifts` we still read `eitje_planning_registration_aggregation` (no raw dedupe path here).
 */
import { getDb } from '../utils/db'
import { EITJE_HOURS_ADD_FIELDS, getUtcDayRange, normalizeEitjeHoursVenueName } from '../utils/eitjeHours'
import { ObjectId } from 'mongodb'

function escapeRegex (s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

export default defineEventHandler(async (event) => {
  try {
    const db = await getDb()
    const query = getQuery(event)
    const date = query.date as string | undefined
    const locationIdParam = query.locationId as string | undefined
    const locationNameRaw = query.locationName as string | undefined
    const locationNameParam =
      typeof locationNameRaw === 'string' && locationNameRaw.trim() !== ''
        ? normalizeEitjeHoursVenueName(locationNameRaw)
        : ''
    const endpoint = (query.endpoint as string) || 'time_registration_shifts'

    if (!date) {
      throw createError({ statusCode: 400, message: 'date is required' })
    }

    if (endpoint === 'planning_shifts') {
      const collectionName = 'eitje_planning_registration_aggregation'
      const q: Record<string, unknown> = {
        period_type: 'day',
        period: date,
      }

      const orBranches: Record<string, unknown>[] = []
      if (locationIdParam) {
        try {
          const oid = new ObjectId(locationIdParam)
          orBranches.push({ locationId: { $in: [oid, locationIdParam] } })
        } catch {
          orBranches.push({ locationId: locationIdParam })
        }
      }
      if (locationNameParam) {
        orBranches.push({
          $expr: {
            $eq: [
              {
                $toLower: {
                  $trim: {
                    input: {
                      $replaceAll: {
                        input: { $ifNull: ['$location_name', ''] },
                        find: '\u00a0',
                        replacement: ' ',
                      },
                    },
                  },
                },
              },
              locationNameParam,
            ],
          },
        })
      }

      if (orBranches.length === 1) {
        Object.assign(q, orBranches[0])
      } else if (orBranches.length > 1) {
        q.$or = orBranches
      } else {
        return { success: true, data: [] }
      }

      const pipeline: unknown[] = [
        { $match: q },
        {
          $addFields: {
            userKey: { $toString: { $ifNull: ['$userId', ''] } },
            teamKey: { $toString: { $ifNull: ['$teamId', ''] } },
          },
        },
        {
          $group: {
            _id: { userKey: '$userKey', teamKey: '$teamKey' },
            worker_name: { $first: '$user_name' },
            team_name: { $first: '$team_name' },
            total_hours: { $sum: { $ifNull: ['$total_hours', 0] } },
            total_cost: { $sum: { $ifNull: ['$total_cost', 0] } },
            record_count: { $sum: { $ifNull: ['$record_count', 0] } },
          },
        },
        {
          $project: {
            _id: 0,
            worker_name: { $ifNull: ['$worker_name', 'Unknown'] },
            team_name: { $ifNull: ['$team_name', 'Unknown'] },
            total_hours: { $round: ['$total_hours', 2] },
            total_cost: { $round: ['$total_cost', 2] },
            record_count: 1,
          },
        },
        { $sort: { worker_name: 1, team_name: 1 } },
      ]
      const records = await db.collection(collectionName).aggregate(pipeline).toArray() as {
        worker_name: string
        team_name: string
        total_hours: number
        total_cost: number
        record_count: number
      }[]
      return { success: true, data: records }
    }

    const { dayStart, dayEnd } = getUtcDayRange(date)
    const dateCondition: Record<string, unknown> = {
      $or: [
        { date: { $gte: dayStart, $lte: dayEnd } },
        { date: date },
      ],
    }

    const match: Record<string, unknown> = {
      endpoint: 'time_registration_shifts',
      $and: [dateCondition],
    }

    const locationOr: Record<string, unknown>[] = []

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
      locationOr.push({ $or: locationClauses })
    }

    const nameTrim = typeof locationNameRaw === 'string' ? locationNameRaw.trim() : ''
    if (nameTrim && nameTrim !== 'Unknown') {
      const esc = escapeRegex(nameTrim)
      locationOr.push({
        $or: [
          { 'extracted.locationName': { $regex: `^${esc}$`, $options: 'i' } },
          { 'rawApiResponse.location_name': { $regex: `^${esc}$`, $options: 'i' } },
          { 'rawApiResponse.environment_name': { $regex: `^${esc}$`, $options: 'i' } },
          { 'rawApiResponse.environment.name': { $regex: `^${esc}$`, $options: 'i' } },
        ],
      })
    }

    if (locationOr.length === 0) {
      return { success: true, data: [] }
    }
    ;(match.$and as unknown[]).push(locationOr.length === 1 ? locationOr[0] : { $or: locationOr })

    const rawPipeline: unknown[] = [
      { $match: match },
      {
        $addFields: {
          ...EITJE_HOURS_ADD_FIELDS,
          userId: {
            $ifNull: [
              '$extracted.userId',
              { $ifNull: ['$rawApiResponse.user_id', '$rawApiResponse.user.id'] },
            ],
          },
          teamId: {
            $ifNull: [
              '$extracted.teamId',
              { $ifNull: ['$rawApiResponse.team_id', '$rawApiResponse.team.id'] },
            ],
          },
          supportIdStr: {
            $toString: {
              $ifNull: [
                '$extracted.supportId',
                { $ifNull: ['$rawApiResponse.support_id', '$rawApiResponse.id'] },
              ],
            },
          },
          cost: {
            $ifNull: [
              { $divide: [{ $toDouble: '$extracted.amountInCents' }, 100] },
              {
                $ifNull: [
                  { $divide: [{ $toDouble: '$rawApiResponse.amt_in_cents' }, 100] },
                  {
                    $ifNull: [
                      { $toDouble: '$extracted.amount' },
                      { $ifNull: [{ $toDouble: '$rawApiResponse.amount' }, 0] },
                    ],
                  },
                ],
              },
            ],
          },
        },
      },
      {
        $addFields: {
          shiftDedupeKey: {
            $cond: [
              { $gt: [{ $strLenCP: { $trim: { input: '$supportIdStr' } } }, 0] },
              { $trim: { input: '$supportIdStr' } },
              { $toString: '$_id' },
            ],
          },
        },
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
                    { $eq: ['$primaryId', '$$uid'] },
                  ],
                },
              },
            },
            { $limit: 1 },
            { $project: { canonicalName: 1, primaryName: 1 } },
          ],
          as: 'user',
        },
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
                    { $eq: ['$primaryId', '$$tid'] },
                  ],
                },
              },
            },
            { $limit: 1 },
            { $project: { canonicalName: 1, primaryName: 1 } },
          ],
          as: 'team',
        },
      },
      {
        $project: {
          shiftDedupeKey: 1,
          hours: 1,
          cost: 1,
          worker_name: {
            $ifNull: [
              { $arrayElemAt: ['$user.canonicalName', 0] },
              {
                $ifNull: [
                  { $arrayElemAt: ['$user.primaryName', 0] },
                  { $ifNull: ['$rawApiResponse.user.name', 'Unknown'] },
                ],
              },
            ],
          },
          team_name: {
            $ifNull: [
              { $arrayElemAt: ['$team.canonicalName', 0] },
              {
                $ifNull: [
                  { $arrayElemAt: ['$team.primaryName', 0] },
                  { $ifNull: ['$rawApiResponse.team.name', 'Unknown'] },
                ],
              },
            ],
          },
        },
      },
      { $sort: { _id: 1 } },
      {
        $group: {
          _id: '$shiftDedupeKey',
          hours: { $first: '$hours' },
          cost: { $first: '$cost' },
          worker_name: { $first: '$worker_name' },
          team_name: { $first: '$team_name' },
        },
      },
      {
        $group: {
          _id: { w: '$worker_name', t: '$team_name' },
          total_hours: { $sum: '$hours' },
          total_cost: { $sum: '$cost' },
          record_count: { $sum: 1 },
        },
      },
      {
        $project: {
          _id: 0,
          worker_name: { $ifNull: ['$_id.w', 'Unknown'] },
          team_name: { $ifNull: ['$_id.t', 'Unknown'] },
          total_hours: { $round: ['$total_hours', 2] },
          total_cost: { $round: ['$total_cost', 2] },
          record_count: 1,
        },
      },
      { $sort: { worker_name: 1, team_name: 1 } },
    ]

    const records = await db.collection('eitje_raw_data').aggregate(rawPipeline).toArray() as {
      worker_name: string
      team_name: string
      total_hours: number
      total_cost: number
      record_count: number
    }[]

    return { success: true, data: records }
  } catch (error) {
    if (error && typeof error === 'object' && 'statusCode' in error) throw error
    console.error('[hours-row-detail]', error)
    throw createError({ statusCode: 500, message: 'Failed to fetch row detail' })
  }
})
