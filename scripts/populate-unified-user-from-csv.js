const { MongoClient, ObjectId } = require('mongodb');
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
    console.log(`✓ Contract: ${contractData.length} records`);
    
    // Build unified employee map from contract CSV
    const employeeMap = new Map();
    
    contractData.forEach(record => {
      const name = record['naam'];
      const supportId = parseInt(record['support ID']);
      
      if (name && name !== 'naam' && !isNaN(supportId)) {
        const employee = {
          canonicalName: name,
          contractType: record['contracttype'],
          hourlyRate: parseEuro(record['uurloon']),
          weeklyContractHours: parseHours(record['wekelijkse contracturen']),
          contractLocation: record['contractvestiging'],
          supportId: supportId,
          nmbrsId: record['Nmbrs ID'] || null,
          vloorId: record['vloer ID'] || null,
        };
        
        employeeMap.set(supportId.toString(), employee);
      }
    });
    
    console.log(`✓ Built employee map: ${employeeMap.size} unique employees\n`);
    
    // Now upsert into unified_user
    let upserted = 0;
    let errors = 0;
    
    for (const [supportIdStr, emp] of employeeMap.entries()) {
      try {
        const result = await db.collection('unified_user').updateOne(
          { support_id: emp.supportId },
          {
            $set: {
              canonicalName: emp.canonicalName,
              hourly_rate: emp.hourlyRate,
              contract_type: emp.contractType,
              weekly_contract_hours: emp.weeklyContractHours,
              contract_location: emp.contractLocation,
              support_id: emp.supportId,
              nmbrs_id: emp.nmbrsId,
              vloor_id: emp.vloorId,
              allIdValues: [emp.supportId],
              csv_synced_at: new Date(),
              isActive: true,
            },
            $setOnInsert: {
              _id: new ObjectId(),
              createdAt: new Date(),
            }
          },
          { upsert: true }
        );
        
        upserted += (result.upsertedCount + result.modifiedCount);
      } catch (e) {
        console.error(`Error upserting ${emp.canonicalName}:`, e.message);
        errors++;
      }
    }
    
    console.log(`✅ Upserted ${upserted} unified_user records`);
    console.log(`⚠️  Errors: ${errors}`);
    
    // Verify
    const total = await db.collection('unified_user').countDocuments({ csv_synced_at: { $exists: true } });
    const withRate = await db.collection('unified_user').countDocuments({ hourly_rate: { $ne: null } });
    
    console.log(`\n📊 Verification:`);
    console.log(`  - Total CSV-synced: ${total}`);
    console.log(`  - With hourly_rate: ${withRate}`);
    
    // Show samples
    console.log('\n📋 Sample records:');
    const samples = await db.collection('unified_user')
      .find({ csv_synced_at: { $exists: true } })
      .sort({ csv_synced_at: -1 })
      .limit(10)
      .toArray();
    
    samples.forEach((u, i) => {
      console.log(`  ${i + 1}. ${u.canonicalName}`);
      console.log(`     €${u.hourly_rate}/hr | ${u.contract_type} | ${u.weekly_contract_hours}h/week | support_id: ${u.support_id}`);
    });
    
  } finally {
    await client.close();
  }
}

main().catch(console.error);
