/**
 * @task-id: backfill-eitje-hours-from-parseddatas
 * @description: Import all 43 parsed Eitje hours documents from parseddatas into inbox-eitje-hours
 * @run: MONGODB_URI=... npx tsx ./server/tasks/backfill-eitje-hours-from-parseddatas.ts
 */

import { MongoClient } from 'mongodb'

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/daily-ops'

async function backfillEitjeHours() {
  const client = new MongoClient(MONGODB_URI)
  
  try {
    await client.connect()
    const db = client.db()
    const parsedCol = db.collection('parseddatas')
    const inboxCol = db.collection('inbox-eitje-hours')
    
    console.log('[backfill-eitje-hours] Starting import from parseddatas...')
    
    // Get all Eitje hours parsed documents
    const parsedDocs = await parsedCol
      .find({ documentType: 'hours' })
      .toArray()
    
    console.log(`[backfill-eitje-hours] Found ${parsedDocs.length} parsed documents`)
    
    let totalRowsInserted = 0
    const operations = []
    
    for (const parsed of parsedDocs) {
      const rows = parsed.data?.rows || []
      
      for (const row of rows) {
        // Transform parsed row into inbox-eitje-hours document
        const doc = {
          ...row,
          source: 'inbox',
          importedAt: parsed.created_at || new Date(),
          sourceEmailId: parsed.emailId,
          sourceParsedDataId: parsed._id,
          cron_priority: 0, // Eitje hours don't have cron_hour tracking
          cron_hour: undefined,
        }
        
        operations.push({
          insertOne: {
            document: doc,
          },
        })
        
        totalRowsInserted++
      }
    }
    
    if (operations.length === 0) {
      console.log('[backfill-eitje-hours] No rows to insert')
      return
    }
    
    // Execute bulk write
    const result = await inboxCol.bulkWrite(operations)
    
    console.log(`[backfill-eitje-hours] Inserted ${result.insertedCount} documents`)
    console.log(`[backfill-eitje-hours] Total rows processed: ${totalRowsInserted}`)
    console.log(`[backfill-eitje-hours] Backfill complete`)
  } finally {
    await client.close()
  }
}

backfillEitjeHours().catch(console.error)
