/**
 * Script to check unified locations count
 */

// Load environment variables
import { config } from 'dotenv';
import { resolve } from 'path';

config({ path: resolve(process.cwd(), '.env.local') });
config({ path: resolve(process.cwd(), '.env') });

import { getDatabase } from '../app/lib/mongodb/v2-connection';
import dbConnect from '../app/lib/mongodb';

async function main() {
  await dbConnect();
  const db = await getDatabase();
  
  const locations = await db.collection('unified_location').find({}).toArray();
  
  console.log(`\n📊 Total unified locations: ${locations.length}\n`);
  
  const byName = new Map<string, any[]>();
  for (const loc of locations) {
    const name = (loc.canonicalName || 'Unknown').toLowerCase().trim();
    if (!byName.has(name)) {
      byName.set(name, []);
    }
    byName.get(name)!.push(loc);
  }
  
  console.log('Locations by canonical name:');
  for (const [name, locs] of byName.entries()) {
    console.log(`  ${name}: ${locs.length} entry/entries`);
    if (locs.length > 1) {
      console.log(`    ⚠️  DUPLICATE FOUND!`);
      for (const loc of locs) {
        console.log(`      - _id: ${loc._id}, primaryId: ${loc.primaryId}`);
      }
    }
  }
  
  process.exit(0);
}

main();
