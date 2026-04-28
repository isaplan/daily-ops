/**
 * @registry-id: v3LaborAPI
 * @created: 2026-04-28T20:25:00.000Z
 * @last-modified: 2026-04-28T20:25:00.000Z
 * @description: API endpoint for V3 labor snapshots - serves working day labor data
 * @last-fix: [2026-04-28] Initial V3 labor API
 * 
 * @exports-to:
 * ✓ pages/daily-ops/hours-v3/*.vue
 * 
 * GET /api/v3/labor?locationId=...&businessDate=...
 * GET /api/v3/labor/range?locationId=...&startDate=...&endDate=...
 * GET /api/v3/labor/all?businessDate=...
 */

import { ObjectId } from 'mongodb'
import { getDb } from '~/server/utils/db'
import { getLaborSnapshot, getSalesSnapshotsByLocationRange } from '~/server/utils/v3Snapshots'
import { getCurrentBusinessDate } from '~/server/utils/v3BusinessDay'

export default defineEventHandler(async (event) => {
  const query = getQuery(event)

  try {
    const db = await getDb()

    // Get all snapshots for a business date
    if (query.all === 'true' || query.all === '1') {
      const businessDate = (query.businessDate as string) || getCurrentBusinessDate()
      const snapshots = await db
        .collection('v3_labor_working_day_snapshots')
        .find({ businessDate })
        .toArray()

      return {
        success: true,
        data: snapshots,
        businessDate,
        count: snapshots.length,
      }
    }

    // Get snapshot range for a location
    if (query.range === 'true' || query.range === '1') {
      const locationId = query.locationId as string
      const startDate = query.startDate as string
      const endDate = query.endDate as string

      if (!locationId || !startDate || !endDate) {
        return createError({
          statusCode: 400,
          statusMessage: 'Missing parameters: locationId, startDate, endDate',
        })
      }

      const snapshots = await db
        .collection('v3_labor_working_day_snapshots')
        .find({
          locationId: new ObjectId(locationId),
          businessDate: { $gte: startDate, $lte: endDate },
        })
        .sort({ businessDate: -1 })
        .toArray()

      return {
        success: true,
        data: snapshots,
        locationId,
        startDate,
        endDate,
        count: snapshots.length,
      }
    }

    // Get single snapshot for a location and date
    const locationId = query.locationId as string
    const businessDate = (query.businessDate as string) || getCurrentBusinessDate()

    if (!locationId) {
      return createError({
        statusCode: 400,
        statusMessage: 'Missing parameter: locationId',
      })
    }

    const snapshot = await getLaborSnapshot(db, new ObjectId(locationId), businessDate)

    if (!snapshot) {
      return {
        success: false,
        data: null,
        message: 'Snapshot not found',
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
    console.error('[v3-labor-api]', errorMsg)

    return createError({
      statusCode: 500,
      statusMessage: `Failed to fetch labor snapshot: ${errorMsg}`,
    })
  }
})
