/**
 * Full aggregation script: finds all dates in raw data and aggregates missing ones.
 * Now with PRE-VALIDATION step to catch data issues early.
 * Usage: npx tsx scripts/full-aggregation.ts [--rebuild-all]
 */
require('dotenv').config({ path: '.env.local' });
require('dotenv').config();

import { buildDailyAggregation } from '@/lib/services/aggregation/dailyOpsAggregationService';
import { runFullValidation } from '@/lib/services/aggregation/aggregationValidationService';
import { getDatabase } from '@/lib/mongodb/v2-connection';
import { ObjectId } from 'mongodb';

async function findAllDatesInRawData(): Promise<Set<string>> {
  const db = await getDatabase();
  const dates = new Set<string>();

  // 1) Daily Ops test collections (what aggregation currently reads)
  for (const colName of ['test-eitje-hours', 'test-eitje-contracts', 'test-bork-sales-unified']) {
    try {
      const docs = await db.collection(colName).find({}).toArray();
      for (const doc of docs) {
        const dateField = doc.date || doc.period || doc.Date || doc.created_at;
        if (dateField) {
          dates.add(new Date(dateField).toISOString().split('T')[0]);
        }
      }
    } catch {
      // Collection might not exist
    }
  }

  // 2) Eitje sync target: eitje_raw_data (time_registration_shifts) – historical sync writes here
  try {
    const eitjeDocs = await db
      .collection('eitje_raw_data')
      .find({ endpoint: 'time_registration_shifts' }, { projection: { date: 1 } })
      .toArray();
    for (const doc of eitjeDocs) {
      const d = doc.date;
      if (d) dates.add(new Date(d).toISOString().split('T')[0]);
    }
  } catch {
    // Collection might not exist
  }

  // 3) Bork sync target: bork_raw_data – historical sync writes here
  try {
    const borkDocs = await db.collection('bork_raw_data').find({}, { projection: { date: 1 } }).toArray();
    for (const doc of borkDocs) {
      const d = doc.date;
      if (d) dates.add(new Date(d).toISOString().split('T')[0]);
    }
  } catch {
    // Collection might not exist
  }

  return dates;
}

/** Returns set of "date|locationId" for docs in aggregated collection. */
async function findAggregatedDateLocationPairs(
  validLocationIds: Set<string>
): Promise<Set<string>> {
  const db = await getDatabase();
  const docs = await db
    .collection('daily_ops_dashboard_aggregated')
    .find({}, { projection: { date: 1, location_id: 1 } })
    .toArray();
  const pairs = new Set<string>();
  for (const d of docs as { date: string; location_id: { toString(): string } }[]) {
    const lid = d.location_id?.toString();
    if (lid && validLocationIds.has(lid)) {
      pairs.add(`${d.date}|${lid}`);
    }
  }
  return pairs;
}

async function main() {
  try {
    const rebuildAll = process.argv.includes('--rebuild-all') || process.env.REBUILD_ALL === '1';
    console.log(rebuildAll ? '🚀 Full Reaggregation (rebuild all)\n' : '🚀 Full Historical Aggregation\n');

    // PRE-VALIDATION: Check data integrity before aggregating
    const validation = await runFullValidation();
    if (!validation.success) {
      console.log('\n⚠️  Pre-validation FAILED - Aborting aggregation');
      console.log('Fix the issues above and try again.\n');
      process.exit(1);
    }
    console.log('✅ Pre-validation PASSED - Proceeding with aggregation\n');

    // Step 1: Find all raw data dates
    console.log('📍 Scanning raw data for all unique dates...');
    const rawDates = await findAllDatesInRawData();
    console.log(`   Found ${rawDates.size} unique date(s) in raw data: ${Array.from(rawDates).sort().join(', ')}\n`);

    // Step 2: Get locations (must use "locations" – same as Eitje/Bork sync writes locationId from)
    const db = await getDatabase();
    const locations = await db.collection('locations').find({}).toArray();
    const validLocationIds = new Set(locations.map((l: any) => l._id.toString()));
    console.log(`📍 Locations (from "locations"): ${locations.length}\n`);

    // Step 3: Remove wrong location_id docs; if --rebuild-all, clear all for valid locations so every pair is rebuilt
    if (rebuildAll) {
      const deleteResult = await db.collection('daily_ops_dashboard_aggregated').deleteMany({
        location_id: { $in: locations.map((l: any) => l._id) },
      });
      console.log(`🗑️  Rebuild all: cleared ${deleteResult.deletedCount} doc(s).\n`);
    } else {
      const deleteResult = await db.collection('daily_ops_dashboard_aggregated').deleteMany({
        location_id: { $nin: locations.map((l: any) => l._id) },
      });
      if (deleteResult.deletedCount > 0) {
        console.log(`🗑️  Removed ${deleteResult.deletedCount} doc(s) with wrong location_id.\n`);
      }
    }

    // Step 4: Find already aggregated (date, location) pairs (only for valid locations)
    console.log('📊 Checking which (date, location) are already aggregated...');
    const aggPairs = await findAggregatedDateLocationPairs(validLocationIds);
    console.log(`   Already aggregated: ${aggPairs.size} (date, location) pair(s)\n`);

    // Step 5: Build aggregation for each (date, location) that is missing
    const defaultLocationId = locations.length > 0 ? (locations[0] as any)._id.toString() : undefined;
    const missingDates = Array.from(rawDates).sort();
    let successCount = 0;
    let built = 0;
    for (const date of missingDates) {
      for (const location of locations) {
        const locId = (location as any)._id.toString();
        const key = `${date}|${locId}`;
        if (aggPairs.has(key)) continue;
        const locName = (location as any).name || 'Unknown';
        built++;
        try {
          if (built <= 5 || built % 20 === 0) {
            console.log(`⏳ Aggregating ${locName} / ${date}...`);
          }
          const result = await buildDailyAggregation(date, locId, { defaultLocationId });
          if (result.success) {
            successCount++;
            aggPairs.add(key);
            if (built <= 5 || built % 20 === 0) console.log(`  ✅ Success`);
          } else {
            if (built <= 5 || built % 20 === 0) console.log(`  ⚠️  Skipped: ${result.error}`);
          }
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          if (built <= 5 || built % 20 === 0) console.log(`  ❌ Error: ${msg}`);
        }
      }
    }

    console.log(`\n✨ Aggregation complete! Created ${successCount} dashboard document(s)\n`);

    // Step 6: Final verification
    const finalCount = await db.collection('daily_ops_dashboard_aggregated').countDocuments();
    const finalPairs = await findAggregatedDateLocationPairs(validLocationIds);
    const uniqueDates = new Set([...finalPairs].map((k) => k.split('|')[0]));
    console.log(`📈 Final state:`);
    console.log(`   Total documents: ${finalCount}`);
    console.log(`   (date, location) pairs: ${finalPairs.size}`);
    console.log(`   Unique dates: ${uniqueDates.size}`);

    process.exit(0);
  } catch (err) {
    console.error('❌ Fatal error:', err);
    process.exit(1);
  }
}

main();
