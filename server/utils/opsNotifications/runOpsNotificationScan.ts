/**
 * @registry-id: runOpsNotificationScan
 * @description: Orchestrates all ops notification detectors (snapshot, source, cron, integrity, architecture)
 * @adr-ref: ADR-004, ADR-006
 */

import type { Db } from 'mongodb'
import type { OpsNotificationsResponseDto } from '~/types/ops-notifications'
import { detectArchitectureNotifications } from './detectors/architecture'
import { detectCronPipelineNotifications } from './detectors/cronPipeline'
import { detectIntegrityNotifications } from './detectors/integrity'
import { detectSnapshotGapNotifications } from './detectors/snapshotGaps'
import { detectSourceDiscrepancyNotifications } from './detectors/sourceDiscrepancy'
import { countByCategory, sortNotifications } from './notificationItem'
import { loadOpsScanContext, resolveScanWindow, type OpsScanWindow } from './scanContext'

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

  const items = [
    ...detectSnapshotGapNotifications(ctx),
    ...detectSourceDiscrepancyNotifications(ctx),
    ...detectCronPipelineNotifications(ctx),
    ...detectIntegrityNotifications(ctx),
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
