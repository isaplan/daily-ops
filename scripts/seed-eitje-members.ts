/**
 * Seed members from eitje CSV into database
 */
import 'dotenv/config';
import fs from 'fs';
import Papa from 'papaparse';
import { MongoClient } from 'mongodb';

async function run() {
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error('Missing MONGODB_URI');

  const client = new MongoClient(uri);
  try {
    await client.connect();
    const db = client.db(process.env.MONGODB_DB_NAME || 'daily-ops');

    // Extract unique member names from CSV
    const csv = fs.readFileSync('./data-sources/eitje-gewerkte-uren.csv', 'utf-8');
    const result = Papa.parse(csv, { header: true, skipEmptyLines: true });

    const names = new Set<string>();
    result.data.forEach((row: any) => {
      const naam = row['naam'] || row['Naam'];
      if (naam) names.add(naam);
    });

    console.log('📋 Unique members in CSV:', names.size);

    // Check which already exist
    const existing = await db.collection('members').find({}).toArray();
    const existingNames = new Set(existing.map((m: any) => m.name));
    console.log('✅ Members already in DB:', existingNames.size);

    // Create missing members
    const toCreate = Array.from(names).filter((name) => !existingNames.has(name));
    console.log('➕ Members to create:', toCreate.length);

    if (toCreate.length > 0) {
      const docs = toCreate.map((name, idx) => ({
        name,
        email: `${name.toLowerCase().replace(/\s+/g, '.')}@eitje.test`,
        created_at: new Date(),
        source: 'eitje-csv',
      }));

      const insertResult = await db.collection('members').insertMany(docs);
      console.log('✅ Created:', insertResult.insertedCount);
    }

    // Verify
    const final = await db.collection('members').countDocuments();
    console.log('\n📊 Final member count:', final);
  } finally {
    await client.close();
  }
}

run().catch(console.error).finally(() => process.exit(0));
