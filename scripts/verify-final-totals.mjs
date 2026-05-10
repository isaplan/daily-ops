import { MongoClient } from 'mongodb'
import dotenv from 'dotenv'

dotenv.config()

const client = new MongoClient(process.env.MONGODB_URI)
try {
  await client.connect()
  const db = client.db(process.env.MONGODB_DB_NAME)
  
  const reports = await db.collection('inbox-bork-basis-report')
    .find({ business_date: '2026-05-07' })
    .toArray()
  
  console.log('FINAL REPORTS FOR BUSINESS DAY 2026-05-07\n')
  
  const byLoc = {}
  for (const r of reports) {
    if (!byLoc[r.location]) byLoc[r.location] = []
    byLoc[r.location].push(r)
  }
  
  const cronPriority = (cron) => {
    if (cron === 7) return 3   // Latest (cron 7 next morning closes the day)
    if (cron === 23) return 2  // Middle
    if (cron === 18) return 1  // Earliest
    return 0
  }
  
  let total = 0
  for (const [loc, docs] of Object.entries(byLoc).sort()) {
    const sorted = docs.sort((a, b) => {
      const pr = cronPriority(b.cron_hour ?? -1) - cronPriority(a.cron_hour ?? -1)
      return pr !== 0 ? pr : (b.cron_hour ?? -1) - (a.cron_hour ?? -1)
    })
    const final = sorted[0]
    const rev = Number(final.final_revenue_ex_vat)
    total += rev
    
    const cronTime = final.cron_hour === 7 ? '07:00 (next morning, ISO May 8)' : 
                     final.cron_hour === 23 ? '23:00 (ISO May 7)' : '18:00 (ISO May 7)'
    
    console.log(`${loc}: cron ${final.cron_hour} (${cronTime}) = €${rev.toFixed(2)}`)
  }
  
  console.log(`\n✅ FINAL TOTAL: €${total.toFixed(2)}`)
  
} finally {
  await client.close()
}
