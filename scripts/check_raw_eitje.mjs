import { MongoClient } from "mongodb";

const uri = "mongodb+srv://daily-ops:fP4A82x5c6u17CI3@twacc-products-9d9ef48a.mongo.ondigitalocean.com/daily-ops-db?authSource=admin&replicaSet=twacc-products&tls=true";

async function checkRawEitje() {
  const client = new MongoClient(uri);
  try {
    await client.connect();
    const db = client.db("daily-ops-db");
    
    const rawColl = db.collection('eitje_raw_data');
    const count = await rawColl.countDocuments();
    console.log(`Raw eitje_raw_data documents: ${count}`);
    
    if (count > 0) {
      const latest = await rawColl.find().sort({ _id: -1 }).limit(1).toArray();
      console.log("\nLatest raw eitje document:");
      console.log(JSON.stringify(latest[0], null, 2).substring(0, 1500));
    }
    
  } catch (e) {
    console.error("✗ Error:", e.message);
  } finally {
    await client.close();
  }
}

checkRawEitje();
