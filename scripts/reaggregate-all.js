/**
 * Script to clear and reaggregate all collections
 * This ensures no duplicates remain after fixing the aggregation logic
 * 
 * Usage: node scripts/reaggregate-all.js
 * 
 * Note: This requires the Next.js server to be running, or you can use the direct import approach
 */

async function reaggregateAll() {
  try {
    // Try to call the API endpoint (requires server to be running)
    const baseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';
    
    console.log('Calling aggregation API endpoint...');
    console.log(`URL: ${baseUrl}/api/aggregations/sync`);
    
    const response = await fetch(`${baseUrl}/api/aggregations/sync`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        clearAndReaggregate: true,
        validate: true,
        syncUnified: true,
        useTrigger: false, // Direct aggregation, no change detection
        aggregationTypes: ['time_registration', 'planning_registration', 'team', 'location', 'user', 'event'],
        periods: ['day', 'week', 'month', 'year'],
      }),
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`API call failed: ${response.status} ${response.statusText}\n${errorText}`);
    }
    
    const result = await response.json();
    
    console.log('\n=== Reaggregation Results ===');
    console.log(JSON.stringify(result, null, 2));
    
    if (result.success) {
      console.log('\n✅ Reaggregation completed successfully!');
      
      if (result.results.cleared) {
        console.log('\n📋 Cleared collections:');
        result.results.cleared.forEach((msg) => {
          console.log(`  - ${msg}`);
        });
      }
      
      if (result.results.validation) {
        if (result.results.validation.valid) {
          console.log('\n✅ Validation passed: No duplicate issues detected');
        } else {
          console.log('\n⚠️  Validation issues found:');
          result.results.validation.issues.forEach((issue) => {
            console.log(`  - ${issue.collection}: ${issue.issue}`);
          });
        }
      }
      
      // Summary
      const totals = result.results.aggregations;
      console.log('\n📊 Summary:');
      console.log(`  - Records processed: ${totals.totalProcessed}`);
      console.log(`  - Records created: ${totals.totalCreated}`);
      console.log(`  - Records updated: ${totals.totalUpdated}`);
    } else {
      console.error('❌ Reaggregation failed:', result.error);
      process.exit(1);
    }
  } catch (error) {
    if (error.code === 'ECONNREFUSED') {
      console.error('❌ Connection refused. Is the Next.js server running?');
      console.error('   Start the server with: npm run dev');
      console.error('\n   Or use the API endpoint directly:');
      console.error('   curl -X POST http://localhost:3000/api/aggregations/sync \\');
      console.error('     -H "Content-Type: application/json" \\');
      console.error('     -d \'{"clearAndReaggregate": true, "validate": true}\'');
    } else {
      console.error('Error:', error.message);
      if (error.stack) {
        console.error(error.stack);
      }
    }
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  reaggregateAll().catch(console.error);
}

module.exports = { reaggregateAll };
