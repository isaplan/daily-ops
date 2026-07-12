/**
 * Compare Eitje "dagelijkse uren" inbox CSV exports vs daily_ops_snapshot_section_labor
 * (same source Staff Totals reads — ADR-004).
 *
 * Usage:
 *   npx tsx scripts/compare-staff-dagelijkse-uren-csv-vs-snapshot.ts
 *   npx tsx scripts/compare-staff-dagelijkse-uren-csv-vs-snapshot.ts path/to.csv [.env.digitalocean.local]
 *   npx tsx scripts/compare-staff-dagelijkse-uren-csv-vs-snapshot.ts --all
 */
import { readFileSync, existsSync, readdirSync } from 'node:fs'
import { resolve, join } from 'node:path'
import { MongoClient } from 'mongodb'
import { normalizeEitjeHoursVenueName } from '../server/utils/eitjeHours.ts'
import { VENUE_STRIP_LOCATIONS } from '../server/utils/venueStrip/constants.ts'
import { amsterdamOpenRegisterBusinessDateYmd } from '../utils/dailyOpsBusinessDate.ts'

const STAFF_DATA_DIR = resolve(
  'dev-docs/validation-data-eitje-bork/eitje/staff-data',
)

const VENUE_NAME_TO_LOCATION_ID = new Map(
  VENUE_STRIP_LOCATIONS.map((v) => [normalizeEitjeHoursVenueName(v.locationName), v.locationId]),
)

