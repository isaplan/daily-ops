const { MongoClient } = require('mongodb');
const fs = require('fs');

function parseCSVManually(content) {
  const lines = content.trim().split('\n');
  const header = lines[0]
    .split(',')
    .map(h => h.trim().replace(/^▲\s*/, '').replace(/"/g, ''));
  
  const records = [];
  for (let i = 1; i < lines.length; i++) {
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
    
    console.log('🔗 Creating mapping with case-insensitive matching\n');
    
    // Parse contracts
    const contractContent = fs.readFileSync('/Users/alviniomolina/Documents/GitHub/daily-ops/data-sources/eitje-werknemer-contract.csv', 'utf-8');
    const contractData = parseCSVManually(contractContent);
    
    // Build name -> support_id (lowercase for matching)
    const nameToSupportId = new Map();
    contractData.forEach(record => {
      const name = record['naam']?.trim();
      const supportId = parseInt(record['support ID']);
      if (name && name !== 'naam' && !isNaN(supportId)) {
        nameToSupportId.set(name.toLowerCase(), { name, supportId });
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
    
    // Create mappings with case-insensitive matching
    const mappings = [];
    let matched = 0;
    let unmatched = 0;
    
    for (const shift of shiftsAgg) {
      const eitjeUserId = shift._id;
      const eitjeUserName = shift.userName;
      const contractRecord = nameToSupportId.get(eitjeUserName.toLowerCase());
      
      if (contractRecord) {
        mappings.push({
          eitjeUserId,
          eitjeUserName,
          displayName: contractRecord.name,
          supportId: contractRecord.supportId,
          createdAt: new Date(),
        });
        matched++;
      } else {
        unmatched++;
      }
    }
    
    console.log(`📊 Matching: ${matched} matched, ${unmatched} unmatched\n`);
    
    // Store mappings
    await db.collection('eitje_user_mapping').deleteMany({});
    if (mappings.length > 0) {
      await db.collection('eitje_user_mapping').insertMany(mappings);
    }
    
    // Update unified_user
    let updated = 0;
    for (const mapping of mappings) {
      const result = await db.collection('unified_user').updateOne(
        { support_id: mapping.supportId },
        {
          $set: {
            eitjeIds: [mapping.eitjeUserId],
          },
          $addToSet: {
            allIdValues: mapping.eitjeUserId,
          }
        }
      );
      updated += result.modifiedCount;
    }
    
    console.log(`✅ Updated ${updated} unified_user records\n`);
    
    // Verify
    const withEitjeId = await db.collection('unified_user').find({ eitjeIds: { $exists: true, $ne: [] } }).toArray();
    console.log(`📈 unified_user with eitjeIds: ${withEitjeId.length}`);
    
    // Show samples
    console.log('\n📋 Sample mapped employees:');
    withEitjeId.slice(0, 10).forEach((u, i) => {
      console.log(`${i + 1}. ${u.canonicalName}`);
      console.log(`   support_id: ${u.support_id} | eitjeId: ${u.eitjeIds?.[0]} | allIdValues: ${JSON.stringify(u.allIdValues)}`);
    });
    
  } finally {
    await client.close();
  }
}

main().catch(console.error);
