import { MongoClient } from "mongodb";

const uri = "mongodb+srv://daily-ops:fP4A82x5c6u17CI3@twacc-products-9d9ef48a.mongo.ondigitalocean.com/daily-ops-db?authSource=admin&replicaSet=twacc-products&tls=true";
const client = new MongoClient(uri);

try {
  await client.connect();
  const db = client.db("daily-ops-db");
  
  // Get all collection names
  const collections = await db.listCollections().toArray();
  console.log("📋 All collections in daily-ops-db:\n");
  collections.forEach(c => console.log(`  - ${c.name}`));
  
  // Check for cron-related collections
  const cronCollections = collections.filter(c => 
    c.name.toLowerCase().includes('cron') || 
    c.name.toLowerCase().includes('job') || 
    c.name.toLowerCase().includes('schedule') ||
    c.name.toLowerCase().includes('task')
  );
  
  if (cronCollections.length > 0) {
    console.log(`\n🔍 Cron/Job related collections found:\n`);
    for (const cron of cronCollections) {
      const collection = db.collection(cron.name);
      const count = await collection.countDocuments();
      console.log(`  📌 ${cron.name}: ${count} records`);
      
      // Show latest entries
      const latest = await collection.findOne({}, { sort: { _id: -1 } });
      if (latest) {
        console.log(`     Last entry: ${JSON.stringify(latest).substring(0, 100)}...\n`);
      }
    }
  } else {
    console.log(`\n❌ No cron/job collections found`);
  }
  
} catch (error) {
  console.error("❌ Error:", error.message);
} finally {
  await client.close();
}
