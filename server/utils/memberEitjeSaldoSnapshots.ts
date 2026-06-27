/**
 * @registry-id: memberEitjeSaldoSnapshots
 * @created: 2026-06-11T18:00:00.000Z
 * @last-modified: 2026-06-11T18:00:00.000Z
 * @description: Parse + upsert Eitje monthly uren/verlof saldo CSV snapshots
 * @last-fix: [2026-06-11] Import uren-contract saldo baselines from eitje-uren-saldo CSVs
 *
 * @exports-to:
 * ✓ scripts/import-eitje-uren-saldo-csvs.ts
 */

import { readFileSync, readdirSync } from 'fs'
import { join, basename } from 'path'
import { ObjectId, type Db } from 'mongodb'
import type { MemberEitjeSaldoSnapshot } from '~/types/member-eitje-saldo'

export const MEMBER_EITJE_SALDO_COLLECTION = 'member_eitje_saldo_snapshot'
export const EITJE_SALDO_MIN_SNAPSHOT_DATE = '2024-01-01'
const MAX_MONTHLY_CONTRACT_HOURS = 220

const MONTH_MAP: Record<string, number> = {
  JAN: 1, FEB: 2, MAR: 3, APR: 4, MAY: 5, JUN: 6,
  JUL: 7, AUG: 8, SEP: 9, OCT: 10, NOV: 11, DEC: 12,
}

export function parseEitjeTimeToHours (value: string | number | null | undefined): number {
  if (value == null) return 0
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0

  let timeStr = String(value).trim()
  if (timeStr === '') return 0

  let sign = 1
  if (timeStr.startsWith('-')) {
    sign = -1
    timeStr = timeStr.slice(1).trim()
  }

  const timeMatch = timeStr.match(/^(\d+):(\d{2})$/)
  if (timeMatch) {
    const hours = parseInt(timeMatch[1] ?? '0', 10)
    const minutes = parseInt(timeMatch[2] ?? '0', 10)
    return sign * (hours + minutes / 60)
  }

  if (/,/.test(timeStr)) {
    const normalized = timeStr.replace(/\./g, '').replace(',', '.')
    const num = Number(normalized)
    return Number.isFinite(num) ? sign * num : 0
  }

  const num = Number(timeStr)
  return Number.isFinite(num) ? sign * num : 0
}

export function snapshotDateFromSaldoFileName (fileName: string): string | null {
  const m = basename(fileName).toUpperCase().match(/1\s*([A-Z]{3})\s*(\d{4})/)
  if (!m) return null
  const month = MONTH_MAP[m[1] ?? '']
  const year = Number(m[2])
  if (!month || !Number.isFinite(year)) return null
  return `${year}-${String(month).padStart(2, '0')}-01`
}

function normName (s: string): string {
  return s.trim().toLowerCase().replace(/\s+/g, ' ')
}

function parseCsvRows (content: string): Record<string, string>[] {
  const lines = content.replace(/^\uFEFF/, '').split(/\r?\n/).filter((l) => l.trim())
  if (lines.length < 2) return []

  const headerLine = lines[0].replace(/^▼\s*/, '')
  const headers = headerLine.split(',').map((h) => h.trim())

  const rows: Record<string, string>[] = []
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i]
    if (!line.trim()) continue

    const cells: string[] = []
    let cur = ''
    let inQuotes = false
    for (let j = 0; j < line.length; j++) {
      const ch = line[j]
      if (ch === '"') {
        inQuotes = !inQuotes
        continue
      }
      if (ch === ',' && !inQuotes) {
        cells.push(cur.trim())
        cur = ''
        continue
      }
      cur += ch
    }
    cells.push(cur.trim())

    const row: Record<string, string> = {}
    for (let h = 0; h < headers.length; h++) {
      row[headers[h] ?? ''] = cells[h] ?? ''
    }
    rows.push(row)
  }
  return rows
}

