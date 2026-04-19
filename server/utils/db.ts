/**
 * @registry-id: mongoDb
 * @last-modified: 2026-04-19T12:00:00.000Z
 * @description: Single MongoClient + DB name resolution for Nitro routes and services
 * @last-fix: [2026-04-19] Accept DATABASE_URL when MONGODB_URI unset (DO App Platform database binding)
 */
import { MongoClient, type Collection } from 'mongodb'
import { readFileSync, existsSync } from 'fs'
import { resolve } from 'path'

// Load parent dir .env.local / .env so Nuxt uses same MongoDB as Next when run from nuxt-app/
function loadParentEnv() {
  try {
    const root = resolve(process.cwd(), '..')
    for (const file of ['.env.local', '.env']) {
      const p = resolve(root, file)
      if (existsSync(p)) {
        const content = readFileSync(p, 'utf-8')
        for (const line of content.split('\n')) {
          const match = line.match(/^([^#=]+)=(.*)$/)
          if (match && !process.env[match[1].trim()]) {
            process.env[match[1].trim()] = match[2].trim().replace(/^["']|["']$/g, '')
          }
        }
      }
    }
  } catch {
    // ignore
  }
}
loadParentEnv()

/** Prefer cwd `.env.local` / `.env` for Mongo — parent-dir load can miss the app DB where `api_credentials` live. */
function loadCwdMongoEnv () {
  const root = resolve(process.cwd())
  for (const file of ['.env.local', '.env']) {
    const p = resolve(root, file)
    if (!existsSync(p)) continue
    for (const line of readFileSync(p, 'utf-8').split('\n')) {
      const match = line.match(/^([^#=]+)=(.*)$/)
      if (!match) continue
      const key = match[1].trim()
      if (key !== 'MONGODB_URI' && key !== 'MONGODB_DB_NAME') continue
      let val = match[2].trim().replace(/^["']|["']$/g, '')
      process.env[key] = val
    }
  }
}
loadCwdMongoEnv()

/** DB segment after host in MONGODB_URI (e.g. daily-ops-db); ignores when URI has no path. */
function parseDbNameFromMongoUri (uri: string): string | undefined {
  if (!uri) return undefined
  const noQuery = uri.split('?')[0] ?? ''
  const afterScheme = noQuery.replace(/^mongodb(\+srv)?:\/\//i, '')
  const slash = afterScheme.indexOf('/')
  if (slash < 0) return undefined
  const name = afterScheme.slice(slash + 1).replace(/\/$/, '')
  return name.length > 0 ? name : undefined
}

function mongoConnectionString (): string {
  return (process.env.MONGODB_URI || process.env.DATABASE_URL || '').trim()
}

function resolveMongoDbName (): string {
  const explicit = process.env.MONGODB_DB_NAME?.trim()
  if (explicit) return explicit
  const parsed = parseDbNameFromMongoUri(mongoConnectionString())
  if (parsed) return parsed
  return 'daily-ops-db'
}

const uri = mongoConnectionString() || 'mongodb://localhost:27017'
const dbName = resolveMongoDbName()

/** Resolved logical DB name (env, URI path, or default). For error messages. */
export function getMongoDatabaseName (): string {
  return dbName
}

let client: MongoClient | null = null

export async function getDb() {
  if (!client) {
    client = new MongoClient(uri)
    await client.connect()
  }
  return client.db(dbName)
}

export async function getNotesCollection(): Promise<Collection> {
  const db = await getDb()
  return db.collection('notes')
}

/** Uses unified_user (singular) – the collection with the latest correct users. */
export async function getUnifiedUsersCollection(): Promise<Collection> {
  const db = await getDb()
  return db.collection('unified_user')
}

export async function getMenuItemsCollection(): Promise<Collection> {
  const db = await getDb()
  return db.collection('menu_items')
}

export async function getMenusCollection(): Promise<Collection> {
  const db = await getDb()
  return db.collection('menus')
}

export async function getMenuVersionsCollection(): Promise<Collection> {
  const db = await getDb()
  return db.collection('menu_versions')
}

export async function connectToDatabase() {
  return getDb()
}
