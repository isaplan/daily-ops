/**
 * Dedup members created from teamleden contract CSV (65083).
 * Merges same-person duplicates when contract periods don't overlap (or stubs have 0 hours).
 * Headline rate = highest across merged rows/members.
 *
 * Usage:
 *   npx tsx scripts/dedup-teamleden-contract-members.ts
 *   npx tsx scripts/dedup-teamleden-contract-members.ts --apply
 */
import { readFileSync, existsSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { MongoClient, ObjectId, type Db } from 'mongodb'
import {
  compensationStatusFromFields,
  resolveCostPerHour,
  toNum,
} from '../server/utils/memberCompensationRevisions.ts'
import { parseOptionalYmdToDate } from '../server/utils/parseOptionalYmdToDate.ts'
import { invalidateEitjeStaffHubCache } from '../server/utils/eitjeStaffHub.ts'
import { MEMBER_EITJE_SALDO_COLLECTION } from '../server/utils/memberEitjeSaldoSnapshots.ts'

const DEFAULT_CSV = resolve(
  'dev-docs/validation-data-eitje-bork/eitje/staff-data/alle-teamleden-contract-info-dailyops-ai - 2024 to 28062026 - 2026-06-28-02-37-01 (65083).csv',
)
const REPORT_PATH = resolve(
  'dev-docs/validation-data-eitje-bork/eitje/staff-data/teamleden-contract-dedup-report.json',
)
const SOURCE_REF = 'teamleden-contract-65083-2024-2026'
const SINCE_YMD = '2024-01-01'
const FAR_FUTURE = new Date(Date.UTC(2099, 11, 31))

type CsvRow = {
  name: string
  contract_type_raw: string
  weekly_hours_raw: string
  hourly_rate: number | null
  support_id: string | null
  email: string | null
  contract_start: string | null
  employment_start: string | null
  contract_end: string | null
  venue: string | null
  gewerkte_uren_raw: string
}

type Interval = { start: Date; end: Date; csvHours: number }

type MemberDoc = {
  _id: ObjectId
  name?: string
  support_id?: string | number
  eitje_ids?: Array<string | number>
  email?: string
  contract_type?: string
  hourly_rate?: number
  cost_per_hour?: number
  contract_start_date?: Date
  contract_end_date?: Date
  compensationHistory?: Array<Record<string, unknown>>
  created_at?: Date
}

function loadEnv() {
  for (const f of ['.env.local', '.env', '.env.digitalocean.local']) {
    const p = resolve(f)
    if (!existsSync(p)) continue
    for (const line of readFileSync(p, 'utf8').split('\n')) {
      const m = line.match(/^([^#=]+)=(.*)$/)
      if (m) process.env[m[1].trim()] = m[2].trim().replace(/^["']|["']$/g, '')
    }
  }
}

function normStr(s: unknown): string {
  return String(s ?? '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ')
}

function baseNameKey(name: string): string {
  return normStr(name).replace(/\s*\|.*$/, '').replace(/^oud\s+/, '')
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

function parseEuro(raw: string): number | null {
  const t = (raw ?? '').trim().replace(/"/g, '').replace(/€/g, '')
  if (!t) return null
  const n = Number(t.replace(/\./g, '').replace(',', '.'))
  return Number.isFinite(n) ? n : null
}

function parseDurationHours(raw: string): number {
  const t = (raw ?? '').trim()
  const m = t.match(/^(\d+):(\d+)$/)
  if (!m) return 0
  return parseInt(m[1]!, 10) + parseInt(m[2]!, 10) / 60
}

function parseWeeklyHours(raw: string): number | null {
  const t = (raw ?? '').trim()
  const m = t.match(/^(\d+):(\d+)$/)
  if (!m) return null
  const h = parseInt(m[1]!, 10) + parseInt(m[2]!, 10) / 60
  return Number.isFinite(h) && h > 0 ? Math.round(h * 100) / 100 : null
}

function formatContractType(raw: string, weeklyHours: number | null): string {
  const t = raw.trim().toLowerCase()
  if (!t) return '—'
  if (t === 'zzp') return weeklyHours != null && weeklyHours > 0 ? `zzp (${weeklyHours})` : 'zzp (0)'
  if (t === 'nul uren') return 'nul uren'
  if (t.includes('uren contract')) {
    return weeklyHours != null ? `uren contract (${weeklyHours})` : 'uren contract'
  }
  return raw.trim()
}

function parseCsvDateNl(raw: string | null | undefined): Date | null {
  const t = (raw ?? '').trim()
  const m = t.match(/^(\d{2})\/(\d{2})\/(\d{4})$/)
  if (!m) {
    const d = parseOptionalYmdToDate(t)
    return d ?? null
  }
  return new Date(Date.UTC(parseInt(m[3]!, 10), parseInt(m[2]!, 10) - 1, parseInt(m[1]!, 10)))
}

function parseContractCsv(filePath: string): CsvRow[] {
  const lines = readFileSync(filePath, 'utf8').split(/\r?\n/).filter(Boolean)
  const out: CsvRow[] = []
  for (let i = 1; i < lines.length; i++) {
    const cols = parseCsvLine(lines[i]!)
    const name = (cols[0] ?? '').trim()
    if (!name) continue
    out.push({
      name,
      contract_type_raw: (cols[1] ?? '').trim(),
      weekly_hours_raw: (cols[6] ?? '').trim(),
      hourly_rate: parseEuro(cols[5] ?? ''),
      support_id: (cols[25] ?? '').trim() || null,
      email: (cols[21] ?? '').trim().toLowerCase() || null,
      contract_start: (cols[4] ?? '').trim() || null,
      employment_start: (cols[20] ?? '').trim() || null,
      contract_end: (cols[3] ?? '').trim() || null,
      venue: (cols[19] ?? '').trim() || null,
      gewerkte_uren_raw: (cols[10] ?? '').trim(),
    })
  }
  return out
}

function rowInterval(row: CsvRow): Interval {
  const start =
    parseCsvDateNl(row.contract_start) ??
    parseCsvDateNl(row.employment_start) ??
    new Date(Date.UTC(2024, 0, 1))
  const end = parseCsvDateNl(row.contract_end) ?? FAR_FUTURE
  return { start, end, csvHours: parseDurationHours(row.gewerkte_uren_raw) }
}

function intervalsOverlap(a: Interval, b: Interval): boolean {
  return a.start.getTime() <= b.end.getTime() && b.start.getTime() <= a.end.getTime()
}

function groupHasBlockingOverlap(rows: CsvRow[]): boolean {
  const intervals = rows.map(rowInterval)
  for (let i = 0; i < intervals.length; i++) {
    for (let j = i + 1; j < intervals.length; j++) {
      const a = intervals[i]!
      const b = intervals[j]!
      if (!intervalsOverlap(a, b)) continue
      if (a.csvHours > 0 && b.csvHours > 0) return true
    }
  }
  return false
}

async function aggHoursForSupport(db: Db, supportId: string | null): Promise<number> {
  if (!supportId) return 0
  const candidates: unknown[] = [supportId]
  const n = Number(supportId)
  if (!Number.isNaN(n)) candidates.push(n)
  const rows = await db
    .collection('eitje_time_registration_aggregation')
    .aggregate<{ total: number }>([
      {
        $match: {
          period_type: 'day',
          period: { $gte: SINCE_YMD },
          userId: { $in: candidates },
        },
      },
      { $group: { _id: null, total: { $sum: { $ifNull: ['$total_hours', 0] } } } },
    ])
    .toArray()
  return Math.round((rows[0]?.total ?? 0) * 100) / 100
}

async function aggHoursForName(db: Db, name: string): Promise<number> {
  const key = normStr(name)
  const rows = await db
    .collection('eitje_time_registration_aggregation')
    .aggregate<{ total: number }>([
      {
        $match: {
          period_type: 'day',
          period: { $gte: SINCE_YMD },
          user_name: { $exists: true, $ne: null },
        },
      },
      { $addFields: { name_key: { $toLower: '$user_name' } } },
      { $match: { name_key: key } },
      { $group: { _id: null, total: { $sum: { $ifNull: ['$total_hours', 0] } } } },
    ])
    .toArray()
  return Math.round((rows[0]?.total ?? 0) * 100) / 100
}

function memberFrom65083(m: MemberDoc): boolean {
  return (m.compensationHistory ?? []).some((r) => r.source_ref === SOURCE_REF)
}

function pickDisplayName(rows: CsvRow[]): string {
  const withHours = rows.filter((r) => parseDurationHours(r.gewerkte_uren_raw) > 0)
  const pool = withHours.length ? withHours : rows
  return pool.sort((a, b) => a.name.length - b.name.length)[0]!.name.replace(/^Oud\s+/i, '').replace(/\s*\|.*$/, '').trim() || pool[0]!.name
}

function maxRate(...rates: Array<number | null | undefined>): number | null {
  const nums = rates.map(toNum).filter((n): n is number => n != null)
  return nums.length ? Math.max(...nums) : null
}

async function main(): Promise<void> {
  loadEnv()
  const apply = process.argv.includes('--apply')
  const csvPath = process.argv.find((a) => a.endsWith('.csv')) ?? DEFAULT_CSV

  if (!existsSync(csvPath)) {
    console.error(`CSV not found: ${csvPath}`)
    process.exit(1)
  }

  const uri = process.env.MONGODB_URI || process.env.DATABASE_URL
  const dbName = process.env.MONGODB_DB_NAME || 'daily-ops-db'
  if (!uri) {
    console.error('Missing MONGODB_URI')
    process.exit(1)
  }

  const csvRows = parseContractCsv(csvPath)
  const csvByKey = new Map<string, CsvRow[]>()
  for (const row of csvRows) {
    const k = baseNameKey(row.name)
    if (!csvByKey.has(k)) csvByKey.set(k, [])
    csvByKey.get(k)!.push(row)
  }

  const dupKeys = [...csvByKey.entries()].filter(([, rows]) => rows.length > 1).map(([k]) => k)

  const client = new MongoClient(uri)
  await client.connect()
  const db = client.db(dbName)

  const allMembers = (await db
    .collection('members')
    .find({})
    .project({
      _id: 1,
      name: 1,
      support_id: 1,
      eitje_ids: 1,
      email: 1,
      contract_type: 1,
      hourly_rate: 1,
      cost_per_hour: 1,
      contract_start_date: 1,
      contract_end_date: 1,
      compensationHistory: 1,
      created_at: 1,
    })
    .toArray()) as MemberDoc[]

  const membersByKey = new Map<string, MemberDoc[]>()
  for (const m of allMembers) {
    const k = baseNameKey(String(m.name ?? ''))
    if (!membersByKey.has(k)) membersByKey.set(k, [])
    membersByKey.get(k)!.push(m)
  }

  type MergePlan = {
    key: string
    displayName: string
    canonicalId: string
    dupeIds: string[]
    highestRate: number | null
    csvRows: number
    reason: string
  }

  const plans: MergePlan[] = []
  const skipped: Array<{ key: string; reason: string }> = []

  for (const key of dupKeys) {
    const rows = csvByKey.get(key)!
    const members = membersByKey.get(key) ?? []
    if (members.length < 2) continue

    if (groupHasBlockingOverlap(rows)) {
      skipped.push({ key, reason: 'Overlapping contract periods with hours on multiple rows' })
      continue
    }

    const memberHours = await Promise.all(
      members.map(async (m) => {
        const sid = m.support_id != null ? String(m.support_id).trim() : null
        const bySupport = await aggHoursForSupport(db, sid)
        const byName = bySupport > 0 ? 0 : await aggHoursForName(db, String(m.name ?? ''))
        return { m, hours: bySupport + byName }
      }),
    )

    const sorted = [...memberHours].sort((a, b) => b.hours - a.hours || (a.m.created_at?.getTime() ?? 0) - (b.m.created_at?.getTime() ?? 0))
    const canonical = sorted[0]!.m
    const dupes = sorted.slice(1).map((x) => x.m)

    const highestRate = maxRate(
      ...rows.map((r) => r.hourly_rate),
      ...members.map((m) => toNum(m.hourly_rate)),
    )

    plans.push({
      key,
      displayName: pickDisplayName(rows),
      canonicalId: String(canonical._id),
      dupeIds: dupes.map((d) => String(d._id)),
      highestRate,
      csvRows: rows.length,
      reason: `merge ${dupes.length} dupes → canonical (hours: ${sorted[0]!.hours})`,
    })
  }

  console.log(`\n=== Dedup plan (${plans.length} merges, ${skipped.length} skipped) ===`)
  for (const p of plans) {
    console.log(`  ${p.displayName}: ${p.dupeIds.length} dupes → ${p.canonicalId.slice(-6)} | max €${p.highestRate ?? '—'}`)
  }
  for (const s of skipped) {
    console.log(`  SKIP ${s.key}: ${s.reason}`)
  }

  writeFileSync(REPORT_PATH, JSON.stringify({ generatedAt: new Date().toISOString(), plans, skipped }, null, 2))
  console.log(`\nReport: ${REPORT_PATH}`)

  if (!apply) {
    console.log('\nDry run. Run with --apply to merge.')
    await client.close()
    return
  }

  let merged = 0
  let deleted = 0

  for (const plan of plans) {
    const rows = csvByKey.get(plan.key)!
    const canonicalOid = new ObjectId(plan.canonicalId)
    const canonical = allMembers.find((m) => String(m._id) === plan.canonicalId)
    if (!canonical) continue

    const supportIds = new Set<string>()
    const eitjeIds = new Set<string>()
    for (const m of [canonical, ...plan.dupeIds.map((id) => allMembers.find((x) => String(x._id) === id)).filter(Boolean)]) {
      if (!m) continue
      if (m.support_id != null) supportIds.add(String(m.support_id).trim())
      for (const eid of m.eitje_ids ?? []) eitjeIds.add(String(eid))
    }
    for (const row of rows) {
      if (row.support_id) supportIds.add(row.support_id)
    }

    const primarySupport = [...supportIds][0] ?? (canonical.support_id != null ? String(canonical.support_id) : null)
    const bestRow =
      rows.filter((r) => parseDurationHours(r.gewerkte_uren_raw) > 0).sort((a, b) => (b.hourly_rate ?? 0) - (a.hourly_rate ?? 0))[0] ??
      rows.sort((a, b) => (b.hourly_rate ?? 0) - (a.hourly_rate ?? 0))[0]!

    const weekly = parseWeeklyHours(bestRow.weekly_hours_raw)
    const contractType = formatContractType(bestRow.contract_type_raw, weekly)
    const hourlyRate = plan.highestRate
    const costPerHour = resolveCostPerHour(contractType, hourlyRate, toNum(canonical.cost_per_hour))
    const status = compensationStatusFromFields(contractType, hourlyRate, costPerHour)

    const earliestStart = rows
      .map((r) => parseCsvDateNl(r.contract_start) ?? parseCsvDateNl(r.employment_start))
      .filter(Boolean)
      .sort((a, b) => a!.getTime() - b!.getTime())[0]

    const latestEnd = rows
      .map((r) => parseCsvDateNl(r.contract_end))
      .filter(Boolean)
      .sort((a, b) => b!.getTime() - a!.getTime())[0]

    const now = new Date()
    const mergedHistory = [...(canonical.compensationHistory ?? [])]
    for (const dupeId of plan.dupeIds) {
      const dupe = allMembers.find((m) => String(m._id) === dupeId)
      if (!dupe?.compensationHistory?.length) continue
      for (const rev of dupe.compensationHistory) {
        const exists = mergedHistory.some(
          (r) =>
            r.source_ref === rev.source_ref &&
            String(r.effective_from) === String(rev.effective_from) &&
            toNum(r.hourly_rate) === toNum(rev.hourly_rate),
        )
        if (!exists) mergedHistory.push(rev)
      }
    }

    for (const row of rows) {
      const rate = row.hourly_rate
      if (rate == null) continue
      const interval = rowInterval(row)
      const ct = formatContractType(row.contract_type_raw, parseWeeklyHours(row.weekly_hours_raw))
      const ref = `${SOURCE_REF}:${row.support_id ?? row.name}`
      const exists = mergedHistory.some((r) => r.source_ref === ref)
      if (exists) continue
      mergedHistory.push({
        effective_from: interval.start,
        effective_to: interval.end.getTime() >= FAR_FUTURE.getTime() ? null : interval.end,
        contract_type: ct,
        hourly_rate: rate,
        cost_per_hour: resolveCostPerHour(ct, rate, null),
        source: 'inbox_eitje_contract',
        source_ref: ref,
        created_at: now,
      })
    }

    mergedHistory.sort(
      (a, b) => new Date(String(a.effective_from)).getTime() - new Date(String(b.effective_from)).getTime(),
    )

    const setFields: Record<string, unknown> = {
      name: plan.displayName,
      contract_type: contractType,
      hourly_rate: hourlyRate,
      cost_per_hour: costPerHour,
      compensation_status: status,
      compensationHistory: mergedHistory,
      updated_at: now,
    }
    if (primarySupport) setFields.support_id = primarySupport
    if (eitjeIds.size) setFields.eitje_ids = [...eitjeIds]
    if (earliestStart) setFields.contract_start_date = earliestStart
    if (latestEnd) setFields.contract_end_date = latestEnd

    await db.collection('members').updateOne({ _id: canonicalOid }, { $set: setFields })

    for (const dupeId of plan.dupeIds) {
      const dupeOid = new ObjectId(dupeId)
      await db.collection(MEMBER_EITJE_SALDO_COLLECTION).updateMany(
        { member_id: dupeId },
        { $set: { member_id: plan.canonicalId, updated_at: now } },
      )
      await db.collection('members').deleteOne({ _id: dupeOid })
      deleted++
      console.log(`[merged] ${plan.displayName}: removed ${dupeId.slice(-6)}`)
    }
    merged++
  }

  invalidateEitjeStaffHubCache()
  console.log(`\n[dedup] merged=${merged} deleted=${deleted}`)
  await client.close()
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
