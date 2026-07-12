import { MongoClient } from 'mongodb'

async function run() {
  const c = new MongoClient(process.env.MONGODB_URI!)
  await c.connect()
  const db = c.db(process.env.MONGODB_DB_NAME!)

  // Look at all collections to find anything storing per-worker cost info
  const cols = (await db.listCollections().toArray()).map((c) => c.name).filter((n) => /eitje|member|staff|user|wage|cost/i.test(n))
  console.log('Candidate collections:', cols)

  // For each, inspect first doc's keys and look for cost-ish fields
  for (const name of cols) {
    const cnt = await db.collection(name).countDocuments({})
    const one = await db.collection(name).findOne({})
    const keys = one ? Object.keys(one) : []
    const costKeys = keys.filter((k) => /cost|loaded|wage|salary|rate/i.test(k))
    console.log(`\n${name} (${cnt} docs)`)
    console.log(`  cost-ish keys: ${costKeys.length > 0 ? costKeys.join(', ') : '(none)'}`)
    if (costKeys.length > 0 && one) {
      for (const k of costKeys) console.log(`    ${k} = ${JSON.stringify(one[k])}`)
    }
  }

  // Raw Eitje data — look for time_registrations or users endpoint
  const eitjeRaw = await db.collection('eitje_raw_data').find({}).limit(5).project({ endpoint: 1, _id: 1 }).toArray().catch(() => [])
  console.log('\neitje_raw_data sample endpoints:', eitjeRaw.map((d) => d.endpoint))

  const endpoints = await db.collection('eitje_raw_data').distinct('endpoint').catch(() => [])
  console.log('eitje_raw_data distinct endpoints:', endpoints)

  // For each endpoint, sample one record and look for cost fields
  for (const ep of endpoints) {
    const sample = await db.collection('eitje_raw_data').findOne({ endpoint: ep })
    if (!sample) continue
    const flat = (obj: any, prefix = ''): string[] => {
      if (!obj || typeof obj !== 'object') return []
      const out: string[] = []
      for (const [k, v] of Object.entries(obj)) {
        const fk = prefix ? `${prefix}.${k}` : k
        if (/cost|loaded|wage|salary|rate/i.test(k)) out.push(`${fk}=${JSON.stringify(v).slice(0, 50)}`)
        if (v && typeof v === 'object' && !Array.isArray(v)) out.push(...flat(v, fk))
        else if (Array.isArray(v) && v.length > 0 && typeof v[0] === 'object') out.push(...flat(v[0], `${fk}[0]`))
      }
      return out
    }
    const hits = flat(sample.data ?? sample)
    if (hits.length > 0) {
      console.log(`\nendpoint=${ep} (one doc): cost-ish fields:`)
      for (const h of hits.slice(0, 15)) console.log(`  ${h}`)
    }
  }

  await c.close()
}
run().catch((e) => { console.error(e); process.exit(1) })
