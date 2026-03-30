import { MongoClient } from 'mongodb'

async function run() {
  const uri = "mongodb+srv://daily-ops:fP4A82x5c6u17CI3@twacc-products-9d9ef48a.mongo.ondigitalocean.com/daily-ops-db?authSource=admin&replicaSet=twacc-products&tls=true"
  const client = new MongoClient(uri)
  try {
    await client.connect()
    const db = client.db('daily-ops-db')
    
    // List collections
    const collections = await db.listCollections().toArray()
    console.log('\n📚 Collections:', collections.map(c => c.name).join(', '))
    
    // Check each collection
    for (const col of collections) {
      const count = await db.collection(col.name).countDocuments()
      console.log(`   ${col.name}: ${count} documents`)
    }
    
    // Check members specifically
    const memberCount = await db.collection('members').countDocuments()
    console.log('\n👤 Members count:', memberCount)
    
    if (memberCount > 0) {
      const members = await db.collection('members').find({}).limit(3).toArray()
      console.log('Sample members:', JSON.stringify(members.map(m => ({ _id: m._id, name: m.name, email: m.email })), null, 2))
    }
  } finally {
    await client.close()
  }
}

run().catch(console.error)
