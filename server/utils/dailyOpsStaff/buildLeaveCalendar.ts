/**
 * @registry-id: dailyOpsStaffBuildLeaveCalendar
 * @created: 2026-08-13T14:13:52.000Z
 * @last-modified: 2026-08-13T16:20:00.000Z
 * @description: Year leave Gantt — leave_requests + ziek hours + FT/PT/ZZP
 * @last-fix: [2026-08-13] Exclude inactive members from leave calendar spans
 * @adr-ref: ADR-004
 * @data-source: direct-db
 * @read-cache-json: none
 *
 * @exports-to:
 * ✓ server/api/daily-ops/staff/leave-calendar.get.ts
 */

import type { Db } from 'mongodb'
import {
  EITJE_ZIEK_TEAM_REGEX,
  isVerlofVakantieTeamName,
  isZiekTeamName,
} from '../eitjeAbsenceTeams'
import { buildWorkerContractIndex } from './resolveWorkerContractFromMembers'
import { VENUE_STRIP_LOCATIONS } from '../venueStrip/constants'
import {
  addCalendarDaysYmd,
  calendarYmdInAmsterdam,
} from '~/utils/dailyOpsBusinessDate'
import {
  classifyStaffContractType,
  type StaffContractBucketKey,
} from '~/utils/dailyOpsStaffContractBuckets'
import type {
  DailyOpsStaffLeaveCalendarDayDto,
  DailyOpsStaffLeaveCalendarDto,
  DailyOpsStaffLeaveCalendarEntryDto,
  DailyOpsStaffLeaveCalendarMonthDto,
  DailyOpsStaffLeaveContractBucket,
  DailyOpsStaffLeaveKind,
  DailyOpsStaffLeaveSource,
  DailyOpsStaffLeaveSpanDto,
} from '~/types/daily-ops-staff'

const DEFAULT_LEAVE_HOURS_PER_DAY = 8
const MONTH_LABELS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
] as const

function round2 (n: number): number {
  return Math.round(n * 100) / 100
}

function dayStartUtc (dateStr: string): Date {
  const [y, m, d] = dateStr.split('-').map(Number)
  return new Date(Date.UTC(y ?? 0, (m ?? 1) - 1, d ?? 1, 0, 0, 0, 0))
}

export function parseYear (year: string | number): { year: number; startDate: string; endDate: string } | null {
  const y = typeof year === 'number' ? year : Number(year)
  if (!Number.isInteger(y) || y < 2000 || y > 2100) return null
  return {
    year: y,
    startDate: `${y}-01-01`,
    endDate: `${y}-12-31`,
  }
}

/** @deprecated month mode — kept for parse helpers */
export function parseMonth (month: string): { startDate: string; endDate: string } | null {
  if (!/^\d{4}-\d{2}$/.test(month)) return null
  const [ys, ms] = month.split('-')
  const y = Number(ys)
  const m = Number(ms)
  if (!y || !m || m < 1 || m > 12) return null
  const startDate = `${ys}-${ms}-01`
  const lastDay = new Date(Date.UTC(y, m, 0)).getUTCDate()
  const endDate = `${ys}-${ms}-${String(lastDay).padStart(2, '0')}`
  return { startDate, endDate }
}

function enumerateDays (startDate: string, endDate: string): string[] {
  const out: string[] = []
  let cur = startDate
  while (cur <= endDate) {
    out.push(cur)
    cur = addCalendarDaysYmd(cur, 1)
  }
  return out
}

function toDate (value: unknown): Date | null {
  const d = value instanceof Date ? value : value ? new Date(String(value)) : null
  if (!d || Number.isNaN(d.getTime())) return null
  return d
}

function overlapHours (
  start: unknown,
  end: unknown,
  windowStart: Date,
  windowEnd: Date,
): number {
  const s = toDate(start)
  const e = toDate(end)
  if (!s || !e) return 0
  const from = Math.max(s.getTime(), windowStart.getTime())
  const to = Math.min(e.getTime(), windowEnd.getTime())
  if (to <= from) return 0
  return round2((to - from) / 3_600_000)
}

