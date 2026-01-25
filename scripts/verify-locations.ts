/**
 * Script to verify unified locations structure
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
  
  console.log(`\n✅ Total unified locations: ${locations.length}\n`);
  
  for (const loc of locations) {
    console.log(`📍 ${loc.canonicalName || loc.primaryName}`);
    console.log(`   - primaryId: ${loc.primaryId}`);
    console.log(`   - abbreviation: ${loc.abbreviation || 'N/A'}`);
    console.log(`   - eitjeIds: ${JSON.stringify(loc.eitjeIds || [])}`);
    console.log(`   - eitjeNames: ${JSON.stringify(loc.eitjeNames || [])}`);
    console.log(`   - isActive: ${loc.isActive}`);
    console.log('');
  }
  
  // Verify no duplicates
  const byName = new Map<string, any[]>();
  for (const loc of locations) {
    const name = (loc.canonicalName || 'Unknown').toLowerCase().trim();
    if (!byName.has(name)) {
      byName.set(name, []);
    }
    byName.get(name)!.push(loc);
  }
  
  const duplicates = Array.from(byName.entries()).filter(([_, locs]) => locs.length > 1);
  if (duplicates.length > 0) {
    console.log('❌ DUPLICATES FOUND:');
    for (const [name, locs] of duplicates) {
      console.log(`   ${name}: ${locs.length} entries`);
    }
    process.exit(1);
  } else {
    console.log('✅ No duplicates found - each location has exactly 1 document!\n');
  }
  
  process.exit(0);
}

main();
