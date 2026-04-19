/**
 * Fills <!-- BORK_V2_14D_START --> … <!-- BORK_V2_14D_END --> in DEBUG_BUSINESS_HOUR_MAPPING.md
 * with hourly V2 vs proportional-CSV rows for the last 14 distinct business_date values in bork_sales_hours.
 *
 * Usage: node --experimental-strip-types scripts/generate-bork-14d-v2-overview.ts
 * Env: MONGODB_URI, MONGODB_DB_NAME; optional BORK_AGG_V2_SUFFIX (e.g. _test)
 */

import { readFileSync, existsSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { MongoClient } from 'mongodb'

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

/** Org-wide benchmark hour curve from DEBUG doc (April 11 register day) — Revenue (CSV) column, BH 0..23 */
const CSV_REF = [0, 0, 0, 0, 0, 111, 108, 574, 1015, 1085, 683, 739, 1319, 1752, 1592, 2020, 2270, 1842, 2031, 2014, 331, 0, 0, 111]

function addDaysISO(iso: string, delta: number): string {
  const [y, m, d] = iso.split('-').map(Number)
  const dt = new Date(Date.UTC(y, m - 1, d + delta))
  const yy = dt.getUTCFullYear()
  const mm = String(dt.getUTCMonth() + 1).padStart(2, '0')
  const dd = String(dt.getUTCDate()).padStart(2, '0')
  return `${yy}-${mm}-${dd}`
}

function realCalendarTime(businessDate: string, bh: number): string {
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
  const fmt = (iso: string) => {
    const [y, mo, d] = iso.split('-').map(Number)
    return `${months[mo - 1]} ${d}, ${y}`
  }
  let iso = businessDate
  let hStart: number
  if (bh <= 17) {
    hStart = bh + 6
  } else {
    iso = addDaysISO(businessDate, 1)
    hStart = bh - 18
  }
  return `${String(hStart).padStart(2, '0')}:00-${String(hStart).padStart(2, '0')}:59 ${fmt(iso)}`
}

function csvHourFromBh(bh: number): string {
  if (bh <= 17) return String(bh + 6).padStart(2, '0')
  return String(bh - 18).padStart(2, '0')
}

function eur(n: number): string {
  return '€' + String(Math.round(n)).padStart(6)
}

function gapStr(gap: number): string {
  const r = Math.round(gap)
  if (r === 0) return '—'
  return r > 0 ? `+${r}` : String(r)
}

function matchLabel(ours: number, bench: number): string {
  const g = Math.abs(ours - bench)
  if (ours === bench && ours === 0) return 'MATCH ✅'
  if (g === 0) return 'MATCH ✅'
  if (g <= Math.max(25, 0.12 * Math.max(Math.abs(bench), Math.abs(ours), 1))) return 'CLOSE 🟡'
  return 'NO MATCH ❌'
}

async function main() {
  loadDotEnv()
  const uri = process.env.MONGODB_URI
  const dbName = process.env.MONGODB_DB_NAME || 'daily-ops'
  if (!uri) {
    console.error('Missing MONGODB_URI')
    process.exit(1)
  }

  const suffix = process.env.BORK_AGG_V2_SUFFIX || ''
  const colName = `bork_sales_hours${suffix}`

  const client = new MongoClient(uri)
  await client.connect()
  const db = client.db(dbName)

  const allDates = (await db.collection(colName).distinct('business_date')) as string[]
  const sortedDesc = allDates.filter(Boolean).sort((a, b) => (a < b ? 1 : a > b ? -1 : 0))
  const last14 = sortedDesc.slice(0, 14).sort()
  if (last14.length === 0) {
    console.error(`No business_date values in ${colName}`)
    await client.close()
    process.exit(1)
  }

  const start = last14[0]!
  const end = last14[last14.length - 1]!

  const docs = await db
    .collection(colName)
    .find({ business_date: { $in: last14 } })
    .sort({ business_date: 1, locationName: 1, business_hour: 1 })
    .toArray()

  const byDayOrg = new Map<string, number>()
  const byDayLoc = new Map<string, number>()
  const v2 = new Map<string, number>()

  for (const d of docs) {
    const bd = d.business_date as string
    const loc = String(d.locationName ?? d.locationId ?? '')
    const bh = d.business_hour as number
    const rev = Number(d.total_revenue ?? 0)
    byDayOrg.set(bd, (byDayOrg.get(bd) ?? 0) + rev)
    const lk = `${bd}|${loc}`
    byDayLoc.set(lk, (byDayLoc.get(lk) ?? 0) + rev)
    v2.set(`${bd}|${loc}|${bh}`, rev)
  }

  const dates = [...new Set(docs.map((d) => d.business_date as string))].sort()

  let md = ''
  md += '## Last 14 days — V2 vs CSV (per location, hourly)\n\n'
  md +=
    '**Refresh:** `node --experimental-strip-types scripts/generate-bork-14d-v2-overview.ts` (uses `MONGODB_URI` / `MONGODB_DB_NAME`; optional `BORK_AGG_V2_SUFFIX`).  \n'
  md += `**Generated:** ${new Date().toISOString()}  \n`
  md +=
    '**Window:** `business_date` **' +
    start +
    '** … **' +
    end +
    '** — **' +
    String(last14.length) +
    '** distinct register day(s) with data (up to **14** most recent in `bork_sales_hours' +
    suffix +
    '`).  \n'
  md +=
    '**CSV (this location)** = org benchmark hour **h** from the April 11 table above × (**location V2 day total** ÷ **org V2 day total**), with **org V2 day total** = sum of `total_revenue` for that `business_date` across all mapped locations. **Gap** = **V2 − CSV** (rounded). **Match** uses the same tolerance as the main doc. When you have **real CSV** per day, replace this proxy column.\n\n'
  md +=
    '| business_date | location | CSV Hour | Real Calendar Time | BH | Revenue (V2) | CSV (this location) | Gap (V2−CSV) | Match |\n'
  md +=
    '|:--------------|:---------|:---------|:-------------------|---:|-------------:|--------------------:|-------------:|:------|\n'

  for (const bd of dates) {
    const orgTot = byDayOrg.get(bd) ?? 0
    const locs = [
      ...new Set(docs.filter((d) => d.business_date === bd).map((d) => String(d.locationName ?? d.locationId))),
    ]
    locs.sort()
    for (const loc of locs) {
      const locTot = byDayLoc.get(`${bd}|${loc}`) ?? 0
      for (let bh = 0; bh < 24; bh++) {
        const v = v2.get(`${bd}|${loc}|${bh}`) ?? 0
        const csvCell = orgTot > 0 ? CSV_REF[bh]! * (locTot / orgTot) : 0
        const c = Math.round(csvCell)
        const gap = v - c
        const m = matchLabel(v, c)
        const g = gapStr(gap)
        md += `| ${bd} | ${loc} | ${csvHourFromBh(bh)} | ${realCalendarTime(bd, bh)} | ${bh} | ${eur(v)} | ${eur(c)} | ${g.padStart(12)} | ${m} |\n`
      }
    }
  }

  const path = resolve(process.cwd(), 'DEBUG_BUSINESS_HOUR_MAPPING.md')
  let raw = readFileSync(path, 'utf-8')
  const markerStart = '<!-- BORK_V2_14D_START -->'
  const markerEnd = '<!-- BORK_V2_14D_END -->'
  if (!raw.includes(markerStart)) {
    raw += `\n\n${markerStart}\n${markerEnd}\n`
  }
  const re = new RegExp(`${markerStart}[\\s\\S]*?${markerEnd}`)
  raw = raw.replace(re, `${markerStart}\n${md}\n${markerEnd}`)
  writeFileSync(path, raw)
  console.log(`Wrote ${dates.length} day(s) (requested up to 14), collection ${colName}, range ${start}..${end}`)
  await client.close()
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
