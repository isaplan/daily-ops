import { MongoClient } from 'mongodb'
import dotenv from 'dotenv'

dotenv.config()

const client = new MongoClient(process.env.MONGODB_URI)
try {
  await client.connect()
  const db = client.db(process.env.MONGODB_DB_NAME)
  
  // "Yesterday" from dashboard is business date 2026-05-07
  // Which has reports from 3 crons (18:00 May 7, 23:00 May 7, 07:00 May 8)
  
  const reports = await db.collection('inbox-bork-basis-report')
    .find({ business_date: '2026-05-07' })
    .sort({ location: 1, cron_hour: -1 })
    .toArray()
  
  console.log('📊 BUSINESS DAY 2026-05-07 (Yesterday)\n')
  console.log('=' .repeat(120))
  
  let grandTotal = 0
  const byLoc = {}
  
  for (const doc of reports) {
    if (!byLoc[doc.location]) byLoc[doc.location] = []
    byLoc[doc.location].push(doc)
  }
  
  for (const [location, docs] of Object.entries(byLoc)) {
    const sorted = docs.sort((a, b) => (b.cron_hour ?? -1) - (a.cron_hour ?? -1))
    const final = sorted[0]
    const rev = Number(final.final_revenue_ex_vat || 0)
    grandTotal += rev
    
    const cronTime = final.cron_hour === 7 ? '08:05 (morning, next day)' : final.cron_hour === 18 ? '18:05 (evening)' : '23:05 (night)'
    const isoDate = final.cron_hour === 7 ? 'May 8' : 'May 7'
    
    console.log(`
📍 ${location}
  ✅ FINAL REPORT (highest cron_hour for this business day):
     Cron: ${cronTime} (ISO date: ${isoDate})
     Business hour: ${final.business_hour} (in 06:00-05:59 day)
     Received: ${final.received_at}
     Revenue (ex-VAT): €${rev.toFixed(2)}
  
  📋 Other reports for this business day (ignored - partial):
`)
    for (let i = 1; i < sorted.length; i++) {
      const cronT = sorted[i].cron_hour
      const cronName = cronT === 7 ? '07:00/08:05 (morning)' : cronT === 18 ? '18:00/18:05 (evening)' : '23:00/23:05 (night)'
      const revI = Number(sorted[i].final_revenue_ex_vat || 0)
      console.log(`     - ${cronName}: €${revI.toFixed(2)} (ignored)`)
    }
  }
  
  console.log('\n' + '='.repeat(120))
  console.log(`\n✅ FINAL TOTAL FOR BUSINESS DAY MAY 7: €${grandTotal.toFixed(2)}`)
  console.log(`(Available at 08:05 cron on May 8)\n`)
  
} finally {
  await client.close()
}
