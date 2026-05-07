/**
 * For each (Dag, location) with large CSV vs API variance, compare DataLab uur 00–04 excl
 * sums to raw bork_daily replay (settled vs all × order vs ticket time).
 * Usage: node --experimental-strip-types scripts/datalab-early-hours-vs-raw.ts
 */

import { readFileSync, existsSync } from 'node:fs'
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

const LOCATIONS: Record<string, string> = {
  'Bar Bea': '6916766daf9930f74a6960be',
  'Gastropub Van Kinsbergen': '6916766daf9930f74a6960bc',
  "L'Amour Toujours": '6916766daf9930f74a6960bd',
}

/** V2 table: |Diff %| > 5 vs CSV incl (Bar Bea / Van K / l'Amour) */
const WATCH: Array<{ dag: string; winkel: string; diffPct: number }> = [
  { dag: '2026-04-23', winkel: 'Bar Bea', diffPct: 5.26 },
  { dag: '2026-04-23', winkel: "L'Amour Toujours", diffPct: 5.29 },
  { dag: '2026-04-24', winkel: 'Bar Bea', diffPct: -10.66 },
  { dag: '2026-04-26', winkel: 'Bar Bea', diffPct: -28.58 },
  { dag: '2026-04-29', winkel: 'Bar Bea', diffPct: -11.82 },
  { dag: '2026-04-29', winkel: "L'Amour Toujours", diffPct: 92.37 },
]

function borkToUtc(ymd: string) {
  const y = +ymd.slice(0, 4)
  const mo = +ymd.slice(4, 6) - 1
  const d = +ymd.slice(6, 8)
  return new Date(Date.UTC(y, mo, d))
}

function datalabUur(dagStr: string, orderYmd: string, timeStr: string): number | null {
  const [Y, M, D] = dagStr.split('-').map(Number)
  const start = new Date(Date.UTC(Y, M - 1, D, 6, 0, 0))
  const end = new Date(Date.UTC(Y, M - 1, D + 1, 6, 0, 0))
  const od = orderYmd.padStart(8, '0')
  const ot = borkToUtc(od)
  const m = String(timeStr || '').match(/^(\d{1,2}):(\d{2}):(\d{2})/)
  if (!m) return null
  const event = new Date(
    Date.UTC(ot.getUTCFullYear(), ot.getUTCMonth(), ot.getUTCDate(), +m[1], +m[2], +m[3])
  )
  if (event < start || event >= end) return null
  return event.getUTCHours()
}

function ymdFromDag(dag: string) {
  const [y, m, d] = dag.split('-')
  return `${y}${m}${d}`
}

function parseDatalabEarlyExcl(csvPath: string): Map<string, number> {
  const text = readFileSync(csvPath, 'utf-8')
  const lines = text.trim().split('\n')
  const map = new Map<string, number>()
  for (let i = 1; i < lines.length; i++) {
    const parts = lines[i].split(';')
    if (parts.length < 6) continue
    const [dag, winkel, uur, , excl] = parts
    if (!['00', '01', '02', '03', '04'].includes(uur)) continue
    const k = `${dag}|${winkel}`
    const v = Number(String(excl).replace(',', '.')) || 0
    map.set(k, (map.get(k) || 0) + v)
  }
  return map
}

async function rebuildRaw(
  db: ReturnType<MongoClient['db']>,
  lid: string,
  dag: string,
  mode: 'order' | 'ticket',
  settledOnly: boolean
) {
  const d0 = ymdFromDag(dag)
  const next = new Date(dag + 'T12:00:00Z')
  next.setUTCDate(next.getUTCDate() + 1)
  const d1 =
    next.getUTCFullYear().toString() +
    String(next.getUTCMonth() + 1).padStart(2, '0') +
    String(next.getUTCDate()).padStart(2, '0')
  const blobs = [`${lid}:bork_daily:${d0}`, `${lid}:bork_daily:${d1}`]
  const byUur = new Map<number, number>()
  for (const sk of blobs) {
    const doc = await db.collection('bork_raw_data').findOne({ syncDedupKey: sk })
    if (!doc?.rawApiResponse) continue
    const tickets = Array.isArray(doc.rawApiResponse) ? doc.rawApiResponse : [doc.rawApiResponse]
    for (const t of tickets) {
      const open = t.ActualDate === 10101 || t.ActualDate === '10101'
      if (settledOnly && open) continue
      for (const o of t.Orders || []) {
        const od = String(o.Date ?? '').padStart(8, '0')
        const ts = mode === 'order' ? o.Time : t.Time
        const uur = datalabUur(dag, od, String(ts))
        if (uur === null) continue
        let rev = 0
        for (const line of o.Lines || []) rev += Number(line.Price || 0) * Number(line.Qty || 0)
        if (!rev) continue
        byUur.set(uur, (byUur.get(uur) || 0) + rev)
      }
    }
  }
  return byUur
}

loadDotEnv()
const csvPath = resolve(
  process.cwd(),
  'dev-docs/validation-data-eitje-bork/bork-validation/revenue-per-hour-per-location-last-7-days.csv'
)
const datalabEarly = parseDatalabEarlyExcl(csvPath)

const c = new MongoClient(process.env.MONGODB_URI || '')
await c.connect()
const db = c.db(process.env.MONGODB_DB_NAME || 'daily-ops')

const rows: Record<string, unknown>[] = []
for (const w of WATCH) {
  const lid = LOCATIONS[w.winkel]
  if (!lid) continue
  const dk = `${w.dag}|${w.winkel}`
  const dl = Math.round((datalabEarly.get(dk) || 0) * 100) / 100

  const sOrder = await rebuildRaw(db, lid, w.dag, 'order', true)
  const sTicket = await rebuildRaw(db, lid, w.dag, 'ticket', true)
  const aOrder = await rebuildRaw(db, lid, w.dag, 'order', false)
  const aTicket = await rebuildRaw(db, lid, w.dag, 'ticket', false)
  const early = [0, 1, 2, 3, 4]
  const sumEarly = (m: Map<number, number>) =>
    Math.round(early.reduce((a, h) => a + (m.get(h) || 0), 0) * 100) / 100

  const rSO = sumEarly(sOrder)
  const rST = sumEarly(sTicket)
  const rAO = sumEarly(aOrder)
  const rAT = sumEarly(aTicket)

  /** Same pattern as Bar Bea 26 Apr: meaningful DataLab early excl, ~0 settled raw in 00–04 */
  const patternLikeApr26 = dl >= 200 && rSO < 50 && rST < 50

  rows.push({
    dag: w.dag,
    winkel: w.winkel,
    v2DiffPct: w.diffPct,
    datalabExcl00to04: dl,
    rawSettledOrderTime00to04: rSO,
    rawSettledTicketTime00to04: rST,
    rawAllOrderTime00to04: rAO,
    rawAllTicketTime00to04: rAT,
    patternLikeApr26,
  })
}

await c.close()

const out = {
  dagWindow:
    '06:00 calendar Dag through 05:59 next day; uur 00–04 = early morning on next calendar date',
  rows,
}
console.log(JSON.stringify(out, null, 2))