function leaveHoursOnDay (
  earliestStart: unknown,
  latestEnd: unknown,
  day: string,
): number {
  const windowStart = dayStartUtc(day)
  const windowEnd = dayStartUtc(addCalendarDaysYmd(day, 1))
  const raw = overlapHours(earliestStart, latestEnd, windowStart, windowEnd)
  if (raw <= 0) return 0
  return round2(Math.min(raw, DEFAULT_LEAVE_HOURS_PER_DAY))
}

export function classifyLeaveKind (reason: string, source: DailyOpsStaffLeaveSource): DailyOpsStaffLeaveKind {
  if (source === 'sick_hours') return 'sick'
  const n = reason.trim().toLowerCase()
  if (!n) return 'leave'
  if (isZiekTeamName(n) || n.includes('ziek') || n.includes('sick')) return 'sick'
  if (isVerlofVakantieTeamName(n) || n.includes('vakantie') || n.includes('vacation') || n.includes('holiday')) {
    return 'vacation'
  }
  return 'leave'
}

function venueName (locationId: string, fallback: string): string {
  const hit = VENUE_STRIP_LOCATIONS.find((v) => v.locationId === locationId)
  return hit?.locationName ?? fallback
}

function daysInMonth (year: number, month1to12: number): number {
  return new Date(Date.UTC(year, month1to12, 0)).getUTCDate()
}

function monthKey (year: number, month1to12: number): string {
  return `${year}-${String(month1to12).padStart(2, '0')}`
}

function shortLabel (kind: DailyOpsStaffLeaveKind, reason: string, userName: string): string {
  const r = reason.trim()
  if (kind === 'sick') return `${userName} · Sick`
  if (kind === 'vacation') {
    if (/vakantie|vacation|holiday/i.test(r) && r.length <= 28) return `${userName} · ${r}`
    return `${userName} · Vacation`
  }
  if (r && r.length <= 24) return `${userName} · ${r}`
  return `${userName} · Leave`
}

function resolveBucket (
  index: Awaited<ReturnType<typeof buildWorkerContractIndex>>,
  userId: string,
  userName: string,
): DailyOpsStaffLeaveContractBucket | null {
  for (const k of [userId, String(Number(userId))].filter(Boolean)) {
    const ct = index.byShiftId.get(k)
    if (ct) {
      const bucket = classifyStaffContractType(ct)
      if (bucket) return bucket
    }
  }
  const nm = userName.trim().toLowerCase().replace(/\s+/g, ' ')
  if (nm) {
    const ct = index.byName.get(nm)
    if (ct) {
      const bucket = classifyStaffContractType(ct) as StaffContractBucketKey | null
      if (bucket) return bucket
    }
  }
  return null
}

function normWorkerName (s: unknown): string {
  return String(s ?? '').trim().toLowerCase().replace(/\s+/g, ' ')
}

function workerIdKeys (id: unknown): string[] {
  if (id == null || id === '') return []
  const s = String(id).trim()
  const out = new Set<string>([s])
  const n = Number(s)
  if (!Number.isNaN(n)) out.add(String(n))
  return [...out]
}

/** Members with is_active === false — exclude from leave Gantt. */
async function loadInactiveWorkerKeys (db: Db): Promise<{
  ids: Set<string>
  names: Set<string>
}> {
  const ids = new Set<string>()
  const names = new Set<string>()
  const rows = await db
    .collection('members')
    .find({
      $or: [{ is_active: false }, { isActive: false }],
    })
    .project({
      name: 1,
      support_id: 1,
      eitje_id: 1,
      eitje_ids: 1,
    })
    .toArray()

  for (const m of rows) {
    const nm = normWorkerName(m.name)
    if (nm) names.add(nm)
    for (const k of workerIdKeys(m.support_id)) ids.add(k)
    for (const k of workerIdKeys(m.eitje_id)) ids.add(k)
    for (const x of (m.eitje_ids as unknown[] | undefined) ?? []) {
      for (const k of workerIdKeys(x)) ids.add(k)
    }
  }
  return { ids, names }
}

