import { MongoClient } from 'mongodb'

async function run() {
  const uri = process.env.MONGODB_URI || "mongodb+srv://daily-ops:fP4A82x5c6u17CI3@twacc-products-9d9ef48a.mongo.ondigitalocean.com/daily-ops-db?authSource=admin&replicaSet=twacc-products&tls=true"
  const client = new MongoClient(uri)
  try {
    await client.connect()
    const db = client.db(process.env.MONGODB_DB_NAME || 'daily-ops-db')
    
    const alvinio = await db.collection('members').findOne({ name: 'Alvinio Molina' })
    if (alvinio) {
      console.log(`✅ Alvinio ID: ${alvinio._id}`)
      console.log(`   Name: ${alvinio.name}`)
      console.log(`   Email: ${alvinio.email}`)
      console.log(`   Contract: ${alvinio.contract_type}`)
      console.log(`   Hourly Rate: €${alvinio.hourly_rate}`)
      console.log(`   Phone: ${alvinio.phone}`)
      console.log(`   Age: ${alvinio.age}`)
    }
  } finally {
    await client.close()
  }
}

run().catch(console.error)
