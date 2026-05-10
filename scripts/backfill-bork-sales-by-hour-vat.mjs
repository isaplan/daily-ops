/**
 * Backfill script: Add both total_revenue_ex_vat and total_revenue_incl_vat to bork_sales_by_hour_v2
 * Idempotent: Only updates documents missing the fields
 */

import { MongoClient } from 'mongodb'
import dotenv from 'dotenv'

dotenv.config()

const client = new MongoClient(process.env.MONGODB_URI)

async function backfill() {
  try {
    await client.connect()
    const db = client.db(process.env.MONGODB_DB_NAME)
    const collection = db.collection('bork_sales_by_hour_v2')
    
    console.log('Starting backfill: Adding VAT fields to bork_sales_by_hour_v2...\n')
    
    // Find only documents missing the fields
    const docs = await collection.find({
      $or: [
        { total_revenue_ex_vat: { $exists: false } },
        { total_revenue_incl_vat: { $exists: false } }
      ]
    }).toArray()
    
    console.log(`Found ${docs.length} documents to update (skipping already-updated)\n`)
    
    if (docs.length === 0) {
      console.log('✅ All documents already have VAT fields!')
      return
    }
    
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
          if (updated % 500 === 0) {
            console.log(`Updated ${updated} / ${docs.length} documents...`)
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
    const totalDocs = await collection.countDocuments({})
    const withVat = await collection.countDocuments({
      total_revenue_ex_vat: { $exists: true }
    })
    
    console.log(`\nVerification:`)
    console.log(`Total documents: ${totalDocs}`)
    console.log(`With VAT fields: ${withVat}`)
    console.log(`Coverage: ${Math.round(withVat / totalDocs * 100)}%`)
    
  } finally {
    await client.close()
  }
}

backfill().catch(console.error)
