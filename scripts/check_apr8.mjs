import { MongoClient } from "mongodb";

async function check() {
  const uri = process.env.MONGODB_URI;
  const client = new MongoClient(uri);
  try {
    await client.connect();
    const db = client.db(process.env.MONGODB_DB_NAME || "daily-ops");

    // Check raw data for Apr 8
    const apr8Start = new Date("2026-04-08T00:00:00Z");
    const apr8End = new Date("2026-04-08T23:59:59Z");

    const rawCount = await db.collection("eitje_raw_data").countDocuments({
      endpoint: "time_registration_shifts",
      date: { $gte: apr8Start, $lte: apr8End }
    });

    console.log(`Raw time registration shifts on Apr 8: ${rawCount}`);

    // Get by environment
    const byEnv = await db.collection("eitje_raw_data").aggregate([
      {
        $match: {
          endpoint: "time_registration_shifts",
          date: { $gte: apr8Start, $lte: apr8End }
        }
      },
      {
        $group: {
          _id: "$rawApiResponse.environment.name",
          count: { $sum: 1 }
        }
      }
    ]).toArray();

    console.log("\nBy location:");
    byEnv.forEach(row => {
      console.log(`  ${row._id}: ${row.count} shifts`);
    });

    // Get a few sample records
    const samples = await db.collection("eitje_raw_data").find({
      endpoint: "time_registration_shifts",
      date: { $gte: apr8Start, $lte: apr8End }
    }).limit(5).toArray();

    console.log("\nSample records:");
    samples.forEach((s, i) => {
      console.log(`${i+1}. ${s.rawApiResponse.user.name} @ ${s.rawApiResponse.environment.name} - ${s.rawApiResponse.hours} hours`);
    });

  } finally {
    await client.close();
  }
}

check().catch(console.error);
