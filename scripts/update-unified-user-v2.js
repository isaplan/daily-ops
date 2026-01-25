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

function parseEuro(str) {
  if (!str) return null;
  const match = str?.toString().match(/[\d,]+/);
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
    
    console.log('📖 Parsing V2 contract CSV\n');
    const v2Content = fs.readFileSync('/Users/alviniomolina/Documents/GitHub/daily-ops/data-sources/eitje-werknemer-contract-v2.csv', 'utf-8');
    const v2Data = parseCSVManually(v2Content);
    
    console.log(`✓ Parsed ${v2Data.length} records\n`);
    
    // Update unified_user with V2 data
    let updated = 0;
    let created = 0;
    
    for (const record of v2Data) {
      const naam = record['naam'];
      const supportId = parseInt(record['support ID']);
      const uurloon = parseEuro(record['uurloon']);
      
      if (!naam || isNaN(supportId)) continue;
      
      const updateData = {
        canonicalName: naam,
        hourly_rate: uurloon,
        contract_type: record['contracttype'],
        weekly_contract_hours: parseHours(record['wekelijkse contracturen']),
        contract_location: record['contractvestiging'],
        email: record['e-mailadres'],
        first_name: record['voornaam'],
        last_name: record['achternaam'],
        nmbrs_id: record['Nmbrs ID'],
        vloor_id: record['vloer ID'],
        support_id: supportId,
        csv_updated_at: new Date(),
      };
      
      try {
        const result = await db.collection('unified_user').updateOne(
          { support_id: supportId },
          { $set: updateData },
          { upsert: true }
        );
        
        if (result.upsertedCount > 0) {
          created++;
        } else if (result.modifiedCount > 0) {
          updated++;
        }
      } catch (e) {
        console.error(`Error updating ${naam}:`, e.message);
      }
    }
    
    console.log(`✅ Updated: ${updated} | Created: ${created}\n`);
    
    // Verify updates
    const samples = await db.collection('unified_user')
      .find({ csv_updated_at: { $exists: true } })
      .sort({ csv_updated_at: -1 })
      .limit(15)
      .toArray();
    
    console.log('📋 Updated records sample:');
    samples.forEach((u, i) => {
      console.log(`${i + 1}. ${u.canonicalName}`);
      console.log(`   €${u.hourly_rate}/hr | ${u.contract_type} | ${u.email || 'no email'}`);
    });
    
    // Check Alvinio specifically
    const alvinio = await db.collection('unified_user').findOne({ canonicalName: 'Alvinio Molina' });
    if (alvinio) {
      console.log(`\n🎯 Alvinio Molina updated:`);
      console.log(`   hourly_rate: €${alvinio.hourly_rate}`);
      console.log(`   email: ${alvinio.email}`);
      console.log(`   support_id: ${alvinio.support_id}`);
      console.log(`   eitjeIds: ${JSON.stringify(alvinio.eitjeIds)}`);
    }
    
  } finally {
    await client.close();
  }
}

main().catch(console.error);