function pickColumn (row: Record<string, string>, ...candidates: string[]): string {
  for (const key of candidates) {
    if (row[key] != null && String(row[key]).trim() !== '') return String(row[key]).trim()
  }
  const lower = Object.fromEntries(
    Object.entries(row).map(([k, v]) => [k.toLowerCase(), v]),
  )
  for (const key of candidates) {
    const hit = lower[key.toLowerCase()]
    if (hit != null && String(hit).trim() !== '') return String(hit).trim()
  }
  return ''
}

type MemberLookup = {
  bySupportId: Map<string, { _id: ObjectId; name: string; contract_type: string | null }>
  byName: Map<string, { _id: ObjectId; name: string; contract_type: string | null; support_id: string | null }>
}

async function buildMemberLookup (db: Db): Promise<MemberLookup> {
  const members = await db.collection('members').find({}).project({
    _id: 1,
    name: 1,
    support_id: 1,
    contract_type: 1,
  }).toArray()

  const bySupportId = new Map<string, { _id: ObjectId; name: string; contract_type: string | null }>()
  const byName = new Map<string, { _id: ObjectId; name: string; contract_type: string | null; support_id: string | null }>()

  for (const raw of members) {
    const m = raw as Record<string, unknown>
    const name = typeof m.name === 'string' ? m.name.trim() : ''
    const contractType = typeof m.contract_type === 'string' ? m.contract_type : null
    const entry = { _id: m._id as ObjectId, name, contract_type: contractType }
    const supportId = String(m.support_id ?? '').trim()
    if (supportId) bySupportId.set(supportId, entry)
    if (name) {
      byName.set(normName(name), {
        ...entry,
        support_id: supportId || null,
      })
    }
  }

  return { bySupportId, byName }
}

function isUrenContractMember (contractType: string | null): boolean {
  return /uren contract/i.test(String(contractType ?? ''))
}

function rowToSnapshot (
  row: Record<string, string>,
  snapshotDate: string,
  sourceFile: string,
  lookup: MemberLookup,
  importedAt: Date,
): MemberEitjeSaldoSnapshot | null {
  const employeeName = pickColumn(row, 'naam', '▲ naam')
  if (!employeeName) return null

  const monthlyContract = parseEitjeTimeToHours(pickColumn(row, 'maandelijkse contracturen'))
  if (monthlyContract <= 0 || monthlyContract > MAX_MONTHLY_CONTRACT_HOURS) return null

  const supportIdRaw = pickColumn(row, 'support ID', 'support id')
  const supportId = supportIdRaw.replace(/\s/g, '')
  if (!supportId) return null

  const memberBySupport = lookup.bySupportId.get(supportId)
  const memberByName = lookup.byName.get(normName(employeeName))
  const member = memberBySupport ?? memberByName
  if (!member) return null

  const isUrenContract = isUrenContractMember(member.contract_type)
  if (!isUrenContract) return null

  return {
    support_id: supportId,
    member_id: String(member._id),
    employee_name: member.name || employeeName,
    snapshot_date: snapshotDate,
    contract_location: pickColumn(row, 'contractvestiging') || null,
    monthly_contract_hours: Math.round(monthlyContract * 100) / 100,
    total_worked_hours: Math.round(parseEitjeTimeToHours(pickColumn(row, '* totaal gewerkte uren')) * 100) / 100,
    plusmin: {
      start: Math.round(parseEitjeTimeToHours(pickColumn(row, 'start plus/min saldo')) * 100) / 100,
      opbouw: Math.round(parseEitjeTimeToHours(pickColumn(row, 'opbouw plus/min saldo')) * 100) / 100,
      correcties: Math.round(parseEitjeTimeToHours(pickColumn(row, 'correcties plus/min saldo')) * 100) / 100,
      eind: Math.round(parseEitjeTimeToHours(pickColumn(row, 'eind plus/min saldo')) * 100) / 100,
    },
    verlof: {
      start: Math.round(parseEitjeTimeToHours(pickColumn(row, 'start verlofsaldo')) * 100) / 100,
      opgebouwd: Math.round(parseEitjeTimeToHours(pickColumn(row, 'opgebouwd verlofsaldo')) * 100) / 100,
      opgenomen: Math.round(parseEitjeTimeToHours(pickColumn(row, 'opgenomen verlofsaldo')) * 100) / 100,
      correcties: Math.round(parseEitjeTimeToHours(pickColumn(row, 'correcties verlofsaldo')) * 100) / 100,
      eind: Math.round(parseEitjeTimeToHours(pickColumn(row, 'eind verlofsaldo')) * 100) / 100,
    },
    sick_hours: Math.round(parseEitjeTimeToHours(pickColumn(row, '* ziekteuren')) * 100) / 100,
    is_uren_contract: true,
    source_file: sourceFile,
    imported_at: importedAt,
  }
}

