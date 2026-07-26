/**
 * @registry-id: tryFixOpsNotification
 * @created: 2026-05-28T00:00:00.000Z
 * @last-modified: 2026-07-26T17:50:00.000Z
 * @description: One-shot fix + self-healing for ops notification rows
 * @last-fix: [2026-07-26] Patch integration_cron_jobs after location heal so alert clears on rescan
 *   Prior: [2026-07-15] Retry failed Bork locations only; track per-location retry streaks
 *   Prior: [2026-07-14] Integration try-fix returns after sync; gap/cache runs in background
 *   Prior: [2026-07-11] Integration sync re-run + snapshot/cache backfill; refresh read-cache after snapshot fix
 *   Prior: [2026-05-28] Bork V2 rebuild + snapshot rebuild for warm-tier / gap alerts
 * @adr-ref: ADR-004, ADR-013
 *
 * @exports-to:
 * ✓ server/utils/opsNotifications/autoRetry.ts
 * ✓ server/api/ops-notifications/try-fix.post.ts
 */

import type { Db } from 'mongodb'
import { buildDailyOpsSnapshot } from '../../services/dailyOpsSnapshotService'
import { rebuildBorkSalesAggregationV2 } from '../../services/borkRebuildAggregationV2Service'
import { runIntegrationCronJob } from '../../services/integrationCronRunner'
import { syncBorkSingleLocation } from '../../services/borkSyncService'
import { resolveV2RebuildCollectionSuffix } from '../borkV2RebuildSuffix'
import { runOpsNotificationScan } from './runOpsNotificationScan'
import {
  recordIntegrationLocationRetryOutcome,
} from './integrationSyncRetryStreak'
import { patchIntegrationCronLocationsHealed } from './integrationSyncDataCoverage'
import { INTEGRATION_SYNC_ALERT_BUSINESS_DATE } from './detectors/integrationSyncFailures'
import type { OpsNotificationKind, OpsNotificationStatus } from '~/types/ops-notifications'
import { retryProcessEmailAttachments } from '../../services/inboxProcessService'
import { refreshDashboardBundleCache } from '../dailyOpsSnapshot/preGenerateBundleCache'
import {
  materializeHistoricalPipelineSnapshots,
  materializeSnapshotGaps,
} from '../dailyOpsSnapshot/triggerSnapshotRebuilds'
import { VENUE_STRIP_LOCATIONS } from '../venueStrip/constants'
import { amsterdamOpenRegisterBusinessDateYmd } from '~/utils/dailyOpsBusinessDate'
import { isIntegrationHistoricalJobType } from '~/utils/integrations/historicalJobTypes'

export type TryFixInput = {
  kind: OpsNotificationKind
  businessDate: string
  locationId: string
  meta?: Record<string, unknown>
}

export type TryFixResult = {
  ok: boolean
  fixed: boolean
  status: OpsNotificationStatus
  message: string
}

const BORK_WARM_FIX_KINDS: OpsNotificationKind[] = [
  'bork_revenue_aggregation_stale',
  'bork_inbox_revenue_gap',
  'missing_bork_when_inbox_final',
]

const SNAPSHOT_ONLY_KINDS: OpsNotificationKind[] = [
  'missing_revenue_snapshot',
  'missing_labor_snapshot',
  'missing_master_snapshot',
  'revenue_snapshot_empty',
  'revenue_snapshot_stale_basis',
  'eitje_labor_aggregation_stale',
  'labor_snapshot_inconsistent',
]

const VENUE_LOCATION_IDS = [...VENUE_STRIP_LOCATIONS.map((v) => v.locationId), 'all']

async function rebuildBorkWarmTier(db: Db, businessDate: string): Promise<string> {
  const suffix = resolveV2RebuildCollectionSuffix()
  const result = await rebuildBorkSalesAggregationV2(db, businessDate, businessDate, suffix)
  const days = result?.businessDays ?? 0
  const hours = result?.salesHours ?? 0
  return `Bork V2 rebuild ${businessDate} (days=${days}, hourly=${hours})`
}

async function rebuildSnapshotWithCache(
  db: Db,
  businessDate: string,
  locationId: string,
): Promise<{ ok: boolean; detail: string }> {
  const result = await buildDailyOpsSnapshot({ businessDate, locationId })
  if (result.errors.length > 0) {
    return { ok: false, detail: result.errors.map((e) => e.error).join('; ') }
  }
  const locIds = locationId === 'all' ? VENUE_LOCATION_IDS : [locationId, 'all']
  await refreshDashboardBundleCache(db, businessDate, businessDate, locIds)
  return { ok: true, detail: 'Snapshot + read-cache rebuilt' }
}

