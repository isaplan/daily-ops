import { MongoClient } from "mongodb";

const uri = "mongodb+srv://daily-ops:fP4A82x5c6u17CI3@twacc-products-9d9ef48a.mongo.ondigitalocean.com/daily-ops-db?authSource=admin&replicaSet=twacc-products&tls=true";

async function checkParsedData() {
  const client = new MongoClient(uri);
  try {
    await client.connect();
    const db = client.db("daily-ops-db");
    
    const parsedColl = db.collection('parseddatas');
    const count = await parsedColl.countDocuments();
    console.log(`parseddatas: ${count} docs\n`);
    
    if (count > 0) {
      const latest = await parsedColl.find().sort({ _id: -1 }).limit(5).toArray();
      console.log("Latest 5 parsed data entries:");
      latest.forEach((doc, i) => {
        console.log(`\n${i+1}. ${doc.fileName || doc.docType}`);
        console.log(`   Created: ${doc.createdAt}`);
        console.log(`   Target collection: ${doc.targetCollection}`);
        console.log(`   Status: ${doc.status || 'N/A'}`);
      });
    }
    
    // Check attachments too
    const attColl = db.collection('emailattachments');
    const attCount = await attColl.countDocuments();
    console.log(`\n\nemailattachments: ${attCount} docs`);
    
    if (attCount > 0) {
      const unprocessed = await attColl.countDocuments({ parseStatus: { $ne: 'success' } });
      console.log(`  - Processed successfully: ${attCount - unprocessed}`);
      console.log(`  - Unprocessed: ${unprocessed}`);
      
      const failed = await attColl.find({ parseStatus: 'failed' }).limit(3).toArray();
      if (failed.length > 0) {
        console.log(`\nRecent failures:`);
        failed.forEach(att => {
          console.log(`  - ${att.filename}: ${att.parseError}`);
        });
      }
    }
    
  } catch (e) {
    console.error("✗ Error:", e.message);
  } finally {
    await client.close();
  }
}

checkParsedData();
