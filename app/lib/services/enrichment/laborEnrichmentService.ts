/**
 * @registry-id: laborEnrichmentService
 * @created: 2026-01-30T00:00:00.000Z
 * @last-modified: 2026-02-02T00:00:00.000Z
 * @description: Add names to raw labor records (Layer 1 to Layer 2) using master data cache
 * @last-fix: [2026-02-02] REVERTED: Removed environment-based matching - keep location boundary by querying locationId only
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
  const dateStr = date.toISOString().slice(0, 10);

  const filter: Record<string, unknown> = {
    $or: [
      { date: { $gte: start, $lte: end } },
      { date: dateStr },
    ],
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

const EITJE_RAW_COLLECTION = 'eitje_raw_data';

/**
 * Load labor from eitje_raw_data (Eitje sync target) when test-eitje-hours has no data.
 * Uses unified_user, unified_location, unified_team for names. Call when enrichLaborBatch returns 0.
 * When defaultLocationId is set and equals locationId, also includes docs where locationId is null (sync fallback).
 * When eitjeIds is set (from unified_location for this location), also matches docs with locationId null and environmentId in eitjeIds.
 */
export async function enrichLaborBatchFromEitjeRaw(
  date: Date,
  locationId: ObjectId,
  options?: { defaultLocationId?: ObjectId }
): Promise<EnrichLaborBatchResult> {
  const db = await getDatabase();
  const start = new Date(date);
  start.setHours(0, 0, 0, 0);
  const end = new Date(date);
  end.setHours(23, 59, 59, 999);

  const isDefault =
    options?.defaultLocationId != null && options.defaultLocationId.toString() === locationId.toString();

  let locationMatch: Record<string, unknown>;
  if (isDefault) {
    locationMatch = { $or: [{ locationId }, { locationId: null }, { locationId: { $exists: false } }] };
  } else {
    locationMatch = { locationId };
  }

  const pipeline: object[] = [
    {
      $match: {
        endpoint: 'time_registration_shifts',
        date: { $gte: start, $lte: end },
        ...locationMatch,
      },
    },
    {
      $addFields: {
        _userId: { $ifNull: ['$extracted.userId', '$rawApiResponse.user_id'] },
        _teamId: { $ifNull: ['$extracted.teamId', '$rawApiResponse.team_id'] },
        _hours: {
          $ifNull: [
            { $toDouble: '$extracted.hours' },
            {
              $ifNull: [
                { $toDouble: '$extracted.hoursWorked' },
                {
                  $ifNull: [
                    { $toDouble: '$rawApiResponse.hours' },
                    {
                      $cond: [
                        {
                          $and: [
                            { $ne: ['$rawApiResponse.start', null] },
                            { $ne: ['$rawApiResponse.end', null] },
                          ],
                        },
                        {
                          $subtract: [
                            {
                              $divide: [
                                {
                                  $subtract: [
                                    { $toDate: '$rawApiResponse.end' },
                                    { $toDate: '$rawApiResponse.start' },
                                  ],
                                },
                                3600000,
                              ],
                            },
                            { $divide: [{ $ifNull: [{ $toDouble: '$rawApiResponse.break_minutes' }, 0] }, 60] },
                          ],
                        },
                        0,
                      ],
                    },
                  ],
                },
              ],
            },
          ],
        },
      },
    },
    {
      $lookup: {
        from: 'unified_user',
        let: { userId: '$_userId' },
        pipeline: [
          {
            $match: {
              $expr: {
                $or: [
                  { $in: ['$$userId', { $ifNull: ['$allIdValues', []] }] },
                  { $in: ['$$userId', { $ifNull: ['$eitjeIds', []] }] },
                ],
              },
            },
          },
        ],
        as: 'user_unified',
      },
    },
    { $unwind: { path: '$user_unified', preserveNullAndEmptyArrays: true } },
    {
      $lookup: {
        from: 'unified_location',
        let: { locId: '$locationId' },
        pipeline: [{
          $match: {
            $expr: {
              $or: [
                { $eq: ['$primaryId', '$$locId'] },
                { $in: ['$$locId', { $ifNull: ['$allIdValues', []] }] },
              ],
            },
          },
        }],
        as: 'location_unified',
      },
    },
    { $unwind: { path: '$location_unified', preserveNullAndEmptyArrays: true } },
    {
      $lookup: {
        from: 'unified_team',
        let: { teamId: '$_teamId' },
        pipeline: [
          { $match: { $expr: { $or: [{ $in: ['$$teamId', { $ifNull: ['$allIdValues', []] }] }, { $in: ['$$teamId', { $ifNull: ['$eitjeIds', []] }] }] } } },
        ],
        as: 'team_unified',
      },
    },
    { $unwind: { path: '$team_unified', preserveNullAndEmptyArrays: true } },
    {
      $addFields: {
        hourly_rate: {
          $ifNull: [
            { $toDouble: '$user_unified.hourly_rate' },
            { $ifNull: [
              { $toDouble: '$extracted.hourlyRate' },
              { $ifNull: [{ $toDouble: '$rawApiResponse.hourly_rate' }, 0] },
            ] },
          ],
        },
      },
    },
    {
      $addFields: {
        cost: {
          $cond: [
            { $gt: ['$_hours', 0] },
            { $multiply: ['$_hours', { $ifNull: ['$hourly_rate', 0] }] },
            { $ifNull: [{ $toDouble: '$extracted.amount' }, { $ifNull: [{ $toDouble: '$rawApiResponse.total_cost' }, 0] }] },
          ],
        },
      },
    },
    {
      $project: {
        date: 1,
        member_id: { $ifNull: ['$user_unified.primaryId', '$user_unified._id'] },
        member_name: {
          $ifNull: [
            '$user_unified.canonicalName',
            { $ifNull: ['$user_unified.primaryName', 'Unknown'] },
          ],
        },
        member_role: 'staff',
        location_id: { $ifNull: ['$location_unified.primaryId', '$locationId'] },
        location_name: {
          $ifNull: [
            '$location_unified.canonicalName',
            { $ifNull: ['$location_unified.primaryName', 'Unknown'] },
          ],
        },
        team_id: { $ifNull: ['$team_unified.primaryId', '$team_unified._id'] },
        team_name: {
          $ifNull: [
            '$team_unified.canonicalName',
            { $ifNull: ['$team_unified.primaryName', 'Unknown'] },
          ],
        },
        hours: '$_hours',
        cost: 1,
        hourly_rate: 1,
        contract_type: { $ifNull: ['$user_unified.contract_type', 'employee'] },
        source: { $literal: 'eitje-api' },
        support_id: { $ifNull: ['$extracted.supportId', '$rawApiResponse.support_id'] },
      },
    },
  ];

  const docs = await db.collection(EITJE_RAW_COLLECTION).aggregate(pipeline).toArray();

  const enriched: EnrichedLaborRecord[] = [];
  for (const d of docs as any[]) {
    if (d.member_id == null) continue;
    const resolvedLocationId = d.location_id ?? locationId;
    const teamId = d.team_id ?? resolvedLocationId;
    enriched.push({
      date: d.date,
      member_id: d.member_id,
      member_name: d.member_name ?? 'Unknown',
      member_role: d.member_role ?? 'staff',
      location_id: resolvedLocationId,
      location_name: d.location_name ?? 'Unknown',
      team_id: teamId,
      team_name: d.team_name ?? 'Unknown',
      hours: Number(d.hours) || 0,
      cost: Number(d.cost) || 0,
      hourly_rate: Number(d.hourly_rate) || 0,
      contract_type: d.contract_type ?? 'employee',
      source: 'eitje-api',
      support_id: d.support_id,
    });
  }

  return { enriched, skipped: docs.length - enriched.length, total: docs.length };
}
