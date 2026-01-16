/**
 * @registry-id: dailyOpsRevenueAPI
 * @created: 2026-01-16T16:05:00.000Z
 * @last-modified: 2026-01-16T16:05:00.000Z
 * @description: API route for Daily Ops revenue data with pagination
 * @last-fix: [2026-01-16] Initial implementation for Design V2 Daily Ops dashboard
 * 
 * @imports-from:
 *   - app/lib/types/dailyOps.types.ts => RevenueData type
 * 
 * @exports-to:
 *   ✓ app/lib/services/dailyOpsService.ts => Calls this API route
 */

import { NextRequest, NextResponse } from 'next/server'
import type { RevenueData } from '@/lib/types/dailyOps.types'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const skip = parseInt(searchParams.get('skip') || '0', 10)
  const limit = Math.min(parseInt(searchParams.get('limit') || '30', 10), 100)
  const days = limit

  const dataPoints: RevenueData['data_points'] = []
  const now = new Date()
  for (let i = days - 1; i >= 0; i--) {
    const date = new Date(now)
    date.setDate(date.getDate() - i)
    dataPoints.push({
      date: date.toISOString().split('T')[0],
      revenue: Math.floor(Math.random() * 2000) + 500,
      hours: Math.floor(Math.random() * 40) + 20,
      pnl: Math.floor(Math.random() * 1000) - 200,
    })
  }

  const totalRevenue = dataPoints.reduce((sum, dp) => sum + dp.revenue, 0)
  const totalHours = dataPoints.reduce((sum, dp) => sum + dp.hours, 0)

  const mockRevenue: RevenueData = {
    data_points: dataPoints.slice(skip, skip + limit),
    total_revenue: totalRevenue,
    total_hours: totalHours,
    average_daily_revenue: totalRevenue / days,
    period_start: dataPoints[0]?.date || new Date().toISOString(),
    period_end: dataPoints[dataPoints.length - 1]?.date || new Date().toISOString(),
  }

  return NextResponse.json({ success: true, data: mockRevenue })
}
