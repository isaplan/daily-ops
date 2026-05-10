import { MongoClient } from 'mongodb'
import dotenv from 'dotenv'

dotenv.config()

const client = new MongoClient(process.env.MONGODB_URI)
try {
  await client.connect()
  const db = client.db(process.env.MONGODB_DB_NAME)
  
  // Search for the exact revenue numbers
  const numbers = [2492.40, 9266.7, 4706.21]
  
  for (const num of numbers) {
    const docs = await db.collection('inbox-bork-basis-report')
      .find({
        final_revenue_ex_vat: { $gte: num - 0.01, $lte: num + 0.01 }
      })
      .toArray()
    
    console.log(`\n€${num}:`)
    for (const doc of docs) {
      console.log(`  Location: ${doc.location}`)
      console.log(`  ISO Date: ${doc.date}, Business Date: ${doc.business_date}`)
      console.log(`  Cron Hour: ${doc.cron_hour}, Business Hour: ${doc.business_hour}`)
      console.log(`  Revenue: €${doc.final_revenue_ex_vat}`)
    }
  }
  
} finally {
  await client.close()
}
