import { MongoClient } from "mongodb";

const uri = "mongodb+srv://daily-ops:fP4A82x5c6u17CI3@twacc-products-9d9ef48a.mongo.ondigitalocean.com/daily-ops-db?authSource=admin&replicaSet=twacc-products&tls=true";

async function testQuery() {
  const client = new MongoClient(uri);
  try {
    await client.connect();
    const db = client.db("daily-ops-db");
    
    console.log("🧪 TESTING V2 QUERY SIMULATION\n");
    
    // Simulate what the fixed endpoint will do
    const borkTable = db.collection('bork_sales_by_table');
    
    // Get last 30 days (ending yesterday in Amsterdam time)
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 31);
    
    const startStr = thirtyDaysAgo.toISOString().split('T')[0];
    const endStr = yesterday.toISOString().split('T')[0];
    
    console.log(`Date range: ${startStr} to ${endStr}`);
    
    // Query for products (bork_sales_by_table with product filtering)
    const match = {
      business_date: { $gte: startStr, $lte: endStr }
    };
    
    const [docs, totalCount] = await Promise.all([
      borkTable.find(match).sort({ total_revenue: -1 }).skip(0).limit(50).toArray(),
      borkTable.countDocuments(match)
    ]);
    
    console.log(`\n✅ Found ${totalCount} matching documents`);
    console.log(`📄 Fetched ${docs.length} for page 1`);
    
    if (docs.length > 0) {
      console.log(`\nSample 3 rows:`);
      docs.slice(0, 3).forEach((row, i) => {
        console.log(`${i+1}. ${row.productName || 'Unknown'} | €${row.total_revenue} | qty: ${row.total_quantity}`);
      });
    }
    
  } catch (e) {
    console.error("✗ Error:", e.message);
  } finally {
    await client.close();
  }
}

testQuery();
