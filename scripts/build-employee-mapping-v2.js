const { MongoClient } = require('mongodb');
const fs = require('fs');
const Papa = require('papaparse');

async function main() {
  const client = new MongoClient('mongodb://localhost:27017');
  try {
    await client.connect();
    const db = client.db('daily-ops');
    
    console.log('🔗 Building comprehensive employee mapping\n');
    
    // Parse CSVs properly
    const hoursContent = fs.readFileSync('/Users/alviniomolina/Documents/GitHub/daily-ops/data-sources/eitje-gewerkte-uren.csv', 'utf-8');
    const contractContent = fs.readFileSync('/Users/alviniomolina/Documents/GitHub/daily-ops/data-sources/eitje-werknemer-contract.csv', 'utf-8');
    
    const hoursData = Papa.parse(hoursContent, { header: true, skipEmptyLines: true }).data;
    const contractData = Papa.parse(contractContent, { header: true, skipEmptyLines: true }).data;
    
    console.log(`✓ Parsed hours CSV: ${hoursData.length} records`);
    console.log(`✓ Parsed contract CSV: ${contractData.length} records\n`);
    
    // Build map from both sources
    const employeesByName = new Map();
    
    // From hours CSV
    hoursData.forEach(record => {
      const name = record['naam']?.trim();
      const supportId = parseInt(record['support ID']);
      if (name && !isNaN(supportId)) {
        if (!employeesByName.has(name)) {
          employeesByName.set(name, { name, supportIds: new Set() });
        }
        employeesByName.get(name).supportIds.add(supportId);
      }
    });
    
    // From contract CSV (adds more details)
    contractData.forEach(record => {
      const name = record['naam']?.trim();
      const supportId = parseInt(record['support ID']);
      if (name && !isNaN(supportId)) {
        if (!employeesByName.has(name)) {
          employeesByName.set(name, { 
            name, 
            supportIds: new Set([supportId]),
            contractType: record['contracttype'],
            hourlyRate: parseFloat(record['uurloon']?.replace('€', '').replace(',', '.')) || null,
          });
        } else {
          employeesByName.get(name).supportIds.add(supportId);
          if (!employeesByName.get(name).contractType) {
            employeesByName.get(name).contractType = record['contracttype'];
          }
          if (!employeesByName.get(name).hourlyRate && record['uurloon']) {
            employeesByName.get(name).hourlyRate = parseFloat(record['uurloon'].replace('€', '').replace(',', '.'));
          }
        }
      }
    });
    
    console.log(`✓ Built employee map: ${employeesByName.size} unique names\n`);
    
    // Update unified_user collection with names
    let updated = 0;
    
    for (const [name, emp] of employeesByName.entries()) {
      const supportIds = Array.from(emp.supportIds);
      
      try {
        // Update by support_id
        const result = await db.collection('unified_user').updateMany(
          { support_id: { $in: supportIds } },
          {
            $set: {
              canonicalName: name,
              eitjeNames: [name],
            }
          }
        );
        
        updated += result.modifiedCount;
      } catch (e) {
        console.error(`Error updating ${name}:`, e.message);
      }
    }
    
    console.log(`✅ Updated ${updated} unified_user records with proper names\n`);
    
    // Verify
    const withNames = await db.collection('unified_user')
      .find({ canonicalName: { $ne: 'Unknown' } })
      .countDocuments();
    
    const withRates = await db.collection('unified_user')
      .find({ hourly_rate: { $ne: null } })
      .countDocuments();
    
    console.log(`📊 Stats:`);
    console.log(`  - unified_user with names: ${withNames}`);
    console.log(`  - unified_user with rates: ${withRates}`);
    
    // Show samples
    console.log('\n📋 Sample records:');
    const samples = await db.collection('unified_user')
      .find({ canonicalName: { $ne: 'Unknown' } })
      .limit(15)
      .toArray();
    
    samples.forEach((u, i) => {
      console.log(`${i + 1}. ${u.canonicalName}`);
      console.log(`   €${u.hourly_rate}/hr | ${u.contract_type}`);
    });
    
  } finally {
    await client.close();
  }
}

main().catch(console.error);
