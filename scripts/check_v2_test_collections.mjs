import { MongoClient } from "mongodb";

const uri = "mongodb+srv://daily-ops:fP4A82x5c6u17CI3@twacc-products-9d9ef48a.mongo.ondigitalocean.com/daily-ops-db?authSource=admin&replicaSet=twacc-products&tls=true";

async function checkCollections() {
  const client = new MongoClient(uri);
  try {
    await client.connect();
    const db = client.db("daily-ops-db");
    
    console.log("🔍 V2 COLLECTIONS WITH _test SUFFIX\n");
    
    const allCollections = await db.listCollections().toArray();
    const v2TestColls = allCollections
      .filter(c => c.name.endsWith('_test') || c.name.includes('v2'))
      .map(c => c.name)
      .sort();
    
    console.log("Collections with _test suffix:");
    for (const collName of v2TestColls) {
      const coll = db.collection(collName);
      const count = await coll.countDocuments();
      console.log(`  ${collName}: ${count} docs`);
    }
    
    console.log("\n🔍 LOOKING FOR PRODUCT COLLECTIONS:\n");
    
    const productColls = allCollections
      .filter(c => c.name.includes('product') && (c.name.includes('_test') || c.name.includes('v2')))
      .map(c => c.name)
      .sort();
    
    if (productColls.length > 0) {
      for (const collName of productColls) {
        const count = await db.collection(collName).countDocuments();
        console.log(`✅ ${collName}: ${count} docs`);
      }
    } else {
      console.log("❌ NO PRODUCT COLLECTIONS FOUND WITH _test SUFFIX");
    }
    
    console.log("\n📊 WHAT V2 PAGE NEEDS:");
    console.log("- groupBy='product' should query: bork_sales_products_test (or similar)");
    
  } catch (e) {
    console.error("✗ Error:", e.message);
  } finally {
    await client.close();
  }
}

checkCollections();