function loadEnvFile(p: string) {
  if (!existsSync(p)) return
  for (const line of readFileSync(p, 'utf8').split('\n')) {
    const m = line.match(/^([^#=]+)=(.*)$/)
    if (m) process.env[m[1].trim()] = m[2].trim().replace(/^["']|["']$/g, '')
  }
}

function loadDotEnv(overridePath?: string) {
  for (const file of ['.env.local', '.env', '.env.digitalocean.local']) {
    loadEnvFile(resolve(file))
  }
  if (overridePath) loadEnvFile(resolve(overridePath))
}

/** Parse Dutch decimal "6,4" → 6.4 */
function parseNlDecimal(s: string): number {
  const t = (s ?? '').trim().replace(/"/g, '')
  if (!t) return NaN
  const n = Number(t.replace(/\./g, '').replace(',', '.'))
  return Number.isFinite(n) ? n : NaN
}

/** DD/MM/YYYY from datum column */
function parseCsvDate(raw: string): string | null {
  const m = (raw ?? '').trim().match(/^(\d{2})\/(\d{2})\/(\d{4})$/)
  if (!m) return null
  return `${m[3]}-${m[2]}-${m[1]}`
}

type CsvShiftRow = {
  date: string
  venue: string
  type: string
  hours: number
}

function parseCsvLine(line: string): string[] {
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
  return cols
}

function parseDagelijkseUrenCsv(filePath: string): CsvShiftRow[] {
  const text = readFileSync(filePath, 'utf8')
  const lines = text.split(/\r?\n/).filter(Boolean)
  const out: CsvShiftRow[] = []
  for (let i = 1; i < lines.length; i++) {
    const cols = parseCsvLine(lines[i]!)
    const date = parseCsvDate(cols[0] ?? '')
    if (!date) continue
    const venue = (cols[2] ?? '').trim()
    const type = (cols[4] ?? '').trim().toLowerCase()
    const hours = parseNlDecimal(cols[5] ?? '')
    if (!venue || !Number.isFinite(hours) || hours <= 0) continue
    out.push({ date, venue, type, hours })
  }
  return out
}

type DayVenueTotals = {
  totalHours: number
  gewerktHours: number
  staffCount: number
}

function aggregateCsvRows(rows: CsvShiftRow[]): Map<string, DayVenueTotals> {
  const map = new Map<string, DayVenueTotals>()
  const staffByKey = new Map<string, Set<string>>()

  for (const r of rows) {
    const venueKey = normalizeEitjeHoursVenueName(r.venue)
    const key = `${r.date}|${venueKey}`
    const cur = map.get(key) ?? { totalHours: 0, gewerktHours: 0, staffCount: 0 }
    cur.totalHours += r.hours
    if (typeIsGewerkt(r.type)) cur.gewerktHours += r.hours
    map.set(key, cur)

    if (typeIsGewerkt(r.type)) {
      const staffKey = `${key}|${r.venue}|${r.type}`
      if (!staffByKey.has(key)) staffByKey.set(key, new Set())
      staffByKey.get(key)!.add(staffKey)
    }
  }

  for (const [key, totals] of map) {
    totals.totalHours = round2(totals.totalHours)
    totals.gewerktHours = round2(totals.gewerktHours)
    totals.staffCount = staffByKey.get(key)?.size ?? 0
  }
  return map
}

function typeIsGewerkt(type: string): boolean {
  const t = type.toLowerCase()
  return t.includes('gewerkte') || t === 'gewerkt'
}

function round2(n: number): number {
  return Math.round(n * 100) / 100
}

type SnapshotDay = {
  date: string
  locationId: string
  locationName: string
  hours: number
  gewerkt_hours: number
  staff_count: number
}

async function fetchSnapshotByDayVenue(
  db: ReturnType<MongoClient['db']>,
  start: string,
  end: string,
): Promise<Map<string, SnapshotDay>> {
  const docs = await db
    .collection('daily_ops_snapshot_section_labor')
    .find(
      { businessDate: { $gte: start, $lte: end } },
      {
        projection: {
          businessDate: 1,
          locationId: 1,
          locationName: 1,
          totals: 1,
          totals_gewerkt: 1,
          operational: 1,
          workers: 1,
        },
      },
    )
    .toArray()

  const map = new Map<string, SnapshotDay>()
  for (const d of docs) {
    const venueKey = normalizeEitjeHoursVenueName(String(d.locationName ?? ''))
    const key = `${d.businessDate}|${venueKey}`
    const gewerkt =
      d.totals_gewerkt?.hours ??
      d.operational?.gewerkt?.hours ??
      d.totals?.hours ??
      0
    const workers = Array.isArray(d.workers) ? d.workers : []
    const staffIds = new Set<string>()
    for (const w of workers) {
      if (Number(w.hours ?? 0) <= 0) continue
      const id = String(w.userId ?? w.userName ?? '').trim()
      if (id) staffIds.add(id)
    }
    map.set(key, {
      date: String(d.businessDate),
      locationId: String(d.locationId),
      locationName: String(d.locationName ?? ''),
      hours: round2(Number(d.totals?.hours ?? 0)),
      gewerkt_hours: round2(Number(gewerkt)),
      staff_count: staffIds.size,
    })
  }
  return map
}

type GapRow = {
  date: string
  venue: string
  locationId: string | null
  csvHours: number
  snapHours: number
  csvGewerkt: number
  snapGewerkt: number
  deltaHours: number
  issue: 'missing_snapshot' | 'hours_mismatch' | 'zero_snapshot'
}

function compareMaps(
  csvMap: Map<string, DayVenueTotals>,
  snapMap: Map<string, SnapshotDay>,
  options: { hoursTolerance?: number; maxDate?: string; metric?: 'total' | 'gewerkt' } = {},
): GapRow[] {
  const hoursTolerance = options.hoursTolerance ?? 0.5
  const maxDate = options.maxDate ?? '9999-12-31'
  const metric = options.metric ?? 'gewerkt'
  const gaps: GapRow[] = []
  for (const [key, csv] of csvMap) {
    const [date, venueKey] = key.split('|')
    if (date! > maxDate) continue
    const snap = snapMap.get(key)
    const locationId = VENUE_NAME_TO_LOCATION_ID.get(venueKey) ?? null
    const csvMetric = metric === 'gewerkt' ? csv.gewerktHours : csv.totalHours
    const snapMetric = metric === 'gewerkt' ? (snap?.gewerkt_hours ?? 0) : (snap?.hours ?? 0)
    if (!snap || snapMetric === 0) {
      if (csvMetric > 0) {
        gaps.push({
          date: date!,
          venue: venueKey,
          locationId,
          csvHours: csv.totalHours,
          snapHours: snap?.hours ?? 0,
          csvGewerkt: csv.gewerktHours,
          snapGewerkt: snap?.gewerkt_hours ?? 0,
          deltaHours: round2(csvMetric - snapMetric),
          issue: snap ? 'zero_snapshot' : 'missing_snapshot',
        })
      }
      continue
    }
    const delta = Math.abs(csvMetric - snapMetric)
    if (delta > hoursTolerance) {
      gaps.push({
        date: date!,
        venue: venueKey,
        locationId,
        csvHours: csv.totalHours,
        snapHours: snap.hours,
        csvGewerkt: csv.gewerktHours,
        snapGewerkt: snap.gewerkt_hours,
        deltaHours: round2(csvMetric - snapMetric),
        issue: 'hours_mismatch',
      })
    }
  }
  gaps.sort((a, b) => a.date.localeCompare(b.date) || a.venue.localeCompare(b.venue))
  return gaps
}

function summarizeGaps(gaps: GapRow[]) {
  const byYear = new Map<string, { missing: number; mismatch: number; zero: number }>()
  for (const g of gaps) {
    const year = g.date.slice(0, 4)
    const cur = byYear.get(year) ?? { missing: 0, mismatch: 0, zero: 0 }
    if (g.issue === 'missing_snapshot') cur.missing++
    else if (g.issue === 'zero_snapshot') cur.zero++
    else cur.mismatch++
    byYear.set(year, cur)
  }
  return byYear
}

async function analyzeFile(
  csvPath: string,
  snapMap: Map<string, SnapshotDay>,
  compareOptions: { hoursTolerance?: number; maxDate?: string; metric?: 'total' | 'gewerkt' },
): Promise<{ gaps: GapRow[]; csvDays: number }> {
  const rows = parseDagelijkseUrenCsv(csvPath)
  const csvMap = aggregateCsvRows(rows)
  const gaps = compareMaps(csvMap, snapMap, compareOptions)
  const csvDays = new Set([...csvMap.keys()].map((k) => k.split('|')[0])).size
  return { gaps, csvDays }
}

async function main(): Promise<void> {
  const args = process.argv.slice(2).filter((a) => !a.startsWith('-'))
  const runAll = process.argv.includes('--all')
  let envPath: string | undefined
  let csvPaths: string[] = []

  if (runAll) {
    csvPaths = readdirSync(STAFF_DATA_DIR)
      .filter((f) => f.endsWith('.csv'))
      .map((f) => join(STAFF_DATA_DIR, f))
  } else if (args[0]?.includes('.env')) {
    envPath = args[0]
    csvPaths = args.slice(1).length ? args.slice(1).map((p) => resolve(p)) : readdirSync(STAFF_DATA_DIR).filter((f) => f.endsWith('.csv')).map((f) => join(STAFF_DATA_DIR, f))
  } else if (args[0]) {
    csvPaths = [resolve(args[0])]
    envPath = args[1]
  } else {
    csvPaths = readdirSync(STAFF_DATA_DIR)
      .filter((f) => f.endsWith('.csv'))
      .map((f) => join(STAFF_DATA_DIR, f))
  }

  loadDotEnv(envPath)
  const uri = process.env.DATABASE_URL || process.env.MONGODB_URI
  const dbName = process.env.MONGODB_DB_NAME || 'daily-ops-db'
  if (!uri) {
    console.error('Set DATABASE_URL or MONGODB_URI')
    process.exit(1)
  }

  // Determine date range from all CSVs
  let minDate = '9999-12-31'
  let maxDate = '0000-01-01'
  for (const p of csvPaths) {
    const rows = parseDagelijkseUrenCsv(p)
    for (const r of rows) {
      if (r.date < minDate) minDate = r.date
      if (r.date > maxDate) maxDate = r.date
    }
  }

  const client = new MongoClient(uri)
  await client.connect()
  const db = client.db(dbName)

  const today = amsterdamOpenRegisterBusinessDateYmd()
  const compareOptions = {
    hoursTolerance: 15,
    maxDate: today,
    metric: 'gewerkt' as const,
  }

  console.log(`\n[staff-csv-compare] window=${minDate}..${maxDate} files=${csvPaths.length}`)
  console.log(`[staff-csv-compare] metric=${compareOptions.metric} tolerance=${compareOptions.hoursTolerance}h maxDate=${compareOptions.maxDate}`)

  const snapMap = await fetchSnapshotByDayVenue(db, minDate, maxDate)

  // Coverage summary per year in snapshot
  const snapByYear = new Map<string, number>()
  for (const s of snapMap.values()) {
    const y = s.date.slice(0, 4)
    snapByYear.set(y, (snapByYear.get(y) ?? 0) + 1)
  }
  console.log('\nSnapshot labor docs by year (all venues):')
  for (const [y, n] of [...snapByYear.entries()].sort()) console.log(`  ${y}: ${n} venue-days`)

  const allGaps: GapRow[] = []
  for (const p of csvPaths) {
    const { gaps, csvDays } = await analyzeFile(p, snapMap, compareOptions)
    console.log(`\n--- ${p.split('/').pop()} ---`)
    console.log(`  CSV venue-days: ${csvDays} unique dates in file`)
    console.log(`  Gaps: ${gaps.length} (missing=${gaps.filter((g) => g.issue === 'missing_snapshot').length}, zero=${gaps.filter((g) => g.issue === 'zero_snapshot').length}, mismatch=${gaps.filter((g) => g.issue === 'hours_mismatch').length})`)
    allGaps.push(...gaps)
  }

  const summary = summarizeGaps(allGaps)
  console.log('\n=== Gap summary by year ===')
  for (const [year, s] of [...summary.entries()].sort()) {
    console.log(`  ${year}: missing=${s.missing} zero=${s.zero} mismatch=${s.mismatch}`)
  }

  // Van Kinsbergen focus
  const vkGaps = allGaps.filter((g) => g.locationId === '69d6cfa63d2adf93b79d1ae7')
  const vkByYear = summarizeGaps(vkGaps)
  console.log('\n=== Van Kinsbergen gaps by year ===')
  for (const [year, s] of [...vkByYear.entries()].sort()) {
    console.log(`  ${year}: missing=${s.missing} zero=${s.zero} mismatch=${s.mismatch}`)
  }

  if (vkGaps.length > 0) {
    console.log('\nFirst 20 Van Kinsbergen gaps:')
    for (const g of vkGaps.slice(0, 20)) {
      console.log(
        `  ${g.date} ${g.issue} csvGew=${g.csvGewerkt}h snapGew=${g.snapGewerkt}h Δ=${g.deltaHours}h`,
      )
    }
    if (vkGaps.length > 20) console.log(`  ... and ${vkGaps.length - 20} more`)
  }

  // Write gap report for backfill
  const reportPath = resolve(STAFF_DATA_DIR, 'snapshot-gaps-report.json')
  const uniqueMissingDates = [...new Set(
    allGaps
      .filter((g) => g.issue === 'missing_snapshot' || g.issue === 'zero_snapshot')
      .map((g) => g.date),
  )].sort()

  const byLocationMissing = new Map<string, string[]>()
  for (const g of allGaps.filter((x) => x.issue === 'missing_snapshot' || x.issue === 'zero_snapshot')) {
    if (!g.locationId) continue
    const list = byLocationMissing.get(g.locationId) ?? []
    if (!list.includes(g.date)) list.push(g.date)
    byLocationMissing.set(g.locationId, list)
  }
  for (const [loc, dates] of byLocationMissing) dates.sort()

  const report = {
    generatedAt: new Date().toISOString(),
    window: { start: minDate, end: maxDate },
    totalGaps: allGaps.length,
    uniqueMissingDates,
    byLocationMissing: Object.fromEntries(byLocationMissing),
    gaps: allGaps,
  }
  await import('node:fs').then(({ writeFileSync }) =>
    writeFileSync(reportPath, JSON.stringify(report, null, 2)),
  )
  console.log(`\nWrote gap report: ${reportPath}`)
  console.log(`Unique missing dates (all venues): ${uniqueMissingDates.length}`)
  console.log('\nNote: Staff Totals chart auto-scrolls to latest month — scroll left for 2024 bars, or switch to Table view.')

  await client.close()
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
