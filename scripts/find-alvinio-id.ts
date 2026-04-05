import { MongoClient } from 'mongodb'

async function run() {
  const uri = "mongodb+srv://daily-ops:fP4A82x5c6u17CI3@twacc-products-9d9ef48a.mongo.ondigitalocean.com/daily-ops-db?authSource=admin&replicaSet=twacc-products&tls=true"
  const client = new MongoClient(uri)
  try {
    await client.connect()
    const db = client.db('daily-ops-db')
    
    // Find Alvinio
    const alvinio = await db.collection('members').findOne({ name: 'Alvinio Molina' })
    
    if (alvinio) {
      console.log('\n✅ Found Alvinio:')
      console.log('ID:', alvinio._id)
      console.log('Name:', alvinio.name)
      console.log('Email:', alvinio.email)
      console.log('Contract Type:', alvinio.contract_type)
      console.log('Contract Start:', alvinio.contract_start_date)
      console.log('Contract End:', alvinio.contract_end_date)
      console.log('Hourly Rate:', alvinio.hourly_rate)
    } else {
      console.log('❌ Alvinio not found')
    }
  } finally {
    await client.close()
  }
}

run().catch(console.error)
