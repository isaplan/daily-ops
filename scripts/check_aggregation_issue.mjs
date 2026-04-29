import { MongoClient } from "mongodb";

const uri = "mongodb+srv://daily-ops:fP4A82x5c6u17CI3@twacc-products-9d9ef48a.mongo.ondigitalocean.com/daily-ops-db?authSource=admin&replicaSet=twacc-products&tls=true";

async function checkAggregation() {
  const client = new MongoClient(uri);
  try {
    await client.connect();
    const db = client.db("daily-ops-db");
    
    console.log("🔧 CHECKING AGGREGATION BUILD STATUS\n");
    
    // Check if Bork V2 aggregation needs rebuilding
    console.log("1️⃣ BORK V2 STATUS");
    const borkAggV2 = db.collection('bork_sales_aggregation_v2');
    const totalV2 = await borkAggV2.countDocuments();
    const latestV2 = await borkAggV2.findOne({}, { sort: { date: -1 } });
    console.log(`   Total docs: ${totalV2}`);
    console.log(`   Latest date: ${latestV2?.date || 'None'}`);
    
    // Check if rebuild_v2_logs exists and what's in it
    const rebuildLogs = db.collection('bork_rebuild_v2_logs');
    const totalRebuilds = await rebuildLogs.countDocuments();
    const latestRebuild = await rebuildLogs.findOne({}, { sort: { startTime: -1 } });
    
    console.log(`   Total rebuild attempts: ${totalRebuilds}`);
    if (latestRebuild) {
      console.log(`   Latest rebuild: ${latestRebuild.startTime}`);
      console.log(`   Status: ${latestRebuild.status}`);
      if (latestRebuild.error) {
        console.log(`   Error: ${latestRebuild.error}`);
      }
      console.log(`   Docs inserted: ${latestRebuild.docsInserted || 0}`);
    }
    
    // Check Eitje V2
    console.log("\n2️⃣ EITJE V2 STATUS");
    const eitjeAggV2 = db.collection('eitje_time_registration_aggregation_v2');
    const eitjeV2Total = await eitjeAggV2.countDocuments();
    const eitjeV2Latest = await eitjeAggV2.findOne({}, { sort: { date: -1 } });
    console.log(`   Total docs: ${eitjeV2Total}`);
    console.log(`   Latest date: ${eitjeV2Latest?.date || 'None'}`);
    
    // Check eitje rebuild logs
    const eitjeRebuildLogs = db.collection('eitje_rebuild_v2_logs');
    const eitjeRebuilds = await eitjeRebuildLogs.countDocuments();
    const eitjeLatestRebuild = await eitjeRebuildLogs.findOne({}, { sort: { startTime: -1 } });
    
    console.log(`   Total rebuild attempts: ${eitjeRebuilds}`);
    if (eitjeLatestRebuild) {
      console.log(`   Latest rebuild: ${eitjeLatestRebuild.startTime}`);
      console.log(`   Status: ${eitjeLatestRebuild.status}`);
      if (eitjeLatestRebuild.error) {
        console.log(`   Error: ${eitjeLatestRebuild.error}`);
      }
    }
    
    // Check raw data by date
    console.log("\n3️⃣ RAW DATA BY DATE (Apr 26)");
    const borkRaw = db.collection('bork_raw_data');
    const borkApr26 = await borkRaw.find({
      date: {
        $gte: new Date('2026-04-26T00:00:00Z'),
        $lt: new Date('2026-04-27T00:00:00Z')
      }
    }).toArray();
    
    console.log(`   Bork raw records: ${borkApr26.length}`);
    borkApr26.slice(0, 3).forEach(rec => {
      console.log(`     - ${rec.endpoint}: ${rec.createdAt}`);
    });
    
    // Check V1 aggregations to see if they're being built
    console.log("\n4️⃣ V1 AGGREGATION STATUS");
    const borkAggV1 = db.collection('bork_sales_aggregation');
    const v1Total = await borkAggV1.countDocuments();
    const v1Latest = await borkAggV1.findOne({}, { sort: { date: -1 } });
    console.log(`   Bork V1 total docs: ${v1Total}`);
    console.log(`   Bork V1 latest date: ${v1Latest?.date || 'None'}`);
    
    const eitjeAggV1 = db.collection('eitje_time_registration_aggregation');
    const eitjeV1Total = await eitjeAggV1.countDocuments();
    const eitjeV1Latest = await eitjeAggV1.findOne({}, { sort: { date: -1 } });
    console.log(`   Eitje V1 total docs: ${eitjeV1Total}`);
    console.log(`   Eitje V1 latest date: ${eitjeV1Latest?.date || 'None'}`);
    
  } catch (e) {
    console.error("✗ Error:", e.message);
  } finally {
    await client.close();
  }
}

checkAggregation();
