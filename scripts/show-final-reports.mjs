import { MongoClient } from 'mongodb'
import dotenv from 'dotenv'

dotenv.config()

const client = new MongoClient(process.env.MONGODB_URI)
try {
  await client.connect()
  const db = client.db(process.env.MONGODB_DB_NAME)
  
  console.log('📋 FINAL REPORTS (highest cron_hour per location) FOR BUSINESS DAY 2026-05-07\n')
  console.log('=' .repeat(100))
  
  const reports = await db.collection('inbox-bork-basis-report')
    .find({ date: '2026-05-07' })
    .sort({ location: 1 })
    .toArray()
  
  let grandTotal = 0
  const byLoc = {}
  
  for (const doc of reports) {
    if (!byLoc[doc.location]) {
      byLoc[doc.location] = []
    }
    byLoc[doc.location].push(doc)
  }
  
  for (const [location, docs] of Object.entries(byLoc)) {
    const sorted = docs.sort((a, b) => (b.cron_hour ?? -1) - (a.cron_hour ?? -1))
    const final = sorted[0]
    const revExVat = Number(final.final_revenue_ex_vat || 0)
    grandTotal += revExVat
    
    console.log(`
📍 ${location}
  Final report (highest cron_hour):
  - Cron hour: ${final.cron_hour} (ISO date: 2026-05-${final.cron_hour === 7 ? '08' : '07'})
  - Business hour: ${final.business_hour}
  - Received: ${final.received_at}
  - Revenue (ex-VAT): €${revExVat.toFixed(2)}
  
  Other reports for this location (ignored):
`)
    for (let i = 1; i < sorted.length; i++) {
      console.log(`  - Cron ${sorted[i].cron_hour}: €${Number(sorted[i].final_revenue_ex_vat || 0).toFixed(2)}`)
    }
  }
  
  console.log('\n' + '='.repeat(100))
  console.log(`\n✅ FINAL TOTAL (using only highest cron_hour per location): €${grandTotal.toFixed(2)}\n`)
  console.log(`This is your FINAL REVENUE for Business Day May 7 (available at 08:05 cron every morning)\n`)
  
} finally {
  await client.close()
}
