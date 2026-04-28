/**
 * @registry-id: v3DashboardAPI
 * @created: 2026-04-28T20:30:00.000Z
 * @last-modified: 2026-04-28T20:30:00.000Z
 * @description: API endpoint for V3 dashboard snapshots - denormalized view for dashboard
 * @last-fix: [2026-04-28] Initial V3 dashboard API
 * 
 * @exports-to:
 * ✓ pages/daily-ops/productivity-v3.vue
 * 
 * GET /api/v3/dashboard?locationId=...&businessDate=...
 * GET /api/v3/dashboard/all?businessDate=...
 */

import { ObjectId } from 'mongodb'
import { getDb } from '~/server/utils/db'
import { getDashboardSnapshot } from '~/server/utils/v3Snapshots'
import { getCurrentBusinessDate } from '~/server/utils/v3BusinessDay'

export default defineEventHandler(async (event) => {
  const query = getQuery(event)

  try {
    const db = await getDb()

  try {
    // Get all dashboards for a business date
    if (query.all === 'true' || query.all === '1') {
      const businessDate = (query.businessDate as string) || getCurrentBusinessDate()
      const snapshots = await db
        .collection('v3_daily_ops_dashboard_snapshots')
        .find({ businessDate })
        .toArray()

      return {
        success: true,
        data: snapshots,
        businessDate,
        count: snapshots.length,
      }
    }

    // Get single dashboard for a location and date
    const locationId = query.locationId as string
    const businessDate = (query.businessDate as string) || getCurrentBusinessDate()

    if (!locationId) {
      return createError({
        statusCode: 400,
        statusMessage: 'Missing parameter: locationId',
      })
    }

    const snapshot = await getDashboardSnapshot(db, new ObjectId(locationId), businessDate)

    if (!snapshot) {
      return {
        success: false,
        data: null,
        message: 'Dashboard snapshot not found',
        locationId,
        businessDate,
      }
    }

    return {
      success: true,
      data: snapshot,
      locationId,
      businessDate,
    }
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error)
    console.error('[v3-dashboard-api]', errorMsg)

    return createError({
      statusCode: 500,
      statusMessage: `Failed to fetch dashboard snapshot: ${errorMsg}`,
    })
  }
})
