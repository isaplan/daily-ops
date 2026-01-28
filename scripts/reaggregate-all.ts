/**
 * Direct script to clear and reaggregate all collections
 * 
 * Usage: npx tsx scripts/reaggregate-all.ts
 * Or: ts-node scripts/reaggregate-all.ts
 */

// Load environment variables
import { config } from 'dotenv';
import { resolve } from 'path';

// Try to load .env.local first, then .env
config({ path: resolve(process.cwd(), '.env.local') });
config({ path: resolve(process.cwd(), '.env') });

import { clearAndReaggregateAll, validateAggregationCounts } from '../app/lib/services/aggregationService';
import { syncAllUnified } from '../app/lib/services/unifiedCollectionsService';

async function main() {
  try {
    console.log('🚀 Starting full reaggregation...\n');
    
    // Clear and reaggregate all
    const result = await clearAndReaggregateAll(
      undefined, // startDate
      undefined, // endDate
      ['time_registration', 'planning_registration', 'team', 'location', 'user', 'event'],
      ['day', 'week', 'month', 'year']
    );
    
    console.log('\n📋 Cleared collections:');
    result.cleared.forEach((msg) => {
      console.log(`  - ${msg}`);
    });
    
    console.log('\n📊 Aggregation results:');
    const summary = result.results.reduce((acc, r) => {
      acc.processed += r.recordsProcessed;
      acc.created += r.recordsCreated;
      acc.updated += r.recordsUpdated;
      return acc;
    }, { processed: 0, created: 0, updated: 0 });
    
    console.log(`  - Records processed: ${summary.processed}`);
    console.log(`  - Records created: ${summary.created}`);
    console.log(`  - Records updated: ${summary.updated}`);
    
    // Validation
    console.log('\n🔍 Validation results:');
    if (result.validation.valid) {
      console.log('  ✅ Validation passed: No duplicate issues detected');
    } else {
      console.log('  ⚠️  Validation issues found:');
      result.validation.issues.forEach((issue) => {
        console.log(`    - ${issue.collection}: ${issue.issue}`);
      });
    }
    
    // Sync unified collections
    console.log('\n🔄 Syncing unified collections...');
    const unifiedResult = await syncAllUnified();
    console.log(`  - Locations: ${unifiedResult.locations.created} created, ${unifiedResult.locations.updated} updated`);
    console.log(`  - Teams: ${unifiedResult.teams.created} created, ${unifiedResult.teams.updated} updated`);
    console.log(`  - Users: ${unifiedResult.users.created} created, ${unifiedResult.users.updated} updated`);
    
    // Final validation
    console.log('\n🔍 Final validation...');
    const finalValidation = await validateAggregationCounts();
    if (finalValidation.valid) {
      console.log('  ✅ Final validation passed: No duplicate issues detected');
    } else {
      console.log('  ⚠️  Final validation issues:');
      finalValidation.issues.forEach((issue) => {
        console.log(`    - ${issue.collection}: ${issue.issue}`);
      });
    }
    
    console.log('\n✅ Reaggregation completed successfully!');
    
  } catch (error: any) {
    console.error('❌ Error during reaggregation:', error);
    if (error.stack) {
      console.error(error.stack);
    }
    process.exit(1);
  }
}

main().catch(console.error);
