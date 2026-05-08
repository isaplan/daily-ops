import { MongoClient } from 'mongodb'
import dotenv from 'dotenv'

dotenv.config()

const client = new MongoClient(process.env.MONGODB_URI)
try {
  await client.connect()
  const db = client.db(process.env.MONGODB_DB_NAME)
  
  // List all collections
  const collections = await db.listCollections().toArray()
  const inboxCollections = collections.filter(c => c.name.includes('inbox'))
  
  console.log('Inbox collections found:')
  for (const col of inboxCollections) {
    console.log(`  - ${col.name}`)
  }
  
  // Collections to DELETE (unused)
  const toDelete = [
    'inbox-bork-sales',
    'inbox-emails',
    'inbox-attachments',
    'inbox-processing-log',
  ]
  
  console.log('\nDeleting unused collections:')
  for (const colName of toDelete) {
    try {
      const exists = await db.collection(colName).countDocuments({}).then(c => c > 0 || true).catch(() => false)
      if (exists || collections.find(c => c.name === colName)) {
        await db.collection(colName).drop()
        console.log(`  ✅ Deleted: ${colName}`)
      }
    } catch (e) {
      console.log(`  ⏭️  Skipped (doesn't exist): ${colName}`)
    }
  }
  
  console.log('\nRemaining inbox collections (to keep):')
  const finalCollections = await db.listCollections().toArray()
  const finalInbox = finalCollections.filter(c => c.name.includes('inbox'))
  for (const col of finalInbox) {
    console.log(`  ✅ ${col.name}`)
  }
  
} finally {
  await client.close()
}
