/**
 * @registry-id: laborEnrichmentService
 * @created: 2026-01-30T00:00:00.000Z
 * @last-modified: 2026-01-30T00:00:00.000Z
 * @description: Add names to raw labor records (Layer 1 to Layer 2) using master data cache
 * @last-fix: [2026-01-30] Initial implementation
 *
 * @exports-to:
 *   ✓ app/lib/services/aggregation/dailyOpsAggregationService.ts
 */

import type { ObjectId } from 'mongodb';
import { getDatabase } from '@/lib/mongodb/v2-connection';
import { getMember, getLocation, getTeam } from '@/lib/services/cache/masterDataCacheService';
import type { RawLaborRecord } from '@/lib/types/raw-data.types';
import type { EnrichedLaborRecord } from '@/lib/types/enrichment.types';

const COLLECTION = 'test-eitje-hours';

export interface EnrichLaborBatchResult {
  enriched: EnrichedLaborRecord[];
  skipped: number;
  total: number;
}

/**
 * Enrich a single raw labor record with member, location, team names. O(1) after cache load.
 */
export function enrichLaborRecord(raw: RawLaborRecord & { _id?: ObjectId }): EnrichedLaborRecord | null {
  const member = getMember(raw.member_id);
  const location = getLocation(raw.location_id);
  const team = getTeam(raw.team_id);
  if (!member || !location || !team) return null;

  const role = Array.isArray(member.roles) && member.roles[0] ? (member.roles[0] as { role?: string }).role : 'staff';

  return {
    date: raw.date,
    member_id: raw.member_id,
    member_name: member.name,
    member_role: role,
    location_id: raw.location_id,
    location_name: location.name,
    team_id: raw.team_id,
    team_name: team.name,
    hours: raw.hours,
    cost: raw.cost,
    hourly_rate: raw.hourly_rate,
    cost_per_hour: raw.cost_per_hour,
    contract_type: raw.contract_type,
    work_type: raw.work_type,
    source: raw.source,
    external_id: raw.external_id,
    support_id: raw.support_id,
  };
}

/**
 * Load raw labor records for a date and location, enrich with names, return enriched list.
 * Caller must call loadAllMasterData() once before calling this.
 */
export async function enrichLaborBatch(
  date: Date,
  locationId: ObjectId,
  options?: { skip?: number; limit?: number }
): Promise<EnrichLaborBatchResult> {
  const db = await getDatabase();
  const start = new Date(date);
  start.setHours(0, 0, 0, 0);
  const end = new Date(date);
  end.setHours(23, 59, 59, 999);

  const filter: Record<string, unknown> = {
    date: { $gte: start, $lte: end },
    location_id: locationId,
  };
  const cursor = db.collection(COLLECTION).find(filter);
  if (options?.skip != null) cursor.skip(options.skip);
  if (options?.limit != null) cursor.limit(options.limit);
  const rawList = await cursor.toArray();

  const enriched: EnrichedLaborRecord[] = [];
  let skipped = 0;
  for (const raw of rawList as (RawLaborRecord & { _id?: ObjectId })[]) {
    const e = enrichLaborRecord(raw);
    if (e) enriched.push(e);
    else skipped++;
  }

  return { enriched, skipped, total: rawList.length };
}
