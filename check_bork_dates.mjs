import { MongoClient } from "mongodb";

const uri = "mongodb+srv://daily-ops:fP4A82x5c6u17CI3@twacc-products-9d9ef48a.mongo.ondigitalocean.com/daily-ops-db?authSource=admin&replicaSet=twacc-products&tls=true";

async function checkDates() {
  const client = new MongoClient(uri);
  try {
    await client.connect();
    const db = client.db("daily-ops-db");
    
    console.log("🔍 CHECKING ACTUAL DATE VALUES IN BORK COLLECTIONS\n");
    
    const coll = db.collection('bork_sales_by_hour');
    
    // Get the latest document to see actual format
    const latest = await coll.findOne({}, { sort: { _id: -1 } });
    console.log("Latest document:");
    console.log(`  date field: ${latest?.date}`);
    console.log(`  date typeof: ${typeof latest?.date}`);
    console.log(`  date ISO: ${latest?.date?.toISOString?.()}`);
    
    // Get a sample from Apr 25
    const apr25 = await coll.findOne({ date: { $lt: new Date('2026-04-26') } }, { sort: { _id: -1 } });
    console.log(`\nLatest from before Apr 26:`);
    console.log(`  date field: ${apr25?.date}`);
    console.log(`  date ISO: ${apr25?.date?.toISOString?.()}`);
    
    // Try to find Apr 26 data with different query
    console.log(`\n🔎 SEARCHING FOR APR 26 DATA`);
    
    const count1 = await coll.countDocuments({
      date: { $gte: '2026-04-26', $lt: '2026-04-27' }
    });
    console.log(`String query (2026-04-26): ${count1}`);
    
    const count2 = await coll.countDocuments({
      date: { $gte: new Date('2026-04-26T00:00:00Z'), $lt: new Date('2026-04-27T00:00:00Z') }
    });
    console.log(`UTC query: ${count2}`);
    
    const count3 = await coll.countDocuments({
      date: { $gte: new Date('2026-04-26') }
    });
    console.log(`Local query: ${count3}`);
    
    // Get distinct dates in the collection
    const distinctDates = await coll.distinct('date', {});
    console.log(`\nDistinct dates (last 5):`);
    distinctDates.sort((a, b) => b - a).slice(0, 5).forEach(d => {
      console.log(`  - ${d} (${d.toISOString?.() || d})`);
    });
    
  } catch (e) {
    console.error("✗ Error:", e.message);
  } finally {
    await client.close();
  }
}

checkDates();
