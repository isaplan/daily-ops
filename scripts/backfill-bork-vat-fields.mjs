/**
 * Backfill script: Add both total_revenue_ex_vat and total_revenue_incl_vat to bork_business_days_v2
 * 
 * Each document currently has only `total_revenue` (incl VAT).
 * This script adds:
 * - total_revenue_incl_vat (copy of total_revenue)
 * - total_revenue_ex_vat (total_revenue / 1.21)
 */

import { MongoClient } from 'mongodb'
import dotenv from 'dotenv'

dotenv.config()

const client = new MongoClient(process.env.MONGODB_URI)

async function backfill() {
  try {
    await client.connect()
    const db = client.db(process.env.MONGODB_DB_NAME)
    const collection = db.collection('bork_business_days_v2')
    
    console.log('Starting backfill: Adding VAT fields to bork_business_days_v2...\n')
    
    // Get all documents
    const docs = await collection.find({}).toArray()
    console.log(`Found ${docs.length} documents to update\n`)
    
    let updated = 0
    let errors = 0
    
    for (const doc of docs) {
      try {
        const inclVat = Number(doc.total_revenue || 0)
        const exVat = Math.round(inclVat / 1.21 * 100) / 100
        
        const result = await collection.updateOne(
          { _id: doc._id },
          {
            $set: {
              total_revenue_incl_vat: inclVat,
              total_revenue_ex_vat: exVat,
            }
          }
        )
        
        if (result.modifiedCount > 0) {
          updated++
          if (updated % 100 === 0) {
            console.log(`Updated ${updated} documents...`)
          }
        }
      } catch (err) {
        console.error(`Error updating doc ${doc._id}:`, err.message)
        errors++
      }
    }
    
    console.log(`\n✅ Backfill complete!`)
    console.log(`Updated: ${updated}`)
    console.log(`Errors: ${errors}`)
    
    // Verify
    const sample = await collection.findOne({})
    console.log(`\nSample document after backfill:`)
    console.log(JSON.stringify({
      _id: sample._id,
      locationName: sample.locationName,
      business_date: sample.business_date,
      total_revenue_incl_vat: sample.total_revenue_incl_vat,
      total_revenue_ex_vat: sample.total_revenue_ex_vat,
    }, null, 2))
    
  } finally {
    await client.close()
  }
}

backfill().catch(console.error)
