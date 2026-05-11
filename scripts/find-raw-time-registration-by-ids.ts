/**
 * Look up Eitje shift ids (rawApiResponse.id) anywhere in eitje_raw_data.
 * Usage: npx tsx scripts/find-raw-time-registration-by-ids.ts [.env.digitalocean.local]
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
  const envPath = resolve(process.argv[2] ?? '.env.digitalocean.local')
  loadEnv(envPath)
  const uri = process.env.DATABASE_URL || process.env.MONGODB_URI
  if (!uri) throw new Error('No DATABASE_URL / MONGODB_URI')

  const ids = [
    27879466, 27897013, 27896900, 27895330, 27897009, 27896898, 27897008,
    27896699, 27896698, 27896695, 27896693,
    27929280, 27929004,
  ]
  const idStrs = ids.map(String)

  const client = new MongoClient(uri)
  await client.connect()
  const db = client.db(process.env.MONGODB_DB_NAME || 'daily-ops-db')
  const coll = db.collection('eitje_raw_data')

  const found = await coll
    .find({
      endpoint: 'time_registration_shifts',
      $or: [
        { 'rawApiResponse.id': { $in: ids } },
        { 'rawApiResponse.id': { $in: idStrs } },
      ],
    })
    .project({
      endpoint: 1,
      date: 1,
      'rawApiResponse.id': 1,
      'rawApiResponse.date': 1,
      'rawApiResponse.start': 1,
      'rawApiResponse.user.name': 1,
      'rawApiResponse.team.name': 1,
      'rawApiResponse.environment.name': 1,
      'rawApiResponse.type.name': 1,
    })
    .toArray()

  const byId = new Map<string, typeof found>()
  for (const d of found) {
    const id = (d.rawApiResponse as { id?: unknown } | undefined)?.id
    const k = id != null ? String(id) : ''
    if (!k) continue
    if (!byId.has(k)) byId.set(k, [])
    byId.get(k)!.push(d)
  }

  const rows: { shiftId: string; imported: string; count: number; detail: string }[] = []
  for (const id of ids) {
    const k = String(id)
    const docs = byId.get(k) ?? []
    if (docs.length === 0) {
      rows.push({ shiftId: k, imported: 'no', count: 0, detail: '—' })
      continue
    }
    const parts = docs.map((d) => {
      const r = d.rawApiResponse as Record<string, unknown>
      const u = r.user as { name?: string } | undefined
      const env = r.environment as { name?: string } | undefined
      const team = r.team as { name?: string } | undefined
      const ty = r.type as { name?: string } | undefined
      return `resourceDate=${r.date} doc.date=${d.date instanceof Date ? d.date.toISOString().slice(0, 10) : d.date} loc=${env?.name ?? '?'} user=${u?.name ?? '?'} team=${team?.name ?? '?'} type=${ty?.name ?? '?'} start=${r.start ?? '?' }`
    })
    rows.push({ shiftId: k, imported: 'yes', count: docs.length, detail: parts.join(' || ') })
  }

  await client.close()

  console.log(JSON.stringify(rows, null, 2))
  console.log('\n| Shift id (inbox) | In raw? | Docs | resourceDate / location / worker |')
  console.log('|---|:---:|---:|---|')
  for (const r of rows) {
    const d = r.detail.length > 120 ? r.detail.slice(0, 117) + '...' : r.detail
    console.log(`| ${r.shiftId} | ${r.imported} | ${r.count} | ${d} |`)
  }
})()
