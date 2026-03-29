/**
 * @registry-id: eitjeValidationService
 * @created: 2026-01-30T00:00:00.000Z
 * @last-modified: 2026-01-30T00:00:00.000Z
 * @description: Compare Eitje CSV totals vs raw records for data quality
 * @last-fix: [2026-01-30] Initial implementation
 *
 * @exports-to:
 *   ✓ app/lib/services/sync/snapshotReconciliationService.ts
 *   ✓ app/api/data/validation/status/route.ts
 */

import type { ObjectId } from 'mongodb';
import { getDatabase } from '@/lib/mongodb/v2-connection';

const RAW_COLLECTION = 'test-eitje-hours';
const SUMMARY_COLLECTION = 'test-eitje-finance-summary';

const TOLERANCE = 0.01;

export interface EitjeValidationResult {
  date: string;
  location_id: string;
  csv_total_hours?: number;
  csv_total_cost?: number;
  raw_total_hours: number;
  raw_total_cost: number;
  raw_record_count: number;
  hours_match: boolean;
  cost_match: boolean;
  all_match: boolean;
  status: 'PASS' | 'FAIL';
  variance_hours?: number;
  variance_cost?: number;
}

/**
 * Validate that CSV finance summary totals match raw test-eitje-hours sum for a date and location.
 */
export async function validateEitjeTotals(
  date: string,
  locationId: string
): Promise<EitjeValidationResult> {
  const db = await getDatabase();
  const locId = locationId as unknown as ObjectId;
  const start = new Date(date + 'T00:00:00.000Z');
  const end = new Date(date + 'T23:59:59.999Z');

  const rawList = await db
    .collection(RAW_COLLECTION)
    .find({ date: { $gte: start, $lte: end }, location_id: locId })
    .toArray();

  const raw_total_hours = rawList.reduce((sum, r) => sum + (r.hours ?? 0), 0);
  const raw_total_cost = rawList.reduce((sum, r) => sum + (r.cost ?? 0), 0);

  const summary = await db.collection(SUMMARY_COLLECTION).findOne({
    date: start,
    location_id: locId,
  });

  const csv_total_hours = summary?.hours_worked ?? summary?.hours;
  const csv_total_cost = summary?.labor_cost ?? summary?.cost;

  const variance_hours = csv_total_hours != null ? Math.abs(csv_total_hours - raw_total_hours) : undefined;
  const variance_cost = csv_total_cost != null ? Math.abs(csv_total_cost - raw_total_cost) : undefined;

  const hours_match =
    csv_total_hours == null || variance_hours == null || variance_hours / (csv_total_hours || 1) < TOLERANCE;
  const cost_match =
    csv_total_cost == null || variance_cost == null || variance_cost / (csv_total_cost || 1) < TOLERANCE;
  const all_match = hours_match && cost_match;

  return {
    date,
    location_id: locationId,
    csv_total_hours,
    csv_total_cost,
    raw_total_hours,
    raw_total_cost,
    raw_record_count: rawList.length,
    hours_match,
    cost_match,
    all_match,
    status: all_match ? 'PASS' : 'FAIL',
    variance_hours,
    variance_cost,
  };
}
