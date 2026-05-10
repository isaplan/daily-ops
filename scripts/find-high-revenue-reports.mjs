import { MongoClient } from 'mongodb'
import dotenv from 'dotenv'

dotenv.config()

const client = new MongoClient(process.env.MONGODB_URI)
try {
  await client.connect()
  const db = client.db(process.env.MONGODB_DB_NAME)
  
  console.log('Finding the EXACT reports shown on /daily-ops/inbox/bork-sales:\n')
  
  // Look for Bar Bea with revenue ~€9266
  const barBea = await db.collection('inbox-bork-basis-report')
    .find({ 
      location: 'Bar Bea',
      business_date: '2026-05-07',
      final_revenue_ex_vat: { $gt: 9000 }
    })
    .toArray()
  
  console.log('Bar Bea with revenue ~€9,266:')
  for (const doc of barBea) {
    console.log(`  cron_hour: ${doc.cron_hour}, revenue: €${doc.final_revenue_ex_vat}`)
  }
  
  // Look for Van Kinsbergen with revenue ~€4706
  const vk = await db.collection('inbox-bork-basis-report')
    .find({
      location: 'Van Kinsbergen',
      business_date: '2026-05-07',
      final_revenue_ex_vat: { $gt: 4500, $lt: 5000 }
    })
    .toArray()
  
  console.log('\nVan Kinsbergen with revenue ~€4,706:')
  for (const doc of vk) {
    console.log(`  cron_hour: ${doc.cron_hour}, revenue: €${doc.final_revenue_ex_vat}`)
  }
  
  // All reports for business day 7
  const all = await db.collection('inbox-bork-basis-report')
    .find({ business_date: '2026-05-07' })
    .sort({ location: 1, final_revenue_ex_vat: -1 })
    .toArray()
  
  console.log('\n\nALL reports for business_date 2026-05-07 (sorted by revenue DESC):')
  for (const doc of all) {
    console.log(`${doc.location} - cron ${doc.cron_hour}: €${doc.final_revenue_ex_vat}`)
  }
  
} finally {
  await client.close()
}