function isInactiveWorker (
  userId: string,
  userName: string,
  inactive: { ids: Set<string>; names: Set<string> },
): boolean {
  for (const k of workerIdKeys(userId)) {
    if (inactive.ids.has(k)) return true
  }
  const nm = normWorkerName(userName)
  return Boolean(nm && inactive.names.has(nm))
}

type LeaveAggDoc = {
  locationId?: string
  location_name?: string
  userId?: string
  user_name?: string
  status?: string
  reason?: string
  process_reason?: string
  earliest_start?: Date
  latest_end?: Date
}

type SickAggDoc = {
  period?: string
  locationId?: string
  location_name?: string
  userId?: string
  user_name?: string
  team_name?: string
  total_hours?: number
}

type SpanDraft = {
  kind: DailyOpsStaffLeaveKind
  source: DailyOpsStaffLeaveSource
  status: string
  reason: string
  userId: string
  userName: string
  locationId: string
  locationName: string
  contractBucket: DailyOpsStaffLeaveContractBucket | null
  startDate: string
  endDate: string
  hoursByDay: Map<string, number>
}

function pushMonthSpans (
  drafts: SpanDraft[],
  year: number,
  out: Map<string, DailyOpsStaffLeaveSpanDto[]>,
): void {
  let seq = 0
  for (const draft of drafts) {
    for (let m = 1; m <= 12; m++) {
      const mk = monthKey(year, m)
      const dim = daysInMonth(year, m)
      const monthStart = `${mk}-01`
      const monthEnd = `${mk}-${String(dim).padStart(2, '0')}`
      if (draft.endDate < monthStart || draft.startDate > monthEnd) continue

      const clipStart = draft.startDate < monthStart ? monthStart : draft.startDate
      const clipEnd = draft.endDate > monthEnd ? monthEnd : draft.endDate
      let hours = 0
      for (const day of enumerateDays(clipStart, clipEnd)) {
        hours = round2(hours + (draft.hoursByDay.get(day) ?? 0))
      }
      if (hours <= 0) continue

      const dayStart = Number(clipStart.slice(8, 10))
      const dayEnd = Number(clipEnd.slice(8, 10))
      seq += 1
      const span: DailyOpsStaffLeaveSpanDto = {
        id: `${draft.userId}-${draft.source}-${draft.startDate}-${mk}-${seq}`,
        kind: draft.kind,
        source: draft.source,
        status: draft.status,
        reason: draft.reason,
        label: shortLabel(draft.kind, draft.reason, draft.userName),
        userId: draft.userId,
        userName: draft.userName,
        locationId: draft.locationId,
        locationName: draft.locationName,
        contractBucket: draft.contractBucket,
        startDate: draft.startDate,
        endDate: draft.endDate,
        month: mk,
        dayStart,
        dayEnd,
        hours,
      }
      const list = out.get(mk) ?? []
      list.push(span)
      out.set(mk, list)
    }
  }
}

