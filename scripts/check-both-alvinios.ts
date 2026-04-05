import { MongoClient, ObjectId } from 'mongodb'

async function run() {
  const uri = "mongodb+srv://daily-ops:fP4A82x5c6u17CI3@twacc-products-9d9ef48a.mongo.ondigitalocean.com/daily-ops-db?authSource=admin&replicaSet=twacc-products&tls=true"
  const client = new MongoClient(uri)
  try {
    await client.connect()
    const db = client.db('daily-ops-db')
    
    const id1 = '69812b80a8699e0e9113a3f0'
    const id2 = '69ca3a6c5d7c5fc3cb219baa'
    
    const oid1 = new ObjectId(id1)
    const oid2 = new ObjectId(id2)
    
    const m1 = await db.collection('members').findOne({ _id: oid1 })
    const m2 = await db.collection('members').findOne({ _id: oid2 })
    
    console.log('\n🔍 Member 1:', id1)
    console.log('Found:', !!m1)
    if (m1) console.log('Name:', m1.name, '| Email:', m1.email, '| Contract:', m1.contract_type)
    
    console.log('\n🔍 Member 2:', id2)
    console.log('Found:', !!m2)
    if (m2) console.log('Name:', m2.name, '| Email:', m2.email, '| Contract:', m2.contract_type)
  } finally {
    await client.close()
  }
}

run().catch(console.error)
