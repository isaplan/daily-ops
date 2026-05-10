import { MongoClient } from 'mongodb'
import dotenv from 'dotenv'

dotenv.config()

const client = new MongoClient(process.env.MONGODB_URI)
try {
  await client.connect()
  const db = client.db(process.env.MONGODB_DB_NAME)
  
  console.log('📋 INBOX BASIS REPORT DOCUMENTS FOR 2026-05-07\n')
  console.log('=' .repeat(120))
  
  const reports = await db.collection('inbox-bork-basis-report')
    .find({ date: '2026-05-07' })
    .sort({ location: 1, cron_hour: 1 })
    .toArray()
  
  if (reports.length === 0) {
    console.log('No reports found')
    process.exit(0)
  }
  
  console.log(`Found ${reports.length} reports\n`)
  
  let grandTotal = 0
  let currentLocation = null
  let locationTotal = 0
  
  for (const doc of reports) {
    if (currentLocation !== doc.location) {
      if (currentLocation !== null) {
        console.log(`\n  ├─ LOCATION SUBTOTAL: €${locationTotal.toFixed(2)}\n`)
      }
      currentLocation = doc.location
      locationTotal = 0
      console.log(`\n📍 LOCATION: ${doc.location} (location_id: ${doc.location_id || 'null'})`)
      console.log('─'.repeat(120))
    }
    
    const revExVat = Number(doc.final_revenue_ex_vat || 0)
    locationTotal += revExVat
    grandTotal += revExVat
    
    console.log(`
  Email ID: ${doc._id}
  Received at: ${doc.received_at || 'unknown'}
  Business hour: ${doc.business_hour} | Cron hour: ${doc.cron_hour}
  Business date: ${doc.business_date || 'unknown'}
  Date (ISO): ${doc.date}
  Final revenue (ex VAT): €${revExVat.toFixed(2)}
    `)
  }
  
  if (currentLocation !== null) {
    console.log(`  ├─ LOCATION SUBTOTAL: €${locationTotal.toFixed(2)}`)
  }
  
  console.log('\n' + '='.repeat(120))
  console.log(`\n🎯 GRAND TOTAL (all locations): €${grandTotal.toFixed(2)}\n`)
  
} finally {
  await client.close()
}
