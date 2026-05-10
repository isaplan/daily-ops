import { MongoClient } from 'mongodb'
import dotenv from 'dotenv'

dotenv.config()

const client = new MongoClient(process.env.MONGODB_URI)
try {
  await client.connect()
  const db = client.db(process.env.MONGODB_DB_NAME)
  
  // Find the exact documents from the screenshot
  console.log('l\'Amour €2167.19 (business_day 2026-05-07, business_hour 23):\n')
  let docs = await db.collection('inbox-bork-basis-report')
    .find({
      location: { $regex: 'Amour', $options: 'i' },
      business_date: '2026-05-07',
      business_hour: 23,
      final_revenue_ex_vat: { $gte: 2167, $lte: 2168 }
    })
    .toArray()
  
  for (const doc of docs) {
    console.log(JSON.stringify(doc, null, 2))
  }
  
  console.log('\n\nBar Bea €8022.32 (business_day 2026-05-07, business_hour 23):\n')
  docs = await db.collection('inbox-bork-basis-report')
    .find({
      location: { $regex: 'Barbea|Bar Bea', $options: 'i' },
      business_date: '2026-05-07',
      business_hour: 23,
      final_revenue_ex_vat: { $gte: 8022, $lte: 8023 }
    })
    .toArray()
  
  for (const doc of docs) {
    console.log(JSON.stringify(doc, null, 2))
  }
  
} finally {
  await client.close()
}
