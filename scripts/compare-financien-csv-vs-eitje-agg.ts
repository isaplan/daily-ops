/**
 * Compare financien inbox CSV (hours per location × omzetgroep per day) vs
 * eitje_time_registration_aggregation on DO/local Mongo (URI from env file).
 *
 * Usage:
 *   npx tsx scripts/compare-financien-csv-vs-eitje-agg.ts [path/to/financien.csv] [.env.digitalocean.local]
 */
import { readFileSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { MongoClient } from 'mongodb'
import { normalizeEitjeHoursVenueName } from '../server/utils/eitjeHours.ts'

function loadEnvFile (p: string) {
  if (!existsSync(p)) return
  for (const line of readFileSync(p, 'utf8').split('\n')) {
    const m = line.match(/^([^#=]+)=(.*)$/)
    if (m) process.env[m[1].trim()] = m[2].trim().replace(/^["']|["']$/g, '')
  }
}

function parseHm (s: string): number {
  const t = s.trim().replace(/"/g, '')
  const m = t.match(/^(\d+):(\d+)$/)
  if (!m) return NaN
  return parseInt(m[1]!, 10) + parseInt(m[2]!, 10) / 60
}

/** DD/MM/YY from first column prefix */
function parseCsvDate (firstCol: string): string | null {
  const m = firstCol.trim().match(/^(\d{2})\/(\d{2})\/(\d{2})/)
  if (!m) return null
  const dd = m[1]!
  const mm = m[2]!
  const yy = m[3]!
  const y = 2000 + parseInt(yy, 10)
  return `${y}-${mm}-${dd}`
}

/** Financien report only has these two omzetgroepen; sick/leave excluded from that export. */
function finOmzetgroepFromTeam (teamName: string): 'Bar & Bediening' | 'Keuken' | '_exclude' {
  const t = (teamName || '').replace(/\u00a0/g, ' ').trim().toLowerCase()
  if (t.includes('ziek') || t.includes('verlof')) return '_exclude'
  if (t === 'keuken' || t.includes('keuken')) return 'Keuken'
  return 'Bar & Bediening'
}

type CsvRow = { period: string; location: string; group: string; hours: number }

function parseFinancienCsv (filePath: string): CsvRow[] {
  const text = readFileSync(filePath, 'utf8')
  const lines = text.split(/\r?\n/).filter(Boolean)
  const out: CsvRow[] = []
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i]!
    const cols: string[] = []
    let cur = ''
    let q = false
    for (let j = 0; j < line.length; j++) {
      const c = line[j]!
      if (c === '"') {
        q = !q
        continue
      }
      if (!q && c === ',') {
        cols.push(cur)
        cur = ''
        continue
      }
      cur += c
    }
    cols.push(cur)
    const first = cols[0]?.trim() ?? ''
    const period = parseCsvDate(first)
    if (!period) continue
    const location = (cols[1] ?? '').trim()
    const group = (cols[2] ?? '').trim()
    if (!location || !group) continue
    const hm = cols[7] ?? ''
    const hours = parseHm(hm)
    if (!Number.isFinite(hours)) continue
    out.push({ period, location, group, hours })
  }
  return out
}

function key (period: string, loc: string, group: string) {
  return `${period}|${normalizeEitjeHoursVenueName(loc)}|${group}`
}

void (async () => {
  const csvPath = resolve(process.argv[2] ?? 'dev-docs/validation-data-eitje-bork/eitje-validation/financien-inbox-gmail - 2026-05-10-21-41-11 (60158).csv')
  const envPath = resolve(process.argv[3] ?? '.env.digitalocean.local')
  loadEnvFile(envPath)
  const uri = process.env.DATABASE_URL || process.env.MONGODB_URI
  if (!uri) {
    console.error('Set DATABASE_URL or MONGODB_URI (e.g. via .env.digitalocean.local)')
    process.exit(1)
  }

  const csvRows = parseFinancienCsv(csvPath)
  const csvMap = new Map<string, number>()
  const periods = new Set<string>()
  for (const r of csvRows) {
    periods.add(r.period)
    const k = key(r.period, r.location, r.group)
    csvMap.set(k, (csvMap.get(k) ?? 0) + r.hours)
  }

  const client = new MongoClient(uri)
  await client.connect()
  const db = client.db(process.env.MONGODB_DB_NAME || 'daily-ops-db')
  const minP = [...periods].sort()[0]!
  const maxP = [...periods].sort().at(-1)!

  const agg = await db
    .collection('eitje_time_registration_aggregation')
    .aggregate([
      {
        $match: {
          period_type: 'day',
          period: { $gte: minP, $lte: maxP },
        },
      },
      {
        $project: {
          period: 1,
          loc: '$location_name',
          team: '$team_name',
          th: '$total_hours',
        },
      },
    ])
    .toArray()

  const mongoMap = new Map<string, number>()
  for (const doc of agg) {
    const period = String(doc.period ?? '')
    const loc = String(doc.loc ?? '')
    const team = String(doc.team ?? '')
    const g = finOmzetgroepFromTeam(team)
    if (g === '_exclude') continue
    const th = typeof doc.th === 'number' ? doc.th : 0
    const k = key(period, loc, g)
    mongoMap.set(k, (mongoMap.get(k) ?? 0) + th)
  }

  const allKeys = new Set([...csvMap.keys(), ...mongoMap.keys()])
  const rows: { k: string; csv: number; mongo: number; delta: number }[] = []
  let maxDelta = 0
  for (const k of [...allKeys].sort()) {
    const csv = csvMap.get(k) ?? 0
    const mongo = mongoMap.get(k) ?? 0
    const delta = Math.round((mongo - csv) * 100) / 100
    maxDelta = Math.max(maxDelta, Math.abs(mongo - csv))
    rows.push({ k, csv, mongo, delta })
  }

  const bad = rows.filter((r) => Math.abs(r.delta) > 0.06)

  /** Same buckets, summed per location × day (matches “total per day per location” in CSV). */
  const csvByLoc = new Map<string, number>()
  const mongoByLoc = new Map<string, number>()
  const locKeyOnly = (period: string, locNorm: string) => `${period}|${locNorm}`
  for (const r of csvRows) {
    const k = locKeyOnly(r.period, normalizeEitjeHoursVenueName(r.location))
    csvByLoc.set(k, (csvByLoc.get(k) ?? 0) + r.hours)
  }
  for (const doc of agg) {
    const period = String(doc.period ?? '')
    const loc = String(doc.loc ?? '')
    const team = String(doc.team ?? '')
    const g = finOmzetgroepFromTeam(team)
    if (g === '_exclude') continue
    const th = typeof doc.th === 'number' ? doc.th : 0
    const k = locKeyOnly(period, normalizeEitjeHoursVenueName(loc))
    mongoByLoc.set(k, (mongoByLoc.get(k) ?? 0) + th)
  }
  const locKeys = new Set([...csvByLoc.keys(), ...mongoByLoc.keys()])
  const byLocRows = [...locKeys]
    .sort()
    .map((k) => {
      const csvH = csvByLoc.get(k) ?? 0
      const mongoH = mongoByLoc.get(k) ?? 0
      return { k, csvHours: csvH, mongoHours: mongoH, delta: Math.round((mongoH - csvH) * 100) / 100 }
    })
  const byLocBad = byLocRows.filter((r) => Math.abs(r.delta) > 0.5)

  console.log(
    JSON.stringify(
      {
        csvPath,
        periods: [...periods].sort(),
        pairsCompared: rows.length,
        mismatchesGt6min: bad.length,
        maxAbsHourDelta: Math.round(maxDelta * 100) / 100,
        locationDayTotals: {
          note: 'CSV: sum(Bar&Bediening + Keuken) per location per day. Mongo: same team buckets, excl ziek/verlof.',
          keys: byLocRows.length,
          mismatchesGt30min: byLocBad.length,
          mismatches: byLocBad.map((r) => {
            const [period, loc] = r.k.split('|')
            return { period, locationNorm: loc, csvHours: r.csvHours, mongoHours: r.mongoHours, delta: r.delta }
          }),
        },
        teamLocationMismatches: bad.map((r) => {
          const [period, loc, group] = r.k.split('|')
          return { period, locationNorm: loc, group, csvHours: r.csv, mongoHours: r.mongo, delta: r.delta }
        }),
      },
      null,
      2,
    ),
  )

  await client.close()
})()
