/**
 * @registry-id: dailyOpsVenueStripCheckInLaborByHour
 * @created: 2026-06-09T20:00:00.000Z
 * @last-modified: 2026-06-09T20:00:00.000Z
 * @description: Allocate live check_in labor to hourly buckets for P&L / profit-by-interval
 * @last-fix: [2026-06-09] check_ins SSOT for open-register floor staff hourly loaded cost
 * @adr-ref: ADR-004, ADR-010
 *
 * @exports-to:
 * ✓ server/utils/dailyOpsSnapshot/fetchDashboardBundle.ts
 */

import type { Db } from 'mongodb'
import { amsterdamOpenRegisterBusinessDateYmd, calendarYmdInAmsterdam } from '~/utils/dailyOpsBusinessDate'
import { elapsedOpenShiftHours, loadedCostFromCph } from '~/utils/dailyOpsOpenShiftLabor'
import {
  allocateShiftLabor,
  type LaborByBusinessDateHourBucket,
} from '../eitjeLaborByHour'
import {
  loadMemberCompensationForStaffRows,
  resolveMemberCompensationHit,
} from '../eitjeAggCompensationEnrich'
import type { CheckInRow } from './checkIns'
import { fetchVenueStripCheckIns } from './checkIns'

export type CheckInLaborHourBucket = LaborByBusinessDateHourBucket

function roundBucketMap (
  buckets: Map<string, CheckInLaborHourBucket>,
): Map<string, CheckInLaborHourBucket> {
  for (const [k, v] of buckets) {
    buckets.set(k, {
      loadedCost: Math.round(v.loadedCost * 100) / 100,
      hours: Math.round(v.hours * 100) / 100,
    })
  }
  return buckets
}

/** Sum loaded labor per location|businessDate|hour from open check_ins (start → now). */
export async function fetchCheckInsLaborByBusinessDateHour (
  db: Db,
  ctx: { startDate: string; endDate: string; locationId?: string },
  checkInRows?: CheckInRow[],
): Promise<Map<string, CheckInLaborHourBucket>> {
  const openRegister = amsterdamOpenRegisterBusinessDateYmd()
  if (ctx.endDate < openRegister || ctx.startDate > openRegister) {
    return new Map()
  }

  const rows =
    checkInRows ??
    (await fetchVenueStripCheckIns(db, openRegister, ctx.locationId ? [ctx.locationId] : undefined))

  const scoped = rows.filter((row) => {
    const ymd = calendarYmdInAmsterdam(row.checkInStart)
    if (ymd < ctx.startDate || ymd > ctx.endDate) return false
    if (ctx.locationId && row.locationId !== ctx.locationId) return false
    return true
  })

  if (scoped.length === 0) return new Map()

  const comp = await loadMemberCompensationForStaffRows(db, scoped)
  const now = new Date()
  const buckets = new Map<string, CheckInLaborHourBucket>()

  for (const row of scoped) {
    const hours = elapsedOpenShiftHours(row.checkInStart, now)
    if (hours <= 0) continue
    const hit = resolveMemberCompensationHit(row.userId, row.userName, comp)
    const loaded = loadedCostFromCph(hours, hit?.costPerHour ?? 0)
    if (loaded <= 0) continue
    const businessDate = calendarYmdInAmsterdam(row.checkInStart)
    allocateShiftLabor(
      buckets,
      businessDate,
      row.checkInStart,
      now,
      loaded,
      row.locationId,
    )
  }

  return roundBucketMap(buckets)
}
