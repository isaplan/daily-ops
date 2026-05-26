/**
 * @registry-id: dailyOpsSnapshotBuildRevenueHourlySection
 * @created: 2026-05-20T00:00:00.000Z
 * @last-modified: 2026-05-26T00:55:00.000Z
 * @description: Hourly revenue snapshot section (24 slots) from paid-time and order-time Bork hour aggregates
 * @last-fix: [2026-05-26] Include order-time hourly buckets beside paid-time buckets.
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
    orderHourly: revenue.orderHourly,
    lastBuiltAt: new Date(),
  }
}
