import { getDb } from '../utils/db'
import { EITJE_HOURS_ADD_FIELDS } from '../utils/eitjeHours'
import { ObjectId, type Db } from 'mongodb'

const MAX_PAGE_SIZE = 200
const DEFAULT_PAGE_SIZE = 50

function parseHoursPage(query: ReturnType<typeof getQuery>) {
  const page = Math.max(1, parseInt(String(query.page ?? '1'), 10) || 1)
  const rawSize = parseInt(String(query.pageSize ?? String(DEFAULT_PAGE_SIZE)), 10) || DEFAULT_PAGE_SIZE
  const pageSize = Math.min(MAX_PAGE_SIZE, Math.max(1, rawSize))
  return { page, pageSize, skip: (page - 1) * pageSize }
}

function normalizeHoursDateRange(startDate: string | undefined, endDate: string | undefined) {
  const todayStr = new Date().toISOString().split('T')[0]
  const thirtyBack = new Date()
  thirtyBack.setDate(thirtyBack.getDate() - 30)
  const thirtyStr = thirtyBack.toISOString().split('T')[0]
  if (!startDate && !endDate) return { start: thirtyStr, end: todayStr }
  if (startDate && !endDate) return { start: startDate, end: todayStr }
  if (!startDate && endDate) {
    const e = new Date(endDate)
    const s = new Date(e)
    s.setDate(s.getDate() - 30)
    return { start: s.toISOString().split('T')[0], end: endDate }
  }
  return { start: startDate!, end: endDate! }
}

async function sumHoursBaseMatch(db: Db, collectionName: string, q: Record<string, unknown>) {
  const [row] = await db
    .collection(collectionName)
    .aggregate([
      { $match: q },
      {
        $group: {
          _id: null,
          total_hours: { $sum: { $ifNull: ['$total_hours', 0] } },
          total_cost: { $sum: { $ifNull: ['$total_cost', 0] } },
          record_count: { $sum: { $ifNull: ['$record_count', 0] } },
        },
      },
    ])
    .toArray()
  const r = row as { total_hours?: number; total_cost?: number; record_count?: number } | undefined
  return {
    total_hours: r?.total_hours ?? 0,
    total_cost: r?.total_cost ?? 0,
    record_count: r?.record_count ?? 0,
  }
}

