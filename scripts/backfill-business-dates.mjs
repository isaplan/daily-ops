import { MongoClient } from 'mongodb'
import dotenv from 'dotenv'

dotenv.config()

function calendarToBusinessDay(dateStr, cronHour) {
  if (cronHour >= 8 && cronHour <= 23) {
    return { businessDate: dateStr, businessHour: cronHour - 8 }
  }
  const [y, m, d] = dateStr.split('-').map(Number)
  const dt = new Date(Date.UTC(y, m - 1, d - 1))
  const yy = dt.getUTCFullYear()
  const mm = String(dt.getUTCMonth() + 1).padStart(2, '0')
  const dd = String(dt.getUTCDate()).padStart(2, '0')
  return {
    businessDate: `${yy}-${mm}-${dd}`,
    businessHour: cronHour + 16,
  }
}

const client = new MongoClient(process.env.MONGODB_URI)
try {
  await client.connect()
  const db = client.db(process.env.MONGODB_DB_NAME)
  
  console.log('🔄 Backfilling business_date for all inbox-bork-basis-report documents...\n')
  
  const reports = await db.collection('inbox-bork-basis-report')
    .find({ business_date: { $exists: false } })
    .toArray()
  
  console.log(`Found ${reports.length} documents without business_date\n`)
  
  let updated = 0
  for (const doc of reports) {
    if (!doc.cron_hour || !doc.date) continue
    
    const { businessDate, businessHour } = calendarToBusinessDay(doc.date, doc.cron_hour)
    
    await db.collection('inbox-bork-basis-report').updateOne(
      { _id: doc._id },
      { $set: { business_date: businessDate, business_hour: businessHour } }
    )
    
    updated++
    if (updated % 10 === 0) {
      console.log(`✅ Updated ${updated}/${reports.length}`)
    }
  }
  
  console.log(`\n✅ Backfill complete! Updated ${updated} documents\n`)
  
  // Show sample after backfill
  const sample = await db.collection('inbox-bork-basis-report')
    .findOne({ date: '2026-05-07' })
  
  if (sample) {
    console.log('Sample after backfill:')
    console.log(`  Date (ISO): ${sample.date}`)
    console.log(`  Business date: ${sample.business_date}`)
    console.log(`  Cron hour: ${sample.cron_hour}`)
    console.log(`  Business hour: ${sample.business_hour}\n`)
  }
  
} finally {
  await client.close()
}
