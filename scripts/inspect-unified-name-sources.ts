import { MongoClient } from 'mongodb'
const URI = process.env.MONGODB_URI!
const DB = process.env.MONGODB_DB_NAME ?? 'daily-ops-db'

async function run() {
  const client = new MongoClient(URI)
  await client.connect()
  const db = client.db(DB)

  console.log('=== locations / unified_location collections ===')
  const allCols = (await db.listCollections().toArray()).map((c) => c.name).sort()
  console.log('location-ish:', allCols.filter((n) => /location/i.test(n)))
  console.log('user-ish:', allCols.filter((n) => /user/i.test(n)))
  const locs = await db.collection('locations').findOne({})
  console.log('locations sample:', locs ? Object.keys(locs) : 'empty')

  console.log('\n=== bork_unified_location_mapping ===')
  const lm = await db.collection('bork_unified_location_mapping').findOne({})
  console.log({ keys: lm ? Object.keys(lm) : null, sample: lm })

  console.log('\n=== users-ish collections ===')
  const userCols = allCols.filter((n) => /user|member|worker/i.test(n))
  for (const c of userCols) {
    const s = await db.collection(c).findOne({})
    console.log(`  ${c}:`, s ? Object.keys(s).slice(0, 15) : 'empty')
  }

  console.log('\n=== eitje_teams (?) ===')
  const eitje_teams = await db.listCollections({ name: /team/i }).toArray()
  console.log('team-ish collections:', eitje_teams.map((c) => c.name))
  for (const c of eitje_teams) {
    const sample = await db.collection(c.name).findOne({})
    console.log(`  ${c.name}:`, sample ? Object.keys(sample) : 'empty')
  }

  await client.close()
}
run().catch((e) => { console.error(e); process.exit(1) })
