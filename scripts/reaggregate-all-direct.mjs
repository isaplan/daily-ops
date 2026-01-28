/**
 * Direct script to clear and reaggregate all collections
 * Uses ES modules to import the aggregation service directly
 * 
 * Usage: node --loader ts-node/esm scripts/reaggregate-all-direct.mjs
 * Or: npx tsx scripts/reaggregate-all-direct.mjs
 */

import { clearAndReaggregateAll, validateAggregationCounts } from '../app/lib/services/aggregationService.ts';
import { syncAllUnified } from '../app/lib/services/unifiedCollectionsService.ts';

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
    
  } catch (error) {
    console.error('❌ Error during reaggregation:', error);
    if (error.stack) {
      console.error(error.stack);
    }
    process.exit(1);
  }
}

main().catch(console.error);