export default defineEventHandler(async (event) => {
  try {
    const db = await getDb()
    const query = getQuery(event)
    const { page, pageSize, skip } = parseHoursPage(query)
    const startDate = query.startDate as string | undefined
    const endDate = query.endDate as string | undefined
    const { start: rangeStart, end: rangeEnd } = normalizeHoursDateRange(startDate, endDate)
    const locationId = query.locationId as string | undefined
    const endpoint = (query.endpoint as string) || 'time_registration_shifts'
    const groupBy = (query.groupBy as string) || 'day'
    const source = query.source as string | undefined
    const sortBy = (query.sortBy as string) || 'date'
    const sortOrder = (query.sortOrder as string) || 'desc'
    const includeLocations = query.includeLocations !== 'false' && query.includeLocations !== '0'

    const emptyPaginated = (locations: { _id: string; name: string }[]) => ({
      success: true as const,
      data: [] as unknown[],
      pagination: { page, pageSize, totalCount: 0 },
      totals: { total_hours: 0, total_cost: 0, record_count: 0 },
      summary: { total_records: 0, group_by: groupBy },
      locations,
    })

    if (groupBy === 'worker' && source === 'contracts') {
      const contractDocs = await db.collection('test-eitje-contracts').find({}).toArray()
      const allRows = contractDocs
        .filter((d: { total_worked_hours?: number }) => (d.total_worked_hours ?? 0) > 0)
        .map(
          (d: {
            employee_name?: string
            support_id?: string
            total_worked_hours?: number
            hourly_rate?: number
            total_worked_days?: number
            contract_location?: string
            contract_type?: string
          }) => ({
            worker_id: d.support_id ?? '',
            worker_name: d.employee_name ?? 'Unknown',
            total_hours: d.total_worked_hours ?? 0,
            total_cost: Math.round((d.total_worked_hours ?? 0) * (d.hourly_rate ?? 0) * 100) / 100,
            record_count: d.total_worked_days ?? 0,
            location_count: d.contract_location ? 1 : 0,
            hourly_rate: d.hourly_rate ?? 0,
            contract_type: d.contract_type ?? '-',
            team_name: '-',
          })
        )
      const sortField = sortBy === 'total_cost' ? 'total_cost' : sortBy === 'worker_name' ? 'worker_name' : 'total_hours'
      const dir = sortOrder === 'asc' ? 1 : -1
      allRows.sort(
        (
          a: { total_hours: number; total_cost: number; worker_name: string },
          b: { total_hours: number; total_cost: number; worker_name: string }
        ) => {
          const va = sortField === 'worker_name' ? a.worker_name : sortField === 'total_cost' ? a.total_cost : a.total_hours
          const vb = sortField === 'worker_name' ? b.worker_name : sortField === 'total_cost' ? b.total_cost : b.total_hours
          return dir * (va < vb ? -1 : va > vb ? 1 : 0)
        }
      )
      const totalCount = allRows.length
      const totals = allRows.reduce(
        (acc, r: { total_hours: number; total_cost: number; record_count: number }) => ({
          total_hours: acc.total_hours + r.total_hours,
          total_cost: acc.total_cost + r.total_cost,
          record_count: acc.record_count + r.record_count,
        }),
        { total_hours: 0, total_cost: 0, record_count: 0 }
      )
      const data = allRows.slice(skip, skip + pageSize)
      let locations: { _id: string; name: string }[] = []
      if (includeLocations) {
        const locs = await db
          .collection('locations')
          .find({}, { projection: { name: 1 } })
          .sort({ name: 1 })
          .toArray()
        locations = locs.map((l: { _id: unknown; name: string }) => ({ _id: String(l._id), name: l.name }))
      }
      return {
        success: true,
        data,
        pagination: { page, pageSize, totalCount },
        totals,
        summary: { total_records: totalCount, group_by: 'worker', source: 'contracts' },
        locations,
      }
    }

    const q: Record<string, unknown> = {
      period_type: 'day',
      period: { $gte: rangeStart, $lte: rangeEnd },
    }
    if (locationId && locationId !== 'all') {
      try {
        q.locationId = new ObjectId(locationId)
      } catch {
        q.locationId = locationId
      }
    }

    let aggregation: unknown[] = [{ $match: q }]

    if (groupBy === 'day') {
      aggregation.push({
        $group: {
          _id: '$period',
          total_hours: { $sum: '$total_hours' },
          total_cost: { $sum: '$total_cost' },
          record_count: { $sum: '$record_count' },
          location_count: { $sum: 1 },
        },
      })
      aggregation.push({
        $project: {
          _id: 0,
          date: '$_id',
          total_hours: 1,
          total_cost: 1,
          record_count: 1,
          location_count: 1,
        },
      })
    } else if (groupBy === 'team') {
      aggregation.push({
        $group: {
          _id: { teamId: '$teamId', team_name: '$team_name' },
          total_hours: { $sum: '$total_hours' },
          total_cost: { $sum: '$total_cost' },
          record_count: { $sum: '$record_count' },
          location_count: { $addToSet: '$locationId' },
          worker_count: { $addToSet: '$userId' },
        },
      })
      aggregation.push({
        $project: {
          _id: 0,
          team_id: '$_id.teamId',
          team_name: { $ifNull: ['$_id.team_name', 'Unknown'] },
          total_hours: 1,
          total_cost: 1,
          record_count: 1,
          location_count: { $size: { $filter: { input: '$location_count', as: 'l', cond: { $ne: ['$$l', null] } } } },
          worker_count: { $size: { $filter: { input: '$worker_count', as: 'w', cond: { $ne: ['$$w', null] } } } },
        },
      })
    } else if (groupBy === 'worker') {
      aggregation.push({
        $group: {
          _id: { userId: '$userId', user_name: '$user_name' },
          total_hours: { $sum: '$total_hours' },
          total_cost: { $sum: '$total_cost' },
          record_count: { $sum: '$record_count' },
          location_count: { $addToSet: '$locationId' },
          team_names: { $addToSet: '$team_name' },
          hourly_rate: { $first: '$hourly_rate' },
          contract_type: { $first: '$contract_type' },
        },
      })
      aggregation.push({
        $project: {
          _id: 0,
          worker_id: '$_id.userId',
          worker_name: { $ifNull: ['$_id.user_name', 'Unknown'] },
          total_hours: 1,
          total_cost: 1,
          record_count: 1,
          location_count: { $size: { $filter: { input: '$location_count', as: 'l', cond: { $ne: ['$$l', null] } } } },
          team_name: {
            $cond: [
              {
                $eq: [
                  {
                    $size: {
                      $filter: {
                        input: '$team_names',
                        as: 't',
                        cond: { $and: [{ $ne: ['$$t', null] }, { $ne: ['$$t', 'Unknown'] }] },
                      },
                    },
                  },
                  1,
                ],
              },
              {
                $arrayElemAt: [
                  {
                    $filter: {
                      input: '$team_names',
                      as: 't',
                      cond: { $and: [{ $ne: ['$$t', null] }, { $ne: ['$$t', 'Unknown'] }] },
                    },
                  },
                  0,
                ],
              },
              {
                $concat: [
                  {
                    $toString: {
                      $size: {
                        $filter: {
                          input: '$team_names',
                          as: 't',
                          cond: { $and: [{ $ne: ['$$t', null] }, { $ne: ['$$t', 'Unknown'] }] },
                        },
                      },
                    },
                  },
                  ' teams',
                ],
              },
            ],
          },
          hourly_rate: { $ifNull: ['$hourly_rate', 0] },
          contract_type: { $ifNull: ['$contract_type', '-'] },
        },
      })
    } else if (groupBy === 'location') {
      aggregation.push({
        $group: {
          _id: { $ifNull: ['$locationId', '$environmentId'] },
          total_hours: { $sum: '$total_hours' },
          total_cost: { $sum: '$total_cost' },
          record_count: { $sum: '$record_count' },
          worker_count: { $addToSet: '$userId' },
          location_name: { $first: '$location_name' },
        },
      })
      aggregation.push({
        $project: {
          _id: 0,
          location_id: '$_id',
          location_name: { $ifNull: ['$location_name', 'Unknown'] },
          total_hours: 1,
          total_cost: 1,
          record_count: 1,
          worker_count: { $size: { $filter: { input: '$worker_count', as: 'w', cond: { $ne: ['$$w', null] } } } },
        },
      })
    } else if (groupBy === 'worker_location_team') {
      const workerId = query.workerId as string | undefined

      if (!workerId) {
        let locations: { _id: string; name: string }[] = []
        if (includeLocations) {
          const locs = await db
            .collection('locations')
            .find({}, { projection: { name: 1 } })
            .sort({ name: 1 })
            .toArray()
          locations = locs.map((l: { _id: unknown; name: string }) => ({ _id: String(l._id), name: l.name }))
        }
        return emptyPaginated(locations)
      }

      let userIdMatch: ObjectId | string | number
      const numId = Number(workerId)
      if (!isNaN(numId) && numId.toString() === workerId.toString()) {
        userIdMatch = numId
      } else {
        try {
          userIdMatch = new ObjectId(workerId)
        } catch {
          userIdMatch = workerId
        }
      }

      aggregation = [
        {
          $match: {
            ...q,
            userId: userIdMatch,
            locationId: { $exists: true, $ne: null },
            teamId: { $exists: true, $ne: null },
            team_name: { $exists: true, $nin: [null, 'Unknown'] },
            location_name: { $exists: true, $nin: [null, 'Unknown'] },
          },
        },
        {
          $group: {
            _id: {
              locationId: '$locationId',
              location_name: '$location_name',
              teamId: '$teamId',
              team_name: '$team_name',
            },
            total_hours: { $sum: '$total_hours' },
            total_cost: { $sum: '$total_cost' },
            record_count: { $sum: '$record_count' },
            hourly_rate: { $first: '$hourly_rate' },
          },
        },
        {
          $project: {
            _id: 0,
            location_name: '$_id.location_name',
            team_name: '$_id.team_name',
            total_hours: 1,
            total_cost: 1,
            record_count: 1,
            hourly_rate: { $ifNull: ['$hourly_rate', 0] },
          },
        },
        { $sort: { location_name: 1, team_name: 1 } },
      ]
    } else {
      aggregation.push({
        $group: {
          _id: { period: '$period', locationId: '$locationId' },
          location_name: { $first: '$location_name' },
          total_hours: { $sum: '$total_hours' },
          total_cost: { $sum: '$total_cost' },
          record_count: { $sum: '$record_count' },
        },
      })
      aggregation.push({
        $project: {
          _id: 0,
          date: '$_id.period',
          location_id: '$_id.locationId',
          location_name: { $ifNull: ['$location_name', 'Unknown'] },
          total_hours: 1,
          total_cost: 1,
          record_count: 1,
        },
      })
    }

    const sortField =
      sortBy === 'location' || sortBy === 'location_name'
        ? 'location_name'
        : sortBy === 'team_name'
          ? 'team_name'
          : sortBy === 'worker_name'
            ? 'worker_name'
            : sortBy === 'total_hours'
              ? 'total_hours'
              : sortBy === 'total_cost'
                ? 'total_cost'
                : 'date'
    const sortDirection = sortOrder === 'asc' ? 1 : -1

    if (groupBy !== 'worker_location_team') {
      aggregation.push({ $sort: { [sortField]: sortDirection } })
    }

    aggregation.push({
      $facet: {
        total: [{ $count: 'count' }],
        data: [{ $skip: skip }, { $limit: pageSize }],
      },
    })

    const collectionName =
      endpoint === 'planning_shifts' ? 'eitje_planning_registration_aggregation' : 'eitje_time_registration_aggregation'

    const [aggOut, totals] = await Promise.all([
      db.collection(collectionName).aggregate(aggregation).toArray(),
      sumHoursBaseMatch(db, collectionName, q),
    ])

    const facet = aggOut[0] as { total: { count: number }[]; data: unknown[] } | undefined
    let results: unknown[] = facet?.data ?? []
    let totalCount = facet?.total[0]?.count ?? 0
    let totalsOut = totals

    if (
      totalCount === 0 &&
      endpoint === 'time_registration_shifts' &&
      (groupBy === 'day' ||
        groupBy === 'date_location' ||
        !['day', 'team', 'worker', 'location', 'worker_location_team'].includes(groupBy))
    ) {
      try {
        const rawMatch: Record<string, unknown> = { endpoint: 'time_registration_shifts' }
        const endD = new Date(rangeEnd)
        endD.setHours(23, 59, 59, 999)
        rawMatch.date = { $gte: new Date(rangeStart), $lte: endD, $exists: true, $ne: null }
        if (locationId && locationId !== 'all') {
          try {
            rawMatch.locationId = new ObjectId(locationId)
          } catch {
            rawMatch.locationId = locationId
          }
        }

        if (groupBy === 'day') {
          const rawPipeline: unknown[] = [
            { $match: rawMatch },
            {
              $addFields: {
                period: { $dateToString: { format: '%Y-%m-%d', date: { $toDate: '$date' } } },
                ...EITJE_HOURS_ADD_FIELDS,
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
              $group: {
                _id: '$period',
                total_hours: { $sum: '$hours' },
                total_cost: { $sum: '$cost' },
                record_count: { $sum: 1 },
                location_count: { $addToSet: '$locationId' },
              },
            },
            {
              $project: {
                _id: 0,
                date: '$_id',
                total_hours: 1,
                total_cost: 1,
                record_count: 1,
                location_count: { $size: '$location_count' },
              },
            },
            { $sort: { [sortBy === 'total_hours' ? 'total_hours' : 'date']: sortOrder === 'asc' ? 1 : -1 } },
          ]
          const rawFull = (await db.collection('eitje_raw_data').aggregate(rawPipeline).toArray()) as {
            total_hours?: number
            total_cost?: number
            record_count?: number
          }[]
          totalCount = rawFull.length
          results = rawFull.slice(skip, skip + pageSize)
          totalsOut = rawFull.reduce(
            (acc, r) => ({
              total_hours: acc.total_hours + Number(r.total_hours ?? 0),
              total_cost: acc.total_cost + Number(r.total_cost ?? 0),
              record_count: acc.record_count + Number(r.record_count ?? 0),
            }),
            { total_hours: 0, total_cost: 0, record_count: 0 }
          )
        } else {
          const rawPipeline: unknown[] = [
            { $match: rawMatch },
            {
              $addFields: {
                period: { $dateToString: { format: '%Y-%m-%d', date: { $toDate: '$date' } } },
                ...EITJE_HOURS_ADD_FIELDS,
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
                locName: {
                  $toString: {
                    $ifNull: [
                      '$extracted.locationName',
                      {
                        $ifNull: [
                          '$extracted.environmentName',
                          {
                            $ifNull: [
                              '$rawApiResponse.location_name',
                              {
                                $ifNull: [
                                  '$rawApiResponse.environment_name',
                                  { $ifNull: ['$rawApiResponse.environment.name', 'Unknown'] },
                                ],
                              },
                            ],
                          },
                        ],
                      },
                    ],
                  },
                },
              },
            },
            {
              $group: {
                _id: { period: '$period', locationId: '$locationId', location_name: '$locName' },
                total_hours: { $sum: '$hours' },
                total_cost: { $sum: '$cost' },
                record_count: { $sum: 1 },
              },
            },
            {
              $project: {
                _id: 0,
                date: '$_id.period',
                location_id: { $ifNull: [{ $toString: '$_id.locationId' }, ''] },
                location_name: '$_id.location_name',
                total_hours: 1,
                total_cost: 1,
                record_count: 1,
              },
            },
            {
              $sort: {
                [sortBy === 'location_name' ? 'location_name' : sortBy === 'total_hours' ? 'total_hours' : 'date']:
                  sortOrder === 'asc' ? 1 : -1,
              },
            },
          ]
          const rawFull = (await db.collection('eitje_raw_data').aggregate(rawPipeline).toArray()) as {
            total_hours?: number
            total_cost?: number
            record_count?: number
          }[]
          totalCount = rawFull.length
          results = rawFull.slice(skip, skip + pageSize)
          totalsOut = rawFull.reduce(
            (acc, r) => ({
              total_hours: acc.total_hours + Number(r.total_hours ?? 0),
              total_cost: acc.total_cost + Number(r.total_cost ?? 0),
              record_count: acc.record_count + Number(r.record_count ?? 0),
            }),
            { total_hours: 0, total_cost: 0, record_count: 0 }
          )
        }
      } catch (fallbackErr) {
        console.error('[hours-aggregated] raw fallback failed:', fallbackErr)
      }
    }

    let locations: { _id: string; name: string }[] = []
    if (includeLocations && groupBy !== 'location') {
      const locs = await db
        .collection('locations')
        .find({}, { projection: { name: 1 } })
        .sort({ name: 1 })
        .toArray()
      locations = locs.map((l: { _id: unknown; name: string }) => ({ _id: String(l._id), name: l.name }))
    }

    return {
      success: true,
      data: results,
      pagination: { page, pageSize, totalCount },
      totals: totalsOut,
      summary: { total_records: totalCount, group_by: groupBy },
      locations,
    }
  } catch (error) {
    console.error('[hours-aggregated]', error)
    throw createError({ statusCode: 500, message: 'Failed to fetch hours data' })
  }
})
