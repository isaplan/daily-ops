import { MongoClient, type Collection } from 'mongodb'

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
