import { readFileSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { MongoClient } from 'mongodb'

function loadDotEnv() {
  for (const file of ['.env.local', '.env']) {
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

async function main() {
  loadDotEnv()
  const uri = process.env.MONGODB_URI || process.env.DATABASE_URL
  const dbName = process.env.MONGODB_DB_NAME || 'daily-ops'
  
  console.log('URI:', uri?.slice(0, 50) + '...')
  console.log('DB:', dbName)
  
  const client = new MongoClient(uri.trim())
  await client.connect()
  const db = client.db(dbName)
  
  console.log('Connected!')
  
  const count = await db.collection('bork_raw_data').countDocuments()
  console.log('bork_raw_data count:', count)
  
  const one = await db.collection('bork_raw_data').findOne({}, { projection: { 'order.Date': 1 } })
  console.log('Sample doc:', JSON.stringify(one, null, 2))
  
  await client.close()
}

main().catch(e => {
  console.error(e)
  process.exit(1)
})
