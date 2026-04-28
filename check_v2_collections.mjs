import { MongoClient } from "mongodb";

const uri = "mongodb+srv://daily-ops:fP4A82x5c6u17CI3@twacc-products-9d9ef48a.mongo.ondigitalocean.com/daily-ops-db?authSource=admin&replicaSet=twacc-products&tls=true";

async function checkV2Collections() {
  const client = new MongoClient(uri);
  try {
    await client.connect();
    const db = client.db("daily-ops-db");
    
    console.log("🔍 V2 AGGREGATION COLLECTIONS\n");
    
    // Check all V2 collections
    const collections = [
      'bork_sales_by_cron',
      'bork_sales_by_hour', 
      'bork_sales_by_table',
      'bork_sales_by_worker',
      'bork_sales_by_guest_account',
      'bork_sales_products'
    ];
    
    for (const collName of collections) {
      try {
        const coll = db.collection(collName);
        const total = await coll.countDocuments();
        const sample = await coll.findOne();
        
        console.log(`${collName}:`);
        console.log(`  Count: ${total}`);
        
        if (sample) {
          console.log(`  Sample date field: ${sample.date}`);
          console.log(`  Sample keys: ${Object.keys(sample).slice(0, 8).join(', ')}`);
        } else {
          console.log(`  ❌ EMPTY`);
        }
        console.log();
      } catch (e) {
        console.log(`${collName}: Error - ${e.message}\n`);
      }
    }
    
    // Try the query the V2 endpoint would use
    console.log("📊 TEST V2 QUERY\n");
    
    const today = new Date().toISOString().split('T')[0];
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const thirtyStr = thirtyDaysAgo.toISOString().split('T')[0];
    
    console.log(`Date range: ${thirtyStr} to ${today}`);
    
    const borkTable = db.collection('bork_sales_by_table');
    
    // Try string query (if dates are stored as strings)
    const stringResult = await borkTable.find({
      date: { $gte: thirtyStr, $lte: today }
    }).limit(5).toArray();
    console.log(`\nString query results: ${stringResult.length} docs`);
    if (stringResult.length > 0) {
      console.log(`Sample:`, {
        date: stringResult[0].date,
        product_name: stringResult[0].product_name,
        revenue: stringResult[0].revenue
      });
    }
    
    // Check what dates exist
    const distinctDates = await borkTable.distinct('date');
    console.log(`\nDistinct dates in collection: ${distinctDates.length}`);
    if (distinctDates.length > 0) {
      console.log(`Latest 3 dates:`);
      distinctDates.sort().reverse().slice(0, 3).forEach(d => {
        console.log(`  - ${d}`);
      });
    }
    
  } catch (e) {
    console.error("✗ Error:", e.message);
  } finally {
    await client.close();
  }
}

checkV2Collections();
