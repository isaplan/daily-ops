const { MongoClient } = require('mongodb');
const fs = require('fs');
const path = require('path');

// Simple CSV parser
function parseCSV(filePath) {
  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.trim().split('\n');
  const header = lines[0].split(',').map(h => h.trim().replace(/^▲\s*/, ''));
  
  const records = [];
  for (let i = 1; i < lines.length; i++) {
    const values = lines[i].split(',').map(v => v.trim());
    const record = {};
    header.forEach((key, idx) => {
      record[key] = values[idx] || null;
    });
    records.push(record);
  }
  return records;
}

// Parse hourly wage from string like "€16,95"
function parseEuro(str) {
  if (!str) return null;
  const match = str.match(/[\d,]+/);
  if (!match) return null;
  return parseFloat(match[0].replace(',', '.'));
}

// Parse hours like "38:00" to decimal hours
function parseHours(str) {
  if (!str) return 0;
  const parts = str.split(':');
  if (parts.length !== 2) return 0;
  const hours = parseInt(parts[0]) || 0;
  const minutes = parseInt(parts[1]) || 0;
  return hours + (minutes / 60);
}

async function main() {
  const client = new MongoClient('mongodb://localhost:27017');
  try {
    await client.connect();
    const db = client.db('daily-ops');
    
    console.log('📖 Parsing contract CSV...');
    const contractData = parseCSV('/Users/alviniomolina/Documents/GitHub/daily-ops/data-sources/eitje-werknemer-contract.csv');
    console.log(`✓ Parsed ${contractData.length} records`);
    
    console.log('\n📖 Parsing hours CSV...');
    const hoursData = parseCSV('/Users/alviniomolina/Documents/GitHub/daily-ops/data-sources/eitje-gewerkte-uren.csv');
    console.log(`✓ Parsed ${hoursData.length} records`);
    
    // Build a map of support_id -> contract info
    const contractMap = new Map();
    contractData.forEach(record => {
      const supportId = record['support ID'];
      if (supportId && !contractMap.has(supportId)) {
        contractMap.set(supportId, {
          name: record['naam'],
          contractType: record['contracttype'],
          uurloon: parseEuro(record['uurloon']),
          wekelijksContracturen: parseHours(record['wekelijkse contracturen']),
          contractVestiging: record['contractvestiging'],
        });
      }
    });
    
    console.log(`\n✓ Built contract map with ${contractMap.size} unique employees`);
    
    // Build a map of name -> [hourly_rates] from hours CSV
    const hoursMap = new Map();
    hoursData.forEach(record => {
      const name = record['naam'];
      const supportId = record['support ID'];
      const uurloon = parseEuro(record['uurloon']);
      const hours = parseHours(record['uren']);
      
      if (name && uurloon) {
        if (!hoursMap.has(name)) {
          hoursMap.set(name, { rates: new Set(), supportIds: new Set(), totalHours: 0 });
        }
        hoursMap.get(name).rates.add(uurloon);
        if (supportId) hoursMap.get(name).supportIds.add(supportId);
        hoursMap.get(name).totalHours += hours;
      }
    });
    
    console.log(`✓ Built hours map with wage info for ${hoursMap.size} employees`);
    
    // Update unified_user collection
    let updated = 0;
    let errors = 0;
    
    for (const [supportId, contract] of contractMap.entries()) {
      try {
        const result = await db.collection('unified_user').updateMany(
          { allIdValues: parseInt(supportId) },
          {
            $set: {
              hourly_rate: contract.uurloon,
              contract_type: contract.contractType,
              weekly_contract_hours: contract.wekelijksContracturen,
              contract_location: contract.contractVestiging,
              support_id: supportId,
              updated_via_csv: new Date(),
            }
          }
        );
        
        if (result.modifiedCount > 0) {
          updated += result.modifiedCount;
        }
      } catch (e) {
        console.error(`Error updating support_id ${supportId}:`, e.message);
        errors++;
      }
    }
    
    console.log(`\n✅ Updated ${updated} unified_user records`);
    console.log(`⚠️  Errors: ${errors}`);
    
    // Show sample of updated records
    console.log('\n📊 Sample updated records:');
    const samples = await db.collection('unified_user')
      .find({ updated_via_csv: { $exists: true } })
      .limit(5)
      .toArray();
    
    samples.forEach((u, i) => {
      console.log(`\n  ${i + 1}. ${u.canonicalName}`);
      console.log(`     - hourly_rate: €${u.hourly_rate}`);
      console.log(`     - contract_type: ${u.contract_type}`);
      console.log(`     - weekly_hours: ${u.weekly_contract_hours}`);
      console.log(`     - support_id: ${u.support_id}`);
    });
    
  } finally {
    await client.close();
  }
}

main().catch(console.error);
