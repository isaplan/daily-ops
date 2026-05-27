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

  const sorted = sortNotifications(items)
  const criticalCount = sorted.filter((i) => i.severity === 'critical').length
  const warningCount = sorted.filter((i) => i.severity === 'warning').length

  return {
    scannedAt: new Date().toISOString(),
    rangeStart: window.startDate,
    rangeEnd: window.endDate,
    total: sorted.length,
    criticalCount,
    warningCount,
    byCategory: countByCategory(sorted),
    items: sorted,
  }
}
