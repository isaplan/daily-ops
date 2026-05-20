/**
 * @registry-id: dailyOpsSnapshotBuildRevenueHourlySection
 * @created: 2026-05-20T00:00:00.000Z
 * @last-modified: 2026-05-20T00:00:00.000Z
 * @description: Hourly revenue snapshot section (24 slots) from bork_sales_by_hour
 * @last-fix: [2026-05-20] Initial
 *
 * @exports-to:
 * ✓ server/services/dailyOpsSnapshotService.ts
 */

import type { Db } from 'mongodb'
import type { DailyOpsSnapshotRevenueHourlySection } from '../../../types/daily-ops-snapshot'
import { buildRevenueSection, type BuildRevenueInput } from './buildRevenueSection'

export async function buildRevenueHourlySection(
  db: Db,
  input: BuildRevenueInput,
): Promise<DailyOpsSnapshotRevenueHourlySection> {
  const revenue = await buildRevenueSection(db, input)
  return {
    schema_version: 1,
    businessDate: input.businessDate,
    locationId: input.locationId,
    locationName: input.locationName,
    hourly: revenue.hourly,
    lastBuiltAt: new Date(),
  }
}
