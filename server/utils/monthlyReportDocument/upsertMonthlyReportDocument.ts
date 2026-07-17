/**
 * @registry-id: monthlyReportDocumentUpsert
 * @created: 2026-07-17T00:00:00.000Z
 * @last-modified: 2026-07-17T01:10:00.000Z
 * @description: Load, build, merge, and upsert monthly_reports documents
 * @last-fix: [2026-07-17] Open period grace + manual lock/unlock
 * @adr-ref: ADR-015
 *
 * @exports-to:
 * ✓ server/api/monthly-reports/*
 * ✓ server/tasks/daily-ops/monthly-report-build.ts
 */

import type { Db } from 'mongodb'
import type { MonthlyReportDocument, MonthlyReportListItem } from '~/types/monthlyReportDocument'
import { resolveWeeklyTargets } from '../dailyOpsWeeklyReport/weeklyStatus'
import {
  isMonthlyReportOpenPeriod,
  monthRangeFromKey,
  previousMonthRange,
} from '../dailyOpsMonthlyReport/monthRange'
import { getWeatherForRange } from '../dailyOpsWeather/getWeatherForRange'
import { buildMonthlyReportComputed } from './buildMonthlyReportDocument'
import { MONTHLY_REPORTS_COLLECTION, MONTHLY_REPORT_FREEZE_DAYS } from './constants'
import { getFreezeState } from '../weeklyReportDocument/getFreezeState'
import { mergeMonthlyReportUserContent } from './mergeMonthlyReportUserContent'

function mapDoc(doc: Record<string, unknown>): MonthlyReportDocument {
  return doc as unknown as MonthlyReportDocument
}

async function attachPreviousMonthWeatherIfMissing(
  db: Db,
  range: NonNullable<ReturnType<typeof monthRangeFromKey>>,
  doc: MonthlyReportDocument,
): Promise<MonthlyReportDocument> {
  if (doc.previousMonthWeather?.daily.length) return doc
  const prevRange = previousMonthRange(range)
  const previousMonthWeather = await getWeatherForRange(db, prevRange.startDate, prevRange.endDate)
  if (!previousMonthWeather.daily.length) return { ...doc, previousMonthWeather: null }
  return { ...doc, previousMonthWeather }
}

export async function findMonthlyReportDocument(
  db: Db,
  monthKey: string,
  locationId: string,
): Promise<MonthlyReportDocument | null> {
  const doc = await db.collection(MONTHLY_REPORTS_COLLECTION).findOne({ monthKey, locationId })
  return doc ? mapDoc(doc as Record<string, unknown>) : null
}

