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
  
  const client = new MongoClient(uri.trim())
  await client.connect()
  const db = client.db(dbName)

  const collections = await db.listCollections().toArray()
  const borkCollections = collections.filter(c => c.name.includes('bork')).map(c => c.name)
  
  console.log('Bork collections:')
  for (const col of borkCollections) {
    const count = await db.collection(col).countDocuments()
    console.log(`  ${col}: ${count} docs`)
  }
  
  await client.close()
}

main().catch(e => {
  console.error(e)
  process.exit(1)
})
