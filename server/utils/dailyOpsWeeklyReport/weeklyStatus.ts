/**
 * @registry-id: dailyOpsWeeklyReportStatus
 * @created: 2026-07-09T00:00:00.000Z
 * @last-modified: 2026-07-09T00:00:00.000Z
 * @description: Target evaluation helpers for weekly digest
 * @last-fix: [2026-07-09] Labor + PnL status thresholds
 * @adr-ref: ADR-013
 *
 * @exports-to:
 * ✓ server/utils/dailyOpsWeeklyReport/buildWeeklyDigest.ts
 * ✓ composables/useDailyOpsWeeklyReport.ts
 */

import type {
  WeeklyCompareMetric,
  WeeklyPerformanceStatus,
  WeeklyTargetPresetId,
  WeeklyTargetsDto,
} from '~/types/daily-ops-weekly-report'
import { WEEKLY_TARGET_PRESETS } from '~/types/daily-ops-weekly-report'

export function roundWeekly2(n: number): number {
  return Math.round(n * 100) / 100
}

export function pctDelta(value: number, benchmark: number): WeeklyCompareMetric {
  const delta = roundWeekly2(value - benchmark)
  const pct = benchmark !== 0 ? roundWeekly2((delta / benchmark) * 100) : null
  return { value: roundWeekly2(value), benchmark: roundWeekly2(benchmark), delta, pct }
}

export function resolveWeeklyTargets(presetId?: string): WeeklyTargetsDto {
  const id = (presetId && presetId in WEEKLY_TARGET_PRESETS
    ? presetId
    : 'standard') as WeeklyTargetPresetId
  const preset = WEEKLY_TARGET_PRESETS[id]
  return { presetId: id, ...preset }
}

export function laborStatus(
  laborCostPct: number | null,
  targets: WeeklyTargetsDto,
): WeeklyPerformanceStatus {
  if (laborCostPct == null) return 'okay'
  if (laborCostPct < targets.laborGoodPct) return 'good'
  if (laborCostPct <= targets.laborOkayPct) return 'okay'
  return 'bad'
}

export function pnlStatus(pnlPct: number | null, targets: WeeklyTargetsDto): WeeklyPerformanceStatus {
  if (pnlPct == null) return 'okay'
  if (pnlPct >= targets.pnlTargetPct) return 'good'
  if (pnlPct >= 0) return 'okay'
  return 'bad'
}

export function marginStatus(margin: number): WeeklyPerformanceStatus {
  if (margin < 0) return 'bad'
  if (margin < 50) return 'okay'
  return 'good'
}

export function hourLabelForBusinessHour(businessHour: number): string {
  const h = (8 + businessHour) % 24
  return `${String(h).padStart(2, '0')}:00`
}

export function weekdayLabel(ymd: string): string {
  const d = new Date(`${ymd}T12:00:00.000Z`)
  return new Intl.DateTimeFormat('en-GB', { weekday: 'short', timeZone: 'UTC' }).format(d)
}
