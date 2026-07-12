/**
 * Import Eitje teamleden contract CSV → members (full enrich: active + inactive).
 *
 * Usage:
 *   npx tsx scripts/apply-teamleden-contract-csv.ts path/to.csv              # dry-run
 *   npx tsx scripts/apply-teamleden-contract-csv.ts --apply path/to.csv      # write all fills
 *   npx tsx scripts/apply-teamleden-contract-csv.ts --apply-inactive       # alias for --apply
 *   npx tsx scripts/apply-teamleden-contract-csv.ts --inactive-only --apply
 */
import { readFileSync, existsSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { MongoClient, ObjectId } from 'mongodb'
import { invalidateEitjeStaffHubCache } from '../server/utils/eitjeStaffHub.ts'
import {
  openNewRevision,
  seedCompensationBaseline,
  toNum,
  compensationStatusFromFields,
  hasCompensationBaseline,
} from '../server/utils/memberCompensationRevisions.ts'
import { parseOptionalYmdToDate } from '../server/utils/parseOptionalYmdToDate.ts'
import { upsertUnifiedUserEitjeIdentity } from '../server/utils/unifiedUserMerge.ts'
import { refreshAllMemberEmploymentFlags } from '../server/utils/memberEitjeMasterSync.ts'
import { invalidateWorkerContractIndexCache } from '../server/utils/dailyOpsStaff/resolveWorkerContractFromMembers.ts'

const STAFF_CONTRACT_IMPORTS = 'staff_contract_imports'

const DEFAULT_CSV = resolve(
  'dev-docs/validation-data-eitje-bork/eitje/staff-data/alle-teamleden-contract-info-dailyops-ai - 2024 to 28062026 - 2026-06-28-02-37-01 (65083).csv',
)
const REPORT_PATH = resolve(
  'dev-docs/validation-data-eitje-bork/eitje/staff-data/teamleden-contract-import-report-65083.json',
)

const SOURCE_REF = 'teamleden-contract-65083-2024-2026'
const BASELINE_SOURCE_REF = 'teamleden-baseline-65082'

type CsvContractRow = {
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
}

type PlannedUpdate = {
  name: string
  support_id: string | null
  member_id: string | null
  active: boolean
  action: 'fill_missing' | 'create_member' | 'review_active' | 'skip_ok'
  fields: { contract_type?: string; hourly_rate?: number | null }
  current: { contract_type?: string | null; hourly_rate?: number | null }
  csv: { contract_type?: string; hourly_rate?: number | null }
  reason?: string
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

function parseWeeklyHours(raw: string): number | null {
  const t = (raw ?? '').trim()
  const m = t.match(/^(\d+):(\d+)$/)
  if (!m) return null
  const h = parseInt(m[1]!, 10) + parseInt(m[2]!, 10) / 60
  return Number.isFinite(h) && h > 0 ? Math.round(h * 100) / 100 : null
}

function formatContractType(raw: string, weeklyHours: number | null): string | null {
  const t = raw.trim().toLowerCase()
  if (!t) return null
  if (t === 'zzp') return weeklyHours != null && weeklyHours > 0 ? `zzp (${weeklyHours})` : 'zzp (0)'
  if (t === 'nul uren') return 'nul uren'
  if (t.includes('uren contract')) {
    return weeklyHours != null ? `uren contract (${weeklyHours})` : 'uren contract'
  }
  if (t.includes('geen contract')) return 'geen contract'
  return raw.trim()
}

function parseContractCsv(filePath: string): CsvContractRow[] {
  const lines = readFileSync(filePath, 'utf8').split(/\r?\n/).filter(Boolean)
  const out: CsvContractRow[] = []
  for (let i = 1; i < lines.length; i++) {
    const cols = parseCsvLine(lines[i]!)
    const name = (cols[0] ?? '').trim()
    if (!name) continue
    const weekly = parseWeeklyHours(cols[6] ?? '')
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
    })
  }
  return out
}

