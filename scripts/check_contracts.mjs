import { MongoClient } from "mongodb";

const uri = "mongodb+srv://daily-ops:fP4A82x5c6u17CI3@twacc-products-9d9ef48a.mongo.ondigitalocean.com/daily-ops-db?authSource=admin&replicaSet=twacc-products&tls=true";

async function checkContracts() {
  const client = new MongoClient(uri);
  try {
    await client.connect();
    const db = client.db("daily-ops-db");
    
    const contractsColl = db.collection('inbox-eitje-contracts');
    
    // Get one document
    const sample = await contractsColl.findOne();
    console.log("Sample contract document:");
    console.log(JSON.stringify(sample, null, 2));
    
  } catch (e) {
    console.error("✗ Error:", e.message);
  } finally {
    await client.close();
  }
}

checkContracts();
