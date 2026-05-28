/**
 * @registry-id: runOpsNotificationScan
 * @last-fix: [2026-05-28] businessDates on scan context; unparsed Basis detector.
 * @adr-ref: ADR-004, ADR-006
 */

import type { Db } from 'mongodb'
import type { OpsNotificationsResponseDto } from '~/types/ops-notifications'
import { detectArchitectureNotifications } from './detectors/architecture'
import { detectCronPipelineNotifications } from './detectors/cronPipeline'
import { detectGmailOAuthNotifications } from './detectors/gmailOAuth'
import { detectIntegrityNotifications } from './detectors/integrity'
import { detectSnapshotGapNotifications } from './detectors/snapshotGaps'
import { detectSourceDiscrepancyNotifications } from './detectors/sourceDiscrepancy'
import { detectUnparsedBasisAttachments } from './detectors/unparsedBasisAttachment'
import { countByCategory, sortNotifications } from './notificationItem'
import { addCalendarDaysYmd } from '~/utils/dailyOpsBusinessDate'
import { loadOpsScanContext, resolveScanWindow, type OpsScanWindow } from './scanContext'

function businessDatesInWindow(startDate: string, endDate: string): string[] {
  const out: string[] = []
  for (let d = startDate; d <= endDate; d = addCalendarDaysYmd(d, 1)) {
    out.push(d)
  }
  return out
}

export type RunOpsNotificationScanOpts = {
  lookbackDays?: number
  endDate?: string
  /** Skip filesystem ADR/monolith checks (faster count endpoint) */
  skipArchitecture?: boolean
  includeHidden?: boolean
}

function shouldAutoHide(item: { businessDate: string; severity: string }, now: Date): boolean {
  if (item.severity === 'critical') return false
  if (!/^\d{4}-\d{2}-\d{2}$/.test(item.businessDate)) return false
  const dayTs = Date.parse(`${item.businessDate}T00:00:00.000Z`)
  if (!Number.isFinite(dayTs)) return false
  const ageMs = now.getTime() - dayTs
  return ageMs > 7 * 24 * 60 * 60 * 1000
}

export async function runOpsNotificationScan(
  db: Db,
  opts?: RunOpsNotificationScanOpts,
): Promise<OpsNotificationsResponseDto> {
  const window: OpsScanWindow = resolveScanWindow(opts)
  const ctx = await loadOpsScanContext(db, window)

  const gmailOAuthItems = await detectGmailOAuthNotifications()

  const items = [
    ...gmailOAuthItems,
    ...detectSnapshotGapNotifications(ctx),
    ...detectSourceDiscrepancyNotifications(ctx),
    ...detectCronPipelineNotifications(ctx),
    ...detectIntegrityNotifications(ctx),
    ...(await Promise.all(
      businessDatesInWindow(window.startDate, window.endDate).map(async (d) => {
        try {
          // No auto-retry on scan — manual Try fix only (avoids slow/failing GET).
          return await detectUnparsedBasisAttachments(db, d, { allowAutoRetry: false })
        } catch {
          return []
        }
      }),
    )).flat(),
    ...(opts?.skipArchitecture ? [] : detectArchitectureNotifications()),
  ]

  const now = new Date()
  const decorated = sortNotifications(items).map((item) => {
    if (!shouldAutoHide(item, now)) return item
    return {
      ...item,
      hidden: true,
      hiddenReason: 'Auto-hidden: non-critical alert older than 7 days',
    }
  })
  const hiddenCount = decorated.filter((i) => i.hidden).length
  const sorted = opts?.includeHidden ? decorated : decorated.filter((i) => !i.hidden)
  const criticalCount = sorted.filter((i) => i.severity === 'critical').length
  const warningCount = sorted.filter((i) => i.severity === 'warning').length

  return {
    scannedAt: new Date().toISOString(),
    rangeStart: window.startDate,
    rangeEnd: window.endDate,
    total: sorted.length,
    criticalCount,
    warningCount,
    hiddenCount,
    byCategory: countByCategory(sorted),
    items: sorted,
  }
}
