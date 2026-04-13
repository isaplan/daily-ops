/**
 * Sync last 7 days raw Bork data and aggregate to TEST collections
 * Usage: BORK_BACKFILL_CONFIRM=1 node --experimental-strip-types scripts/bork-last-7-days-test.ts
 */

import { readFileSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { MongoClient, type Db } from 'mongodb'
import { rebuildBorkSalesAggregation } from '../server/services/borkRebuildAggregationService.ts'

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

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms))

async function syncLastSevenDays() {
  if (!process.env.BORK_BACKFILL_CONFIRM) {
    console.error('❌ Missing BORK_BACKFILL_CONFIRM=1')
    process.exit(1)
  }

  loadDotEnv()

  const mongoUri = process.env.MONGODB_URI
  const dbName = process.env.MONGODB_DB_NAME
  if (!mongoUri || !dbName) {
    console.error('❌ Missing MONGODB_URI or MONGODB_DB_NAME')
    process.exit(1)
  }

  const client = new MongoClient(mongoUri)
  try {
    await client.connect()
    const db = client.db(dbName)
    
    console.log('🔄 Starting last 7 days sync + TEST aggregation...')
    
    // Calculate date range: last 7 days
    const endDate = new Date()
    const startDate = new Date(endDate)
    startDate.setDate(startDate.getDate() - 7)
    
    const startIso = startDate.toISOString().split('T')[0]
    const endIso = endDate.toISOString().split('T')[0]
    
    console.log(`📅 Date range: ${startIso} to ${endIso}`)
    
    // Step 1: Sync raw data from Bork API
    console.log('📥 Fetching raw data from Bork API...')
    await syncBorkRawData(db, startIso, endIso)
    
    // Step 2: Rebuild aggregations into TEST collections
    console.log('🏗️  Building TEST aggregations...')
    const aggStart = startIso
    const aggEndDate = new Date(endIso)
    aggEndDate.setDate(aggEndDate.getDate() + 1)
    const aggEnd = aggEndDate.toISOString().split('T')[0]
    
    await rebuildBorkSalesAggregation(db, aggStart, aggEnd, '_test')
    
    console.log('✅ Complete! Check TEST collections:')
    console.log('  - bork_sales_by_hour_test')
    console.log('  - bork_sales_by_table_test')
    console.log('  - bork_sales_by_worker_test')
    console.log('  - bork_sales_by_cron_test')
    console.log('  - bork_sales_by_guest_account_test')
    
  } finally {
    await client.close()
  }
}

async function syncBorkRawData(db: Db, startDate: string, endDate: string) {
  const col = db.collection('bork_raw_data')
  
  // Get location mapping
  const locationMapping = await db.collection('bork_unified_location_mapping').find({}).toArray()
  const locationMap = new Map(locationMapping.map(doc => [doc.borkLocationId, doc.unifiedLocationName]))
  
  // Get master data first
  console.log('  📦 Fetching master data...')
  await fetchBorkMasterData(db)
  
  // Date range
  let current = new Date(startDate)
  const end = new Date(endDate)
  let fetchedDays = 0
  let skippedDays = 0
  
  while (current <= end) {
    const dateStr = current.toISOString().split('T')[0]
    const dateNum = dateStr.replace(/-/g, '')
    
    // Check if day already exists
    const existingCount = await col.countDocuments({ date: dateStr })
    
    if (existingCount > 0) {
      console.log(`  ⏭️  ${dateStr} - already synced (${existingCount} records)`)
      skippedDays++
      current.setDate(current.getDate() + 1)
      continue
    }
    
    // Fetch day for each location
    console.log(`  🔄 ${dateStr}...`)
    for (const [borkLocId, unifiedName] of locationMap) {
      const ticketUrl = `https://www.borkapp.com/api/ticket/day.json/${dateNum}?location=${borkLocId}`
      
      try {
        const resp = await fetch(ticketUrl)
        if (!resp.ok) {
          console.log(`    ❌ ${unifiedName} - ${resp.status}`)
          continue
        }
        
        const tickets = await resp.json() as any[]
        if (!Array.isArray(tickets)) {
          console.log(`    ⚠️  ${unifiedName} - invalid response`)
          continue
        }
        
        // Process tickets
        if (tickets.length > 0) {
          const docs = tickets.map((t: any) => ({
            date: dateStr,
            hour: new Date(t.time).getUTCHours(),
            locationId: borkLocId,
            locationName: unifiedName,
            revenue: t.total_excl || 0,
            ticketId: t.id,
            timestamp: new Date(t.time),
            raw: t
          }))
          
          await col.insertMany(docs)
          console.log(`    ✅ ${unifiedName} - ${tickets.length} tickets`)
        } else {
          // Store placeholder for empty days
          await col.insertOne({
            date: dateStr,
            locationId: borkLocId,
            locationName: unifiedName,
            isEmpty: true,
            timestamp: new Date()
          })
          console.log(`    ✅ ${unifiedName} - empty day (placeholder)`)
        }
        
        await sleep(75) // Rate limit
      } catch (err: any) {
        console.log(`    ❌ ${unifiedName} - ${err.message}`)
      }
    }
    
    fetchedDays++
    current.setDate(current.getDate() + 1)
    await sleep(200)
  }
  
  console.log(`\n  📊 Synced: ${fetchedDays} days, Skipped: ${skippedDays} days`)
}

async function fetchBorkMasterData(db: Db) {
  const masterEndpoints = [
    { collection: 'bork_products_master', path: '/catalog/productlist.json' }
  ]
  
  for (const { collection, path } of masterEndpoints) {
    try {
      const resp = await fetch(`https://www.borkapp.com/api${path}`)
      if (!resp.ok) continue
      
      const data = await resp.json()
      const col = db.collection(collection)
      await col.deleteMany({})
      await col.insertMany(Array.isArray(data) ? data : [data])
      console.log(`    ✅ ${collection}`)
    } catch (err) {
      console.log(`    ⚠️  ${collection} - skipped`)
    }
  }
}

syncLastSevenDays().catch(err => {
  console.error('❌ Fatal error:', err)
  process.exit(1)
})
