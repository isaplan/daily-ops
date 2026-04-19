import { MongoClient } from "mongodb";

const uri = "mongodb+srv://daily-ops:fP4A82x5c6u17CI3@twacc-products-9d9ef48a.mongo.ondigitalocean.com/daily-ops-db?authSource=admin&replicaSet=twacc-products&tls=true";
const client = new MongoClient(uri);

try {
  await client.connect();
  const db = client.db("daily-ops-db");
  
  // Get today's date in YYYY-MM-DD format
  const today = new Date().toISOString().split('T')[0];
  console.log(`🔍 Checking for data on ${today}...\n`);
  
  // Check Bork raw data
  const borkRaw = db.collection("bork_raw_tickets");
  const borkRawCount = await borkRaw.countDocuments({ date: today });
  console.log(`📦 Bork raw tickets (${today}): ${borkRawCount} records`);
  
  // Check Bork aggregation
  const borkAgg = db.collection("bork_aggregation_daily");
  const borkAggCount = await borkAgg.countDocuments({ date: today });
  console.log(`📊 Bork aggregation (${today}): ${borkAggCount} records`);
  
  // Check Eitje raw data
  const eitjeRaw = db.collection("eitje_raw_time_registrations");
  const eitjeRawCount = await eitjeRaw.countDocuments({ date: today });
  console.log(`📦 Eitje raw registrations (${today}): ${eitjeRawCount} records`);
  
  // Check Eitje aggregation
  const eitjeAgg = db.collection("eitje_aggregation_daily");
  const eitjeAggCount = await eitjeAgg.countDocuments({ date: today });
  console.log(`📊 Eitje aggregation (${today}): ${eitjeAggCount} records`);
  
  console.log(`\n✅ Total: ${borkRawCount + borkAggCount + eitjeRawCount + eitjeAggCount} records for today`);
  
} catch (error) {
  console.error("❌ Error:", error.message);
} finally {
  await client.close();
}
