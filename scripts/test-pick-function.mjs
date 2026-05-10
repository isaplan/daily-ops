import { MongoClient } from 'mongodb'
import dotenv from 'dotenv'

dotenv.config()

// Mimic the function
function normalizeBasisLocationLabel(label) {
  if (!label) return null
  const lower = String(label).toLowerCase().trim()
  if (lower.includes('lamour') || lower.includes("l'amour")) return "l'Amour Toujours"
  if (lower.includes('kinsbergen') || lower.includes('van')) return 'Van Kinsbergen'
  if (lower.includes('bar') && lower.includes('bea')) return 'Bar Bea'
  return null
}

function pickBasisReportsPerLocation(reports) {
  const byLocDate = new Map()
  
  for (const r of reports) {
    const locKey = normalizeBasisLocationLabel(r.location)
    if (!locKey || locKey === 'unspecified') continue
    
    const dateKey = r.business_date || r.date
    const key = `${locKey}:::${dateKey}`
    
    if (!byLocDate.has(key)) {
      byLocDate.set(key, [])
    }
    byLocDate.get(key).push(r)
  }
  
  const result = new Map()
  
  for (const [key, list] of byLocDate) {
    const cronPriority = (cronHour) => {
      if (cronHour === 7) return 3  // Final (next morning 07:00)
      if (cronHour === 23) return 2 // Middle
      if (cronHour === 18) return 1 // Earliest
      return 0
    }
    
    const sorted = [...list].sort((a, b) => {
      const priorityDiff = cronPriority(b.cron_hour ?? -1) - cronPriority(a.cron_hour ?? -1)
      if (priorityDiff !== 0) return priorityDiff
      return (b.date > a.date ? 1 : -1)
    })
    
    result.set(key, sorted[0])
  }
  
  return result
}

const client = new MongoClient(process.env.MONGODB_URI)
try {
  await client.connect()
  const db = client.db(process.env.MONGODB_DB_NAME)
  
  const rows = await db.collection('inbox-bork-basis-report')
    .find({ business_date: '2026-05-06' })
    .toArray()
  
  console.log(`Raw documents: ${rows.length}`)
  
  const picked = pickBasisReportsPerLocation(rows)
  
  console.log(`\nPicked ${picked.size} reports:`)
  let total = 0
  for (const [key, rep] of picked) {
    const revenue = Number(rep.final_revenue_ex_vat ?? 0)
    console.log(`  ${key}: €${revenue.toFixed(2)}`)
    total += revenue
  }
  
  console.log(`\nTotal: €${total.toFixed(2)}`)
  
} finally {
  await client.close()
}
