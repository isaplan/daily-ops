import { MongoClient } from "mongodb";

async function check() {
  const uri = process.env.MONGODB_URI;
  const client = new MongoClient(uri);
  try {
    await client.connect();
    const db = client.db(process.env.MONGODB_DB_NAME || "daily-ops");

    const locCount = await db.collection("unified_location").countDocuments();
    const teamCount = await db.collection("unified_team").countDocuments();
    const userCount = await db.collection("unified_user").countDocuments();
    
    console.log("unified_location:", locCount);
    console.log("unified_team:", teamCount);
    console.log("unified_user:", userCount);

  } finally {
    await client.close();
  }
}

check().catch(console.error);
