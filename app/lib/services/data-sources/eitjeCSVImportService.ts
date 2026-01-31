/**
 * @registry-id: eitjeCSVImportService
 * @created: 2026-01-30T00:00:00.000Z
 * @last-modified: 2026-01-30T00:00:00.000Z
 * @description: Transform Eitje CSV (hours) to Layer 1 raw records and store in test-eitje-hours
 * @last-fix: [2026-01-30] Initial implementation
 *
 * @exports-to:
 *   ✓ app/api/data/import/eitje-csv/route.ts
 *   ✓ app/lib/services/enrichment/laborEnrichmentService.ts (reads test-eitje-hours)
 */

import mongoose from 'mongoose';
import { getDatabase } from '@/lib/mongodb/v2-connection';
import dbConnect from '@/lib/mongodb';
import Member from '@/models/Member';
import Location from '@/models/Location';
import Team from '@/models/Team';
import { ensureDailyOpsCollections } from '@/lib/daily-ops/ensure-collections';
import { parseCSV } from '@/lib/utils/csv-parser';
import type { RawLaborRecord } from '@/lib/types/raw-data.types';

const COLLECTION = 'test-eitje-hours';

function parseDateDDMMYYYY(s: string): Date {
  const parts = (s || '').trim().split(/[/.-]/);
  if (parts.length !== 3) return new Date(NaN);
  const day = parseInt(parts[0], 10);
  const month = parseInt(parts[1], 10) - 1;
  const year = parseInt(parts[2], 10);
  const d = new Date(year, month, day);
  return Number.isNaN(d.getTime()) ? new Date(NaN) : d;
}

function parseHoursHHMM(s: string): number {
  if (!s || typeof s !== 'string') return 0;
  const cleaned = s.replace(/[^\d:]/g, '');
  const [h, m] = cleaned.split(':').map((x) => parseInt(x, 10) || 0);
  return h + m / 60;
}

function parseCurrency(s: string | number): number {
  if (typeof s === 'number' && !Number.isNaN(s)) return s;
  if (!s) return 0;
  const str = String(s).replace(/[^\d,.-]/g, '').replace(',', '.');
  const n = parseFloat(str);
  return Number.isNaN(n) ? 0 : n;
}

export interface EitjeCSVImportResult {
  success: boolean;
  imported: number;
  failed: number;
  errors: Array<{ row: number; error: string }>;
}

/**
 * Import Eitje labour hours CSV (e.g. eitje-gewerkte-uren.csv) into test-eitje-hours.
 * Resolves member by name, location by "naam van vestiging", team by "team naam" + location.
 */
export async function importEitjeHoursCSV(csvText: string): Promise<EitjeCSVImportResult> {
  await dbConnect();
  await ensureDailyOpsCollections();
  const db = await getDatabase();

  const parseResult = await parseCSV(csvText, { autoDetectDelimiter: true });
  if (!parseResult.success || !parseResult.rows?.length) {
    return { success: false, imported: 0, failed: 0, errors: [{ row: 0, error: parseResult.error || 'Parse failed' }] };
  }

  const errors: Array<{ row: number; error: string }> = [];
  let imported = 0;

  for (let i = 0; i < parseResult.rows.length; i++) {
    const row = parseResult.rows[i] as Record<string, string | undefined>;
    const naam = row['naam'] ?? row['Naam'];
    const vestiging = row['naam van vestiging'] ?? row['Naam van vestiging'];
    const teamNaam = row['team naam'] ?? row['Team naam'];
    const datum = row['datum'] ?? row['Datum'];
    const uren = row['uren'] ?? row['Uren'];
    const kosten = row['gerealizeerde loonkosten'] ?? row['Gerealizeerde loonkosten'];
    const kostenPerUur = row['Loonkosten per uur'] ?? row['loonkosten per uur'];
    const contracttype = row['contracttype'] ?? row['Contracttype'] ?? 'nul uren';
    const uurloon = row['uurloon'] ?? row['Uurloon'];
    const type = row['type'] ?? row['Type'] ?? 'gewerkte uren';
    const supportId = row['support ID'] ?? row['Support ID'];

    if (!naam || !vestiging || !teamNaam) {
      errors.push({ row: i + 1, error: 'Missing naam, vestiging or team' });
      continue;
    }

    const date = parseDateDDMMYYYY(datum);
    if (Number.isNaN(date.getTime())) {
      errors.push({ row: i + 1, error: `Invalid date: ${datum}` });
      continue;
    }

    const location = await Location.findOne({ name: vestiging.trim() }).lean();
    if (!location) {
      errors.push({ row: i + 1, error: `Location not found: ${vestiging}` });
      continue;
    }

    const team = await Team.findOne({ name: teamNaam.trim(), location_id: location._id }).lean();
    if (!team) {
      errors.push({ row: i + 1, error: `Team not found: ${teamNaam} at ${vestiging}` });
      continue;
    }

    const member = await Member.findOne({ name: (naam as string).trim() }).lean();
    if (!member) {
      errors.push({ row: i + 1, error: `Member not found: ${naam}` });
      continue;
    }

    const hours = parseHoursHHMM(uren as string);
    const cost = parseCurrency(kosten as string);
    const costPerHour = parseCurrency(kostenPerUur as string);
    const hourlyRate = parseCurrency(uurloon as string);

    const doc: Omit<RawLaborRecord, 'raw_csv' | 'raw_api'> & { raw_csv?: Record<string, unknown>; raw_api?: undefined } = {
      date,
      member_id: member._id as mongoose.Types.ObjectId,
      location_id: location._id as mongoose.Types.ObjectId,
      team_id: team._id as mongoose.Types.ObjectId,
      hours,
      cost,
      hourly_rate: hourlyRate || costPerHour,
      cost_per_hour: costPerHour,
      contract_type: (contracttype as string) || 'nul uren',
      work_type: (type as string) || 'gewerkte uren',
      source: 'eitje-csv',
      support_id: supportId as string,
      imported_at: new Date(),
    };

    try {
      await db.collection(COLLECTION).insertOne(doc);
      imported++;
    } catch (err) {
      errors.push({ row: i + 1, error: err instanceof Error ? err.message : 'Insert failed' });
    }
  }

  return {
    success: errors.length === 0,
    imported,
    failed: errors.length,
    errors,
  };
}
