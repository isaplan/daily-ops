/**
 * Script to update location abbreviations
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
  
  console.log('Updating location abbreviations...\n');
  
  const abbreviations: Record<string, string> = {
    'Van Kinsbergen': 'VKB',
    "l'Amour Toujours": 'LAT',
    'Bar Bea': 'BEA',
  };
  
  for (const loc of locations) {
    const canonicalName = loc.canonicalName || loc.primaryName;
    const expectedAbbrev = abbreviations[canonicalName];
    
    if (expectedAbbrev && loc.abbreviation !== expectedAbbrev) {
      await db.collection('unified_location').updateOne(
        { _id: loc._id },
        { $set: { abbreviation: expectedAbbrev } }
      );
      console.log(`✅ Updated ${canonicalName}: ${loc.abbreviation || 'N/A'} → ${expectedAbbrev}`);
    } else if (expectedAbbrev) {
      console.log(`✓ ${canonicalName}: already has abbreviation ${expectedAbbrev}`);
    }
  }
  
  console.log('\n✅ Abbreviation update complete!\n');
  process.exit(0);
}

main();
