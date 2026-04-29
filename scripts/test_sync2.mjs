import { MongoClient } from "mongodb";

async function testSync() {
  const uri = process.env.MONGODB_URI;
  const client = new MongoClient(uri);
  try {
    await client.connect();
    const db = client.db(process.env.MONGODB_DB_NAME || "daily-ops");

    console.log("Testing unified collection sync...\n");

    // Get environments
    const envDocs = await db.collection("eitje_raw_data").find({ endpoint: "environments" }).toArray();
    console.log(`Found ${envDocs.length} environment docs`);
    
    const uniqueEnvs = new Map();
    envDocs.forEach((doc) => {
      const extracted = doc.extracted;
      const id = extracted?.id;
      const name = extracted?.name;
      if (id && name) uniqueEnvs.set(id, String(name));
    });

    console.log(`Unique environments: ${uniqueEnvs.size}`);
    for (const [id, name] of uniqueEnvs) {
      console.log(`  ${id}: ${name}`);
      const result = await db.collection("unified_location").updateOne(
        { $or: [{ eitjeIds: id }, { allIdValues: id }] },
        {
          $set: {
            eitjeIds: [id],
            allIdValues: [id],
            primaryName: name,
            name,
            updatedAt: new Date(),
          },
          $setOnInsert: { createdAt: new Date() },
        },
        { upsert: true }
      );
      console.log(`    Upserted: ${result.upsertedCount}, Modified: ${result.modifiedCount}`);
    }

    const locCount = await db.collection("unified_location").countDocuments();
    console.log(`\nTotal unified_location: ${locCount}`);

  } finally {
    await client.close();
  }
}

testSync().catch(console.error);
