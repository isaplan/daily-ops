/**
 * Compares `bork_business_days` (V2) daily revenue to the **exact** per-day-per-location
 * figures in:
 *   dev-docs/validation-data-eitje-bork/bork-validation/omzet-per0dag-per-locatie-2025-2026.csv
 *
 * Outputs:
 * 1) Per-register-day **totals** (sum of 3 locations): Σ V2 vs Σ CSV, gap, match
 * 2) Per-location rows for the same days (aligned columns)
 *
 * Replaces <!-- BORK_DAILY_OMZET_CSV_START --> … <!-- BORK_DAILY_OMZET_CSV_END --> in dev-docs/DEBUG_BUSINESS_HOUR_MAPPING.md
 *
 * Usage: node --experimental-strip-types scripts/compare-bork-daily-omzet-csv.ts
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

/** Exact file name in repo (digit 0 in "per0dag") */
const OMZET_CSV_FILENAME = 'omzet-per0dag-per-locatie-2025-2026.csv'

const CSV_PATH = resolve(
  process.cwd(),
  'dev-docs/validation-data-eitje-bork/bork-validation',
  OMZET_CSV_FILENAME
)

function csvWinkelToDbName(w: string): string {
  const s = w.trim()
  if (s === 'Gastropub Van Kinsbergen') return 'Van Kinsbergen'
  if (/^l['']amour toujours$/i.test(s)) return "l'Amour Toujours"
  return s
}

function parseOmzetExcl(cell: string): number {
  const t = cell.trim().replace(/\s/g, '')
  if (!t || t === '-') return 0
  const n = t.replace(/\./g, '')
  const v = parseInt(n, 10)
  return Number.isFinite(v) ? v : 0
}

function gapStr(gap: number): string {
  const r = Math.round(gap)
  if (r === 0) return '—'
  return r > 0 ? `+${r}` : String(r)
}

function matchDaily(v2: number, csv: number): string {
  const g = Math.abs(v2 - csv)
  if (g === 0) return 'MATCH ✅'
  if (g <= Math.max(50, 0.02 * Math.max(Math.abs(v2), Math.abs(csv), 1))) return 'CLOSE 🟡'
  return 'NO MATCH ❌'
}

function loadCsv(): Map<string, number> {
  const raw = readFileSync(CSV_PATH, 'utf-8')
  const lines = raw.split(/\r?\n/).filter((l) => l.length > 0 && !l.startsWith('Totaal') && !/^;+$/.test(l))
  const map = new Map<string, number>()
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    if (i === 0 && line.includes('Dag')) continue
    const parts = line.split(';')
    if (parts.length < 3) continue
    const dag = parts[0]!.trim()
    const winkel = parts[1]!.trim()
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dag)) continue
    const omzetExcl = parseOmzetExcl(parts[2] ?? '0')
    const dbName = csvWinkelToDbName(winkel)
    map.set(`${dag}|${dbName}`, omzetExcl)
  }
  return map
}

function lastNDatesFromCsv(csvMap: Map<string, number>, n: number): string[] {
  const dates = new Set<string>()
  for (const k of csvMap.keys()) {
    dates.add(k.split('|')[0]!)
  }
  return [...dates].filter(Boolean).sort().slice(-n)
}

/** Plain euros for aligned markdown (no locale thousand separators that shift width). */
function eurCell(n: number | null, w: number): string {
  if (n === null) return '—'.padStart(w, ' ')
  const s = String(Math.round(n))
  return ('€' + s).padStart(w, ' ')
}

function padLoc(s: string, w: number): string {
  return s.length > w ? s.slice(0, w - 1) + '…' : s.padEnd(w, ' ')
}

function padDate(s: string, w: number): string {
  return s.padEnd(w, ' ')
}

