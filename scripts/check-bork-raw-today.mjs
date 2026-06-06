import { MongoClient, ObjectId } from 'mongodb'
import 'dotenv/config'

const uri = process.env.MONGODB_URI
const client = new MongoClient(uri)
const today = '2026-06-06'
const kinsId = new ObjectId('69d6cfa63d2adf93b79d1ae7')

function isOpen(ticket) {
  return Number(ticket?.ActualDate) === 10101
}

try {
  await client.connect()
  const db = client.db()

  const raw = await db.collection('bork_raw_data').find({
    business_date: today,
    locationId: kinsId,
  }).limit(1).toArray()

  console.log('bork_raw_data docs for today Kinsbergen:', await db.collection('bork_raw_data').countDocuments({
    business_date: today,
    locationId: kinsId,
  }))

  // Try alternate field names
  const raw2 = await db.collection('bork_raw_data').countDocuments({
    date: { $gte: new Date(`${today}T00:00:00Z`), $lte: new Date(`${today}T23:59:59Z`) },
  })
  console.log('bork_raw_data by date field today:', raw2)

  const sample = await db.collection('bork_raw_data').findOne({}, { sort: { _id: -1 } })
  if (sample) {
    console.log('\nLatest raw doc keys:', Object.keys(sample).slice(0, 15))
    console.log('business_date:', sample.business_date)
    console.log('locationId:', sample.locationId)
    console.log('_id time:', sample._id.getTimestamp().toISOString())
  }

  // Check orders in business day doc
  const day = await db.collection('bork_business_days_v2').findOne({
    business_date: today,
    locationId: kinsId,
  })
  if (day) {
    console.log('\nDay doc ticket_count:', day.ticket_count ?? day.total_tickets)
    console.log('open_tickets excluded?', day.meta)
  }
} finally {
  await client.close()
}
