import { MongoClient } from "mongodb";

async function check() {
  const uri = process.env.MONGODB_URI;
  const client = new MongoClient(uri);
  try {
    await client.connect();
    const db = client.db(process.env.MONGODB_DB_NAME || "daily-ops");

    // Get one raw shift
    const shift = await db.collection("eitje_raw_data").findOne({ endpoint: "time_registration_shifts" });
    console.log("Sample raw shift:");
    console.log(JSON.stringify(shift, null, 2).slice(0, 1000));

    // Check aggregation doc
    console.log("\n\nSample aggregation doc:");
    const agg = await db.collection("eitje_time_registration_aggregation").findOne({});
    console.log(JSON.stringify(agg, null, 2).slice(0, 1000));

  } finally {
    await client.close();
  }
}

check().catch(console.error);
