/**
 * Compare dashboard labor sources for one location + business date.
 * Usage: npx --yes tsx scripts/debug-labor-yesterday.ts --locationId=... --date=2026-05-15
 */

import { ObjectId } from 'mongodb'
import { getDb } from '../server/utils/db'

function arg(name: string): string | undefined {
  const p = process.argv.find((a) => a.startsWith(`--${name}=`))
  return p?.split('=')[1]
}

async function main() {
  const locationId = arg('locationId') ?? '69d6cfa73d2adf93b79d1ae8'
  const businessDate = arg('date') ?? '2026-05-15'

  const db = await getDb()
  const locOid = new ObjectId(locationId)

  const loc = await db.collection('locations').findOne({ _id: locOid })
  const mapping = await db
    .collection('bork_unified_location_mapping')
    .findOne({ unifiedLocationId: locOid })

  process.stdout.write(`Location: ${String(loc?.name ?? mapping?.unifiedLocationName ?? '?')}\n`)
  process.stdout.write(`businessDate=${businessDate} locationId=${locationId}\n\n`)

  const snap = await db.collection('daily_ops_snapshot_section_labor').findOne({
    businessDate,
    locationId,
  })
  if (snap) {
    process.stdout.write(
      `SNAPSHOT labor: hours=${snap.totals?.hours} wage=${snap.totals?.wage_cost} loaded=${snap.totals?.loaded_cost} workerLines=${(snap.workers as unknown[])?.length ?? 0}\n`
    )
  } else {
    process.stdout.write('SNAPSHOT labor: MISSING\n')
  }

  const locMatch = { $in: [locOid, locationId] }
  const aggRows = await db
    .collection('eitje_time_registration_aggregation')
    .find({ period: businessDate, period_type: 'day', locationId: locMatch })
    .toArray()

  let hours = 0
  let wage = 0
  let loaded = 0
  const keyCounts = new Map<string, number>()
  for (const r of aggRows) {
    hours += Number(r.total_hours ?? 0)
    wage += Number(r.total_cost ?? 0)
    loaded += Number(r.total_cost_loaded ?? 0)
    const k = `${r.userId}|${r.teamId}|${r.period}`
    keyCounts.set(k, (keyCounts.get(k) ?? 0) + 1)
  }
  const dupes = [...keyCounts.entries()].filter(([, c]) => c > 1)
  process.stdout.write(
    `\nEITJE AGG: rows=${aggRows.length} hours=${hours.toFixed(2)} wage(total_cost)=${wage.toFixed(2)} loaded=${loaded.toFixed(2)} duplicateKeys=${dupes.length}\n`
  )
  if (dupes.length) {
    process.stdout.write(`  sample dupes: ${dupes.slice(0, 5).map(([k, c]) => `${k}×${c}`).join(', ')}\n`)
  }

  // Inbox hours — DD/MM/YYYY stored as Amsterdam midnight → prior UTC evening (e.g. May 15 → 2026-05-14T22:00:00Z)
  const [y, m, d] = businessDate.split('-').map(Number)
  const inboxDate = new Date(Date.UTC(y ?? 0, (m ?? 1) - 1, d ?? 1, 0, 0, 0, 0))
  inboxDate.setUTCHours(inboxDate.getUTCHours() - 2)
  const locName = String(loc?.name ?? mapping?.unifiedLocationName ?? '')
  const inboxMatch: Record<string, unknown> = {
    date: inboxDate,
  }
  if (locName) {
    inboxMatch.$or = [
      { location_name: locName },
      { location_name: { $regex: new RegExp(locName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i') } },
    ]
  }

  const inboxRows = await db.collection('inbox-eitje-hours').find(inboxMatch).toArray()
  let inboxHours = 0
  let inboxLabor = 0
  for (const r of inboxRows) {
    inboxHours += Number(r.hours ?? 0)
    inboxLabor += Number(r.realized_labor_costs ?? 0)
  }
  process.stdout.write(
    `\nINBOX hours (${locName || 'all'}): rows=${inboxRows.length} hours=${inboxHours.toFixed(2)} realized_labor_costs=${inboxLabor.toFixed(2)}\n`
  )

  // Latest inbox import for this location (any date on businessDate)
  const latestImport = await db
    .collection('inbox-eitje-hours')
    .find(inboxMatch)
    .sort({ importedAt: -1 })
    .limit(1)
    .toArray()
  if (latestImport[0]) {
    process.stdout.write(
      `  latest import: ${latestImport[0].importedAt} cron_hour=${latestImport[0].cron_hour} file=${latestImport[0].source_attachment_name ?? '—'}\n`
    )
  }

  // Basis report labor if any
  const basis = await db.collection('inbox-bork-basis-report').findOne({
    business_date: businessDate,
    locationId: locMatch,
  })
  if (basis) {
    process.stdout.write(
      `\nINBOX basis: hours=${basis.hours ?? basis.gewerkte_uren} labor=${basis.realized_labor_costs ?? basis.gerealiseerde_loonkosten}\n`
    )
  }

  process.stdout.write('\nDashboard uses:\n')
  process.stdout.write('  - headline labor card: snapshot.wages if >0 else sum(eitje agg total_cost)\n')
  process.stdout.write('  - labor tables/charts: eitje_time_registration_aggregation (fetchLaborByDate)\n')
}

main().catch((e) => {
  process.stderr.write(`${e instanceof Error ? e.message : String(e)}\n`)
  process.exit(1)
})