/** Merge consecutive same-key sick days into multi-day drafts. */
function mergeSickDays (
  days: Array<{
    day: string
    hours: number
    userId: string
    userName: string
    locationId: string
    locationName: string
    reason: string
    contractBucket: DailyOpsStaffLeaveContractBucket | null
  }>,
): SpanDraft[] {
  const sorted = [...days].sort((a, b) =>
    a.userId.localeCompare(b.userId)
    || a.locationId.localeCompare(b.locationId)
    || a.day.localeCompare(b.day),
  )
  const drafts: SpanDraft[] = []
  let cur: SpanDraft | null = null

  for (const row of sorted) {
    const canExtend = cur
      && cur.userId === row.userId
      && cur.locationId === row.locationId
      && addCalendarDaysYmd(cur.endDate, 1) === row.day

    if (canExtend && cur) {
      cur.endDate = row.day
      cur.hoursByDay.set(row.day, row.hours)
      continue
    }
    cur = {
      kind: 'sick',
      source: 'sick_hours',
      status: 'registered',
      reason: row.reason,
      userId: row.userId,
      userName: row.userName,
      locationId: row.locationId,
      locationName: row.locationName,
      contractBucket: row.contractBucket,
      startDate: row.day,
      endDate: row.day,
      hoursByDay: new Map([[row.day, row.hours]]),
    }
    drafts.push(cur)
  }
  return drafts
}

