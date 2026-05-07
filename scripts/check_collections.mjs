import { MongoClient } from "mongodb";

async function check() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.error("MONGODB_URI not set");
    process.exit(1);
  }

  const client = new MongoClient(uri);
  try {
    await client.connect();
    const db = client.db(process.env.MONGODB_DB_NAME || "daily-ops");

    // Check collections
    const collections = await db.listCollections().toArray();
    const collNames = collections.map(c => c.name);
    console.log("Key collections:", collNames.filter(c => c.includes("unified") || c.includes("eitje")).sort());

    // Check unified_location
    const locCount = await db.collection("unified_location").countDocuments();
    console.log("\nunified_location count:", locCount);
    if (locCount > 0) {
      const sample = await db.collection("unified_location").findOne({});
      console.log("Sample:", JSON.stringify(sample, null, 2).slice(0, 300));
    }

    // Check unified_team
    const teamCount = await db.collection("unified_team").countDocuments();
    console.log("\nunified_team count:", teamCount);
    if (teamCount > 0) {
      const sample = await db.collection("unified_team").findOne({});
      console.log("Sample:", JSON.stringify(sample, null, 2).slice(0, 300));
    }

    // Check unified_user
    const userCount = await db.collection("unified_user").countDocuments();
    console.log("\nunified_user count:", userCount);

    // Check eitje_raw_data for master data
    const envCount = await db.collection("eitje_raw_data").countDocuments({ endpoint: "environments" });
    const teamRawCount = await db.collection("eitje_raw_data").countDocuments({ endpoint: "teams" });
    const userRawCount = await db.collection("eitje_raw_data").countDocuments({ endpoint: "users" });
    
    console.log("\neitje_raw_data:");
    console.log("  environments:", envCount);
    console.log("  teams:", teamRawCount);
    console.log("  users:", userRawCount);

    // Check aggregation
    const aggCount = await db.collection("eitje_time_registration_aggregation").countDocuments();
    console.log("\neitje_time_registration_aggregation count:", aggCount);

  } finally {
    await client.close();
  }
}

check().catch(console.error);
