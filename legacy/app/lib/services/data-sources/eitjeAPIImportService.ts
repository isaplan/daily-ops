/**
 * @registry-id: eitjeAPIImportService
 * @created: 2026-01-30T00:00:00.000Z
 * @last-modified: 2026-01-30T00:00:00.000Z
 * @description: Transform Eitje API shift data to Layer 1 raw records and store in test-eitje-hours
 * @last-fix: [2026-01-30] Initial implementation
 *
 * @exports-to:
 *   ✓ app/api/cron/sync/api-snapshot/route.ts (when Eitje API data is available)
 *   ✓ app/lib/services/enrichment/laborEnrichmentService.ts (reads test-eitje-hours)
 */

import type { ObjectId } from 'mongodb';
import mongoose from 'mongoose';
import { getDatabase } from '@/lib/mongodb/v2-connection';
import Member from '@/models/Member';
import Location from '@/models/Location';
import Team from '@/models/Team';
import { ensureDailyOpsCollections } from '@/lib/daily-ops/ensure-collections';
import type { RawLaborRecord } from '@/lib/types/raw-data.types';

const COLLECTION = 'test-eitje-hours';

export interface EitjeAPIShift {
  id?: string;
  employee?: { id?: string; name?: string; email?: string };
  shift?: { date?: string; startTime?: string; endTime?: string; duration?: number };
  location?: { id?: string; name?: string };
  team?: { id?: string; name?: string };
  labor?: { hourlyRate?: number; totalCost?: number };
  status?: string;
}

export interface EitjeAPIImportResult {
  success: boolean;
  imported: number;
  failed: number;
  errors: Array<{ index: number; error: string }>;
}

/**
 * Import Eitje API shift data into test-eitje-hours.
 * Resolves member by name, location by name, team by name + location.
 */
export async function importEitjeAPIShifts(
  shifts: EitjeAPIShift[],
  locationId: string
): Promise<EitjeAPIImportResult> {
  const db = await getDatabase();
  await ensureDailyOpsCollections();

  const locId = new mongoose.Types.ObjectId(locationId);
  const location = await Location.findById(locId).lean();
  if (!location) {
    return { success: false, imported: 0, failed: shifts.length, errors: [{ index: 0, error: 'Location not found' }] };
  }

  const errors: Array<{ index: number; error: string }> = [];
  let imported = 0;

  for (let i = 0; i < shifts.length; i++) {
    const shift = shifts[i];
    const empName = shift?.employee?.name;
    const teamName = shift?.team?.name;
    const dateStr = shift?.shift?.date;
    const duration = typeof shift?.shift?.duration === 'number' ? shift.shift.duration : 0;
    const totalCost = typeof shift?.labor?.totalCost === 'number' ? shift.labor.totalCost : 0;
    const hourlyRate = typeof shift?.labor?.hourlyRate === 'number' ? shift.labor.hourlyRate : 0;

    if (!empName) {
      errors.push({ index: i, error: 'Missing employee name' });
      continue;
    }

    const member = await Member.findOne({ name: empName.trim() }).lean();
    if (!member) {
      errors.push({ index: i, error: `Member not found: ${empName}` });
      continue;
    }

    const team = teamName
      ? await Team.findOne({ name: teamName.trim(), location_id: locId }).lean()
      : null;
    const teamId = team?._id ?? (await Team.findOne({ location_id: locId }).lean())?._id;
    if (!teamId) {
      errors.push({ index: i, error: 'No team found for location' });
      continue;
    }

    const date = dateStr ? new Date(dateStr) : new Date();
    if (Number.isNaN(date.getTime())) {
      errors.push({ index: i, error: 'Invalid date' });
      continue;
    }

    const doc: Omit<RawLaborRecord, 'raw_csv'> & { raw_api?: EitjeAPIShift } = {
      date,
      member_id: member._id as ObjectId,
      location_id: locId as ObjectId,
      team_id: teamId as ObjectId,
      hours: duration,
      cost: totalCost,
      hourly_rate: hourlyRate,
      cost_per_hour: duration > 0 ? totalCost / duration : 0,
      contract_type: 'uren contract',
      work_type: 'gewerkte uren',
      source: 'eitje-api',
      external_id: shift?.id,
      imported_at: new Date(),
      raw_api: shift,
    };

    try {
      await db.collection(COLLECTION).insertOne(doc);
      imported++;
    } catch (err) {
      errors.push({ index: i, error: err instanceof Error ? err.message : 'Insert failed' });
    }
  }

  return {
    success: errors.length === 0,
    imported,
    failed: errors.length,
    errors,
  };
}
