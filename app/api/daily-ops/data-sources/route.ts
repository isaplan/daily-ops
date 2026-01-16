/**
 * @registry-id: dailyOpsDataSourcesAPI
 * @created: 2026-01-16T16:05:00.000Z
 * @last-modified: 2026-01-16T16:05:00.000Z
 * @description: API route for Daily Ops data source status (Eitje, Bork, PowerBI, Email)
 * @last-fix: [2026-01-16] Initial implementation for Design V2 Daily Ops dashboard
 * 
 * @imports-from:
 *   - app/lib/types/dailyOps.types.ts => DataSource type
 * 
 * @exports-to:
 *   ✓ app/lib/services/dailyOpsService.ts => Calls this API route
 */

import { NextResponse } from 'next/server'
import type { DataSource } from '@/lib/types/dailyOps.types'

export async function GET() {
  const mockDataSources: DataSource[] = [
    {
      id: 'eitje',
      name: 'Eitje',
      status: 'connected',
      last_sync: new Date(Date.now() - 3600000).toISOString(),
      last_sync_successful: true,
    },
    {
      id: 'bork',
      name: 'Bork',
      status: 'connected',
      last_sync: new Date(Date.now() - 7200000).toISOString(),
      last_sync_successful: true,
    },
    {
      id: 'powerbi',
      name: 'PowerBI',
      status: 'syncing',
      last_sync: new Date(Date.now() - 1800000).toISOString(),
      last_sync_successful: true,
    },
    {
      id: 'email',
      name: 'Email',
      status: 'connected',
      last_sync: new Date(Date.now() - 300000).toISOString(),
      last_sync_successful: true,
    },
  ]

  return NextResponse.json({ success: true, data: mockDataSources })
}
