import { MongoClient } from 'mongodb'

async function run() {
  const uri = "mongodb+srv://daily-ops:fP4A82x5c6u17CI3@twacc-products-9d9ef48a.mongo.ondigitalocean.com/daily-ops-db?authSource=admin&replicaSet=twacc-products&tls=true"
  const client = new MongoClient(uri)
  try {
    await client.connect()
    const admin = client.db('admin').admin()
    const dbs = await admin.listDatabases()
    
    console.log('\n📊 All databases:')
    dbs.databases.forEach(db => {
      console.log(`  - ${db.name}`)
    })
    
    // Check each database for members collection
    console.log('\n🔍 Checking for members collection:')
    for (const dbInfo of dbs.databases) {
      const db = client.db(dbInfo.name)
      const collections = await db.listCollections().toArray()
      const hasMembersCollection = collections.some(c => c.name === 'members')
      if (hasMembersCollection) {
        const count = await db.collection('members').countDocuments()
        console.log(`  ✅ ${dbInfo.name}: members collection (${count} documents)`)
      }
    }
  } finally {
    await client.close()
  }
}

run().catch(console.error)
