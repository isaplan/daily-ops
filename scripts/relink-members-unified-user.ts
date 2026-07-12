/**
 * Force relink every members.unified_user_id from support_id + name.
 * Usage: npx tsx scripts/relink-members-unified-user.ts
 */
import { readFileSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { MongoClient, ObjectId } from 'mongodb'
import { linkMemberUnifiedUserId } from '../server/utils/memberEitjeContext.ts'

function loadDotEnv () {
  for (const file of ['.env.local', '.env', '.env.digitalocean.local']) {
    const p = resolve(process.cwd(), file)
    if (!existsSync(p)) continue
    for (const line of readFileSync(p, 'utf-8').split('\n')) {
      const m = line.match(/^([^#=]+)=(.*)$/)
      if (m && process.env[m[1].trim()] === undefined) {
        process.env[m[1].trim()] = m[2].trim().replace(/^["']|["']$/g, '')
      }
    }
  }
}

async function main (): Promise<void> {
  loadDotEnv()
  const uri = process.env.MONGODB_URI || process.env.DATABASE_URL
  if (!uri) throw new Error('Missing MONGODB_URI')
  const client = new MongoClient(uri)
  await client.connect()
  const db = client.db(process.env.MONGODB_DB_NAME || 'daily-ops-db')
  const members = await db.collection('members').find({}).toArray()
  let linked = 0
  for (const m of members) {
    if (!(m._id instanceof ObjectId)) continue
    await db.collection('members').updateOne({ _id: m._id }, { $unset: { unified_user_id: '' } })
    const uid = await linkMemberUnifiedUserId(
      db,
      m._id,
      typeof m.support_id === 'string' ? m.support_id : undefined,
      String(m.name ?? ''),
    )
    if (uid) linked++
  }
  console.log(`[relink-members] linked=${linked}/${members.length}`)
  await client.close()
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