function contractFromRow(row: CsvContractRow): { contract_type: string | null; hourly_rate: number | null } {
  const weekly = parseWeeklyHours(row.weekly_hours_raw)
  return {
    contract_type: formatContractType(row.contract_type_raw, weekly),
    hourly_rate: row.hourly_rate,
  }
}

function contractTypesMatch(a: string | null | undefined, b: string | null | undefined): boolean {
  const na = normStr(a).replace(/\([\d.]+\)/, '').trim()
  const nb = normStr(b).replace(/\([\d.]+\)/, '').trim()
  if (!na || !nb) return na === nb
  return na === nb
}

function ratesMatch(a: number | null | undefined, b: number | null | undefined): boolean {
  if (a == null && b == null) return true
  if (a == null || b == null) return false
  return Math.abs(a - b) < 0.02
}

function memberHasCompensation(m: {
  contract_type?: string | null
  hourly_rate?: number | null
  compensation_status?: string | null
}): boolean {
  return (
    compensationStatusFromFields(
      String(m.contract_type ?? ''),
      toNum(m.hourly_rate),
      null,
    ) === 'ok'
  )
}

function parseCsvDateNl(raw: string | null | undefined): Date | null {
  const t = (raw ?? '').trim()
  const m = t.match(/^(\d{2})\/(\d{2})\/(\d{4})$/)
  if (m) return new Date(Date.UTC(parseInt(m[3]!, 10), parseInt(m[2]!, 10) - 1, parseInt(m[1]!, 10)))
  return parseOptionalYmdToDate(t)
}

/** Employed per CSV contract end (not trailing hours). */
function isRowEmployed(row: CsvContractRow, asOf = new Date()): boolean {
  const end = parseCsvDateNl(row.contract_end)
  if (!end) return true
  const day = new Date(Date.UTC(asOf.getUTCFullYear(), asOf.getUTCMonth(), asOf.getUTCDate()))
  const endDay = new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth(), end.getUTCDate()))
  return endDay >= day
}

function mergeFillFields(
  curType: string | null,
  curRate: number | null,
  hasOk: boolean,
  csvContract: { contract_type?: string | null; hourly_rate?: number | null },
): { contract_type?: string; hourly_rate?: number | null } {
  const fields: { contract_type?: string; hourly_rate?: number | null } = {}
  if (!curType?.trim() && csvContract.contract_type) fields.contract_type = csvContract.contract_type
  if (curRate == null && csvContract.hourly_rate != null) fields.hourly_rate = csvContract.hourly_rate
  if (!hasOk) {
    if (csvContract.contract_type && !fields.contract_type) fields.contract_type = csvContract.contract_type
    if (csvContract.hourly_rate != null && fields.hourly_rate == null) fields.hourly_rate = csvContract.hourly_rate
  }
  return fields
}