export async function upsertMonthlyReportDocument(
  db: Db,
  monthKey: string,
  locationId: string,
  opts?: { targetsPreset?: string; force?: boolean; unlock?: boolean; lock?: boolean },
): Promise<MonthlyReportDocument> {
  const range = monthRangeFromKey(monthKey)
  if (!range) throw createError({ statusCode: 400, message: `Invalid monthKey: ${monthKey}` })

  let existing = await findMonthlyReportDocument(db, monthKey, locationId)
  const inOpenPeriod = isMonthlyReportOpenPeriod(monthKey)
  const lockedManually = existing?.lockedManually === true && !opts?.unlock

  // Heal stale auto-locks on current / previous month (e.g. June while still open).
  if (inOpenPeriod && existing?.frozenAt && !lockedManually) {
    await db.collection(MONTHLY_REPORTS_COLLECTION).updateOne(
      { monthKey, locationId },
      { $set: { frozenAt: null, lockedManually: false } },
    )
    existing = { ...existing, frozenAt: null, lockedManually: false }
  }

  const freeze = lockedManually && existing?.frozenAt
    ? { isFrozen: true, frozenAt: existing.frozenAt }
    : inOpenPeriod
      ? { isFrozen: false, frozenAt: null }
      : getFreezeState(range.endDate, existing?.frozenAt, MONTHLY_REPORT_FREEZE_DAYS)

  if (freeze.isFrozen && existing && !opts?.force && !opts?.unlock && !opts?.lock) {
    if (!existing.frozenAt && freeze.frozenAt) {
      const frozen = { ...existing, frozenAt: freeze.frozenAt, lockedManually: false }
      await db.collection(MONTHLY_REPORTS_COLLECTION).updateOne(
        { monthKey, locationId },
        { $set: { frozenAt: freeze.frozenAt, lockedManually: false } },
      )
      return attachPreviousMonthWeatherIfMissing(db, range, frozen)
    }
    return attachPreviousMonthWeatherIfMissing(db, range, existing)
  }

  const targets = resolveWeeklyTargets(opts?.targetsPreset)
  const computed = await buildMonthlyReportComputed(db, range, locationId, targets)

  let nextFrozenAt: string | null = freeze.frozenAt
  let nextLockedManually = lockedManually && !!nextFrozenAt
  if (opts?.unlock) {
    nextFrozenAt = null
    nextLockedManually = false
  }
  if (opts?.lock) {
    nextFrozenAt = new Date().toISOString()
    nextLockedManually = true
  }

  const merged = mergeMonthlyReportUserContent(
    computed,
    existing,
    nextFrozenAt,
    nextLockedManually,
  )

  await db.collection(MONTHLY_REPORTS_COLLECTION).updateOne(
    { monthKey, locationId },
    { $set: merged },
    { upsert: true },
  )
  await db.collection(MONTHLY_REPORTS_COLLECTION).createIndex(
    { monthKey: 1, locationId: 1 },
    { unique: true, name: 'month_location_unique' },
  )

  return merged
}

export async function setMonthlyReportLock(
  db: Db,
  monthKey: string,
  locationId: string,
  locked: boolean,
): Promise<MonthlyReportDocument> {
  return upsertMonthlyReportDocument(db, monthKey, locationId, {
    force: true,
    lock: locked,
    unlock: !locked,
  })
}

export async function listMonthlyReports(
  db: Db,
  opts?: { locationId?: string; limit?: number },
): Promise<MonthlyReportListItem[]> {
  const filter: Record<string, string> = {}
  if (opts?.locationId) filter.locationId = opts.locationId

  const docs = await db
    .collection(MONTHLY_REPORTS_COLLECTION)
    .find(filter)
    .sort({ monthKey: -1 })
    .limit(opts?.limit ?? 36)
    .toArray()

  return docs.map((doc) => ({
    monthKey: String(doc.monthKey),
    locationId: String(doc.locationId),
    locationName: String(doc.locationName ?? ''),
    label: String((doc.digest as { label?: string })?.label ?? doc.monthKey),
    startDate: String((doc.digest as { startDate?: string })?.startDate ?? ''),
    endDate: String((doc.digest as { endDate?: string })?.endDate ?? ''),
    frozenAt: doc.frozenAt != null ? String(doc.frozenAt) : null,
    builtAt: String(doc.builtAt ?? ''),
  }))
}

export async function saveMonthlyReportSection(
  db: Db,
  monthKey: string,
  locationId: string,
  sectionKey: string,
  text: string,
  todos: MonthlyReportDocument['sections'][keyof MonthlyReportDocument['sections']]['todos'],
  agrees: MonthlyReportDocument['sections'][keyof MonthlyReportDocument['sections']]['agrees'],
): Promise<MonthlyReportDocument> {
  const doc = await upsertMonthlyReportDocument(db, monthKey, locationId)
  const updatedAt = new Date().toISOString()
  await db.collection(MONTHLY_REPORTS_COLLECTION).updateOne(
    { monthKey, locationId },
    {
      $set: {
        [`sections.${sectionKey}.text`]: text,
        [`sections.${sectionKey}.todos`]: todos,
        [`sections.${sectionKey}.agrees`]: agrees,
        [`sections.${sectionKey}.updatedAt`]: updatedAt,
      },
    },
  )
  const refreshed = await findMonthlyReportDocument(db, monthKey, locationId)
  return refreshed ?? doc
}
