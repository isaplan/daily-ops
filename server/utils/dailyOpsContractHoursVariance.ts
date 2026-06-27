/**
 * @registry-id: dailyOpsContractHoursVariance
 * @created: 2026-06-11T12:00:00.000Z
 * @last-modified: 2026-06-12T10:10:00.000Z
 * @description: Staff YTD plus/min balance (1 Jan 2026 CSV + cumulative worked − contract)
 * @last-fix: [2026-06-12] YTD range anchored 2026-01-01 opening CSV
 *
 * @exports-to:
 * ✓ server/api/daily-ops/metrics/contract-hours-variance.get.ts
 */

import type { Db } from 'mongodb'
import { ObjectId } from 'mongodb'
import { amsterdamOpenRegisterBusinessDateYmd } from '~/utils/dailyOpsBusinessDate'
import { computeMemberPlusminBalance } from './memberPlusminBalance'
import type {
  DailyOpsContractHoursVarianceDto,
  DailyOpsContractHoursVarianceRowDto,
} from '~/types/daily-ops-dashboard'

export const CONTRACT_HOURS_VARIANCE_THRESHOLD = 24
export const CONTRACT_HOURS_VARIANCE_CRITICAL = 40

function round2 (n: number): number {
  return Math.round(n * 100) / 100
}

function severityForDelta (absDelta: number): 'warning' | 'critical' {
  return absDelta > CONTRACT_HOURS_VARIANCE_CRITICAL ? 'critical' : 'warning'
}

function resolveAsOfDate (anchorYmd?: string): string {
  if (anchorYmd && /^\d{4}-\d{2}-\d{2}$/.test(anchorYmd)) return anchorYmd
  return amsterdamOpenRegisterBusinessDateYmd()
}

export async function fetchDailyOpsContractHoursVariance (
  db: Db,
  anchorYmd?: string,
): Promise<DailyOpsContractHoursVarianceDto> {
  const asOfDate = resolveAsOfDate(anchorYmd)

  const members = await db
    .collection('members')
    .find({ is_active: { $ne: false }, contract_type: /uren contract/i })
    .project({ _id: 1 })
    .toArray()

  const rows: DailyOpsContractHoursVarianceRowDto[] = []

  for (const raw of members) {
    const memberId = raw._id as ObjectId
    const balance = await computeMemberPlusminBalance(db, memberId, asOfDate)
    if (!balance) continue

    const absDelta = Math.abs(balance.plusminHours)
    if (absDelta <= CONTRACT_HOURS_VARIANCE_THRESHOLD) continue

    rows.push({
      memberId: balance.memberId,
      userName: balance.userName,
      teamName: balance.teamName ?? '—',
      contractType: balance.contractType,
      workedHours: balance.forwardWorkedHours,
      contractHours: balance.forwardContractHours,
      deltaHours: balance.plusminHours,
      verlofHours: balance.verlofHours,
      baselineSnapshotDate: balance.baselineSnapshotDate,
      severity: severityForDelta(absDelta),
    })
  }

  rows.sort((a, b) => Math.abs(b.deltaHours) - Math.abs(a.deltaHours))

  return {
    range: { startDate: '2026-01-01', endDate: asOfDate },
    weeks: 0,
    thresholdHours: CONTRACT_HOURS_VARIANCE_THRESHOLD,
    criticalHours: CONTRACT_HOURS_VARIANCE_CRITICAL,
    workers: rows.length,
    rows,
  }
}

export function resolveContractHoursVarianceRange (anchorYmd?: string): { startDate: string; endDate: string } {
  const endDate = resolveAsOfDate(anchorYmd)
  return { startDate: '2024-01-01', endDate }
}
