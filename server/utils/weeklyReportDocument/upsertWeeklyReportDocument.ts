/**
 * @registry-id: weeklyReportDocumentUpsert
 * @created: 2026-07-14T21:00:00.000Z
 * @last-modified: 2026-07-14T21:00:00.000Z
 * @description: Load, build, merge, and upsert weekly_reports documents
 * @adr-ref: ADR-015
 *
 * @exports-to:
 * ✓ server/api/weekly-reports/*
 * ✓ server/tasks/daily-ops/weekly-report-build.ts
 */

import type { Db } from 'mongodb'
import type { WeeklyReportDocument, WeeklyReportListItem } from '~/types/weeklyReportDocument'
import { resolveWeeklyTargets } from '../dailyOpsWeeklyReport/weeklyStatus'
import { previousWeekRange, weekRangeFromKey } from '../dailyOpsWeeklyReport/weekRange'
import { getWeatherForRange } from '../dailyOpsWeather/getWeatherForRange'
import { buildWeeklyReportComputed } from './buildWeeklyReportDocument'
import { WEEKLY_REPORTS_COLLECTION } from './constants'
import { getFreezeState } from './getFreezeState'
import { mergeWeeklyReportUserContent } from './mergeWeeklyReportUserContent'

function mapDoc(doc: Record<string, unknown>): WeeklyReportDocument {
  return doc as unknown as WeeklyReportDocument
}

async function attachPreviousWeekWeatherIfMissing(
  db: Db,
  range: NonNullable<ReturnType<typeof weekRangeFromKey>>,
  doc: WeeklyReportDocument,
): Promise<WeeklyReportDocument> {
  if (doc.previousWeekWeather?.daily.length) return doc
  const prevRange = previousWeekRange(range)
  const previousWeekWeather = await getWeatherForRange(db, prevRange.startDate, prevRange.endDate)
  if (!previousWeekWeather.daily.length) return { ...doc, previousWeekWeather: null }
  return { ...doc, previousWeekWeather }
}

export async function findWeeklyReportDocument(
  db: Db,
  weekKey: string,
  locationId: string,
): Promise<WeeklyReportDocument | null> {
  const doc = await db.collection(WEEKLY_REPORTS_COLLECTION).findOne({ weekKey, locationId })
  return doc ? mapDoc(doc as Record<string, unknown>) : null
}

export async function upsertWeeklyReportDocument(
  db: Db,
  weekKey: string,
  locationId: string,
  opts?: { targetsPreset?: string; force?: boolean },
): Promise<WeeklyReportDocument> {
  const range = weekRangeFromKey(weekKey)
  if (!range) throw createError({ statusCode: 400, message: `Invalid weekKey: ${weekKey}` })

  const existing = await findWeeklyReportDocument(db, weekKey, locationId)
  const freeze = getFreezeState(range.endDate, existing?.frozenAt)

  if (freeze.isFrozen && existing && !opts?.force) {
    if (!existing.frozenAt && freeze.frozenAt) {
      const frozen = { ...existing, frozenAt: freeze.frozenAt }
      await db.collection(WEEKLY_REPORTS_COLLECTION).updateOne(
        { weekKey, locationId },
        { $set: { frozenAt: freeze.frozenAt } },
      )
      return attachPreviousWeekWeatherIfMissing(db, range, frozen)
    }
    return attachPreviousWeekWeatherIfMissing(db, range, existing)
  }

  const targets = resolveWeeklyTargets(opts?.targetsPreset)
  const computed = await buildWeeklyReportComputed(db, range, locationId, targets)
  const merged = mergeWeeklyReportUserContent(computed, existing, freeze.frozenAt)

  await db.collection(WEEKLY_REPORTS_COLLECTION).updateOne(
    { weekKey, locationId },
    { $set: merged },
    { upsert: true },
  )
  await db.collection(WEEKLY_REPORTS_COLLECTION).createIndex(
    { weekKey: 1, locationId: 1 },
    { unique: true, name: 'week_location_unique' },
  )

  return merged
}

export async function listWeeklyReports(
  db: Db,
  opts?: { locationId?: string; limit?: number },
): Promise<WeeklyReportListItem[]> {
  const filter: Record<string, string> = {}
  if (opts?.locationId) filter.locationId = opts.locationId

  const docs = await db
    .collection(WEEKLY_REPORTS_COLLECTION)
    .find(filter)
    .sort({ weekKey: -1 })
    .limit(opts?.limit ?? 52)
    .toArray()

  return docs.map((doc) => ({
    weekKey: String(doc.weekKey),
    locationId: String(doc.locationId),
    locationName: String(doc.locationName ?? ''),
    label: String((doc.digest as { label?: string })?.label ?? doc.weekKey),
    startDate: String((doc.digest as { startDate?: string })?.startDate ?? ''),
    endDate: String((doc.digest as { endDate?: string })?.endDate ?? ''),
    frozenAt: doc.frozenAt != null ? String(doc.frozenAt) : null,
    builtAt: String(doc.builtAt ?? ''),
  }))
}

export async function saveWeeklyReportSection(
  db: Db,
  weekKey: string,
  locationId: string,
  sectionKey: string,
  text: string,
  todos: WeeklyReportDocument['sections'][keyof WeeklyReportDocument['sections']]['todos'],
  agrees: WeeklyReportDocument['sections'][keyof WeeklyReportDocument['sections']]['agrees'],
): Promise<WeeklyReportDocument> {
  const doc = await upsertWeeklyReportDocument(db, weekKey, locationId)
  const updatedAt = new Date().toISOString()
  await db.collection(WEEKLY_REPORTS_COLLECTION).updateOne(
    { weekKey, locationId },
    {
      $set: {
        [`sections.${sectionKey}.text`]: text,
        [`sections.${sectionKey}.todos`]: todos,
        [`sections.${sectionKey}.agrees`]: agrees,
        [`sections.${sectionKey}.updatedAt`]: updatedAt,
      },
    },
  )
  const refreshed = await findWeeklyReportDocument(db, weekKey, locationId)
  return refreshed ?? doc
}