async function healIntegrationSyncFailure(
  db: Db,
  meta?: Record<string, unknown>,
  notificationId?: string,
): Promise<{ ok: boolean; detail: string }> {
  const source = meta?.source === 'eitje' ? 'eitje' : 'bork'
  const jobType = String(meta?.jobType ?? '')
  if (!jobType) {
    return { ok: false, detail: 'missing jobType in alert meta' }
  }

  const window = meta?.syncWindow as { startDate?: string; endDate?: string } | undefined
  const openRegister = amsterdamOpenRegisterBusinessDateYmd()
  const startDate = window?.startDate ?? openRegister
  const endDate = window?.endDate ?? openRegister
  const failedLocations = (meta?.failedLocations as Array<{ locationId?: string }>) ?? []

  let syncDetail = ''
  if (source === 'bork' && failedLocations.length > 0) {
    const locationResults: string[] = []
    const healedIds: string[] = []
    let allLocationsOk = true
    for (const loc of failedLocations) {
      const locationId = loc.locationId != null ? String(loc.locationId) : ''
      if (!locationId) continue
      const result = await syncBorkSingleLocation(db, locationId, 'daily', jobType)
      const fixed = result.ok
      if (notificationId) {
        await recordIntegrationLocationRetryOutcome(db, notificationId, locationId, fixed)
      }
      if (!fixed) allLocationsOk = false
      else healedIds.push(locationId)
      locationResults.push(`${locationId}: ${result.message}`)
    }
    syncDetail = locationResults.join(' · ')
    if (healedIds.length > 0) {
      await patchIntegrationCronLocationsHealed(
        db,
        source,
        jobType,
        healedIds,
        `retry sync ok · ${syncDetail}`,
      )
    }
    if (!allLocationsOk) {
      return { ok: false, detail: syncDetail || 'failed location retry' }
    }
    if (isIntegrationHistoricalJobType(jobType)) {
      const suffix = resolveV2RebuildCollectionSuffix()
      await rebuildBorkSalesAggregationV2(db, startDate, endDate, suffix)
      await materializeHistoricalPipelineSnapshots(db, startDate, endDate)
    }
  } else {
    const sync = await runIntegrationCronJob(db, source, jobType)
    syncDetail = sync.syncResult.message
    if (!sync.syncResult.ok) {
      return { ok: false, detail: syncDetail }
    }
  }

  void (async () => {
    try {
      await materializeSnapshotGaps(db, { startDate, endDate: openRegister })
      await refreshDashboardBundleCache(db, startDate, openRegister, VENUE_LOCATION_IDS)
    } catch {
      // Best-effort — sync success already clears integration alert on rescan
    }
  })()

  return {
    ok: true,
    detail: `Re-ran ${source} ${jobType} for failed location(s) · ${syncDetail} · snapshot/cache backfill started (${startDate}..${endDate})`,
  }
}

async function stillOpen(
  db: Db,
  input: TryFixInput,
): Promise<boolean> {
  const endDate =
    input.kind === 'integration_sync_partial_failure'
      ? amsterdamOpenRegisterBusinessDateYmd()
      : input.businessDate
  const report = await runOpsNotificationScan(db, {
    lookbackDays: 45,
    endDate,
    skipArchitecture: true,
  })
  const businessDate =
    input.kind === 'integration_sync_partial_failure'
      ? INTEGRATION_SYNC_ALERT_BUSINESS_DATE
      : input.businessDate
  const id = `${input.kind}:${businessDate}:${input.locationId}`
  return report.items.some((i) => i.id === id)
}

export async function tryFixOpsNotification(db: Db, input: TryFixInput): Promise<TryFixResult> {
  const { kind, businessDate, locationId } = input
  const steps: string[] = []

  try {
    if (kind === 'integration_sync_partial_failure') {
      const notificationId = `${kind}:${INTEGRATION_SYNC_ALERT_BUSINESS_DATE}:${locationId}`
      const healed = await healIntegrationSyncFailure(db, input.meta, notificationId)
      steps.push(healed.detail)
      if (!healed.ok) {
        return {
          ok: false,
          fixed: false,
          status: 'open',
          message: `Tried fix, failed: ${healed.detail}`,
        }
      }
    } else if (BORK_WARM_FIX_KINDS.includes(kind)) {
      steps.push(await rebuildBorkWarmTier(db, businessDate))
    }

    if (BORK_WARM_FIX_KINDS.includes(kind) || SNAPSHOT_ONLY_KINDS.includes(kind)) {
      const snap = await rebuildSnapshotWithCache(db, businessDate, locationId)
      steps.push(snap.detail)
      if (!snap.ok) {
        return {
          ok: false,
          fixed: false,
          status: 'open',
          message: `Tried fix, failed: ${snap.detail}`,
        }
      }
    } else if (kind === 'unparsed_basis_attachment') {
      const emailId = String(input.meta?.emailId ?? '')
      if (!emailId) {
        return {
          ok: false,
          fixed: false,
          status: 'open',
          message: 'Tried fix, failed: missing emailId in alert meta',
        }
      }
      const attId = String(input.meta?.attachmentId ?? '')
      const retry = await retryProcessEmailAttachments(emailId, attId ? { attachmentId: attId } : undefined)
      if (!retry.success) {
        return {
          ok: false,
          fixed: false,
          status: 'open',
          message: `Tried fix, failed: ${retry.error ?? 'inbox reprocess failed'}`,
        }
      }
      steps.push('Inbox attachment reprocessed')
      const snap = await rebuildSnapshotWithCache(db, businessDate, locationId)
      steps.push(snap.detail)
      if (!snap.ok) {
        return {
          ok: false,
          fixed: false,
          status: 'open',
          message: `Tried fix, failed: ${snap.detail}`,
        }
      }
    } else if (kind !== 'integration_sync_partial_failure') {
      return {
        ok: false,
        fixed: false,
        status: 'open',
        message: 'No automated fix for this alert type — use fix hint / code change',
      }
    }

    const open = await stillOpen(db, input)
    if (!open) {
      return {
        ok: true,
        fixed: true,
        status: 'fixed',
        message: `Fixed: ${steps.join(' · ')}`,
      }
    }
    return {
      ok: true,
      fixed: false,
      status: 'open',
      message: `Tried fix, failed: ${steps.join(' · ')} — alert still present after rescan`,
    }
  } catch (e) {
    const err = e instanceof Error ? e.message : String(e)
    return {
      ok: false,
      fixed: false,
      status: 'open',
      message: `Tried fix, failed: ${err}`,
    }
  }
}
