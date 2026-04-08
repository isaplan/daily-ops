/**
 * Copy credential-related collections from a source MongoDB (default: local)
 * into the target DB from MONGODB_URI / MONGODB_DB_NAME (.env.local / .env).
 *
 * Typical: local `api_credentials` → DigitalOcean `daily-ops-db`.
 *
 * Usage (repo root):
 *   MIGRATE_CREDENTIALS_CONFIRM=1 node --experimental-strip-types scripts/migrate-credentials-to-remote.ts
 *
 * Env:
 *   SOURCE_MONGODB_URI      (default mongodb://127.0.0.1:27017)
 *   SOURCE_MONGODB_DB_NAME  (default daily-ops)
 *   MONGODB_URI             target (required) — e.g. DO connection string
 *   MONGODB_DB_NAME         target DB name (default daily-ops)
 *   MIGRATE_CREDENTIALS_CONFIRM=1  required to write (safety)
 *   MIGRATE_CREDENTIALS_DRY_RUN=1  only print what would be copied
 *   INCLUDE_INTEGRATION_CRON_JOBS=1  also sync integration_cron_jobs (Eitje/Bork cron rows)
 */
import { readFileSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { MongoClient } from 'mongodb'

function loadDotEnv () {
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

function redactMongoUri (uri: string): string {
  if (!uri) return '(empty)'
  const masked = uri.replace(/(mongodb(?:\+srv)?:\/\/)([^/@]+)(@)/, '$1***:***$3')
  return masked.length > 120 ? `${masked.slice(0, 120)}…` : masked
}

async function bulkReplaceCollection (
  targetDb: ReturnType<MongoClient['db']>,
  name: string,
  docs: Record<string, unknown>[]
): Promise<void> {
  if (docs.length === 0) {
    console.log(`  ${name}: (no documents)`)
    return
  }
  const ops = docs.map((doc) => ({
    replaceOne: {
      filter: { _id: doc._id },
      replacement: doc,
      upsert: true,
    },
  }))
  const r = await targetDb.collection(name).bulkWrite(ops, { ordered: false })
  console.log(
    `  ${name}: upserted ${r.upsertedCount}, modified ${r.modifiedCount}, matched ${r.matchedCount} (${docs.length} source docs)`
  )
}

async function main () {
  loadDotEnv()

  const targetUri = process.env.MONGODB_URI
  const targetDbName = process.env.MONGODB_DB_NAME || 'daily-ops'
  const sourceUri = process.env.SOURCE_MONGODB_URI || 'mongodb://127.0.0.1:27017'
  const sourceDbName = process.env.SOURCE_MONGODB_DB_NAME || 'daily-ops'
  const dryRun = process.env.MIGRATE_CREDENTIALS_DRY_RUN === '1' || process.env.MIGRATE_CREDENTIALS_DRY_RUN === 'true'
  const confirmed = process.env.MIGRATE_CREDENTIALS_CONFIRM === '1' || process.env.MIGRATE_CREDENTIALS_CONFIRM === 'yes'
  const includeCron = process.env.INCLUDE_INTEGRATION_CRON_JOBS === '1' || process.env.INCLUDE_INTEGRATION_CRON_JOBS === 'true'

  if (!targetUri) {
    console.error('Missing MONGODB_URI for target (DigitalOcean / production). Set in .env.local')
    process.exit(1)
  }

  console.log('Source:', redactMongoUri(sourceUri), 'db:', sourceDbName)
  console.log('Target:', redactMongoUri(targetUri), 'db:', targetDbName)
  if (dryRun) console.log('Mode: DRY RUN (no writes)')

  const sourceClient = new MongoClient(sourceUri)
  const targetClient = new MongoClient(targetUri)
  await sourceClient.connect()
  await targetClient.connect()

  const sourceDb = sourceClient.db(sourceDbName)
  const targetDb = targetClient.db(targetDbName)

  const credCount = await sourceDb.collection('api_credentials').countDocuments()
  const cronCount = includeCron
    ? await sourceDb.collection('integration_cron_jobs').countDocuments()
    : 0

  console.log(`\nSource api_credentials: ${credCount} document(s)`)
  if (includeCron) console.log(`Source integration_cron_jobs: ${cronCount} document(s)`)

  if (credCount === 0 && (!includeCron || cronCount === 0)) {
    console.error('Nothing to migrate from source.')
    await sourceClient.close()
    await targetClient.close()
    process.exit(1)
  }

  if (dryRun) {
    console.log('\nDry run only — set MIGRATE_CREDENTIALS_CONFIRM=1 to apply.')
    await sourceClient.close()
    await targetClient.close()
    return
  }

  if (!confirmed) {
    console.error(
      '\nRefusing to write without MIGRATE_CREDENTIALS_CONFIRM=1 (prevents accidental overwrite of production credentials).'
    )
    await sourceClient.close()
    await targetClient.close()
    process.exit(1)
  }

  console.log('\nWriting to target…')

  if (credCount > 0) {
    const creds = await sourceDb.collection('api_credentials').find({}).toArray()
    await bulkReplaceCollection(targetDb, 'api_credentials', creds)
  }

  if (includeCron && cronCount > 0) {
    const jobs = await sourceDb.collection('integration_cron_jobs').find({}).toArray()
    await bulkReplaceCollection(targetDb, 'integration_cron_jobs', jobs)
  }

  const afterCred = await targetDb.collection('api_credentials').countDocuments()
  console.log(`\nTarget api_credentials total count: ${afterCred}`)

  await sourceClient.close()
  await targetClient.close()
  console.log('Done.')
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
