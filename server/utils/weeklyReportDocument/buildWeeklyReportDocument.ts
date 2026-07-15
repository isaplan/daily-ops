/**
 * @registry-id: weeklyReportDocumentBuild
 * @created: 2026-07-14T21:00:00.000Z
 * @last-modified: 2026-07-15T00:00:00.000Z
 * @description: Build computed weekly report document from digest + weather + events
 * @adr-ref: ADR-004, ADR-013, ADR-015
 *
 * @exports-to:
 * ✓ server/utils/weeklyReportDocument/upsertWeeklyReportDocument.ts
 */

import type { Db } from 'mongodb'
import type { WeeklyTargetsDto } from '~/types/daily-ops-weekly-report'
import {
  WEEKLY_REPORT_SCHEMA_VERSION,
  emptyWeeklyReportSections,
  type WeeklyReportDocument,
} from '~/types/weeklyReportDocument'
import { getEventsForRange } from '../dailyOpsCalendarEvents/getEventsForRange'
import { getWeatherForRange } from '../dailyOpsWeather/getWeatherForRange'
import { buildWeeklyDigest } from '../dailyOpsWeeklyReport/buildWeeklyDigest'
import { previousWeekRange, type WeeklyRange } from '../dailyOpsWeeklyReport/weekRange'

export async function buildWeeklyReportComputed(
  db: Db,
  range: WeeklyRange,
  locationId: string,
  targets: WeeklyTargetsDto,
): Promise<Omit<WeeklyReportDocument, 'sections' | 'frozenAt'>> {
  const prevRange = previousWeekRange(range)
  const [digest, weather, previousWeekWeather, events] = await Promise.all([
    buildWeeklyDigest(db, range, { locationId, targets }),
    getWeatherForRange(db, range.startDate, range.endDate),
    getWeatherForRange(db, prevRange.startDate, prevRange.endDate),
    getEventsForRange(db, range.startDate, range.endDate),
  ])

  return {
    weekKey: range.weekKey,
    locationId,
    locationName: digest.locationName,
    digest,
    weather,
    previousWeekWeather: previousWeekWeather.daily.length ? previousWeekWeather : null,
    events,
    builtAt: new Date().toISOString(),
    schemaVersion: WEEKLY_REPORT_SCHEMA_VERSION,
  }
}

export function frozenWeeklyReportDocument(
  existing: WeeklyReportDocument,
  frozenAt: string,
): WeeklyReportDocument {
  return { ...existing, frozenAt }
}

export function emptySectionsShell(): WeeklyReportDocument['sections'] {
  return emptyWeeklyReportSections()
}
