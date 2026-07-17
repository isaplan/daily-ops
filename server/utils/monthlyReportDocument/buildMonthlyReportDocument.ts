/**
 * @registry-id: monthlyReportDocumentBuild
 * @created: 2026-07-17T00:00:00.000Z
 * @last-modified: 2026-07-17T00:00:00.000Z
 * @description: Build computed monthly report document from digest + weather + events + accounting P&L
 * @adr-ref: ADR-004, ADR-013, ADR-015
 *
 * @exports-to:
 * ✓ server/utils/monthlyReportDocument/upsertMonthlyReportDocument.ts
 */

import type { Db } from 'mongodb'
import type { WeeklyTargetsDto } from '~/types/daily-ops-weekly-report'
import type { AccountingPnlBenchmarkTableLineDto } from '~/types/accounting-pnl-benchmark'
import {
  MONTHLY_REPORT_SCHEMA_VERSION,
  type MonthlyReportDocument,
} from '~/types/monthlyReportDocument'
import { accountingPnlVenueIdForLocationId } from '~/utils/accountingPnlData'
import { getEventsForRange } from '../dailyOpsCalendarEvents/getEventsForRange'
import { getWeatherForRange } from '../dailyOpsWeather/getWeatherForRange'
import { buildMonthlyDigest } from '../dailyOpsMonthlyReport/buildMonthlyDigest'
import { previousMonthRange, type MonthlyRange } from '../dailyOpsMonthlyReport/monthRange'
import { fetchAccountingPnlBenchmark } from '../accountingPnlBenchmarkService'

async function loadAccountingPnlLine(
  db: Db,
  monthKey: string,
  locationId: string,
): Promise<AccountingPnlBenchmarkTableLineDto | null> {
  const venueId = accountingPnlVenueIdForLocationId(locationId)
  if (!venueId) return null
  const [yearStr, monthStr] = monthKey.split('-')
  const year = Number(yearStr)
  const month = Number(monthStr)
  if (!Number.isFinite(year) || !Number.isFinite(month)) return null
  if (year < 2024 || year > 2026) return null
  const dto = await fetchAccountingPnlBenchmark(db, year, month)
  return dto.lines.find((line) => line.key === venueId) ?? null
}

export async function buildMonthlyReportComputed(
  db: Db,
  range: MonthlyRange,
  locationId: string,
  targets: WeeklyTargetsDto,
): Promise<Omit<MonthlyReportDocument, 'sections' | 'frozenAt'>> {
  const prevRange = previousMonthRange(range)
  const [digest, weather, previousMonthWeather, events, accountingPnl] = await Promise.all([
    buildMonthlyDigest(db, range, { locationId, targets }),
    getWeatherForRange(db, range.startDate, range.endDate),
    getWeatherForRange(db, prevRange.startDate, prevRange.endDate),
    getEventsForRange(db, range.startDate, range.endDate),
    loadAccountingPnlLine(db, range.monthKey, locationId),
  ])

  return {
    monthKey: range.monthKey,
    locationId,
    locationName: digest.locationName,
    digest,
    accountingPnl,
    weather,
    previousMonthWeather: previousMonthWeather.daily.length ? previousMonthWeather : null,
    events,
    builtAt: new Date().toISOString(),
    schemaVersion: MONTHLY_REPORT_SCHEMA_VERSION,
  }
}
