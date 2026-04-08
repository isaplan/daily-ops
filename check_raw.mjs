import { MongoClient } from "mongodb";

async function check() {
  const uri = process.env.MONGODB_URI;
  const client = new MongoClient(uri);
  try {
    await client.connect();
    const db = client.db(process.env.MONGODB_DB_NAME || "daily-ops");

    console.log("=== Environments ===");
    const env = await db.collection("eitje_raw_data").findOne({ endpoint: "environments" });
    console.log(JSON.stringify(env, null, 2));

    console.log("\n=== Teams ===");
    const team = await db.collection("eitje_raw_data").findOne({ endpoint: "teams" });
    console.log(JSON.stringify(team, null, 2));

    console.log("\n=== Users ===");
    const user = await db.collection("eitje_raw_data").findOne({ endpoint: "users" });
    console.log(JSON.stringify(user, null, 2));

  } finally {
    await client.close();
  }
}

check().catch(console.error);
