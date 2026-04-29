import { MongoClient } from "mongodb";

const uri = "mongodb+srv://daily-ops:fP4A82x5c6u17CI3@twacc-products-9d9ef48a.mongo.ondigitalocean.com/daily-ops-db?authSource=admin&replicaSet=twacc-products&tls=true";

async function checkBorkCollections() {
  const client = new MongoClient(uri);
  try {
    await client.connect();
    const db = client.db("daily-ops-db");
    
    console.log("🔍 BORK AGGREGATION COLLECTIONS\n");
    
    const collections = [
      'bork_sales_by_cron',
      'bork_sales_by_hour',
      'bork_sales_by_table',
      'bork_sales_by_worker',
      'bork_sales_by_guest_account'
    ];
    
    for (const collName of collections) {
      const coll = db.collection(collName);
      const total = await coll.countDocuments();
      
      // Count from Apr 26
      const apr26 = await coll.countDocuments({
        date: { $gte: new Date('2026-04-26') }
      });
      
      // Get one sample
      const sample = await coll.findOne({}, { sort: { _id: -1 } });
      
      console.log(`${collName}:`);
      console.log(`  Total: ${total}`);
      console.log(`  Apr 26: ${apr26}`);
      if (sample) {
        console.log(`  Latest: ${sample.date}`);
      }
      console.log();
    }
    
    // Check if there's eitje aggregation
    console.log("🔍 EITJE AGGREGATION COLLECTIONS\n");
    
    const eitjeColls = [
      'eitje_time_registration_aggregation',
      'eitje_time_registration_aggregation_v2'
    ];
    
    for (const collName of eitjeColls) {
      try {
        const coll = db.collection(collName);
        const total = await coll.countDocuments();
        const apr26 = await coll.countDocuments({
          date: { $gte: new Date('2026-04-26') }
        });
        const sample = await coll.findOne({}, { sort: { _id: -1 } });
        
        console.log(`${collName}:`);
        console.log(`  Total: ${total}`);
        console.log(`  Apr 26: ${apr26}`);
        if (sample) {
          console.log(`  Latest: ${sample.date}`);
        }
        console.log();
      } catch (e) {
        console.log(`${collName}: Error - ${e.message}\n`);
      }
    }
    
  } catch (e) {
    console.error("✗ Error:", e.message);
  } finally {
    await client.close();
  }
}

checkBorkCollections();
