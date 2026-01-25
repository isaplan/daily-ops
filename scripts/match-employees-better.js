const { MongoClient } = require('mongodb');
const fs = require('fs');

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

function parseEuro(str) {
  if (!str) return null;
  const match = str.match(/[\d,]+/);
  if (!match) return null;
  return parseFloat(match[0].replace(',', '.'));
}

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
    
    console.log('📖 Parsing CSVs...');
    const contractData = parseCSV('/Users/alviniomolina/Documents/GitHub/daily-ops/data-sources/eitje-werknemer-contract.csv');
    const hoursData = parseCSV('/Users/alviniomolina/Documents/GitHub/daily-ops/data-sources/eitje-gewerkte-uren.csv');
    
    // Create comprehensive map: name -> contract info
    const employeeMap = new Map();
    
    // First, add from contract CSV (most complete)
    contractData.forEach(record => {
      const name = record['naam'];
      const supportId = parseInt(record['support ID']) || null;
      
      if (name && name !== 'naam') {
        if (!employeeMap.has(name)) {
          employeeMap.set(name, {
            name,
            supportId,
            contractType: record['contracttype'],
            uurloon: parseEuro(record['uurloon']),
            wekelijksContracturen: parseHours(record['wekelijkse contracturen']),
            contractVestiging: record['contractvestiging'],
            nmbrsId: record['Nmbrs ID'],
            vloorId: record['vloer ID'],
          });
        }
      }
    });
    
    // Add support IDs from hours CSV
    hoursData.forEach(record => {
      const name = record['naam'];
      const supportId = parseInt(record['support ID']) || null;
      if (name && supportId && employeeMap.has(name)) {
        employeeMap.get(name).supportId = supportId;
      }
    });
    
    console.log(`✓ Built employee map: ${employeeMap.size} unique names`);
    
    // Now match against unified_user by name
    let updated = 0;
    let notFound = [];
    
    for (const [name, emp] of employeeMap.entries()) {
      try {
        // Try to match by canonicalName
        const result = await db.collection('unified_user').updateMany(
          { 
            $or: [
              { canonicalName: name },
              { eitjeNames: name },
              { 'eitjeNames': { $in: [name] } },
            ]
          },
          {
            $set: {
              hourly_rate: emp.uurloon,
              contract_type: emp.contractType,
              weekly_contract_hours: emp.wekelijksContracturen,
              contract_location: emp.contractVestiging,
              support_id: emp.supportId,
              nmbrs_id: emp.nmbrsId,
              vloor_id: emp.vloorId,
              csv_synced_at: new Date(),
            }
          }
        );
        
        if (result.modifiedCount > 0) {
          updated += result.modifiedCount;
        } else {
          notFound.push(name);
        }
      } catch (e) {
        console.error(`Error updating ${name}:`, e.message);
      }
    }
    
    console.log(`\n✅ Updated ${updated} unified_user records`);
    console.log(`⚠️  Not found in unified_user: ${notFound.length}`);
    
    if (notFound.length > 0) {
      console.log('\nNot found employees:');
      notFound.slice(0, 10).forEach(n => console.log(`  - ${n}`));
      if (notFound.length > 10) {
        console.log(`  ... and ${notFound.length - 10} more`);
      }
    }
    
    // Show updated samples
    console.log('\n📊 Sample updated records:');
    const samples = await db.collection('unified_user')
      .find({ csv_synced_at: { $exists: true } })
      .sort({ csv_synced_at: -1 })
      .limit(10)
      .toArray();
    
    samples.forEach((u, i) => {
      console.log(`\n  ${i + 1}. ${u.canonicalName}`);
      console.log(`     hourly_rate: €${u.hourly_rate} | contract: ${u.contract_type} | hours/week: ${u.weekly_contract_hours}`);
    });
    
    // Check total with hourly_rate set
    const withRate = await db.collection('unified_user').countDocuments({ hourly_rate: { $ne: null } });
    console.log(`\n📈 Total unified_user with hourly_rate: ${withRate}`);
    
  } finally {
    await client.close();
  }
}

main().catch(console.error);
