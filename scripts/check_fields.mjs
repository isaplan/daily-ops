import { MongoClient } from "mongodb";

const uri = "mongodb+srv://daily-ops:fP4A82x5c6u17CI3@twacc-products-9d9ef48a.mongo.ondigitalocean.com/daily-ops-db?authSource=admin&replicaSet=twacc-products&tls=true";

async function checkFields() {
  const client = new MongoClient(uri);
  try {
    await client.connect();
    const db = client.db("daily-ops-db");
    
    console.log("🔍 BORK_SALES_BY_TABLE FIELD NAMES\n");
    
    const sample = await db.collection('bork_sales_by_table').findOne({
      business_date: { $gte: '2026-04-20' }
    });
    
    if (sample) {
      console.log("Sample document fields:");
      const fields = Object.keys(sample).sort();
      fields.forEach(f => {
        const val = sample[f];
        const type = typeof val;
        const displayVal = type === 'string' ? `"${val}"` : val;
        console.log(`  ${f}: ${displayVal}`);
      });
    }
    
  } catch (e) {
    console.error("✗ Error:", e.message);
  } finally {
    await client.close();
  }
}

checkFields();
