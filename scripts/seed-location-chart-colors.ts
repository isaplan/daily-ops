/**
 * Seed unified_location.chartColor for Daily Ops venue graph colors.
 * Run: npx tsx scripts/seed-location-chart-colors.ts
 */
import 'dotenv/config'
import { getDb } from '../server/utils/db'
import {
  DAILY_OPS_LOCATION_CHART_COLOR_SEED,
  normalizeChartColor,
} from '../server/utils/dailyOpsLocationChartColors'

function abbreviationForDoc(doc: Record<string, unknown>): string {
  const abbrev = typeof doc.abbreviation === 'string' ? doc.abbreviation.trim().toUpperCase() : ''
  if (abbrev) return abbrev
  const name = String(doc.name ?? doc.primaryName ?? doc.canonicalName ?? '').toLowerCase()
  if (/kinsbergen/.test(name)) return 'VKB'
  if ((name.includes('bar') && name.includes('bea')) || name.replace(/\s+/g, '') === 'barbea') return 'BEA'
  if (/amour/.test(name) && /toujours/.test(name)) return 'LAT'
  return ''
}

async function main() {
  const db = await getDb()
  const docs = await db.collection('unified_location').find({}).toArray()
  let updated = 0

  for (const doc of docs) {
    const record = doc as Record<string, unknown>
    const abbrev = abbreviationForDoc(record)
    const seedColor = DAILY_OPS_LOCATION_CHART_COLOR_SEED[abbrev]
    if (!seedColor) continue

    const existing = normalizeChartColor(record.chartColor)
    if (existing === seedColor.toUpperCase()) {
      console.log(`✓ ${abbrev} already ${existing}`)
      continue
    }

    await db.collection('unified_location').updateOne(
      { _id: doc._id },
      { $set: { chartColor: seedColor, updatedAt: new Date() } },
    )
    console.log(`✅ ${abbrev} → ${seedColor}`)
    updated += 1
  }

  console.log(`\nDone. Updated ${updated} location(s).`)
  process.exit(0)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
