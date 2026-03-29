/**
 * @registry-id: borkValidationService
 * @created: 2026-01-30T00:00:00.000Z
 * @last-modified: 2026-01-30T00:00:00.000Z
 * @description: Compare Bork CSV/email totals vs raw API data for data quality
 * @last-fix: [2026-01-30] Initial implementation
 *
 * @exports-to:
 *   ✓ app/lib/services/sync/snapshotReconciliationService.ts
 *   ✓ app/api/data/validation/status/route.ts
 */

import type { ObjectId } from 'mongodb';
import { getDatabase } from '@/lib/mongodb/v2-connection';

const UNIFIED_COLLECTION = 'test-bork-sales-unified';

const TOLERANCE = 0.01;
const ABSOLUTE_TOLERANCE_EUR = 1;

export interface BorkValidationResult {
  date: string;
  location_id: string;
  csv_revenue?: number;
  api_revenue: number;
  csv_record_count?: number;
  api_record_count: number;
  revenue_match: boolean;
  status: 'PASS' | 'FAIL';
  variance?: number;
}

/**
 * Validate that CSV revenue total matches raw test-bork-sales-unified sum for a date and location.
 * If no CSV reference exists, only api_revenue and api_record_count are set; revenue_match is true.
 */
export async function validateBorkTotals(
  date: string,
  locationId: string
): Promise<BorkValidationResult> {
  const db = await getDatabase();
  const locId = locationId as unknown as ObjectId;
  const start = new Date(date + 'T00:00:00.000Z');
  const end = new Date(date + 'T23:59:59.999Z');

  const rawList = await db
    .collection(UNIFIED_COLLECTION)
    .find({ date: { $gte: start, $lte: end }, location_id: locId })
    .toArray();

  const api_revenue = rawList.reduce((sum, r) => sum + (r.revenue ?? 0), 0);
  const api_record_count = rawList.length;

  const csvDoc = await db.collection('test-bork-basis-rapport').findOne({
    date: start,
    location_id: locId,
  });
  const csv_revenue = csvDoc?.revenue ?? csvDoc?.total;
  const csv_record_count = csvDoc ? 1 : 0;

  const variance = csv_revenue != null ? Math.abs(csv_revenue - api_revenue) : undefined;
  const revenue_match =
    csv_revenue == null ||
    (variance != null && (variance < ABSOLUTE_TOLERANCE_EUR || variance / (csv_revenue || 1) < TOLERANCE));

  return {
    date,
    location_id: locationId,
    csv_revenue,
    api_revenue,
    csv_record_count,
    api_record_count,
    revenue_match,
    status: revenue_match ? 'PASS' : 'FAIL',
    variance,
  };
}
