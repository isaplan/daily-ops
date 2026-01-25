const { MongoClient } = require('mongodb');
const fs = require('fs');

function parseCSVManually(content) {
  const lines = content.trim().split('\n');
  const header = lines[0]
    .split(',')
    .map(h => h.trim().replace(/^▲\s*/, '').replace(/"/g, ''));
  
  const records = [];
  for (let i = 1; i < lines.length; i++) {
    // Simple parsing: split by comma but keep quoted values together
    const line = lines[i];
    const values = [];
    let current = '';
    let inQuotes = false;
    
    for (let j = 0; j < line.length; j++) {
      const char = line[j];
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === ',' && !inQuotes) {
        values.push(current.trim().replace(/^"|"$/g, ''));
        current = '';
      } else {
        current += char;
      }
    }
    values.push(current.trim().replace(/^"|"$/g, ''));
    
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
    
    console.log('🔗 Final mapping creation\n');
    
    // Parse manually
    const contractContent = fs.readFileSync('/Users/alviniomolina/Documents/GitHub/daily-ops/data-sources/eitje-werknemer-contract.csv', 'utf-8');
    const contractData = parseCSVManually(contractContent);
    
    // Build name -> support_id
    const nameToSupportId = new Map();
    contractData.forEach(record => {
      const name = record['naam']?.trim();
      const supportId = parseInt(record['support ID']);
      if (name && name !== 'naam' && !isNaN(supportId)) {
        nameToSupportId.set(name, supportId);
      }
    });
    
    console.log(`✓ Parsed ${nameToSupportId.size} contract records\n`);
    
    // Get shift users
    const shiftsAgg = await db.collection('eitje_raw_data').aggregate([
      { $match: { endpoint: 'time_registration_shifts' } },
      { $group: { _id: '$extracted.userId', userName: { $first: '$rawApiResponse.user.name' } } },
      { $sort: { _id: 1 } }
    ]).toArray();
    
    console.log(`✓ Found ${shiftsAgg.length} unique Eitje user IDs\n`);
    
    // Create mappings
    const mappings = [];
    const matched = [];
    const unmatched = [];
    
    for (const shift of shiftsAgg) {
      const eitjeUserId = shift._id;
      const eitjeUserName = shift.userName;
      const supportId = nameToSupportId.get(eitjeUserName);
      
      if (supportId) {
        mappings.push({
          eitjeUserId,
          eitjeUserName,
          supportId,
          createdAt: new Date(),
        });
        matched.push(eitjeUserName);
      } else {
        unmatched.push(eitjeUserName);
      }
    }
    
    console.log(`📊 Matching results:`);
    console.log(`  ✓ Matched: ${matched.length}`);
    console.log(`  ❌ Unmatched: ${unmatched.length}\n`);
    
    if (unmatched.length > 0) {
      console.log('Unmatched names (first 10):');
      unmatched.slice(0, 10).forEach(n => console.log(`  - "${n}"`));
    }
    
    // Store mappings
    await db.collection('eitje_user_mapping').deleteMany({});
    if (mappings.length > 0) {
      await db.collection('eitje_user_mapping').insertMany(mappings);
      console.log(`\n✅ Inserted ${mappings.length} mappings`);
    }
    
    // Update unified_user
    let updated = 0;
    for (const mapping of mappings) {
      const result = await db.collection('unified_user').updateOne(
        { support_id: mapping.supportId },
        {
          $set: {
            eitjeIds: [mapping.eitjeUserId],
            eitjeNames: [mapping.eitjeUserName],
          },
          $addToSet: {
            allIdValues: mapping.eitjeUserId,
          }
        }
      );
      updated += result.modifiedCount;
    }
    
    console.log(`✅ Updated ${updated} unified_user records\n`);
    
    // Show samples
    console.log('📋 Sample mapped employees:');
    const samples = await db.collection('unified_user')
      .find({ eitjeIds: { $exists: true, $ne: [] } })
      .limit(10)
      .toArray();
    
    samples.forEach((u, i) => {
      console.log(`${i + 1}. ${u.canonicalName}`);
      console.log(`   support_id: ${u.support_id} | eitjeId: ${u.eitjeIds?.[0]} | €${u.hourly_rate}/hr`);
    });
    
  } finally {
    await client.close();
  }
}

main().catch(console.error);
