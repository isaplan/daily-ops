import { MongoClient } from "mongodb";

const uri = "mongodb+srv://daily-ops:fP4A82x5c6u17CI3@twacc-products-9d9ef48a.mongo.ondigitalocean.com/daily-ops-db?authSource=admin&replicaSet=twacc-products&tls=true";

async function checkLatest() {
  const client = new MongoClient(uri);
  try {
    await client.connect();
    const db = client.db("daily-ops-db");
    
    console.log("✅ DATA STATUS FOR APR 26, 2026\n");
    
    // Bork aggregations
    console.log("🔵 BORK AGGREGATIONS");
    const hourColl = db.collection('bork_sales_by_hour');
    
    const apr26Docs = await hourColl.find({ date: { $gte: '2026-04-26' } }).limit(3).toArray();
    console.log(`   bork_sales_by_hour (Apr 26+): ${apr26Docs.length} docs`);
    apr26Docs.forEach(d => {
      console.log(`     - ${d.date} | location: ${d.location_name} | revenue: ${d.revenue}`);
    });
    
    // Count by type
    const cronCount = await db.collection('bork_sales_by_cron').countDocuments({ date: { $gte: '2026-04-26' } });
    const hourCount = await db.collection('bork_sales_by_hour').countDocuments({ date: { $gte: '2026-04-26' } });
    const tableCount = await db.collection('bork_sales_by_table').countDocuments({ date: { $gte: '2026-04-26' } });
    const workerCount = await db.collection('bork_sales_by_worker').countDocuments({ date: { $gte: '2026-04-26' } });
    
    console.log(`\n   Aggregation counts (Apr 26+):`);
    console.log(`   - by_cron: ${cronCount}`);
    console.log(`   - by_hour: ${hourCount}`);
    console.log(`   - by_table: ${tableCount}`);
    console.log(`   - by_worker: ${workerCount}`);
    
    // Eitje aggregations
    console.log(`\n🟢 EITJE AGGREGATIONS`);
    const eitjeV1 = db.collection('eitje_time_registration_aggregation');
    const eitjeV1Apr26 = await eitjeV1.find({ date: { $gte: new Date('2026-04-26') } }).limit(3).toArray();
    console.log(`   V1 (Apr 26+): ${eitjeV1Apr26.length} docs`);
    eitjeV1Apr26.forEach(d => {
      console.log(`     - ${d.date} | emp: ${d.employee_name}`);
    });
    
    // Inbox collections
    console.log(`\n📧 INBOX COLLECTIONS (Apr 26+)`);
    
    const inbox = {
      'inbox-eitje-hours': await db.collection('inbox-eitje-hours').countDocuments({ importedAt: { $gte: new Date('2026-04-26') } }),
      'inbox-eitje-finance': await db.collection('inbox-eitje-finance').countDocuments({ importedAt: { $gte: new Date('2026-04-26') } }),
      'inbox-bork-sales': await db.collection('inbox-bork-sales').countDocuments({ importedAt: { $gte: new Date('2026-04-26') } }),
      'inbox-bork-product-mix': await db.collection('inbox-bork-product-mix').countDocuments({ importedAt: { $gte: new Date('2026-04-26') } }),
      'inbox-bork-food-beverage': await db.collection('inbox-bork-food-beverage').countDocuments({ importedAt: { $gte: new Date('2026-04-26') } }),
      'inbox-bork-basis-report': await db.collection('inbox-bork-basis-report').countDocuments({ importedAt: { $gte: new Date('2026-04-26') } }),
    };
    
    for (const [name, count] of Object.entries(inbox)) {
      console.log(`   ${name}: ${count}`);
    }
    
    // Gmail / Email status
    console.log(`\n📬 EMAIL STATUS`);
    const emails = await db.collection('inboxemails').countDocuments({
      createdAt: { $gte: new Date('2026-04-26') }
    });
    console.log(`   inboxemails (Apr 26+): ${emails}`);
    
  } catch (e) {
    console.error("✗ Error:", e.message);
  } finally {
    await client.close();
  }
}

checkLatest();
