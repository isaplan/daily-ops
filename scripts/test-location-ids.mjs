import { MongoClient } from 'mongodb'

console.log(`MONGODB_URI: ${process.env.MONGODB_URI}`)
console.log(`MONGODB_DB_NAME: ${process.env.MONGODB_DB_NAME}`)

const client = new MongoClient(process.env.MONGODB_URI || 'mongodb://localhost:27017')
try {
  await client.connect()
  const dbName = process.env.MONGODB_DB_NAME || 'daily-ops'
  console.log(`Connecting to database: ${dbName}`)
  const db = client.db(dbName)
  
  const all = await db.collection('inbox-bork-basis-report').find({}).limit(3).toArray()
  console.log(`Total sample count: ${all.length}`)
} finally {
  await client.close()
}
