import { MongoClient } from "mongodb";

const uri = "mongodb+srv://daily-ops:fP4A82x5c6u17CI3@twacc-products-9d9ef48a.mongo.ondigitalocean.com/daily-ops-db?authSource=admin&replicaSet=twacc-products&tls=true";

async function checkDataSize() {
  const client = new MongoClient(uri);
  try {
    await client.connect();
    const db = client.db("daily-ops-db");
    
    console.log("📊 BORK_RAW_DATA SIZE ANALYSIS\n");
    
    const rawColl = db.collection('bork_raw_data');
    const totalDocs = await rawColl.countDocuments();
    console.log(`Total bork_raw_data documents: ${totalDocs}`);
    
    // Get size of one document
    const sample = await rawColl.findOne();
    if (sample) {
      const sizeInBytes = JSON.stringify(sample).length;
      console.log(`Average document size: ~${(sizeInBytes / 1024).toFixed(2)} KB`);
      console.log(`Total collection size: ~${(sizeInBytes * totalDocs / 1024 / 1024).toFixed(2)} MB`);
      
      // Check rawApiResponse array size
      if (sample.rawApiResponse && Array.isArray(sample.rawApiResponse)) {
        console.log(`\nSample doc rawApiResponse:`);
        console.log(`  Records in array: ${sample.rawApiResponse.length}`);
        
        if (sample.rawApiResponse[0]) {
          const firstRecord = sample.rawApiResponse[0];
          console.log(`  First record keys: ${Object.keys(firstRecord).join(', ')}`);
          if (firstRecord.Orders && Array.isArray(firstRecord.Orders)) {
            console.log(`  Orders in first record: ${firstRecord.Orders.length}`);
            if (firstRecord.Orders[0]?.Lines) {
              console.log(`  Lines in first order: ${firstRecord.Orders[0].Lines.length}`);
            }
          }
        }
      }
    }
    
    // Count documents by date
    console.log(`\n📅 DOCUMENTS BY DATE RANGE`);
    const dates = await rawColl.distinct('date');
    console.log(`Distinct dates: ${dates.length}`);
    
    // Check aggregation V1
    console.log(`\n🔍 BORK AGGREGATIONS COMPARISON`);
    const byProduct = db.collection('bork_sales_by_table');
    const byProductCount = await byProduct.countDocuments();
    console.log(`bork_sales_by_table documents: ${byProductCount}`);
    
    const byHour = db.collection('bork_sales_by_hour');
    const byHourCount = await byHour.countDocuments();
    console.log(`bork_sales_by_hour documents: ${byHourCount}`);
    
  } catch (e) {
    console.error("✗ Error:", e.message);
  } finally {
    await client.close();
  }
}

checkDataSize();
