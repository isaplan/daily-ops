import { getDb } from '../utils/db'
import { EITJE_HOURS_ADD_FIELDS } from '../utils/eitjeHours'
import { ObjectId } from 'mongodb'

export default defineEventHandler(async (event) => {
  try {
    const db = await getDb()
    const query = getQuery(event)
    const startDate = query.startDate as string | undefined
    const endDate = query.endDate as string | undefined
    const locationId = query.locationId as string | undefined
    const endpoint = (query.endpoint as string) || 'time_registration_shifts'
    const groupBy = (query.groupBy as string) || 'day'
    const source = query.source as string | undefined
    const sortBy = (query.sortBy as string) || 'date'
    const sortOrder = (query.sortOrder as string) || 'desc'

    if (groupBy === 'worker' && source === 'contracts') {
      const contractDocs = await db.collection('test-eitje-contracts').find({}).toArray()
      const results = contractDocs
        .filter((d: { total_worked_hours?: number }) => (d.total_worked_hours ?? 0) > 0)
        .map((d: { employee_name?: string; support_id?: string; total_worked_hours?: number; hourly_rate?: number; total_worked_days?: number; contract_location?: string; contract_type?: string }) => ({
          worker_id: d.support_id ?? '',
          worker_name: d.employee_name ?? 'Unknown',
          total_hours: d.total_worked_hours ?? 0,
          total_cost: Math.round((d.total_worked_hours ?? 0) * (d.hourly_rate ?? 0) * 100) / 100,
          record_count: d.total_worked_days ?? 0,
          location_count: d.contract_location ? 1 : 0,
          hourly_rate: d.hourly_rate ?? 0,
          contract_type: d.contract_type ?? '-',
          team_name: '-',
        }))
      const sortField = sortBy === 'total_cost' ? 'total_cost' : sortBy === 'worker_name' ? 'worker_name' : 'total_hours'
      const dir = sortOrder === 'asc' ? 1 : -1
      results.sort((a: { total_hours: number; total_cost: number; worker_name: string }, b: { total_hours: number; total_cost: number; worker_name: string }) => {
        const va = sortField === 'worker_name' ? a.worker_name : sortField === 'total_cost' ? a.total_cost : a.total_hours
        const vb = sortField === 'worker_name' ? b.worker_name : sortField === 'total_cost' ? b.total_cost : b.total_hours
        return dir * (va < vb ? -1 : va > vb ? 1 : 0)
      })
      return { success: true, data: results, summary: { total_records: results.length, group_by: 'worker', source: 'contracts' }, locations: [] }
    }

    // Collection written by app/lib/services/aggregationService (aggregateTimeRegistration).
    // Stored docs: period (YYYY-MM-DD for day), period_type ('day'|'week'|'month'|'year'),
    // locationId (ObjectId from unified_location.primaryId), location_name, userId, user_name,
    // teamId, team_name, total_hours, total_cost, record_count (one doc per period+location+user+team).
    const q: Record<string, unknown> = { period_type: 'day' }
    if (startDate || endDate) {
      q.period = {}
      if (startDate) (q.period as Record<string, string>).$gte = startDate
      if (endDate) (q.period as Record<string, string>).$lte = endDate
    } else {
      const thirtyDaysAgo = new Date()
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
      q.period = { $gte: thirtyDaysAgo.toISOString().split('T')[0] }
    }
    if (locationId && locationId !== 'all') {
      try {
        q.locationId = new ObjectId(locationId)
      } catch {
        q.locationId = locationId
      }
    }

    let aggregation: unknown[] = [{ $match: { 
      ...q,
      // CRITICAL: Exclude "Unknown" values - they indicate data quality issues
      team_name: { $ne: 'Unknown' }
    } }]

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
              { $eq: [{ $size: { $filter: { input: '$team_names', as: 't', cond: { $and: [{ $ne: ['$$t', null] }, { $ne: ['$$t', 'Unknown'] }] } } } }, 1] },
              { $arrayElemAt: [{ $filter: { input: '$team_names', as: 't', cond: { $and: [{ $ne: ['$$t', null] }, { $ne: ['$$t', 'Unknown'] }] } } }, 0] },
              { $concat: [{ $toString: { $size: { $filter: { input: '$team_names', as: 't', cond: { $and: [{ $ne: ['$$t', null] }, { $ne: ['$$t', 'Unknown'] }] } } } } }, ' teams'] }
            ]
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
      // Get worker's breakdown by location and team - this should group EXISTING aggregation docs
      // Each doc in the aggregation collection is for a specific period+location+team+worker
      // We group by location+team to sum across all periods
      const workerId = query.workerId as string | undefined
      
      if (!workerId) {
        return { success: true, data: [], summary: { total_records: 0, group_by: 'worker_location_team' }, locations: [] }
      }
      
      // Try to parse as number first (most users have numeric IDs), then try ObjectId
      let userIdMatch: Record<string, unknown>
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
      
      // Query aggregation collection and group by location+team
      // CRITICAL: Exclude "Unknown" teams - Eitje data must ALWAYS be valid!
      aggregation = [
        { $match: { 
          ...q, 
          userId: userIdMatch,
          // STRICT filtering: no null, no "Unknown" values
          locationId: { $exists: true, $ne: null },
          teamId: { $exists: true, $ne: null },
          team_name: { $exists: true, $nin: [null, 'Unknown'] },
          location_name: { $exists: true, $nin: [null, 'Unknown'] }
        } },
        {
          $group: {
            _id: { 
              locationId: '$locationId', 
              location_name: '$location_name', 
              teamId: '$teamId', 
              team_name: '$team_name' 
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
        { $sort: { location_name: 1, team_name: 1 } }
      ]
    } else {
      // date_location: one row per (day, location) – group by period + locationId (collection has one doc per worker/team per location per day)
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

    const sortField = sortBy === 'location' || sortBy === 'location_name' ? 'location_name' : sortBy === 'team_name' ? 'team_name' : sortBy === 'worker_name' ? 'worker_name' : sortBy === 'total_hours' ? 'total_hours' : sortBy === 'total_cost' ? 'total_cost' : 'date'
    const sortDirection = sortOrder === 'asc' ? 1 : -1
    
    // Only add sort if not already in pipeline (worker_location_team already has sort)
    if (groupBy !== 'worker_location_team') {
      aggregation.push({ $sort: { [sortField]: sortDirection } })
    }

    const collectionName = endpoint === 'planning_shifts' ? 'eitje_planning_registration_aggregation' : 'eitje_time_registration_aggregation'
    let results = await db.collection(collectionName).aggregate(aggregation).toArray()

    // Fallback: if aggregation collection is empty, aggregate from raw data (eitje_raw_data)
    if (results.length === 0 && endpoint === 'time_registration_shifts' && (groupBy === 'day' || groupBy === 'date_location' || (!['day', 'team', 'worker', 'location', 'worker_location_team'].includes(groupBy)))) {
      try {
        const rawMatch: Record<string, unknown> = { endpoint: 'time_registration_shifts' }
        if (startDate || endDate) {
          const dateCond: Record<string, unknown> = { $exists: true, $ne: null }
          if (startDate) dateCond.$gte = new Date(startDate)
          if (endDate) {
            const end = new Date(endDate)
            end.setHours(23, 59, 59, 999)
            dateCond.$lte = end
          }
          rawMatch.date = dateCond
        } else {
          const thirtyDaysAgo = new Date()
          thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
          rawMatch.date = { $gte: thirtyDaysAgo, $exists: true, $ne: null }
        }
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
                      { $ifNull: [{ $toDouble: '$extracted.amount' }, { $ifNull: [{ $toDouble: '$rawApiResponse.amount' }, 0] }] }
                    ]
                  }
                ]
              }
            }
          },
          {
            $group: {
              _id: '$period',
              total_hours: { $sum: '$hours' },
              total_cost: { $sum: '$cost' },
              record_count: { $sum: 1 },
              location_count: { $addToSet: '$locationId' }
            }
          },
          {
            $project: {
              _id: 0,
              date: '$_id',
              total_hours: 1,
              total_cost: 1,
              record_count: 1,
              location_count: { $size: '$location_count' }
            }
          },
          { $sort: { [sortBy === 'total_hours' ? 'total_hours' : 'date']: sortOrder === 'asc' ? 1 : -1 } }
        ]
        const rawDayResults = await db.collection('eitje_raw_data').aggregate(rawPipeline).toArray()
        results = rawDayResults as typeof results
      } else {
        // date_location or flat: one row per day per location from raw
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
                      { $ifNull: [{ $toDouble: '$extracted.amount' }, { $ifNull: [{ $toDouble: '$rawApiResponse.amount' }, 0] }] }
                    ]
                  }
                ]
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
                            { $ifNull: ['$rawApiResponse.environment_name', 'Unknown'] }
                          ]
                        }
                      ]
                    }
                  ]
                }
              }
            }
          },
          {
            $group: {
              _id: { period: '$period', locationId: '$locationId', location_name: '$locName' },
              total_hours: { $sum: '$hours' },
              total_cost: { $sum: '$cost' },
              record_count: { $sum: 1 }
            }
          },
          {
            $project: {
              _id: 0,
              date: '$_id.period',
              location_id: { $ifNull: [{ $toString: '$_id.locationId' }, ''] },
              location_name: '$_id.location_name',
              total_hours: 1,
              total_cost: 1,
              record_count: 1
            }
          },
          { $sort: { [sortBy === 'location_name' ? 'location_name' : sortBy === 'total_hours' ? 'total_hours' : 'date']: sortOrder === 'asc' ? 1 : -1 } }
        ]
        const rawDateLocResults = await db.collection('eitje_raw_data').aggregate(rawPipeline).toArray()
        results = rawDateLocResults as typeof results
      }
      } catch (fallbackErr) {
        console.error('[hours-aggregated] raw fallback failed:', fallbackErr)
        // keep results as [] so we return 200 with empty data instead of 500
      }
    }

    let locations: { _id: string; name: string }[] = []
    if (groupBy !== 'location') {
      const locs = await db.collection('locations').find({}).sort({ name: 1 }).toArray()
      locations = locs.map((l: { _id: unknown; name: string }) => ({ _id: String(l._id), name: l.name }))
    }

    return { success: true, data: results, summary: { total_records: results.length, group_by: groupBy }, locations }
  } catch (error) {
    console.error('[hours-aggregated]', error)
    throw createError({ statusCode: 500, message: 'Failed to fetch hours data' })
  }
})
