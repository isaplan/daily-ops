/**
 * Writes <!-- BORK_BENCHMARK_INBOX_VS_API_START --> … <!-- BORK_BENCHMARK_INBOX_VS_API_END -->
 * in dev-docs/DEBUG_BUSINESS_HOUR_MAPPING.md: inbox Basis Rapport + Sales.csv vs Bork API aggregates.
 *
 * Benchmark: morning inbox (Basis Rapport / Sales.csv) for yesterday’s Bork calendar day — compare
 * to line revenue summed from `bork_sales_hours` + suffix (built from `bork_raw_data` API pulls).
 *
 * Usage: node --experimental-strip-types scripts/generate-bork-benchmark-inbox-vs-api.ts
 * Env: MONGODB_URI, MONGODB_DB_NAME
 * Optional: BORK_AGG_V2_SUFFIX (defaults to **_test** → collection `bork_sales_hours_test`)
 */

import { readFileSync, existsSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { MongoClient, ObjectId, type Db } from 'mongodb'

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

function parseReportDateFromSubject(subject: string | undefined): string | null {
  if (!subject) return null
  const m = subject.match(/report from\s+(\d{2})\/(\d{2})\/(\d{4})/i)
  if (!m) return null
  const dd = +m[1]
  const mm = +m[2]
  const yyyy = +m[3]
  return `${yyyy}-${String(mm).padStart(2, '0')}-${String(dd).padStart(2, '0')}`
}

function normalizeVenueLabel(raw: string): string {
  const s = raw.toLowerCase()
  if (s.includes('kinsbergen') || s.includes('gastropub')) return 'Van Kinsbergen'
  if (s.includes('bea')) return 'Bar Bea'
  if (s.includes('amour') || s.includes('toujours') || s.includes('lamour')) return "l'Amour Toujours"
  return raw
}

function venueFromSubject(subject: string | undefined): string | null {
  if (!subject) return null
  const s = subject.toLowerCase()
  if (s.includes('kinsbergen') || s.includes('gastropub')) return 'Van Kinsbergen'
  if (s.includes('bar bea') || /\bbea\b/.test(s)) return 'Bar Bea'
  if (s.includes('amour') || s.includes('toujours') || s.includes('lamour')) return "l'Amour Toujours"
  return null
}

function parseNlEuro(val: unknown): number | null {
  if (typeof val === 'number' && Number.isFinite(val)) return val
  if (typeof val !== 'string') return null
  const s = val.replace(/[^\d.,-]/g, '').trim()
  if (!s) return null
  if (s.includes(',')) {
    const norm = s.replace(/\./g, '').replace(',', '.')
    const n = parseFloat(norm)
    return Number.isFinite(n) ? n : null
  }
  const n = parseFloat(s)
  return Number.isFinite(n) ? n : null
}

async function venueFromSalesEmail(db: Db, emailId: ObjectId): Promise<string | null> {
  const row = await db.collection('inbox-bork-sales').findOne({ sourceEmailId: emailId })
  if (!row) return null
  const reserved = new Set(['Sales', 'sourceEmailId', 'sourceAttachmentId', 'sourceFileName', 'fileFormat', 'parsedAt', '_id'])
  for (const k of Object.keys(row)) {
    if (reserved.has(k) || k.startsWith('column_')) continue
    return normalizeVenueLabel(k)
  }
  return null
}

async function reportDateFromSalesEmail(db: Db, emailId: ObjectId): Promise<string | null> {
  const re = /(\d{2})\/(\d{2})\/(\d{4})\s*-\s*\d{2}\/\d{2}\/\d{4}/
  const rows = await db.collection('inbox-bork-sales').find({ sourceEmailId: emailId }).limit(200).toArray()
  for (const r of rows) {
    const sales = r.Sales
    if (typeof sales !== 'string') continue
    const m = sales.match(re)
    if (!m) continue
    const dd = +m[1]
    const mm = +m[2]
    const yyyy = +m[3]
    return `${yyyy}-${String(mm).padStart(2, '0')}-${String(dd).padStart(2, '0')}`
  }
  return null
}

async function subjectByEmailIds(db: Db, ids: ObjectId[]): Promise<Map<string, string | undefined>> {
  if (ids.length === 0) return new Map()
  const emails = await db
    .collection('inboxemails')
    .find({ _id: { $in: ids } })
    .project({ subject: 1 })
    .toArray()
  return new Map(emails.map((e) => [String(e._id), e.subject as string | undefined]))
}

function eur(n: number): string {
  return '€' + (Math.round(n * 100) / 100).toFixed(2)
}

function dashNum(n: number | null | undefined, empty = '—'): string {
  if (n == null || Number.isNaN(n)) return empty
  return eur(n)
}

/** CSV vs Daily (Basis) — should match when both from same Bork close. */
function matchCsvDaily(csv: number | null | undefined, daily: number | null | undefined): string {
  if (csv == null && daily == null) return '—'
  if (csv == null || daily == null) return 'incomplete'
  const diff = Math.abs(csv - daily)
  if (diff <= 1) return 'OK'
  return `Δ${eur(diff)}`
}

// --- Basis Rapport (inbox-bork-basis-report) ---

type BasisRow = {
  _id: ObjectId
  Groep1?: string | null
  Hoeveelheid?: string | number | null
  'Totale prijs'?: string | number | null
  'Ex BTW'?: string | number | null
  sourceEmailId: ObjectId
  sourceAttachmentId: ObjectId
  parsedAt?: Date
}

function sortBasisRows(rows: BasisRow[]): BasisRow[] {
  return [...rows].sort((a, b) => String(a._id).localeCompare(String(b._id)))
}

function extractBasisNetto(rows: BasisRow[]): { inc: number; ex: number } | null {
  const sorted = sortBasisRows(rows)
  const betIdx = sorted.findIndex((r) => r.Groep1 === 'Betalingen')
  const slice = betIdx === -1 ? sorted : sorted.slice(0, betIdx)
  for (const r of slice) {
    if (r.Groep1 !== 'Grand Total') continue
    const tp = r['Totale prijs']
    const ex = r['Ex BTW']
    if (typeof tp !== 'number' || typeof ex !== 'number') continue
    if (tp <= 0) continue
    return { inc: tp, ex }
  }
  return null
}

function extractBasisCorrecties(rows: BasisRow[]): number | null {
  const sorted = sortBasisRows(rows)
  const corrIdx = sorted.findIndex((r) => r.Groep1 === 'Correcties')
  if (corrIdx === -1) return null
  const internIdx = sorted.findIndex((r) => r.Groep1 === 'Interne Verkoop')
  const end = internIdx === -1 ? sorted.length : internIdx
  for (let i = corrIdx; i < end; i++) {
    const r = sorted[i]!
    if (r.Groep1 !== 'Grand Total') continue
    const tp = r['Totale prijs']
    if (typeof tp !== 'number') continue
    return tp
  }
  return null
}

type VenueDayAgg = {
  reportDate: string
  venue: string
  value: number
  parsedAt: Date
  nrows: number
}

function dedupeMaxByVenueDay(candidates: VenueDayAgg[]): Map<string, VenueDayAgg> {
  const m = new Map<string, VenueDayAgg>()
  for (const c of candidates) {
    const k = `${c.reportDate}|${c.venue}`
    const prev = m.get(k)
    if (!prev || c.value > prev.value || (c.value === prev.value && c.nrows > prev.nrows)) m.set(k, c)
  }
  return m
}

async function aggregateBasisByVenueDay(db: Db): Promise<Map<string, { nettoInc: number; nettoEx: number; corr: number | null }>> {
  const all = (await db.collection('inbox-bork-basis-report').find({}).toArray()) as BasisRow[]
  const byAtt = new Map<string, BasisRow[]>()
  for (const r of all) {
    const id = String(r.sourceAttachmentId)
    if (!byAtt.has(id)) byAtt.set(id, [])
    byAtt.get(id)!.push(r)
  }
  const emailIds = [...new Set([...byAtt.values()].flat().map((r) => r.sourceEmailId))]
  const subjects = await subjectByEmailIds(db, emailIds)

  type Tmp = { reportDate: string; venue: string; nettoInc: number; nettoEx: number; corr: number | null; parsedAt: Date; nrows: number }
  const candidates: Tmp[] = []
  for (const rows of byAtt.values()) {
    const emailId = rows[0]?.sourceEmailId
    if (!emailId) continue
    const subject = subjects.get(String(emailId))
    let reportDate = parseReportDateFromSubject(subject)
    if (!reportDate) reportDate = await reportDateFromSalesEmail(db, emailId)
    let venue = await venueFromSalesEmail(db, emailId)
    if (!venue) venue = venueFromSubject(subject)
    if (!reportDate || !venue) continue
    const netto = extractBasisNetto(rows)
    if (!netto) continue
    const corr = extractBasisCorrecties(rows)
    const parsedAt = rows.reduce((mx, r) => {
      const pt = r.parsedAt instanceof Date ? r.parsedAt : new Date(String(r.parsedAt ?? 0))
      return pt > mx ? pt : mx
    }, new Date(0))
    candidates.push({
      reportDate,
      venue,
      nettoInc: netto.inc,
      nettoEx: netto.ex,
      corr,
      parsedAt,
      nrows: rows.length,
    })
  }
  const byKey = new Map<string, Tmp>()
  for (const c of candidates) {
    const k = `${c.reportDate}|${c.venue}`
    const prev = byKey.get(k)
    if (!prev || c.nettoInc > prev.nettoInc || (c.nettoInc === prev.nettoInc && c.nrows > prev.nrows)) byKey.set(k, c)
  }
  const out = new Map<string, { nettoInc: number; nettoEx: number; corr: number | null }>()
  for (const [, v] of byKey) {
    out.set(`${v.reportDate}|${v.venue}`, { nettoInc: v.nettoInc, nettoEx: v.nettoEx, corr: v.corr })
  }
  return out
}

function extractSalesGrandTotal(rows: Record<string, unknown>[]): number | null {
  let best: number | null = null
  for (const r of rows) {
    if (r.column_0 === 'Grand Total' || (typeof r.column_0 === 'string' && r.column_0.toLowerCase() === 'grand total')) {
      const a = parseNlEuro(r.column_4) ?? parseNlEuro(r.column_5)
      if (a != null) best = best == null ? a : Math.max(best, a)
    }
    if (r.column_2 === 'Grand Total') {
      const a = parseNlEuro(r.column_4) ?? parseNlEuro(r.column_5)
      if (a != null) best = best == null ? a : Math.max(best, a)
    }
  }
  return best
}

async function aggregateSalesCsvByVenueDay(db: Db): Promise<Map<string, number>> {
  const all = await db.collection('inbox-bork-sales').find({}).toArray()
  const byAtt = new Map<string, Record<string, unknown>[]>()
  for (const r of all) {
    const id = String(r.sourceAttachmentId)
    if (!byAtt.has(id)) byAtt.set(id, [])
    byAtt.get(id)!.push(r)
  }
  const emailIds = [...new Set([...byAtt.values()].flat().map((r) => r.sourceEmailId as ObjectId))]
  const subjects = await subjectByEmailIds(db, emailIds)
  const candidates: VenueDayAgg[] = []
  for (const rows of byAtt.values()) {
    const emailId = rows[0]?.sourceEmailId as ObjectId | undefined
    if (!emailId) continue
    const subject = subjects.get(String(emailId))
    let reportDate = parseReportDateFromSubject(subject)
    if (!reportDate) reportDate = await reportDateFromSalesEmail(db, emailId)
    let venue = await venueFromSalesEmail(db, emailId)
    if (!venue) venue = venueFromSubject(subject)
    if (!reportDate || !venue) continue
    const gt = extractSalesGrandTotal(rows)
    if (gt == null) continue
    const parsedAt = rows.reduce((mx, r) => {
      const pt = r.parsedAt instanceof Date ? r.parsedAt : new Date(String(r.parsedAt ?? 0))
      return pt > mx ? pt : mx
    }, new Date(0))
    candidates.push({ reportDate, venue, value: gt, parsedAt, nrows: rows.length })
  }
  const deduped = dedupeMaxByVenueDay(candidates)
  const out = new Map<string, number>()
  for (const [, v] of deduped) out.set(`${v.reportDate}|${v.venue}`, v.value)
  return out
}

async function main() {
  loadDotEnv()
  const uri = process.env.MONGODB_URI
  const dbName = process.env.MONGODB_DB_NAME || 'daily-ops'
  if (!uri) {
    process.stderr.write('Missing MONGODB_URI\n')
    process.exit(1)
  }

  /** Default `_test` so this doc matches the API test aggregate collection unless you override. */
  const suffix = process.env.BORK_AGG_V2_SUFFIX !== undefined ? process.env.BORK_AGG_V2_SUFFIX : '_test'
  const apiCol = `bork_sales_hours${suffix}`

  const client = new MongoClient(uri)
  await client.connect()
  const db = client.db(dbName)

  const basisMap = await aggregateBasisByVenueDay(db)
  const salesMap = await aggregateSalesCsvByVenueDay(db)

  const dateSet = new Set<string>()
  for (const k of basisMap.keys()) dateSet.add(k.split('|')[0]!)
  for (const k of salesMap.keys()) dateSet.add(k.split('|')[0]!)

  const apiDates = (await db.collection(apiCol).distinct('business_date')) as string[]
  for (const d of apiDates) {
    if (d) dateSet.add(d)
  }

  const sortedDates = [...dateSet].filter(Boolean).sort()
  const maxStr = sortedDates.length ? sortedDates[sortedDates.length - 1]! : null
  /** Last 14 calendar days ending at max observed date (pad with missing days as empty rows). */
  const last14Calendar: string[] = []
  if (maxStr) {
    const [yy, mo, dd] = maxStr.split('-').map(Number)
    for (let i = 13; i >= 0; i--) {
      const dt = new Date(Date.UTC(yy, mo - 1, dd - i))
      const y = dt.getUTCFullYear()
      const m = String(dt.getUTCMonth() + 1).padStart(2, '0')
      const d = String(dt.getUTCDate()).padStart(2, '0')
      last14Calendar.push(`${y}-${m}-${d}`)
    }
  }
  const last14 = last14Calendar.length ? last14Calendar : sortedDates.slice(-14)

  const apiRows = await db
    .collection(apiCol)
    .aggregate([
      { $match: { business_date: { $in: last14 } } },
      { $group: { _id: { bd: '$business_date', loc: '$locationName' }, total: { $sum: '$total_revenue' } } },
    ])
    .toArray()

  const apiByDayLoc = new Map<string, number>()
  const apiByDay = new Map<string, number>()
  const apiDayHasRows = new Set<string>()
  for (const row of apiRows) {
    const bd = row._id.bd as string
    const loc = String(row._id.loc)
    const t = Number(row.total) || 0
    if (!last14.includes(bd)) continue
    apiDayHasRows.add(bd)
    apiByDayLoc.set(`${bd}|${loc}`, t)
    apiByDay.set(bd, (apiByDay.get(bd) ?? 0) + t)
  }

  const locs = ['Bar Bea', 'Van Kinsbergen', "l'Amour Toujours"]

  let md = ''
  md += '## Benchmark: Bork API vs inbox CSV vs Basis Rapport (readable columns)\n\n'
  md +=
    'Morning inbox (~**08:00 Europe/Amsterdam**) = Bork’s **calendar-day** export for “yesterday”. **CSV** and **Daily** should agree (same close); **Bork** is the API line-total aggregate for comparison.\n\n'
  md += '**Column meanings (short header → source):**\n\n'
  md += '| Header | Mongo / meaning |\n'
  md += '|:-------|----------------|\n'
  md += '| **Bork** | `' + apiCol + '` — Σ `total_revenue` (closed tickets, from **`bork_raw_data`** rebuild) |\n'
  md += '| **CSV** | `inbox-bork-sales` — Sales.csv hierarchy **Grand Total** (inc BTW) |\n'
  md += '| **Daily** | `inbox-bork-basis-report` — Basis Rapport **Netto Sales** Grand Total **Totale prijs** (inc BTW) |\n'
  md += '| **Match** | CSV vs Daily: **OK** if both present and within **€1**; **incomplete** if one side missing; **Δ€…** if they disagree |\n\n'
  md +=
    '**Why so many dashes?** Rows are **—** when that **venue + day** has **no** parsed rows in that collection. In this database snapshot, **Van Kinsbergen** inbox files dominate; **Bar Bea** / **l’Amour** need the same daily email bundle (Sales + Basis) ingested for those dates.\n\n'
  md +=
    '**Refresh:** `node --experimental-strip-types scripts/generate-bork-benchmark-inbox-vs-api.ts`  \n'
  md += `**Generated:** ${new Date().toISOString()}  \n`
  md += `**Window:** **${last14[0] ?? '—'}** … **${last14[last14.length - 1] ?? '—'}** (${last14.length} days). API suffix: \`${suffix || '(none)'}\` (env \`BORK_AGG_V2_SUFFIX\`; default \`_test\`).\n\n`
  const anyApiInWindow = last14.some((d) => apiDayHasRows.has(d))
  if (!anyApiInWindow) {
    md +=
      '> **Bork column empty:** no documents in `' +
      apiCol +
      '` for these dates — rebuild test aggregates or set `BORK_AGG_V2_SUFFIX=` to use production `bork_sales_hours`.\n\n'
  }

  md += '### Organisation total (sum over venues that have inbox rows that day)\n\n'
  md += '| date | Bork | CSV | Daily | Match |\n'
  md += '|:-----|-----:|----:|------:|:------|\n'

  for (const d of last14) {
    let sumDaily = 0
    let hasDaily = false
    let sumCsv = 0
    let hasCsv = false
    for (const loc of locs) {
      const b = basisMap.get(`${d}|${loc}`)
      if (b) {
        sumDaily += b.nettoInc
        hasDaily = true
      }
      const s = salesMap.get(`${d}|${loc}`)
      if (s != null) {
        sumCsv += s
        hasCsv = true
      }
    }
    const api = apiDayHasRows.has(d) ? (apiByDay.get(d) ?? 0) : null
    md += `| ${d} | ${api != null ? eur(api) : '—'} | ${hasCsv ? eur(sumCsv) : '—'} | ${hasDaily ? eur(sumDaily) : '—'} | ${matchCsvDaily(hasCsv ? sumCsv : null, hasDaily ? sumDaily : null)} |\n`
  }

  md += '\n### Per location\n\n'
  md += '| date | location | Bork | CSV | Daily | Match |\n'
  md += '|:-----|:---------|-----:|----:|------:|:------|\n'

  for (const d of last14) {
    for (const loc of locs) {
      const b = basisMap.get(`${d}|${loc}`)
      const s = salesMap.get(`${d}|${loc}`)
      const api = apiDayHasRows.has(d) ? apiByDayLoc.get(`${d}|${loc}`) : undefined
      const daily = b?.nettoInc
      const csv = s ?? undefined
      const apiN = api != null ? api : null
      md += `| ${d} | ${loc} | ${dashNum(apiN)} | ${dashNum(csv)} | ${dashNum(daily)} | ${matchCsvDaily(csv, daily)} |\n`
    }
  }

  let corrMd = ''
  for (const d of last14) {
    for (const loc of locs) {
      const b = basisMap.get(`${d}|${loc}`)
      const c = b?.corr
      if (c == null) continue
      corrMd += `| ${d} | ${loc} | ${eur(c)} |\n`
    }
  }
  if (corrMd) {
    md += '\n### Correcties (Basis Rapport only)\n\n'
    md += '| date | location | Correcties € |\n'
    md += '|:-----|:---------|-------------:|\n'
    md += corrMd
  }

  const path = resolve(process.cwd(), 'dev-docs/DEBUG_BUSINESS_HOUR_MAPPING.md')
  let raw = readFileSync(path, 'utf-8')
  const markerStart = '<!-- BORK_BENCHMARK_INBOX_VS_API_START -->'
  const markerEnd = '<!-- BORK_BENCHMARK_INBOX_VS_API_END -->'
  if (!raw.includes(markerStart)) {
    raw = raw.replace(
      '<!-- BORK_DAILY_OMZET_CSV_END -->',
      `<!-- BORK_DAILY_OMZET_CSV_END -->\n\n${markerStart}\n${markerEnd}`,
    )
  }
  const re = new RegExp(`${markerStart}[\\s\\S]*?${markerEnd}`)
  raw = raw.replace(re, `${markerStart}\n${md}\n${markerEnd}`)
  writeFileSync(path, raw)
  process.stdout.write(`Wrote benchmark section → dev-docs/DEBUG_BUSINESS_HOUR_MAPPING.md (${last14.length} day(s), ${apiCol}).\n`)

  await client.close()
}

main().catch((e) => {
  process.stderr.write(String(e) + '\n')
  process.exit(1)
})
