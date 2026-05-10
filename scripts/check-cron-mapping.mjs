import { MongoClient } from 'mongodb'
import dotenv from 'dotenv'

dotenv.config()

const client = new MongoClient(process.env.MONGODB_URI)
try {
  await client.connect()
  const db = client.db(process.env.MONGODB_DB_NAME)
  
  const reports = await db.collection('inbox-bork-basis-report')
    .find({ date: { $in: ['2026-05-07', '2026-05-08'] } })
    .sort({ location: 1, date: 1, cron_hour: 1 })
    .toArray()
  
  console.log('Cron hour mapping:\n')
  
  const cronMap = {}
  for (const r of reports) {
    const key = `cron_${r.cron_hour}`
    if (!cronMap[key]) {
      cronMap[key] = {
        examples: [],
      }
    }
    cronMap[key].examples.push({
      date: r.date,
      location: r.location,
      received: r.received_at,
    })
  }
  
  for (const [cronKey, data] of Object.entries(cronMap).sort()) {
    console.log(`${cronKey}:`)
    for (const ex of data.examples.slice(0, 3)) {
      const receivedTime = new Date(ex.received).toLocaleTimeString('nl-NL', { timeZone: 'Europe/Amsterdam' })
      console.log(`  - Date: ${ex.date}, ${ex.location}, Received: ${receivedTime}`)
    }
  }
  
} finally {
  await client.close()
}