function padGap(g: number | null, w: number): string {
  if (g === null) return '—'.padStart(w, ' ')
  return gapStr(g).padStart(w, ' ')
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
  const colName = `bork_business_days${suffix}`

  const csvMap = loadCsv()
  const last14 = lastNDatesFromCsv(csvMap, 14)
  const dbNames = ['Bar Bea', 'Van Kinsbergen', "l'Amour Toujours"] as const

  const client = new MongoClient(uri)
  await client.connect()
  const db = client.db(dbName)

  const v2Docs = await db
    .collection(colName)
    .find({ business_date: { $in: last14 } })
    .project({ business_date: 1, locationName: 1, total_revenue: 1 })
    .toArray()

  const v2Map = new Map<string, number>()
  for (const d of v2Docs) {
    const bd = d.business_date as string
    const loc = d.locationName as string
    v2Map.set(`${bd}|${loc}`, Math.round(Number(d.total_revenue ?? 0)))
  }

  const W_DATE = 14
  const W_LOC = 22
  const W_EUR = 14
  const W_GAP = 14
  const W_MATCH = 14

  let md = ''
  md += `## Daily totals vs \`${OMZET_CSV_FILENAME}\` (exact file in \`dev-docs/.../bork-validation/\`)\n\n`
  md +=
    '**CSV:** **Omzet (excl. btw) € / Selectie** — same numbers as the finance export (**exact revenue per day per location**).  \n'
  md +=
    '**V2:** `bork_business_days.total_revenue` per `business_date` + location (register day **06:00–05:59**).  \n'
  md +=
    '**Σ CSV** = sum of the three location rows in that file for that **Dag**. **Σ V2** = sum of our three unified locations for that **business_date**. **Gap** = **Σ V2 − Σ CSV**.\n\n'

  md += '### Per day — organisation total (3 locations)\n\n'
  md += `| ${padDate('business_date', W_DATE)} | ${padDate('Σ V2', W_EUR)} | ${padDate('Σ CSV', W_EUR)} | ${padDate('Gap', W_GAP)} | ${padDate('Match', W_MATCH)} |\n`
  md += `|:--------------|--------------:|--------------:|--------------:|:--------------|\n`

  for (const dag of last14) {
    let sV2 = 0
    let sCsv = 0
    let haveV2 = false
    let haveCsv = false
    for (const loc of dbNames) {
      const k = `${dag}|${loc}`
      if (v2Map.has(k)) {
        sV2 += v2Map.get(k)!
        haveV2 = true
      }
      if (csvMap.has(k)) {
        sCsv += csvMap.get(k)!
        haveCsv = true
      }
    }
    const v2Cell = haveV2 ? sV2 : null
    const csvCell = haveCsv ? sCsv : null
    let gap: number | null = null
    let m = '—'
    if (haveV2 && haveCsv) {
      gap = sV2 - sCsv
      m = matchDaily(sV2, sCsv)
    } else if (!haveV2 && haveCsv) m = 'no V2'
    else if (haveV2 && !haveCsv) m = 'no CSV'

    md += `| ${padDate(dag, W_DATE)} | ${eurCell(v2Cell, W_EUR)} | ${eurCell(csvCell, W_EUR)} | ${padGap(gap, W_GAP)} | ${m.padEnd(W_MATCH, ' ')} |\n`
  }

  md += '\n### Per location — same days\n\n'
  md +=
    '**Refresh:** `node --experimental-strip-types scripts/compare-bork-daily-omzet-csv.ts`  \n'
  md += `**Generated:** ${new Date().toISOString()}  \n`
  md +=
    `**Window:** last **${last14.length}** **Dag** values in **${OMZET_CSV_FILENAME}** (**${last14[0] ?? '—'}** … **${last14[last14.length - 1] ?? '—'}**).\n\n`

  md += `| ${padDate('business_date', W_DATE)} | ${padLoc('location', W_LOC)} | ${padDate('V2', W_EUR)} | ${padDate('CSV', W_EUR)} | ${padDate('Gap', W_GAP)} | ${padDate('Match', W_MATCH)} |\n`
  md += `|:--------------|:----------------------|--------------:|--------------:|--------------:|:--------------|\n`

  for (const dag of last14) {
    for (const loc of dbNames) {
      const v2 = v2Map.has(`${dag}|${loc}`) ? v2Map.get(`${dag}|${loc}`)! : null
      const csv = csvMap.has(`${dag}|${loc}`) ? csvMap.get(`${dag}|${loc}`)! : null
      let gap: number | null = null
      let match = '—'
      if (v2 !== null && csv !== null) {
        gap = v2 - csv
        match = matchDaily(v2, csv)
      } else if (v2 !== null && csv === null) match = 'no CSV row'
      else if (v2 === null && csv !== null) match = 'no V2 row'

      md += `| ${padDate(dag, W_DATE)} | ${padLoc(loc, W_LOC)} | ${eurCell(v2, W_EUR)} | ${eurCell(csv, W_EUR)} | ${padGap(gap, W_GAP)} | ${match.padEnd(W_MATCH, ' ')} |\n`
    }
  }

  const path = resolve(process.cwd(), 'dev-docs/DEBUG_BUSINESS_HOUR_MAPPING.md')
  let raw = readFileSync(path, 'utf-8')
  const markerStart = '<!-- BORK_DAILY_OMZET_CSV_START -->'
  const markerEnd = '<!-- BORK_DAILY_OMZET_CSV_END -->'
  if (!raw.includes(markerStart)) {
    raw += `\n\n${markerStart}\n${markerEnd}\n`
  }
  const re = new RegExp(`${markerStart}[\\s\\S]*?${markerEnd}`)
  raw = raw.replace(re, `${markerStart}\n${md}\n${markerEnd}`)
  writeFileSync(path, raw)
  console.log(`Updated dev-docs/DEBUG_BUSINESS_HOUR_MAPPING.md — ${last14.length} day(s) + ${last14.length * 3} location rows.`)
  await client.close()
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
