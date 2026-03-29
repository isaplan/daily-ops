/**
 * @registry-id: dailyOpsKPIsAPI
 * @created: 2026-01-16T16:05:00.000Z
 * @last-modified: 2026-01-16T16:05:00.000Z
 * @description: API route for Daily Ops KPI data (mock initially, ready for Eitje/Bork/PowerBI integration)
 * @last-fix: [2026-01-16] Initial implementation for Design V2 Daily Ops dashboard
 * 
 * @imports-from:
 *   - app/lib/types/dailyOps.types.ts => KPI type
 * 
 * @exports-to:
 *   ✓ app/lib/services/dailyOpsService.ts => Calls this API route
 */

import { NextResponse } from 'next/server'
import type { KPI } from '@/lib/types/dailyOps.types'

export async function GET() {
  const mockKPI: KPI = {
    hours: {
      total: 12450,
      this_week: 320,
      last_week: 298,
      trend: 'up',
    },
    revenue: {
      total: 245000,
      this_month: 18500,
      last_month: 17200,
      trend: 'up',
    },
    subscriptions: {
      active: 145,
      new_this_month: 12,
      cancelled_this_month: 3,
    },
    last_updated: new Date().toISOString(),
  }

  return NextResponse.json({ success: true, data: mockKPI })
}
