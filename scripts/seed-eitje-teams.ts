/**
 * Seed teams from eitje CSV
 */
import 'dotenv/config';
import fs from 'fs';
import Papa from 'papaparse';
import { MongoClient, ObjectId } from 'mongodb';

async function run() {
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error('Missing MONGODB_URI');

  const client = new MongoClient(uri);
  try {
    await client.connect();
    const db = client.db(process.env.MONGODB_DB_NAME || 'daily-ops');

    // Get all locations
    const locations = await db.collection('locations').find({}).toArray();
    const locByName: Record<string, ObjectId> = {};
    locations.forEach((l: any) => {
      locByName[l.name] = l._id;
    });
    console.log('📍 Locations:', Object.keys(locByName));

    // Extract unique team names from CSV
    const csv = fs.readFileSync('./data-sources/eitje-gewerkte-uren.csv', 'utf-8');
    const result = Papa.parse(csv, { header: true, skipEmptyLines: true });

    const teamNames = new Set<string>();
    result.data.forEach((row: any) => {
      const teamNaam = row['team naam'] || row['Team naam'];
      if (teamNaam) teamNames.add(teamNaam);
    });

    console.log('👥 Unique teams in CSV:', teamNames.size);

    // Get existing teams per location
    const teams = await db.collection('teams').find({}).toArray();
    const existingKeys = new Set(
      teams.map((t: any) => `${t.name}|||${t.location_id}`)
    );

    console.log('✅ Teams in DB:', existingKeys.size);

    // Create teams for each location
    const toCreate: Array<any> = [];
    for (const teamName of teamNames) {
      for (const locName of Object.keys(locByName)) {
        const key = `${teamName}|||${locByName[locName]}`;
        if (!existingKeys.has(key)) {
          toCreate.push({
            name: teamName,
            location_id: locByName[locName],
            created_at: new Date(),
          });
        }
      }
    }

    console.log('➕ Teams to create:', toCreate.length);

    if (toCreate.length > 0) {
      const insertResult = await db.collection('teams').insertMany(toCreate);
      console.log('✅ Created:', insertResult.insertedCount);
    }

    // Verify
    const final = await db.collection('teams').countDocuments();
    console.log('\n📊 Final team count:', final);
  } finally {
    await client.close();
  }
}

run().catch(console.error).finally(() => process.exit(0));
