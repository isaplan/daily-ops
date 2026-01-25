/**
 * Script to sync unified locations and merge duplicates
 */

// Load environment variables
import { config } from 'dotenv';
import { resolve } from 'path';

config({ path: resolve(process.cwd(), '.env.local') });
config({ path: resolve(process.cwd(), '.env') });

import { syncUnifiedLocations } from '../app/lib/services/unifiedCollectionsService';

async function main() {
  console.log('Starting unified locations sync...');
  try {
    const result = await syncUnifiedLocations();
    console.log('✅ Sync completed!');
    console.log(`   Created: ${result.created}`);
    console.log(`   Updated: ${result.updated}`);
    process.exit(0);
  } catch (error) {
    console.error('❌ Sync failed:', error);
    process.exit(1);
  }
}

main();
