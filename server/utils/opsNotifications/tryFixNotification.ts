/**
 * @description: One-shot manual fix for ops notification rows (no auto-retry on scan).
 * @last-fix: [2026-05-28] Bork V2 rebuild + snapshot rebuild for warm-tier / gap alerts.
 */

import type { Db } from 'mongodb'
import { buildDailyOpsSnapshot } from '../../services/dailyOpsSnapshotService'
import { rebuildBorkSalesAggregationV2 } from '../../services/borkRebuildAggregationV2Service'
import { resolveV2RebuildCollectionSuffix } from '../borkV2RebuildSuffix'
import { runOpsNotificationScan } from './runOpsNotificationScan'
import type { OpsNotificationKind, OpsNotificationStatus } from '~/types/ops-notifications'
import { retryProcessEmailAttachments } from '../../services/inboxProcessService'

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

async function rebuildBorkWarmTier(db: Db, businessDate: string): Promise<string> {
  const suffix = resolveV2RebuildCollectionSuffix()
  const result = await rebuildBorkSalesAggregationV2(db, businessDate, businessDate, suffix)
  const days = result?.businessDays ?? 0
  const hours = result?.salesHours ?? 0
  return `Bork V2 rebuild ${businessDate} (days=${days}, hourly=${hours})`
}

async function rebuildSnapshot(
  businessDate: string,
  locationId: string,
): Promise<{ ok: boolean; detail: string }> {
  const result = await buildDailyOpsSnapshot({ businessDate, locationId })
  if (result.errors.length > 0) {
    return { ok: false, detail: result.errors.map((e) => e.error).join('; ') }
  }
  return { ok: true, detail: 'Snapshot rebuilt' }
}

async function stillOpen(
  db: Db,
  input: TryFixInput,
): Promise<boolean> {
  const report = await runOpsNotificationScan(db, {
    lookbackDays: 45,
    endDate: input.businessDate,
    skipArchitecture: true,
  })
  const id = `${input.kind}:${input.businessDate}:${input.locationId}`
  return report.items.some((i) => i.id === id)
}

export async function tryFixOpsNotification(db: Db, input: TryFixInput): Promise<TryFixResult> {
  const { kind, businessDate, locationId } = input
  const steps: string[] = []

  try {
    if (BORK_WARM_FIX_KINDS.includes(kind)) {
      steps.push(await rebuildBorkWarmTier(db, businessDate))
    }

    if (BORK_WARM_FIX_KINDS.includes(kind) || SNAPSHOT_ONLY_KINDS.includes(kind)) {
      const snap = await rebuildSnapshot(businessDate, locationId)
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
      const snap = await rebuildSnapshot(businessDate, locationId)
      steps.push(snap.detail)
      if (!snap.ok) {
        return {
          ok: false,
          fixed: false,
          status: 'open',
          message: `Tried fix, failed: ${snap.detail}`,
        }
      }
    } else {
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
