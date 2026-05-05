/**
 * Builds markdown tables: V2 hourly aggregates vs omzet CSV (same window as day-breakdown validation).
 *
 * V2 revenue = sum of `total_revenue` on `bork_sales_by_hour{suffix}` grouped by `business_date`
 * (+ `locationName` for per-location). Matches the hourly slice returned by
 * `GET /api/bork/v2/day-breakdown-v2` when summed in the client.
 *
 * Env: MONGODB_URI, MONGODB_DB_NAME (default daily-ops)
 * Optional: **BORK_V2_CSV_TABLE_SUFFIX** — if set, overrides read suffix for this report only (use `_v2` when
 *   `.env` points hourly data at `_test` but you want validation against production V2 collections).
 *   Otherwise: BORK_AGG_VERSION_SUFFIX | BORK_AGG_V2_SUFFIX (default `_v2`).
 * Optional: BORK_V2_CSV_COMPARE_START / BORK_V2_CSV_COMPARE_END (YYYY-MM-DD, inclusive)
 *
 * Usage:
 *   node --experimental-strip-types scripts/generate-day-breakdown-v2-vs-csv-tables.ts
 *   node --experimental-strip-types scripts/generate-day-breakdown-v2-vs-csv-tables.ts --write
 *   (--write replaces <!-- V2_VS_CSV_TABLES_START --> … <!-- V2_VS_CSV_TABLES_END --> in day-breakdown-vs-csv-last7.md)
 */

import { readFileSync, existsSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { MongoClient } from 'mongodb'

const CSV_FILENAME = 'omzet-per-dag-per-locatie-2025-2026.csv'
const MD_PATH = 'dev-docs/validation-data-eitje-bork/bork-validation/day-breakdown-vs-csv-last7.md'

const MARKER_START = '<!-- V2_VS_CSV_TABLES_START -->'
const MARKER_END = '<!-- V2_VS_CSV_TABLES_END -->'

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

function csvWinkelToDbName(w: string): string {
  const s = w.trim()
  if (s === 'Gastropub Van Kinsbergen') return 'Van Kinsbergen'
  if (/^l['']amour toujours$/i.test(s)) return "l'Amour Toujours"
  return s
}

function parseEuroInt(cell: string): number {
  const t = cell.trim().replace(/\s/g, '')
  if (!t || t === '-') return 0
  const n = t.replace(/\./g, '')
  const v = parseInt(n, 10)
  return Number.isFinite(v) ? v : 0
}

function formatEuroNl(n: number): string {
  const s = n.toFixed(2)
  const [intRaw, dec] = s.split('.')
  const intPart = intRaw!.replace(/\B(?=(\d{3})+(?!\d))/g, '.')
  return `€ ${intPart},${dec}`
}

function pctDiff(api: number, csvIncl: number): string {
  if (csvIncl === 0) return api === 0 ? '0,00%' : '+100,00%'
  const p = ((api - csvIncl) / csvIncl) * 100
  const sign = p > 0 ? '+' : ''
  return `${sign}${p.toFixed(2).replace('.', ',')}%`
}

type CsvRow = { dag: string; loc: string; excl: number; incl: number }

function loadCsv(csvPath: string): CsvRow[] {
  const raw = readFileSync(csvPath, 'utf-8')
  const lines = raw.split(/\r?\n/).filter((l) => l.length > 0 && !l.startsWith('Totaal') && !/^;+$/.test(l))
  const out: CsvRow[] = []
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!
    if (i === 0 && line.includes('Dag')) continue
    const parts = line.split(';')
    if (parts.length < 4) continue
    const dag = parts[0]!.trim()
    const winkel = parts[1]!.trim()
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dag)) continue
    const excl = parseEuroInt(parts[2] ?? '0')
    const incl = parseEuroInt(parts[3] ?? '0')
    out.push({ dag, loc: csvWinkelToDbName(winkel), excl, incl })
  }
  return out
}

function resolveV2SuffixMeta(): { suffix: string; note: string } {
  const forced = process.env.BORK_V2_CSV_TABLE_SUFFIX
  if (forced !== undefined && forced !== '') {
    return { suffix: forced, note: '`BORK_V2_CSV_TABLE_SUFFIX` (overrides app env for this report)' }
  }
  const s = process.env.BORK_AGG_VERSION_SUFFIX ?? process.env.BORK_AGG_V2_SUFFIX ?? '_v2'
  return { suffix: s, note: '`BORK_AGG_VERSION_SUFFIX` / `BORK_AGG_V2_SUFFIX` (default `_v2`)' }
}

