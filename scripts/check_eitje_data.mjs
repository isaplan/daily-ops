import { MongoClient } from "mongodb";

const uri = "mongodb+srv://daily-ops:fP4A82x5c6u17CI3@twacc-products-9d9ef48a.mongo.ondigitalocean.com/daily-ops-db?authSource=admin&replicaSet=twacc-products&tls=true";

async function checkEitjeData() {
  const client = new MongoClient(uri);
  try {
    await client.connect();
    const db = client.db("daily-ops-db");
    
    // Check finance inbox - most likely to have email schedules
    const finColl = db.collection('inbox-eitje-finance');
    const finCount = await finColl.countDocuments();
    console.log(`📊 inbox-eitje-finance: ${finCount} docs`);
    
    if (finCount > 0) {
      const sample = await finColl.findOne();
      console.log("\nSample from inbox-eitje-finance:");
      console.log(JSON.stringify(sample, null, 2).substring(0, 1200));
      
      // Look for fields that might indicate email timing
      const keys = Object.keys(sample);
      console.log("\nDocument fields:", keys);
    }
    
    // Check hours
    const hoursColl = db.collection('inbox-eitje-hours');
    const hoursCount = await hoursColl.countDocuments();
    console.log(`\n⏰ inbox-eitje-hours: ${hoursCount} docs`);
    
    // Check contracts
    const contractsColl = db.collection('inbox-eitje-contracts');
    const contractsCount = await contractsColl.countDocuments();
    console.log(`📋 inbox-eitje-contracts: ${contractsCount} docs`);
    
  } catch (e) {
    console.error("✗ Error:", e.message);
  } finally {
    await client.close();
  }
}

checkEitjeData();
