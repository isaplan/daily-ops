import { MongoClient } from "mongodb";

const uri = "mongodb+srv://daily-ops:fP4A82x5c6u17CI3@twacc-products-9d9ef48a.mongo.ondigitalocean.com/daily-ops-db?authSource=admin&replicaSet=twacc-products&tls=true";

async function checkAllData() {
  const client = new MongoClient(uri);
  try {
    await client.connect();
    const db = client.db("daily-ops-db");
    
    console.log("🔍 DATA CHECK FOR 2026-04-26\n");
    
    // 1. Eitje API Raw Data
    console.log("1️⃣ EITJE API (Raw Data)");
    const eitjeRawColl = db.collection('eitje_raw_data');
    const eitjeRawToday = await eitjeRawColl.countDocuments({
      createdAt: {
        $gte: new Date('2026-04-26T00:00:00Z'),
        $lt: new Date('2026-04-27T00:00:00Z')
      }
    });
    console.log(`   Raw data today: ${eitjeRawToday} docs`);
    
    // 2. Eitje Aggregation V1 & V2
    console.log("\n2️⃣ EITJE AGGREGATION");
    const eitjeAggV1 = db.collection('eitje_time_registration_aggregation');
    const eitjeAggV1Count = await eitjeAggV1.countDocuments({
      date: { $gte: new Date('2026-04-26') }
    });
    console.log(`   V1 (eitje_time_registration_aggregation): ${eitjeAggV1Count} docs`);
    
    const eitjeAggV2 = db.collection('eitje_time_registration_aggregation_v2');
    const eitjeAggV2Count = await eitjeAggV2.countDocuments({
      date: { $gte: new Date('2026-04-26') }
    });
    console.log(`   V2 (eitje_time_registration_aggregation_v2): ${eitjeAggV2Count} docs`);
    
    // 3. Bork API Raw Data
    console.log("\n3️⃣ BORK API (Raw Data)");
    const borkRawColl = db.collection('bork_raw_data');
    const borkRawToday = await borkRawColl.countDocuments({
      createdAt: {
        $gte: new Date('2026-04-26T00:00:00Z'),
        $lt: new Date('2026-04-27T00:00:00Z')
      }
    });
    console.log(`   Raw data today: ${borkRawToday} docs`);
    
    // 4. Bork Aggregation V1 & V2
    console.log("\n4️⃣ BORK AGGREGATION");
    const borkAggV1 = db.collection('bork_sales_aggregation');
    const borkAggV1Count = await borkAggV1.countDocuments({
      date: { $gte: new Date('2026-04-26') }
    });
    console.log(`   V1 (bork_sales_aggregation): ${borkAggV1Count} docs`);
    
    const borkAggV2 = db.collection('bork_sales_aggregation_v2');
    const borkAggV2Count = await borkAggV2.countDocuments({
      date: { $gte: new Date('2026-04-26') }
    });
    console.log(`   V2 (bork_sales_aggregation_v2): ${borkAggV2Count} docs`);
    
    // 5. Inbox Collections
    console.log("\n5️⃣ INBOX COLLECTIONS");
    
    const eitjeHours = db.collection('inbox-eitje-hours');
    const eitjeHoursCount = await eitjeHours.countDocuments({
      importedAt: {
        $gte: new Date('2026-04-26T00:00:00Z'),
        $lt: new Date('2026-04-27T00:00:00Z')
      }
    });
    console.log(`   eitje-hours: ${eitjeHoursCount} docs (today)`);
    const eitjeHoursTotal = await eitjeHours.countDocuments();
    console.log(`   eitje-hours: ${eitjeHoursTotal} docs (total)`);
    
    const borkSales = db.collection('inbox-bork-sales');
    const borkSalesCount = await borkSales.countDocuments({
      importedAt: {
        $gte: new Date('2026-04-26T00:00:00Z'),
        $lt: new Date('2026-04-27T00:00:00Z')
      }
    });
    console.log(`   bork-sales: ${borkSalesCount} docs (today)`);
    
    const borkProductMix = db.collection('inbox-bork-product-mix');
    const borkProductMixCount = await borkProductMix.countDocuments({
      importedAt: {
        $gte: new Date('2026-04-26T00:00:00Z'),
        $lt: new Date('2026-04-27T00:00:00Z')
      }
    });
    console.log(`   bork-product-mix: ${borkProductMixCount} docs (today)`);
    
    const borkFoodBev = db.collection('inbox-bork-food-beverage');
    const borkFoodBevCount = await borkFoodBev.countDocuments({
      importedAt: {
        $gte: new Date('2026-04-26T00:00:00Z'),
        $lt: new Date('2026-04-27T00:00:00Z')
      }
    });
    console.log(`   bork-food-beverage: ${borkFoodBevCount} docs (today)`);
    
    const borkBasis = db.collection('inbox-bork-basis-report');
    const borkBasisCount = await borkBasis.countDocuments({
      importedAt: {
        $gte: new Date('2026-04-26T00:00:00Z'),
        $lt: new Date('2026-04-27T00:00:00Z')
      }
    });
    console.log(`   bork-basis-report: ${borkBasisCount} docs (today)`);
    
    // 6. Email Attachments
    console.log("\n6️⃣ EMAIL ATTACHMENTS");
    const attachments = db.collection('emailattachments');
    
    const eitjeHoursAtt = await attachments.countDocuments({
      filename: { $regex: 'dagelijkse-uren-export' },
      createdAt: {
        $gte: new Date('2026-04-26T00:00:00Z'),
        $lt: new Date('2026-04-27T00:00:00Z')
      }
    });
    console.log(`   Eitje hours attachment: ${eitjeHoursAtt}`);
    
    const borkSalesAtt = await attachments.countDocuments({
      filename: { $regex: 'sales', $options: 'i' },
      createdAt: {
        $gte: new Date('2026-04-26T00:00:00Z'),
        $lt: new Date('2026-04-27T00:00:00Z')
      }
    });
    console.log(`   Bork sales attachment: ${borkSalesAtt}`);
    
  } catch (e) {
    console.error("✗ Error:", e.message);
  } finally {
    await client.close();
  }
}

checkAllData();