export type ImportEitjeSaldoResult = {
  filesProcessed: number
  snapshotsUpserted: number
  skippedNoMember: number
  skippedNonUren: number
  skippedBadRow: number
  dateRange: { from: string; to: string } | null
}

export async function importEitjeSaldoCsvFolder (
  db: Db,
  folderPath: string,
  minSnapshotDate = EITJE_SALDO_MIN_SNAPSHOT_DATE,
): Promise<ImportEitjeSaldoResult> {
  const lookup = await buildMemberLookup(db)
  const importedAt = new Date()
  const coll = db.collection<MemberEitjeSaldoSnapshot>(MEMBER_EITJE_SALDO_COLLECTION)

  await coll.createIndex(
    { support_id: 1, snapshot_date: 1 },
    { unique: true, name: 'support_id_snapshot_date_unique' },
  )
  await coll.createIndex({ member_id: 1, snapshot_date: 1 }, { name: 'member_id_snapshot_date' })

  const files = readdirSync(folderPath)
    .filter((f) => f.toLowerCase().endsWith('.csv'))
    .map((f) => join(folderPath, f))
    .filter((f) => {
      const d = snapshotDateFromSaldoFileName(f)
      return d != null && d >= minSnapshotDate
    })
    .sort()

  let snapshotsUpserted = 0
  let skippedNoMember = 0
  let skippedNonUren = 0
  let skippedBadRow = 0
  let minDate: string | null = null
  let maxDate: string | null = null

  for (const filePath of files) {
    const snapshotDate = snapshotDateFromSaldoFileName(filePath)
    if (!snapshotDate) continue

    minDate = minDate == null || snapshotDate < minDate ? snapshotDate : minDate
    maxDate = maxDate == null || snapshotDate > maxDate ? snapshotDate : maxDate

    const content = readFileSync(filePath, 'utf-8')
    const rows = parseCsvRows(content)
    const sourceFile = basename(filePath)

    for (const row of rows) {
      const employeeName = pickColumn(row, 'naam', '▲ naam')
      const supportId = pickColumn(row, 'support ID', 'support id').replace(/\s/g, '')
      const monthlyContract = parseEitjeTimeToHours(pickColumn(row, 'maandelijkse contracturen'))

      if (!employeeName || !supportId || monthlyContract <= 0 || monthlyContract > MAX_MONTHLY_CONTRACT_HOURS) {
        skippedBadRow++
        continue
      }

      const member = lookup.bySupportId.get(supportId) ?? lookup.byName.get(normName(employeeName))
      if (!member) {
        skippedNoMember++
        continue
      }
      if (!isUrenContractMember(member.contract_type)) {
        skippedNonUren++
        continue
      }

      const doc = rowToSnapshot(row, snapshotDate, sourceFile, lookup, importedAt)
      if (!doc) {
        skippedBadRow++
        continue
      }

      await coll.updateOne(
        { support_id: doc.support_id, snapshot_date: doc.snapshot_date },
        { $set: doc },
        { upsert: true },
      )
      snapshotsUpserted++
    }
  }

  return {
    filesProcessed: files.length,
    snapshotsUpserted,
    skippedNoMember,
    skippedNonUren,
    skippedBadRow,
    dateRange: minDate && maxDate ? { from: minDate, to: maxDate } : null,
  }
}
