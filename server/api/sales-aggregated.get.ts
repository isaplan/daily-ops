import { getDb } from '../utils/db'
import { ObjectId } from 'mongodb'

export default defineEventHandler(async (event) => {
  try {
    const db = await getDb()
    const query = getQuery(event)
    const startDate = query.startDate as string | undefined
    const endDate = query.endDate as string | undefined
    const locationId = query.locationId as string | undefined
    const groupBy = (query.groupBy as string) || 'date'
    const sortBy = (query.sortBy as string) || 'date'
    const sortOrder = (query.sortOrder as string) || 'desc'

    const q: Record<string, unknown> = {}
    
    // Date range filter
    if (startDate || endDate) {
      q.date = {}
      if (startDate) (q.date as Record<string, string>).$gte = startDate
      if (endDate) (q.date as Record<string, string>).$lte = endDate
    } else {
      // Default: last 30 days
      const thirtyDaysAgo = new Date()
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
      q.date = { $gte: thirtyDaysAgo.toISOString().split('T')[0] }
    }

    // Location filter
    if (locationId && locationId !== 'all') {
      try {
        q.location_id = new ObjectId(locationId)
      } catch {
        q.location_id = locationId
      }
    }

    let aggregation: unknown[] = [{ $match: q }]

    if (groupBy === 'date') {
      aggregation.push({
        $group: {
          _id: '$date',
          total_revenue: { $sum: { $toDouble: '$revenue' } },
          total_quantity: { $sum: { $toDouble: '$quantity' } },
          record_count: { $sum: 1 },
          location_count: { $addToSet: '$location_id' },
        },
      })
      aggregation.push({
        $project: {
          _id: 0,
          date: '$_id',
          total_revenue: { $round: ['$total_revenue', 2] },
          total_quantity: { $round: ['$total_quantity', 2] },
          record_count: 1,
          location_count: { $size: { $filter: { input: '$location_count', as: 'l', cond: { $ne: ['$$l', null] } } } },
        },
      })
    } else if (groupBy === 'location') {
      aggregation.push({
        $group: {
          _id: { location_id: '$location_id', location_name: '$location_name' },
          total_revenue: { $sum: { $toDouble: '$revenue' } },
          total_quantity: { $sum: { $toDouble: '$quantity' } },
          record_count: { $sum: 1 },
          product_count: { $addToSet: '$product_name' },
        },
      })
      aggregation.push({
        $project: {
          _id: 0,
          location_id: '$_id.location_id',
          location_name: { $ifNull: ['$_id.location_name', 'Unknown'] },
          total_revenue: { $round: ['$total_revenue', 2] },
          total_quantity: { $round: ['$total_quantity', 2] },
          record_count: 1,
          product_count: { $size: { $filter: { input: '$product_count', as: 'p', cond: { $ne: ['$$p', null] } } } },
        },
      })
    } else if (groupBy === 'product') {
      aggregation.push({
        $group: {
          _id: { product_id: '$product_id', product_name: '$product_name' },
          total_revenue: { $sum: { $toDouble: '$revenue' } },
          total_quantity: { $sum: { $toDouble: '$quantity' } },
          record_count: { $sum: 1 },
          location_count: { $addToSet: '$location_id' },
        },
      })
      aggregation.push({
        $project: {
          _id: 0,
          product_id: '$_id.product_id',
          product_name: { $ifNull: ['$_id.product_name', 'Unknown'] },
          total_revenue: { $round: ['$total_revenue', 2] },
          total_quantity: { $round: ['$total_quantity', 2] },
          record_count: 1,
          location_count: { $size: { $filter: { input: '$location_count', as: 'l', cond: { $ne: ['$$l', null] } } } },
        },
      })
    } else {
      // date_location: one row per (date, location)
      aggregation.push({
        $group: {
          _id: { date: '$date', location_id: '$location_id', location_name: '$location_name' },
          total_revenue: { $sum: { $toDouble: '$revenue' } },
          total_quantity: { $sum: { $toDouble: '$quantity' } },
          record_count: { $sum: 1 },
        },
      })
      aggregation.push({
        $project: {
          _id: 0,
          date: '$_id.date',
          location_id: '$_id.location_id',
          location_name: { $ifNull: ['$_id.location_name', 'Unknown'] },
          total_revenue: { $round: ['$total_revenue', 2] },
          total_quantity: { $round: ['$total_quantity', 2] },
          record_count: 1,
        },
      })
    }

    const sortField = 
      sortBy === 'location' || sortBy === 'location_name' ? 'location_name' :
      sortBy === 'product_name' ? 'product_name' :
      sortBy === 'total_revenue' ? 'total_revenue' :
      sortBy === 'total_quantity' ? 'total_quantity' :
      'date'
    
    const sortDirection = sortOrder === 'asc' ? 1 : -1
    aggregation.push({ $sort: { [sortField]: sortDirection } })

    const results = await db.collection('test-bork-sales-unified').aggregate(aggregation).toArray()

    let locations: { _id: string; name: string }[] = []
    if (groupBy !== 'location') {
      const locs = await db.collection('locations').find({}).sort({ name: 1 }).toArray()
      locations = locs.map((l: { _id: unknown; name: string }) => ({ _id: String(l._id), name: l.name }))
    }

    return { success: true, data: results, summary: { total_records: results.length, group_by: groupBy }, locations }
  } catch (error) {
    console.error('[sales-aggregated]', error)
    throw createError({ statusCode: 500, message: 'Failed to fetch sales data' })
  }
})
