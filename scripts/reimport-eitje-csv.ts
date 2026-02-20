/**
 * Reimport Eitje CSV with correct location mapping
 */
import fs from 'fs';
import path from 'path';
import { MongoClient, ObjectId } from 'mongodb';
import Papa from 'papaparse';

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

function matchLocationName(csvName: string): string | null {
  const normalized = csvName.toLowerCase().trim();
  if (normalized.includes('bar') && normalized.includes('bea')) return 'BarBea';
  if (normalized.includes('kinsbergen')) return 'Kinsbergen';
  if (normalized.includes('amour')) return 'lAmour';
  return null;
}

async function run() {
  const client = new MongoClient(process.env.MONGODB_URI || '');
  try {
    await client.connect();
    const db = client.db(process.env.MONGODB_DB || 'daily-ops');

    // Get all locations
    const locations = await db.collection('locations').find({}).toArray();
    const locByName: Record<string, ObjectId> = {};
    locations.forEach((l: any) => {
      locByName[l.name] = l._id;
    });
    console.log('📍 Locations:', Object.keys(locByName));

    // Get members
    const members = await db.collection('members').find({}).toArray();
    const memberByName: Record<string, ObjectId> = {};
    members.forEach((m: any) => {
      memberByName[m.name] = m._id;
    });
    console.log('👤 Members:', Object.keys(memberByName).length);

    // Get teams
    const teams = await db.collection('teams').find({}).toArray();
    const teamByNameAndLoc: Record<string, ObjectId> = {};
    teams.forEach((t: any) => {
      const key = `${t.name}|||${t.location_id}`;
      teamByNameAndLoc[key] = t._id;
    });
    console.log('👥 Teams:', Object.keys(teamByNameAndLoc).length);

    // Read and parse CSV
    const csvPath = path.join(process.cwd(), 'data-sources', 'eitje-gewerkte-uren.csv');
    const csvText = fs.readFileSync(csvPath, 'utf-8');

    const parseResult = Papa.parse(csvText, {
      header: true,
      dynamicTyping: false,
      skipEmptyLines: true,
    });

    if (!parseResult.data || parseResult.data.length === 0) {
      console.error('❌ CSV parse failed');
      process.exit(1);
    }

    console.log('📄 CSV rows:', parseResult.data.length);

    let imported = 0;
    let failed = 0;
    const errors: Array<{ row: number; error: string }> = [];

    for (let i = 0; i < parseResult.data.length; i++) {
      const row: any = parseResult.data[i];

      // Handle BOM in first column
      let datum: string | undefined;
      for (const key of Object.keys(row)) {
        if (key.includes('datum')) {
          datum = row[key];
          break;
        }
      }

      const naam = row['naam'] || row['Naam'];
      const vestiging = row['naam van vestiging'] || row['Naam van vestiging'];
      const teamNaam = row['team naam'] || row['Team naam'];
      const uren = row['uren'] || row['Uren'];
      const kosten = row['gerealizeerde loonkosten'] || row['Gerealizeerde loonkosten'];
      const kostenPerUur = row['Loonkosten per uur'] || row['loonkosten per uur'];

      if (!naam || !vestiging || !teamNaam || !datum) {
        failed++;
        continue;
      }

      // Match location
      const dbLocName = matchLocationName(vestiging);
      if (!dbLocName) {
        errors.push({ row: i + 1, error: `Unknown location: ${vestiging}` });
        failed++;
        continue;
      }

      const locId = locByName[dbLocName];
      if (!locId) {
        errors.push({ row: i + 1, error: `Location not in DB: ${dbLocName}` });
        failed++;
        continue;
      }

      // Parse date
      const date = parseDateDDMMYYYY(datum);
      if (Number.isNaN(date.getTime())) {
        errors.push({ row: i + 1, error: `Invalid date: ${datum}` });
        failed++;
        continue;
      }

      // Find member
      const memberId = memberByName[naam.trim()];
      if (!memberId) {
        errors.push({ row: i + 1, error: `Member not found: ${naam}` });
        failed++;
        continue;
      }

      // Find team
      const teamKey = `${teamNaam.trim()}|||${locId}`;
      const teamId = teamByNameAndLoc[teamKey];
      if (!teamId) {
        errors.push({ row: i + 1, error: `Team not found: ${teamNaam} at ${dbLocName}` });
        failed++;
        continue;
      }

      // Insert
      const doc = {
        date,
        member_id: memberId,
        location_id: locId,
        team_id: teamId,
        hours: parseHoursHHMM(uren),
        cost: parseCurrency(kosten),
        hourly_rate: parseCurrency(kostenPerUur),
        cost_per_hour: parseCurrency(kostenPerUur),
        contract_type: 'uren contract',
        work_type: 'gewerkte uren',
        source: 'eitje-csv',
        imported_at: new Date(),
      };

      try {
        await db.collection('test-eitje-hours').insertOne(doc);
        imported++;
      } catch (err) {
        errors.push({ row: i + 1, error: err instanceof Error ? err.message : 'Insert failed' });
        failed++;
      }
    }

    console.log('\n✅ Import complete');
    console.log('   Imported:', imported);
    console.log('   Failed:', failed);
    if (errors.length > 0) {
      console.log(`\n❌ Errors (showing first 30 of ${errors.length}):`);
      errors.slice(0, 30).forEach((e) => console.log(`   Row ${e.row}: ${e.error}`));
    }
  } finally {
    await client.close();
  }
}

run().catch(console.error);
