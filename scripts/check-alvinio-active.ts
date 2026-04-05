import { MongoClient } from 'mongodb'

async function run() {
  const uri = "mongodb+srv://daily-ops:fP4A82x5c6u17CI3@twacc-products-9d9ef48a.mongo.ondigitalocean.com/daily-ops-db?authSource=admin&replicaSet=twacc-products&tls=true"
  const client = new MongoClient(uri)
  try {
    await client.connect()
    const db = client.db('daily-ops-db')
    
    // Find Alvinio with all fields
    const alvinio = await db.collection('members').findOne({ name: 'Alvinio Molina' })
    
    if (alvinio) {
      console.log('\nAlvinio Full Data:')
      console.log('is_active:', alvinio.is_active)
      console.log('isActive:', alvinio.isActive)
      console.log('All fields:', JSON.stringify(alvinio, null, 2))
    }
  } finally {
    await client.close()
  }
}

run().catch(console.error)
