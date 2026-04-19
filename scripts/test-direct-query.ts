import { MongoClient, ObjectId } from 'mongodb'

async function run() {
  const uri = "mongodb+srv://daily-ops:fP4A82x5c6u17CI3@twacc-products-9d9ef48a.mongo.ondigitalocean.com/daily-ops-db?authSource=admin&replicaSet=twacc-products&tls=true"
  const client = new MongoClient(uri)
  try {
    await client.connect()
    const db = client.db('daily-ops-db')
    
    const id = '69ca3a6c5d7c5fc3cb219baa'
    const oid = new ObjectId(id)
    
    console.log('Looking for OID:', oid.toString())
    
    const member = await db.collection('members').findOne({ _id: oid })
    
    if (member) {
      console.log('✅ Found member:')
      console.log('Name:', member.name)
      console.log('Email:', member.email)
      console.log('Contract Type:', member.contract_type)
      console.log('Hourly Rate:', member.hourly_rate)
    } else {
      console.log('❌ Member not found with that OID')
    }
  } finally {
    await client.close()
  }
}

run().catch(console.error)
