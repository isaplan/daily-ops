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

const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017'
const dbName = process.env.MONGODB_DB_NAME || 'daily-ops'

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
