import { MongoClient } from "mongodb";

const uri = "mongodb+srv://daily-ops:fP4A82x5c6u17CI3@twacc-products-9d9ef48a.mongo.ondigitalocean.com/daily-ops-db?authSource=admin&replicaSet=twacc-products&tls=true";

async function checkLogs() {
  const client = new MongoClient(uri);
  try {
    await client.connect();
    const db = client.db("daily-ops-db");
    
    // Check recent processing logs
    const logsColl = db.collection('processinglogs');
    const count = await logsColl.countDocuments();
    console.log(`processinglogs: ${count} total docs\n`);
    
    // Get latest errors
    const errors = await logsColl
      .find({ status: 'error' })
      .sort({ _id: -1 })
      .limit(5)
      .toArray();
    
    if (errors.length > 0) {
      console.log("Recent ERRORS:");
      errors.forEach((log, i) => {
        console.log(`\n${i+1}. ${log.eventType}`);
        console.log(`   Status: ${log.status}`);
        console.log(`   Message: ${log.message}`);
        console.log(`   Created: ${log.createdAt}`);
      });
    }
    
    // Get today's store events
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const todayStoreEvents = await logsColl
      .find({
        eventType: 'store',
        createdAt: { $gte: today }
      })
      .limit(10)
      .toArray();
    
    console.log(`\n\nToday's STORE events: ${todayStoreEvents.length}`);
    todayStoreEvents.forEach((log, i) => {
      console.log(`${i+1}. ${log.message} (${log.createdAt})`);
    });
    
  } catch (e) {
    console.error("✗ Error:", e.message);
  } finally {
    await client.close();
  }
}

checkLogs();