async function seedActiveBaselines(
  db: Awaited<ReturnType<MongoClient['db']>>,
  csvRows: CsvContractRow[],
  plan: PlannedUpdate[],
  apply: boolean,
): Promise<{ candidates: number; inserted: number }> {
  const activeWithMember = plan.filter((p) => p.active && p.member_id && p.action !== 'skip_ok')
  const allActive = plan.filter((p) => p.active && p.member_id)
  const targets = allActive.length ? allActive : plan.filter((p) => p.active && p.member_id)

  let candidates = 0
  let inserted = 0

  for (const p of targets) {
    const row = csvRows.find((r) => r.name === p.name)
    if (!row || !p.member_id) continue

    const csvContract = contractFromRow(row)
    const curRate = toNum(p.current.hourly_rate)
    const csvRate = csvContract.hourly_rate
    if (curRate == null || csvRate == null) continue
    if (Math.abs(curRate - csvRate) < 0.02) continue
    if (csvRate >= curRate - 0.01) continue

    const oid = new ObjectId(p.member_id)
    const member = await db.collection('members').findOne({ _id: oid }, { projection: { compensationHistory: 1 } })
    if (hasCompensationBaseline(member?.compensationHistory as never, BASELINE_SOURCE_REF)) continue

    candidates++

    const effectiveFrom =
      parseCsvDateNl(row.contract_start) ??
      parseCsvDateNl(row.employment_start) ??
      new Date(Date.UTC(2024, 0, 1))

    const openRev = (member?.compensationHistory as Array<{ effective_from: Date; effective_to: Date | null }> | undefined)
      ?.filter((r) => r.effective_to == null)
      .sort((a, b) => new Date(b.effective_from).getTime() - new Date(a.effective_from).getTime())[0]

    let effectiveTo: Date
    if (openRev && new Date(openRev.effective_from).getTime() > effectiveFrom.getTime() + 86400000) {
      effectiveTo = new Date(new Date(openRev.effective_from).getTime() - 86400000)
    } else {
      effectiveTo = new Date(Math.min(Date.now(), effectiveFrom.getTime() + 180 * 86400000))
    }

    if (!apply) continue

    const result = await seedCompensationBaseline(db, oid, {
      baseline: {
        contract_type: csvContract.contract_type ?? p.current.contract_type ?? '',
        hourly_rate: csvRate,
        cost_per_hour: null,
      },
      effectiveFrom,
      effectiveTo,
      sourceRef: BASELINE_SOURCE_REF,
    })
    if (result.inserted) {
      inserted++
      console.log(
        `[baseline] ${p.name} €${csvRate} (${effectiveFrom.toISOString().slice(0, 10)} → ${effectiveTo.toISOString().slice(0, 10)}) → current €${curRate}`,
      )
    }
  }

  return { candidates, inserted }
}

