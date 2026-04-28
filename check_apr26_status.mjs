import { MongoClient } from "mongodb";

const uri = "mongodb+srv://daily-ops:fP4A82x5c6u17CI3@twacc-products-9d9ef48a.mongo.ondigitalocean.com/daily-ops-db?authSource=admin&replicaSet=twacc-products&tls=true";

async function checkStatus() {
  const client = new MongoClient(uri);
  try {
    await client.connect();
    const db = client.db("daily-ops-db");
    
    console.log("🔎 INVESTIGATION: Why No Aggregated Data?\n");
    
    // Check if cron jobs ran
    console.log("1️⃣ CRON JOB STATUS");
    const cronJobs = db.collection('integration_cron_jobs');
    
    const borkJob = await cronJobs.findOne({ source: 'bork' });
    console.log(`\nBork Job:`);
    console.log(`  Last run: ${borkJob?.lastRun || 'Never'}`);
    console.log(`  Last run UTC: ${borkJob?.lastRunUTC || 'Never'}`);
    console.log(`  Last sync OK: ${borkJob?.lastSyncOk}`);
    console.log(`  Last sync message: ${borkJob?.lastSyncMessage || 'N/A'}`);
    
    const eitjeJob = await cronJobs.findOne({ source: 'eitje' });
    console.log(`\nEitje Job:`);
    console.log(`  Last run: ${eitjeJob?.lastRun || 'Never'}`);
    console.log(`  Last run UTC: ${eitjeJob?.lastRunUTC || 'Never'}`);
    console.log(`  Last sync OK: ${eitjeJob?.lastSyncOk}`);
    console.log(`  Last sync message: ${eitjeJob?.lastSyncMessage || 'N/A'}`);
    
    // Check if Gmail sync ran on Apr 26
    console.log("\n2️⃣ GMAIL SYNC ON APR 26");
    const emails = db.collection('inboxemails');
    const apr26Emails = await emails.countDocuments({
      createdAt: {
        $gte: new Date('2026-04-26T00:00:00Z'),
        $lt: new Date('2026-04-27T00:00:00Z')
      }
    });
    console.log(`   Emails fetched: ${apr26Emails}`);
    
    // Check latest email
    const latestEmail = await emails.findOne({}, { sort: { createdAt: -1 } });
    if (latestEmail) {
      console.log(`   Latest email: ${latestEmail.createdAt} from ${latestEmail.from?.[0]}`);
    }
    
    // Check processing logs for Apr 26
    console.log("\n3️⃣ PROCESSING LOGS - APR 26");
    const logs = db.collection('processinglogs');
    
    const apr26Logs = await logs.countDocuments({
      createdAt: {
        $gte: new Date('2026-04-26T00:00:00Z'),
        $lt: new Date('2026-04-27T00:00:00Z')
      }
    });
    console.log(`   Total logs: ${apr26Logs}`);
    
    // Check for errors
    const apr26Errors = await logs
      .find({
        status: 'error',
        createdAt: {
          $gte: new Date('2026-04-26T00:00:00Z'),
          $lt: new Date('2026-04-27T00:00:00Z')
        }
      })
      .limit(5)
      .toArray();
    
    if (apr26Errors.length > 0) {
      console.log(`   Errors: ${apr26Errors.length}`);
      apr26Errors.forEach(log => {
        console.log(`     - ${log.eventType}: ${log.message?.substring(0, 80)}`);
      });
    }
    
    // Check if aggregation was attempted
    console.log("\n4️⃣ AGGREGATION REBUILD STATUS");
    const rebuildColl = db.collection('bork_rebuild_v2_logs');
    const apr26Rebuilds = await rebuildColl.countDocuments({
      startTime: {
        $gte: new Date('2026-04-26T00:00:00Z'),
        $lt: new Date('2026-04-27T00:00:00Z')
      }
    });
    console.log(`   V2 rebuilds on Apr 26: ${apr26Rebuilds}`);
    
    // Check raw data more carefully
    console.log("\n5️⃣ RAW DATA DETAILS");
    const eitjeRaw = db.collection('eitje_raw_data');
    const latestEitjeRaw = await eitjeRaw.findOne({}, { sort: { createdAt: -1 } });
    if (latestEitjeRaw) {
      console.log(`   Latest eitje raw: ${latestEitjeRaw.createdAt}`);
      console.log(`   Endpoint: ${latestEitjeRaw.endpoint}`);
    }
    
    const borkRaw = db.collection('bork_raw_data');
    const latestBorkRaw = await borkRaw.findOne({}, { sort: { createdAt: -1 } });
    if (latestBorkRaw) {
      console.log(`   Latest bork raw: ${latestBorkRaw.createdAt}`);
      console.log(`   Endpoint: ${latestBorkRaw.endpoint}`);
    }
    
  } catch (e) {
    console.error("✗ Error:", e.message);
  } finally {
    await client.close();
  }
}

checkStatus();
