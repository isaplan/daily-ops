import { MongoClient } from 'mongodb'

async function run() {
  const c = new MongoClient(process.env.MONGODB_URI!)
  await c.connect()
  const db = c.db(process.env.MONGODB_DB_NAME!)

  const dupes = await db.collection('eitje_time_registration_aggregation').aggregate([
    { $match: { period_type: 'day' } },
    { $group: { _id: { period: '$period', locationId: '$locationId', userId: '$userId', teamId: '$teamId' }, n: { $sum: 1 } } },
    { $match: { n: { $gt: 1 } } },
    { $count: 'dupKeys' },
  ]).toArray()

  const total = await db.collection('eitje_time_registration_aggregation').countDocuments({ period_type: 'day' })
  const unique = await db.collection('eitje_time_registration_aggregation').aggregate([
    { $match: { period_type: 'day' } },
    { $group: { _id: { period: '$period', locationId: '$locationId', userId: '$userId', teamId: '$teamId' } } },
    { $count: 'distinct' },
  ]).toArray()

  console.log({
    total_day_rows: total,
    distinct_keys: unique[0]?.distinct ?? 0,
    duplicated_key_count: dupes[0]?.dupKeys ?? 0,
    extra_rows: total - (unique[0]?.distinct ?? 0),
  })

  // Show a few example duplicated keys
  const sampleDupes = await db.collection('eitje_time_registration_aggregation').aggregate([
    { $match: { period_type: 'day' } },
    { $group: { _id: { period: '$period', locationId: '$locationId', userId: '$userId', teamId: '$teamId' }, n: { $sum: 1 }, ids: { $push: '$_id' } } },
    { $match: { n: { $gt: 1 } } },
    { $limit: 3 },
  ]).toArray()
  console.log('Sample dupes:', JSON.stringify(sampleDupes, null, 2))

  await c.close()
}
run().catch((e) => { console.error(e); process.exit(1) })
