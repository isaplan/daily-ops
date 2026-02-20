/**
 * Quick script to create and populate daily_ops_dashboard_aggregated collection.
 * Usage: npx tsx scripts/create-daily-ops-aggregated.ts
 */
require('dotenv').config({ path: '.env.local' });
require('dotenv').config();

import { buildDailyAggregation } from '@/lib/services/aggregation/dailyOpsAggregationService';
import { getDatabase } from '@/lib/mongodb/v2-connection';
import { ObjectId } from 'mongodb';

async function main() {
  try {
    console.log('🚀 Creating daily_ops_dashboard_aggregated collection and populating with data...\n');

    // Get DB to fetch locations
    const db = await getDatabase();
    
    // Use "locations" collection (same as Eitje/Bork sync – raw data has locationId from here)
    const locations = await db.collection('locations').find({}).toArray();
    console.log(`📍 Found ${locations.length} location(s): ${locations.map(l => (l as any).name).join(', ')}\n`);

    if (locations.length === 0) {
      console.error('❌ No locations found in locations collection');
      process.exit(1);
    }

    // Use today's date or last 3 days to ensure we have data
    const dates = [];
    for (let i = 0; i < 3; i++) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      dates.push(d.toISOString().split('T')[0]);
    }

    console.log(`📅 Will aggregate for dates: ${dates.join(', ')}\n`);

    // Build aggregation for each location and date
    let successCount = 0;
    for (const location of locations) {
      const locId = (location as any)._id.toString();
      const locName = (location as any).name;

      for (const date of dates) {
        try {
          console.log(`⏳ Aggregating ${locName} / ${date}...`);
          const result = await buildDailyAggregation(date, locId);
          if (result.success) {
            console.log(`  ✅ Dashboard created: ${result.dashboardId}`);
            successCount++;
          } else {
            console.log(`  ⚠️  Skipped: ${result.error}`);
          }
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          console.log(`  ❌ Error: ${msg}`);
        }
      }
    }

    console.log(`\n✨ Done! Created ${successCount} dashboard document(s)\n`);

    // Verify collection now exists
    const collections = await db.listCollections().toArray();
    const exists = collections.some(c => c.name === 'daily_ops_dashboard_aggregated');
    console.log(`📊 Collection daily_ops_dashboard_aggregated exists: ${exists}`);

    if (exists) {
      const count = await db.collection('daily_ops_dashboard_aggregated').countDocuments();
      console.log(`📈 Total documents in collection: ${count}`);
    }

    process.exit(0);
  } catch (err) {
    console.error('❌ Fatal error:', err);
    process.exit(1);
  }
}

main();
