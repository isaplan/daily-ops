import { MongoClient } from "mongodb";

const uri = "mongodb+srv://daily-ops:fP4A82x5c6u17CI3@twacc-products-9d9ef48a.mongo.ondigitalocean.com/daily-ops-db?authSource=admin&replicaSet=twacc-products&tls=true";

async function checkAllCollections() {
  const client = new MongoClient(uri);
  try {
    await client.connect();
    const db = client.db("daily-ops-db");
    
    console.log("🔍 ALL BORK COLLECTIONS IN DATABASE\n");
    
    const allCollections = await db.listCollections().toArray();
    const borkColls = allCollections
      .filter(c => c.name.includes('bork'))
      .map(c => c.name)
      .sort();
    
    for (const collName of borkColls) {
      const coll = db.collection(collName);
      const count = await coll.countDocuments();
      console.log(`${collName}: ${count} docs`);
    }
    
    console.log("\n🔍 WHAT THE V2 ENDPOINT EXPECTS:\n");
    console.log("For groupBy='product': bork_sales_products (❌ MISSING/EMPTY)");
    console.log("For groupBy='table': bork_sales_tables (or bork_sales_by_table?)");
    console.log("For groupBy='hour': bork_sales_hours (or bork_sales_by_hour?)");
    console.log("For groupBy='day': bork_sales_by_day (❓ CHECK)");
    
    // Check what we have vs what endpoint expects
    const expected = [
      'bork_sales_products',
      'bork_sales_tables',
      'bork_sales_hours',
      'bork_sales_by_day',
      'bork_sales_workers',
      'bork_sales_guest_accounts'
    ];
    
    console.log("\n📋 EXPECTED vs ACTUAL:\n");
    for (const exp of expected) {
      const exists = borkColls.includes(exp);
      const count = exists ? await db.collection(exp).countDocuments() : 0;
      console.log(`${exists ? '✅' : '❌'} ${exp}: ${count} docs`);
    }
    
  } catch (e) {
    console.error("✗ Error:", e.message);
  } finally {
    await client.close();
  }
}

checkAllCollections();
