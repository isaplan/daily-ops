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

async function main() {
  const client = new MongoClient('mongodb://localhost:27017');
  try {
    await client.connect();
    const db = client.db('daily-ops');
    
    console.log('🔗 Building employee name -> support_id mapping\n');
    
    // Parse hours CSV (has both names and support_id)
    const hoursData = parseCSV('/Users/alviniomolina/Documents/GitHub/daily-ops/data-sources/eitje-gewerkte-uren.csv');
    
    const nameToSupportId = new Map();
    hoursData.forEach(record => {
      const name = record['naam'];
      const supportId = parseInt(record['support ID']);
      if (name && !isNaN(supportId)) {
        nameToSupportId.set(name, supportId);
      }
    });
    
    console.log(`✓ Built map: ${nameToSupportId.size} unique employee names\n`);
    
    // Now update unified_user to add eitjeNames
    let updated = 0;
    
    for (const [name, supportId] of nameToSupportId.entries()) {
      try {
        const result = await db.collection('unified_user').updateOne(
          { support_id: supportId },
          {
            $set: {
              eitjeNames: [name],
              canonicalName: name,
            }
          }
        );
        
        if (result.modifiedCount > 0) {
          updated++;
        }
      } catch (e) {
        console.error(`Error updating ${name}:`, e.message);
      }
    }
    
    console.log(`✅ Updated ${updated} unified_user records with eitjeNames\n`);
    
    // Show samples
    console.log('📋 Sample updated records:');
    const samples = await db.collection('unified_user')
      .find({ eitjeNames: { $exists: true, $ne: [] } })
      .limit(10)
      .toArray();
    
    samples.forEach((u, i) => {
      console.log(`${i + 1}. ${u.canonicalName}`);
      console.log(`   support_id: ${u.support_id} | hourly_rate: €${u.hourly_rate}`);
    });
    
  } finally {
    await client.close();
  }
}

main().catch(console.error);
