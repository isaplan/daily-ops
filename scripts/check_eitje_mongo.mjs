// Script to check for eitje incoming emails at 1800 UTC
import { MongoClient } from "mongodb";

const uri = "mongodb+srv://daily-ops:fP4A82x5c6u17CI3@twacc-products-9d9ef48a.mongo.ondigitalocean.com/daily-ops-db?authSource=admin&replicaSet=twacc-products&tls=true";

async function checkEitje() {
  const client = new MongoClient(uri);
  try {
    await client.connect();
    console.log("✓ Connected to MongoDB");
    const db = client.db("daily-ops-db");
    
    // List all collections
    const collections = await db.listCollections().toArray();
    console.log("\nCollections with 'eitje':");
    collections.filter(c => c.name.includes('eitje')).forEach(c => console.log("  -", c.name));
    
    // Check for any eitje_inbox_snapshots
    const inboxColl = db.collection('eitje_inbox_snapshots');
    const totalDocs = await inboxColl.countDocuments();
    console.log(`\nTotal docs in eitje_inbox_snapshots: ${totalDocs}`);
    
    if (totalDocs > 0) {
      const sample = await inboxColl.findOne();
      console.log("\nSample document structure:");
      console.log(JSON.stringify(sample, null, 2).substring(0, 800));
    }
    
  } catch (e) {
    console.error("✗ Error:", e.message);
  } finally {
    await client.close();
  }
}

checkEitje();