const LOCATIONS = ['Bar Bea', 'Van Kinsbergen', "l'Amour Toujours"] as const

async function main() {
  loadDotEnv()
  const uri = process.env.MONGODB_URI
  const dbName = process.env.MONGODB_DB_NAME || 'daily-ops'
  const write = process.argv.includes('--write')

  const csvPath = resolve(process.cwd(), 'dev-docs/validation-data-eitje-bork/bork-validation', CSV_FILENAME)
  if (!existsSync(csvPath)) {
    console.error('Missing CSV:', csvPath)
    process.exit(1)
  }

  let start = process.env.BORK_V2_CSV_COMPARE_START ?? '2026-04-23'
  let end = process.env.BORK_V2_CSV_COMPARE_END ?? '2026-04-29'
  if (start > end) [start, end] = [end, start]

  const dates: string[] = []
  {
    const [y0, m0, d0] = start.split('-').map(Number)
    const [y1, m1, d1] = end.split('-').map(Number)
    const t0 = Date.UTC(y0!, m0! - 1, d0!)
    const t1 = Date.UTC(y1!, m1! - 1, d1!)
    for (let t = t0; t <= t1; t += 86400000) {
      const d = new Date(t)
      dates.push(
        `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`
      )
    }
  }

  if (!uri) {
    console.error('Missing MONGODB_URI — cannot query V2 aggregates.')
    process.exit(1)
  }

  const { suffix, note: suffixNote } = resolveV2SuffixMeta()
  const hourlyColl = `bork_sales_by_hour${suffix}`

  const client = new MongoClient(uri.trim())
  await client.connect()
  const db = client.db(dbName)

  const agg = await db
    .collection(hourlyColl)
    .aggregate<{ _id: { bd: string; loc: string }; rev: number }>([
      { $match: { business_date: { $gte: start, $lte: end } } },
      {
        $group: {
          _id: { bd: '$business_date', loc: '$locationName' },
          rev: { $sum: { $ifNull: ['$total_revenue', 0] } },
        },
      },
    ])
    .toArray()

  await client.close()

  const v2Map = new Map<string, number>()
  for (const r of agg) {
    const bd = r._id.bd as string
    const loc = r._id.loc as string
    v2Map.set(`${bd}|${loc}`, Math.round(r.rev * 100) / 100)
  }

  const csvRows = loadCsv(csvPath)
  const csvByKey = new Map<string, { excl: number; incl: number }>()
  for (const r of csvRows) {
    csvByKey.set(`${r.dag}|${r.loc}`, { excl: r.excl, incl: r.incl })
  }

  const csvSumDay = (dag: string) => {
    let excl = 0
    let incl = 0
    for (const loc of LOCATIONS) {
      const c = csvByKey.get(`${dag}|${loc}`)
      if (c) {
        excl += c.excl
        incl += c.incl
      }
    }
    return { excl, incl }
  }

  const v2SumDay = (dag: string) => {
    let s = 0
    for (const loc of LOCATIONS) {
      s += v2Map.get(`${dag}|${loc}`) ?? 0
    }
    return Math.round(s * 100) / 100
  }

  let md = ''
  md += `## 5) V2 — totals per day\n\n`
  md += `- **Source:** \`bork_sales_by_hour${suffix}\` — sum of \`total_revenue\` by \`business_date\` (all locations), same register-day slice as \`GET /api/bork/v2/day-breakdown-v2\` hourly data summed.\n`
  md += `- **Suffix:** \`${suffix || '(empty)'}\` — ${suffixNote}.\n\n`
  md +=
    '| Date       | V2 API Revenue | CSV excl. btw | CSV incl. btw | Abs Diff (V2 − CSV incl) | Diff % vs CSV incl |\n'
  md +=
    '|:-----------|---------------:|--------------:|--------------:|-------------------------:|-------------------:|\n'

  for (const dag of dates) {
    const api = v2SumDay(dag)
    const { excl, incl } = csvSumDay(dag)
    const diff = Math.round((api - incl) * 100) / 100
    md += `| ${dag} | ${formatEuroNl(api)} | ${formatEuroNl(excl)} | ${formatEuroNl(incl)} | ${formatEuroNl(diff)} | ${pctDiff(api, incl)} |\n`
  }

  md += `\n## 6) V2 — per location (vs CSV incl. btw)\n\n`

  for (const loc of LOCATIONS) {
    md += `### ${loc}\n\n`
    md += '| Date       | V2 API Revenue | CSV incl. btw | Abs Diff | Diff % |\n'
    md += '|:-----------|---------------:|--------------:|---------:|-------:|\n'
    for (const dag of dates) {
      const api = v2Map.get(`${dag}|${loc}`) ?? 0
      const incl = csvByKey.get(`${dag}|${loc}`)?.incl ?? 0
      const diff = Math.round((api - incl) * 100) / 100
      md += `| ${dag} | ${formatEuroNl(api)} | ${formatEuroNl(incl)} | ${formatEuroNl(diff)} | ${pctDiff(api, incl)} |\n`
    }
    md += '\n'
  }

  let sumV2Loc: Record<string, number> = { 'Bar Bea': 0, 'Van Kinsbergen': 0, "l'Amour Toujours": 0 }
  let sumCsvInclLoc: Record<string, number> = { 'Bar Bea': 0, 'Van Kinsbergen': 0, "l'Amour Toujours": 0 }
  for (const dag of dates) {
    for (const loc of LOCATIONS) {
      sumV2Loc[loc] += v2Map.get(`${dag}|${loc}`) ?? 0
      sumCsvInclLoc[loc] += csvByKey.get(`${dag}|${loc}`)?.incl ?? 0
    }
  }
  for (const loc of LOCATIONS) {
    sumV2Loc[loc] = Math.round(sumV2Loc[loc] * 100) / 100
    sumCsvInclLoc[loc] = Math.round(sumCsvInclLoc[loc] * 100) / 100
  }

  md += `## 7) V2 — ${dates.length}-day totals per location\n\n`
  md += '| Location         | V2 API Total | CSV incl. btw | Abs Diff     | Diff %  |\n'
  md += '|:-----------------|-------------:|--------------:|-------------:|--------:|\n'
  for (const loc of LOCATIONS) {
    const a = sumV2Loc[loc]
    const c = sumCsvInclLoc[loc]
    const d = Math.round((a - c) * 100) / 100
    md += `| ${loc} | ${formatEuroNl(a)} | ${formatEuroNl(c)} | ${formatEuroNl(d)} | ${pctDiff(a, c)} |\n`
  }

  const grandV2 = Math.round(dates.reduce((s, d) => s + v2SumDay(d), 0) * 100) / 100
  const grandCsv = Math.round(dates.reduce((s, d) => s + csvSumDay(d).incl, 0) * 100) / 100
  const grandDiff = Math.round((grandV2 - grandCsv) * 100) / 100

  md += `\n## 8) V2 — ${dates.length}-day grand total\n\n`
  md += `- V2 API total: **${formatEuroNl(grandV2)}**\n`
  md += `- CSV incl. btw total: **${formatEuroNl(grandCsv)}**\n`
  md += `- Abs diff: **${formatEuroNl(grandDiff)}** (${pctDiff(grandV2, grandCsv)})\n`
  if (grandV2 === 0) {
    md += `\n> **No V2 hourly data** for \`${start}\` … \`${end}\` in \`${hourlyColl}\`. Sections 5–8 stay at €0 until that collection is populated (e.g. \`BORK_V2_REBUILD_CONFIRM=1 BORK_V2_BACKSTOP=2025-11-01 pnpm bork:rebuild:v2\` — one full raw scan). Legacy \`bork_sales_by_hour\` (no suffix) may still hold V1 rows — compare sections **1–4**.\n`
  }

  md += `\n**Regenerate:** \`BORK_V2_CSV_TABLE_SUFFIX=_v2 node --experimental-strip-types scripts/generate-day-breakdown-v2-vs-csv-tables.ts --write\` (optional suffix override)  \n`
  md += `**Generated (UTC):** ${new Date().toISOString()}\n`

  const wrapped = `${MARKER_START}\n${md}\n${MARKER_END}`

  if (write) {
    const realMdPath = resolve(process.cwd(), MD_PATH)
    let raw = readFileSync(realMdPath, 'utf-8')
    if (!raw.includes(MARKER_START) || !raw.includes(MARKER_END)) {
      raw = raw.trimEnd() + `\n\n${wrapped}\n`
    } else {
      const before = raw.slice(0, raw.indexOf(MARKER_START))
      const after = raw.slice(raw.indexOf(MARKER_END) + MARKER_END.length)
      raw = `${before.trimEnd()}\n\n${wrapped}\n${after.trimStart()}`
    }
    writeFileSync(realMdPath, raw, 'utf-8')
    console.log('Updated', realMdPath)
  } else {
    console.log(wrapped)
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