export async function buildLeaveCalendar (
  db: Db,
  input: { year: number; locationId?: string | null },
): Promise<DailyOpsStaffLeaveCalendarDto> {
  const parsed = parseYear(input.year)
  if (!parsed) throw new Error('year must be YYYY (2000–2100)')

  const { year, startDate, endDate } = parsed
  const locationIds = VENUE_STRIP_LOCATIONS.map((v) => v.locationId)
  const locationFilter = input.locationId && input.locationId !== 'all'
    ? [input.locationId]
    : locationIds

  const yearStart = dayStartUtc(startDate)
  const yearEndExclusive = dayStartUtc(addCalendarDaysYmd(endDate, 1))

  const [leaveDocs, sickDocs, contractIndex, inactiveWorkers] = await Promise.all([
    db.collection<LeaveAggDoc>('eitje_leave_requests_aggregation')
      .find({
        locationId: { $in: locationFilter },
        earliest_start: { $lt: yearEndExclusive },
        latest_end: { $gt: yearStart },
      })
      .toArray(),
    db.collection<SickAggDoc>('eitje_time_registration_aggregation')
      .find({
        period_type: 'day',
        period: { $gte: startDate, $lte: endDate },
        locationId: { $in: locationFilter },
        team_name: EITJE_ZIEK_TEAM_REGEX,
      })
      .toArray(),
    buildWorkerContractIndex(db),
    loadInactiveWorkerKeys(db),
  ])

  const leaveDrafts: SpanDraft[] = []
  for (const doc of leaveDocs) {
    const start = toDate(doc.earliest_start)
    const end = toDate(doc.latest_end)
    if (!start || !end) continue
    const startYmd = calendarYmdInAmsterdam(start)
    const endYmd = calendarYmdInAmsterdam(end)
    const clipStart = startYmd < startDate ? startDate : startYmd
    const clipEnd = endYmd > endDate ? endDate : endYmd
    if (clipEnd < clipStart) continue

    const reason = String(doc.reason ?? doc.process_reason ?? 'Verlof')
    const source: DailyOpsStaffLeaveSource = 'leave_request'
    const kind = classifyLeaveKind(reason, source)
    const userId = String(doc.userId ?? '')
    const userName = String(doc.user_name ?? 'Unknown')
    if (isInactiveWorker(userId, userName, inactiveWorkers)) continue
    const locationId = String(doc.locationId ?? '')
    const hoursByDay = new Map<string, number>()
    for (const day of enumerateDays(clipStart, clipEnd)) {
      const h = leaveHoursOnDay(doc.earliest_start, doc.latest_end, day)
      if (h > 0) hoursByDay.set(day, h)
    }
    if (!hoursByDay.size) continue

    leaveDrafts.push({
      kind,
      source,
      status: String(doc.status ?? 'unknown'),
      reason,
      userId,
      userName,
      locationId,
      locationName: venueName(locationId, String(doc.location_name ?? '')),
      contractBucket: resolveBucket(contractIndex, userId, userName),
      startDate: startYmd,
      endDate: endYmd,
      hoursByDay,
    })
  }

  const sickRows = sickDocs
    .map((doc) => {
      const day = String(doc.period ?? '')
      const hours = round2(Number(doc.total_hours ?? 0))
      if (!day || hours <= 0) return null
      const userId = String(doc.userId ?? '')
      const userName = String(doc.user_name ?? 'Unknown')
      if (isInactiveWorker(userId, userName, inactiveWorkers)) return null
      const locationId = String(doc.locationId ?? '')
      return {
        day,
        hours,
        userId,
        userName,
        locationId,
        locationName: venueName(locationId, String(doc.location_name ?? '')),
        reason: String(doc.team_name ?? 'Ziek'),
        contractBucket: resolveBucket(contractIndex, userId, userName),
      }
    })
    .filter((x): x is NonNullable<typeof x> => x != null)

  const sickDrafts = mergeSickDays(sickRows)
  const spansByMonth = new Map<string, DailyOpsStaffLeaveSpanDto[]>()
  for (let m = 1; m <= 12; m++) spansByMonth.set(monthKey(year, m), [])
  pushMonthSpans([...leaveDrafts, ...sickDrafts], year, spansByMonth)

  const byDay = new Map<string, DailyOpsStaffLeaveCalendarEntryDto[]>()
  for (const day of enumerateDays(startDate, endDate)) byDay.set(day, [])

  for (const draft of [...leaveDrafts, ...sickDrafts]) {
    for (const [day, hours] of draft.hoursByDay) {
      if (day < startDate || day > endDate) continue
      const list = byDay.get(day)
      if (!list) continue
      list.push({
        date: day,
        kind: draft.kind,
        source: draft.source,
        status: draft.status,
        reason: draft.reason,
        userId: draft.userId,
        userName: draft.userName,
        locationId: draft.locationId,
        locationName: draft.locationName,
        hours,
        startDate: draft.startDate,
        endDate: draft.endDate,
        contractBucket: draft.contractBucket,
      })
    }
  }

  const months: DailyOpsStaffLeaveCalendarMonthDto[] = []
  let leaveCount = 0
  let vacationCount = 0
  let sickCount = 0
  let pendingCount = 0
  let totalHours = 0
  let ftCount = 0
  let ptCount = 0
  let zzpCount = 0

  for (let m = 1; m <= 12; m++) {
    const mk = monthKey(year, m)
    const spans = (spansByMonth.get(mk) ?? []).sort((a, b) =>
      a.dayStart - b.dayStart || a.userName.localeCompare(b.userName),
    )
    for (const s of spans) {
      totalHours = round2(totalHours + s.hours)
      if (s.kind === 'vacation') vacationCount += 1
      else if (s.kind === 'sick') sickCount += 1
      else leaveCount += 1
      if (s.status === 'pending' || s.status === 'requested') pendingCount += 1
      if (s.contractBucket === 'ft') ftCount += 1
      else if (s.contractBucket === 'pt') ptCount += 1
      else if (s.contractBucket === 'zzp') zzpCount += 1
    }
    months.push({
      month: mk,
      label: MONTH_LABELS[m - 1]!,
      daysInMonth: daysInMonth(year, m),
      spans,
    })
  }

  const days: DailyOpsStaffLeaveCalendarDayDto[] = []
  for (const day of enumerateDays(startDate, endDate)) {
    const entries = (byDay.get(day) ?? []).sort((a, b) =>
      a.userName.localeCompare(b.userName) || a.kind.localeCompare(b.kind),
    )
    days.push({ date: day, entries })
  }

  return {
    year,
    range: { startDate, endDate },
    locationId: input.locationId ?? null,
    totals: {
      entry_count: leaveCount + vacationCount + sickCount,
      vacation_count: vacationCount,
      leave_count: leaveCount,
      sick_count: sickCount,
      pending_count: pendingCount,
      total_hours: totalHours,
      ft_count: ftCount,
      pt_count: ptCount,
      zzp_count: zzpCount,
    },
    months,
    days,
  }
}
