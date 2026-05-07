import { MongoClient } from "mongodb";

const uri = "mongodb+srv://daily-ops:fP4A82x5c6u17CI3@twacc-products-9d9ef48a.mongo.ondigitalocean.com/daily-ops-db?authSource=admin&replicaSet=twacc-products&tls=true";

async function checkLogs() {
  const client = new MongoClient(uri);
  try {
    await client.connect();
    const db = client.db("daily-ops-db");
    
    console.log("🔍 V2 REBUILD LOGS\n");
    
    // Check if rebuild logs collection exists
    const rebuildLogs = db.collection('bork_rebuild_v2_logs');
    const count = await rebuildLogs.countDocuments();
    console.log(`bork_rebuild_v2_logs: ${count} docs`);
    
    if (count > 0) {
      const latest = await rebuildLogs.findOne({}, { sort: { startTime: -1 } });
      if (latest) {
        console.log(`\nLatest rebuild:`);
        console.log(`  Start: ${latest.startTime}`);
        console.log(`  Status: ${latest.status}`);
        console.log(`  Products: ${latest.productLines || 0}`);
        if (latest.error) {
          console.log(`  Error: ${latest.error}`);
        }
      }
    }
    
    console.log(`\n📝 SOLUTION:\n`);
    console.log(`The V2 aggregation needs to be rebuilt to populate bork_sales_products.`);
    console.log(`Run the rebuild script:`);
    console.log(`\n  BORK_V2_REBUILD_CONFIRM=1 node --experimental-strip-types scripts/rebuild-bork-v2-date-range.ts`);
    
  } catch (e) {
    console.error("✗ Error:", e.message);
  } finally {
    await client.close();
  }
}

checkLogs();
