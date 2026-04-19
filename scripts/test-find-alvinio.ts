import { MongoClient, ObjectId } from 'mongodb'

async function run() {
  const uri = "mongodb+srv://daily-ops:fP4A82x5c6u17CI3@twacc-products-9d9ef48a.mongo.ondigitalocean.com/daily-ops-db?authSource=admin&replicaSet=twacc-products&tls=true"
  const client = new MongoClient(uri)
  try {
    await client.connect()
    const db = client.db('daily-ops-db')
    
    const id = '69ca3a6c5d7c5fc3cb219baa'
    const oid = new ObjectId(id)
    
    console.log('Looking for OID:', oid)
    
    const member = await db.collection('members').findOne({ _id: oid })
    
    if (member) {
      console.log('\n✅ Member found:')
      console.log('Name:', member.name)
      console.log('Email:', member.email)
      console.log('Contract Type:', member.contract_type)
    } else {
      console.log('❌ Member not found')
      console.log('\nAll members in collection:')
      const all = await db.collection('members').find({}).limit(5).toArray()
      all.forEach(m => {
        console.log(`  - ${m._id} | ${m.name}`)
      })
    }
  } finally {
    await client.close()
  }
}

run().catch(console.error)
