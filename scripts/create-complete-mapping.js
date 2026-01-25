const { MongoClient } = require('mongodb');
const fs = require('fs');
const Papa = require('papaparse');

function parseEuro(str) {
  if (!str) return null;
  const match = str?.toString().match(/[\d,]+/);
  if (!match) return null;
  return parseFloat(match[0].replace(',', '.'));
}

async function main() {
  const client = new MongoClient('mongodb://localhost:27017');
  try {
    await client.connect();
    const db = client.db('daily-ops');
    
    console.log('🔗 Creating complete ID mapping\n');
    
    // Parse CSVs
    const hoursContent = fs.readFileSync('/Users/alviniomolina/Documents/GitHub/daily-ops/data-sources/eitje-gewerkte-uren.csv', 'utf-8');
    const contractContent = fs.readFileSync('/Users/alviniomolina/Documents/GitHub/daily-ops/data-sources/eitje-werknemer-contract.csv', 'utf-8');
    
    const hoursData = Papa.parse(hoursContent, { header: true, skipEmptyLines: true }).data;
    const contractData = Papa.parse(contractContent, { header: true, skipEmptyLines: true }).data;
    
    // Build name -> support_id from contract CSV
    const nameToSupportId = new Map();
    contractData.forEach(record => {
      const name = record['naam']?.trim();
      const supportId = parseInt(record['support ID']);
      if (name && !isNaN(supportId)) {
        nameToSupportId.set(name, supportId);
      }
    });
    
    console.log(`✓ Name->SupportID map: ${nameToSupportId.size} entries`);
    
    // Get all unique Eitje user IDs from shifts
    const eitjeUserIds = new Set();
    const shiftsAgg = await db.collection('eitje_raw_data').aggregate([
      { $match: { endpoint: 'time_registration_shifts' } },
      { $group: { _id: '$extracted.userId', userName: { $first: '$rawApiResponse.user.name' } } },
    ]).toArray();
    
    console.log(`✓ Found ${shiftsAgg.length} unique Eitje user IDs in shifts\n`);
    
    // Create a mapping collection
    console.log('📝 Creating eitje_user_mapping collection...');
    await db.collection('eitje_user_mapping').deleteMany({}); // Clear old
    
    const mappings = [];
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
      }
    }
    
    if (mappings.length > 0) {
      await db.collection('eitje_user_mapping').insertMany(mappings);
    }
    
    console.log(`✅ Inserted ${mappings.length} mappings\n`);
    
    // Now update unified_user to include eitjeIds
    let updated = 0;
    for (const mapping of mappings) {
      const result = await db.collection('unified_user').updateOne(
        { support_id: mapping.supportId },
        {
          $addToSet: {
            eitjeIds: mapping.eitjeUserId,
            allIdValues: mapping.eitjeUserId,
          }
        }
      );
      updated += result.modifiedCount;
    }
    
    console.log(`✅ Updated ${updated} unified_user records with eitjeIds\n`);
    
    // Show mappings
    console.log('📋 Sample mappings:');
    const samples = await db.collection('eitje_user_mapping').find().limit(15).toArray();
    samples.forEach((m, i) => {
      console.log(`${i + 1}. ${m.eitjeUserName}`);
      console.log(`   Eitje ID: ${m.eitjeUserId} -> Support ID: ${m.supportId}`);
    });
    
  } finally {
    await client.close();
  }
}

main().catch(console.error);
