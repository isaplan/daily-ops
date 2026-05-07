import { MongoClient } from "mongodb";

const uri = "mongodb+srv://daily-ops:fP4A82x5c6u17CI3@twacc-products-9d9ef48a.mongo.ondigitalocean.com/daily-ops-db?authSource=admin&replicaSet=twacc-products&tls=true";

async function checkInbox() {
  const client = new MongoClient(uri);
  try {
    await client.connect();
    const db = client.db("daily-ops-db");
    
    // List all collections
    const collections = await db.listCollections().toArray();
    const inboxCollections = collections.filter(c => c.name.includes('inbox'));
    
    console.log("🔍 INBOX COLLECTIONS:\n");
    
    for (const coll of inboxCollections) {
      const count = await db.collection(coll.name).countDocuments();
      const latest = count > 0 
        ? await db.collection(coll.name).findOne({}, { sort: { _id: -1 } })
        : null;
      
      console.log(`${coll.name}: ${count} docs`);
      if (latest) {
        const createdAt = latest.createdAt || latest.importedAt || latest._id?.getTimestamp?.() || 'N/A';
        console.log(`  └─ Latest: ${createdAt}`);
      }
      console.log();
    }
    
  } catch (e) {
    console.error("✗ Error:", e.message);
  } finally {
    await client.close();
  }
}

checkInbox();