async function main(): Promise<void> {
  loadEnv()
  const apply =
    process.argv.includes('--apply') ||
    process.argv.includes('--apply-inactive') ||
    process.argv.includes('--apply-all')
  const seedBaselines = process.argv.includes('--seed-active-baselines')
  const inactiveOnly = process.argv.includes('--inactive-only')
  const csvPath = process.argv.find((a) => a.endsWith('.csv')) ?? DEFAULT_CSV

  if (!existsSync(csvPath)) {
    console.error(`CSV not found: ${csvPath}`)
    process.exit(1)
  }

  const uri = process.env.MONGODB_URI || process.env.DATABASE_URL
  const dbName = process.env.MONGODB_DB_NAME || 'daily-ops-db'
  if (!uri) {
    console.error('Missing MONGODB_URI / DATABASE_URL')
    process.exit(1)
  }

  const csvRows = parseContractCsv(csvPath)
  console.log(`[teamleden-csv] parsed ${csvRows.length} staff rows from ${csvPath.split('/').pop()}`)

  const client = new MongoClient(uri)
  await client.connect()
  const db = client.db(dbName)

  if (apply) {
    await db.collection(STAFF_CONTRACT_IMPORTS).insertOne({
      source_file: csvPath.split('/').pop(),
      source_ref: SOURCE_REF,
      imported_at: new Date(),
      row_count: csvRows.length,
      rows: csvRows,
    })
    console.log(`[teamleden-csv] archived ${csvRows.length} rows → ${STAFF_CONTRACT_IMPORTS}`)
  }


  const members = await db
    .collection('members')
    .find({})
    .project({
      _id: 1,
      name: 1,
      support_id: 1,
      contract_type: 1,
      hourly_rate: 1,
      compensation_status: 1,
      email: 1,
    })
    .toArray()

  const bySupport = new Map<string, (typeof members)[0]>()
  const byName = new Map<string, (typeof members)[0]>()
  const byBaseName = new Map<string, (typeof members)[0]>()
  for (const m of members) {
    const sid = String(m.support_id ?? '').trim()
    if (sid) bySupport.set(sid, m)
    byName.set(normStr(m.name), m)
    byBaseName.set(baseNameKey(String(m.name ?? '')), m)
  }

  const plan: PlannedUpdate[] = []
  const pendingCreates = new Map<string, PlannedUpdate>()

  for (const row of csvRows) {
    const csvContract = contractFromRow(row)
    const member =
      (row.support_id ? bySupport.get(row.support_id) : undefined) ??
      byName.get(normStr(row.name)) ??
      byName.get(normStr(row.name.replace(/\s*\|.*$/, ''))) ??
      byBaseName.get(baseNameKey(row.name))

    const employed = isRowEmployed(row)

    if (!member) {
      if (inactiveOnly && employed) continue
      if (!csvContract.contract_type && csvContract.hourly_rate == null) continue
      const bkey = baseNameKey(row.name)
      const pending = pendingCreates.get(bkey)
      const displayName = row.name.replace(/^Oud\s+/i, '').replace(/\s*\|.*$/, '').trim() || row.name
      if (pending) {
        const cur = toNum(pending.fields.hourly_rate)
        const next = csvContract.hourly_rate
        if (cur == null || (next != null && next > cur)) {
          pending.fields.hourly_rate = next
          pending.csv.hourly_rate = next
        }
        if (!pending.fields.contract_type && csvContract.contract_type) {
          pending.fields.contract_type = csvContract.contract_type
        }
        continue
      }
      const entry: PlannedUpdate = {
        name: displayName,
        support_id: row.support_id,
        member_id: null,
        active: employed,
        action: 'create_member',
        fields: {
          contract_type: csvContract.contract_type ?? undefined,
          hourly_rate: csvContract.hourly_rate,
        },
        current: {},
        csv: csvContract,
        reason: employed ? 'No member — will create (active)' : 'No member record — will create (inactive)',
      }
      pendingCreates.set(bkey, entry)
      plan.push(entry)
      continue
    }

    const curType = typeof member.contract_type === 'string' ? member.contract_type : null
    const curRate = toNum(member.hourly_rate)
    const hasOk = memberHasCompensation(member)
    const fields = mergeFillFields(curType, curRate, hasOk, csvContract)

    if (employed) {
      if (inactiveOnly) continue
      if (!fields.contract_type && fields.hourly_rate == null) {
        plan.push({
          name: row.name,
          support_id: row.support_id,
          member_id: String(member._id),
          active: true,
          action: 'skip_ok',
          fields: {},
          current: { contract_type: curType, hourly_rate: curRate },
          csv: csvContract,
        })
        continue
      }
      plan.push({
        name: row.name,
        support_id: row.support_id,
        member_id: String(member._id),
        active: true,
        action: 'fill_missing',
        fields,
        current: { contract_type: curType, hourly_rate: curRate },
        csv: csvContract,
        reason: 'Active — fill missing contract/wage from CSV',
      })
      continue
    }

    if (!fields.contract_type && fields.hourly_rate == null) {
      plan.push({
        name: row.name,
        support_id: row.support_id,
        member_id: String(member._id),
        active: false,
        action: 'skip_ok',
        fields: {},
        current: { contract_type: curType, hourly_rate: curRate },
        csv: csvContract,
        reason: 'Inactive — already has contract data',
      })
      continue
    }

    plan.push({
      name: row.name,
      support_id: row.support_id,
      member_id: String(member._id),
      active: false,
      action: 'fill_missing',
      fields,
      current: { contract_type: curType, hourly_rate: curRate },
      csv: csvContract,
    })
  }

  const applyPlan = plan.filter((p) => p.action === 'fill_missing' || p.action === 'create_member')
  const summary = {
    csv_rows: csvRows.length,
    inactive_only: inactiveOnly,
    fill_missing: applyPlan.filter((p) => p.action === 'fill_missing').length,
    fill_active: applyPlan.filter((p) => p.action === 'fill_missing' && p.active).length,
    fill_inactive: applyPlan.filter((p) => p.action === 'fill_missing' && !p.active).length,
    create_member: applyPlan.filter((p) => p.action === 'create_member').length,
    skip_ok: plan.filter((p) => p.action === 'skip_ok').length,
  }

  writeFileSync(REPORT_PATH, JSON.stringify({ generatedAt: new Date().toISOString(), csvPath, summary, plan }, null, 2))

  console.log('\n=== Summary ===')
  if (inactiveOnly) console.log('  Mode: inactive staff only')
  console.log(`  Fill missing (total):   ${summary.fill_missing}`)
  console.log(`    active:               ${summary.fill_active}`)
  console.log(`    inactive:             ${summary.fill_inactive}`)
  console.log(`  Create member:          ${summary.create_member}`)
  console.log(`  OK / skip:              ${summary.skip_ok}`)
  console.log(`\nReport: ${REPORT_PATH}`)

  if (!inactiveOnly) {
    const baselinePreview = await seedActiveBaselines(db, csvRows, plan, false)
    console.log(`\n=== Active baseline (CSV → compensationHistory) ===`)
    console.log(`  Candidates (CSV rate < current): ${baselinePreview.candidates}`)

    if (seedBaselines) {
      const baselineApply = await seedActiveBaselines(db, csvRows, plan, true)
      console.log(`  Seeded baselines: ${baselineApply.inserted}`)
      invalidateEitjeStaffHubCache()
    } else if (baselinePreview.candidates > 0) {
      console.log('  Run with --seed-active-baselines to store CSV rates as historical revisions.')
    }
  }

  if (!apply) {
    console.log('\nDry run. Run with --apply to write all fills + creates.')
    await client.close()
    return
  }

  let updated = 0
  let created = 0
  const asOf = new Date()
  const createdByBase = new Map<string, ObjectId>()

  for (const p of inactiveOnly ? applyPlan.filter((x) => !x.active) : applyPlan) {
    if (p.action === 'create_member') {
      const bkey = baseNameKey(p.name)
      if (createdByBase.has(bkey)) continue

      const row =
        csvRows.find((r) => baseNameKey(r.name) === bkey && r.support_id === p.support_id) ??
        csvRows.find((r) => baseNameKey(r.name) === bkey)!
      const siblingRows = csvRows.filter((r) => baseNameKey(r.name) === bkey)
      const hourly_rate = siblingRows.reduce<number | null>((max, r) => {
        const rate = contractFromRow(r).hourly_rate
        if (rate == null) return max
        return max == null || rate > max ? rate : max
      }, p.fields.hourly_rate ?? p.csv.hourly_rate ?? null)

      const email =
        row.email ||
        siblingRows.find((r) => r.email)?.email ||
        (row.support_id
          ? `support-${row.support_id.replace(/[^\w.-]/g, '_')}@noreply.local`
          : `member-${new ObjectId().toHexString()}@noreply.local`)

      if (row.support_id) {
        const exists = await db.collection('members').findOne({ support_id: row.support_id })
        if (exists) {
          createdByBase.set(bkey, exists._id as ObjectId)
          continue
        }
      }

      const doc: Record<string, unknown> = {
        name: p.name,
        email,
        roles: [{ role: 'kitchen_staff', scope: 'team', grantedAt: asOf }],
        is_active: p.active,
        created_at: asOf,
        updated_at: asOf,
      }
      if (row.support_id) doc.support_id = row.support_id
      const csd = parseOptionalYmdToDate(row.contract_start ?? undefined)
      if (csd) doc.contract_start_date = csd
      const ced = parseOptionalYmdToDate(row.contract_end ?? undefined)
      if (ced) doc.contract_end_date = ced

      const ins = await db.collection('members').insertOne(doc)
      createdByBase.set(bkey, ins.insertedId)
      const contract_type = p.fields.contract_type ?? p.csv.contract_type ?? ''
      if (contract_type || hourly_rate != null) {
        await openNewRevision(
          db,
          ins.insertedId,
          { contract_type, hourly_rate, cost_per_hour: null },
          'inbox_eitje_contract',
          asOf,
          SOURCE_REF,
        )
      }
      if (row.support_id) {
        const { unifiedUserId } = await upsertUnifiedUserEitjeIdentity(
          db,
          row.support_id,
          p.name,
          row.support_id,
        )
        await db.collection('members').updateOne(
          { _id: ins.insertedId },
          { $set: { unified_user_id: unifiedUserId, updated_at: asOf } },
        )
      }
      created++
      console.log(`[create] ${p.name}`)
      continue
    }

    if (p.action !== 'fill_missing' || !p.member_id) continue

    const oid = new ObjectId(p.member_id)
    const existing = await db.collection('members').findOne({ _id: oid })
    if (!existing) continue

    const row =
      csvRows.find((r) => r.name === p.name && r.support_id === p.support_id) ??
      csvRows.find((r) => baseNameKey(r.name) === baseNameKey(p.name))

    const contract_type =
      p.fields.contract_type ??
      (typeof existing.contract_type === 'string' && existing.contract_type.trim() ? existing.contract_type : '') ??
      p.csv.contract_type ??
      ''
    const hourly_rate =
      p.fields.hourly_rate ??
      toNum(existing.hourly_rate) ??
      p.csv.hourly_rate ??
      null

    const { changed } = await openNewRevision(
      db,
      oid,
      { contract_type, hourly_rate, cost_per_hour: toNum(existing.cost_per_hour) },
      'inbox_eitje_contract',
      asOf,
      SOURCE_REF,
    )
    if (changed) {
      updated++
      console.log(`[update${p.active ? '' : '-inactive'}] ${p.name} → ${contract_type} €${hourly_rate ?? '—'}`)
    }

    const memberPatch: Record<string, unknown> = { updated_at: asOf }
    if (row) {
      const csd = parseCsvDateNl(row.contract_start ?? row.employment_start)
      const ced = parseCsvDateNl(row.contract_end)
      if (csd) memberPatch.contract_start_date = csd
      if (ced) memberPatch.contract_end_date = ced
    }
    if (p.support_id && !existing.support_id) memberPatch.support_id = p.support_id

    if (p.support_id) {
      const { unifiedUserId } = await upsertUnifiedUserEitjeIdentity(
        db,
        p.support_id,
        p.name,
        p.support_id,
      )
      memberPatch.unified_user_id = unifiedUserId
    }

    await db.collection('members').updateOne({ _id: oid }, { $set: memberPatch })
  }

  invalidateEitjeStaffHubCache()
  invalidateWorkerContractIndexCache()
  console.log(`\n[teamleden-csv] applied: updated=${updated} created=${created}`)

  let inactiveFlags = 0
  let activeFlags = 0
  for (const p of plan.filter((x) => x.member_id)) {
    const oid = new ObjectId(p.member_id!)
    if (!p.active) {
      const r = await db.collection('members').updateOne(
        { _id: oid, is_active: { $ne: false } },
        { $set: { is_active: false, updated_at: asOf } },
      )
      if (r.modifiedCount) inactiveFlags++
    } else {
      const r = await db.collection('members').updateOne(
        { _id: oid, is_active: { $ne: true } },
        { $set: { is_active: true, updated_at: asOf } },
      )
      if (r.modifiedCount) activeFlags++
    }
  }
  if (inactiveFlags) console.log(`[teamleden-csv] marked inactive: ${inactiveFlags}`)
  if (activeFlags) console.log(`[teamleden-csv] marked active: ${activeFlags}`)

  const refreshed = await refreshAllMemberEmploymentFlags(db)
  if (refreshed) console.log(`[teamleden-csv] employment flags refreshed=${refreshed}`)

  await client.close()
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
