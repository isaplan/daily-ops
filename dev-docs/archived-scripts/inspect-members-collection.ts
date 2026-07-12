import { MongoClient } from 'mongodb'

async function run() {
  const c = new MongoClient(process.env.MONGODB_URI!)
  await c.connect()
  const db = c.db(process.env.MONGODB_DB_NAME!)

  const total = await db.collection('members').countDocuments({})
  console.log(`members total docs: ${total}`)

  const sample = await db.collection('members').findOne({})
  console.log('\nFirst member doc keys:', sample ? Object.keys(sample).join(', ') : '—')
  if (sample) console.log('Sample:', JSON.stringify(sample, null, 2).slice(0, 1500))

  const withCph = await db.collection('members').countDocuments({ cost_per_hour: { $exists: true, $ne: null } })
  const withEitjeId = await db.collection('members').countDocuments({ eitje_id: { $exists: true } })
  const withEitjeIds = await db.collection('members').countDocuments({ eitje_ids: { $exists: true } })
  console.log(`\nmembers with cost_per_hour: ${withCph}/${total}`)
  console.log(`members with eitje_id:  ${withEitjeId}/${total}`)
  console.log(`members with eitje_ids: ${withEitjeIds}/${total}`)

  const distinctIdFields = await db.collection('members').aggregate([
    { $project: { keys: { $objectToArray: '$$ROOT' } } },
    { $unwind: '$keys' },
    { $match: { 'keys.k': { $regex: 'eitje', $options: 'i' } } },
    { $group: { _id: '$keys.k', count: { $sum: 1 } } },
  ]).toArray()
  console.log('\nFields containing "eitje":', distinctIdFields)

  // Look for one of the Kinsbergen workers (Eric Falter)
  const eric = await db.collection('members').findOne({
    $or: [
      { first_name: 'Eric', last_name: 'Falter' },
      { name: { $regex: /eric.*falter/i } },
      { full_name: { $regex: /eric.*falter/i } },
    ],
  })
  console.log('\nLooking up "Eric Falter":', eric ? JSON.stringify(eric, null, 2).slice(0, 1200) : 'NOT FOUND')

  // Inspect actual eitje row userId format
  const eRow = await db.collection('eitje_time_registration_aggregation').findOne({ period: '2026-05-12' })
  console.log('\neitje row userId sample:', eRow?.userId, 'typeof:', typeof eRow?.userId)

  await c.close()
}
run().catch((e) => { console.error(e); process.exit(1) })
