/**
 * One-off: print shape of time_registration_shifts in eitje_raw_data + probe CSV support id fields.
 * Usage: npx tsx scripts/inspect-eitje-raw-shift-shape.ts [.env.digitalocean.local]
 */
import { readFileSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { MongoClient } from 'mongodb'

function loadEnv (p: string) {
  if (!existsSync(p)) return
  for (const line of readFileSync(p, 'utf8').split('\n')) {
    const m = line.match(/^([^#=]+)=(.*)$/)
    if (m) process.env[m[1].trim()] = m[2].trim().replace(/^["']|["']$/g, '')
  }
}

void (async () => {
  const envPath = resolve(process.argv[2] ?? '.env')
  loadEnv(envPath)
  const uri = process.env.DATABASE_URL || process.env.MONGODB_URI
  if (!uri) throw new Error('No DATABASE_URL / MONGODB_URI')
  const client = new MongoClient(uri)
  await client.connect()
  const db = client.db(process.env.MONGODB_DB_NAME || 'daily-ops-db')
  const coll = db.collection('eitje_raw_data')

  const total = await coll.countDocuments({ endpoint: 'time_registration_shifts' })
  console.log('DB:', process.env.MONGODB_DB_NAME || 'daily-ops-db', '| time_registration_shifts count:', total)

  const sample = await coll.findOne({ endpoint: 'time_registration_shifts' })
  const raw = sample?.rawApiResponse as Record<string, unknown> | undefined
  if (!raw) {
    console.log('No sample document found.')
    await client.close()
    return
  }
  console.log('\nSample rawApiResponse top-level keys:', Object.keys(raw).sort().join(', '))
  const pick = ['id', 'support_id', 'supportId', 'user_id', 'start', 'date', 'hours', 'user', 'team', 'environment', 'environment_id', 'location_name', 'environment_name']
  console.log('\nSample fields (subset):')
  for (const k of pick) {
    const v = raw[k]
    if (v === undefined) continue
    if (k === 'user' && v && typeof v === 'object') {
      const u = v as Record<string, unknown>
      console.log(`  user:`, JSON.stringify({ id: u.id, name: u.name, support_id: u.support_id }))
    } else {
      console.log(`  ${k}:`, typeof v === 'object' ? JSON.stringify(v).slice(0, 120) : v)
    }
  }
  console.log('\nextracted:', JSON.stringify(sample?.extracted ?? {}))

  const sid = 27896693
  const probes: Record<string, unknown>[] = [
    { 'rawApiResponse.id': sid },
    { 'rawApiResponse.id': String(sid) },
    { 'rawApiResponse.support_id': sid },
    { 'rawApiResponse.support_id': String(sid) },
    { 'extracted.supportId': sid },
    { 'extracted.supportId': String(sid) },
    { 'rawApiResponse.user.support_id': sid },
  ]
  console.log(`\nProbe CSV support id ${sid}:`)
  for (const q of probes) {
    const n = await coll.countDocuments({ endpoint: 'time_registration_shifts', ...q })
    if (n > 0) console.log('  MATCH', JSON.stringify(q), '→', n)
  }

  await client.close()
})()
