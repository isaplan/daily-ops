/**
 * Shared scan window + preloaded Mongo rows for all ops notification detectors.
 */

import type { Db } from 'mongodb'
import { ObjectId } from 'mongodb'
import {
  DAILY_OPS_SNAPSHOT_COLLECTIONS,
  type DailyOpsSnapshotLaborSection,
} from '~/types/daily-ops-snapshot'
import { VENUE_STRIP_LOCATIONS } from '../venueStrip/constants'
import {
  calculateBasisCronPriority,
  type BasisReportData,
} from '../inbox/basis-report-mapper'
import {
  addCalendarDaysYmd,
  amsterdamOpenRegisterBusinessDateYmd,
} from '~/utils/dailyOpsBusinessDate'
import { resolveBorkAggReadSuffix } from '../borkAggVersionSuffix'

export const REV_EPS = 0.02
export const GAP_PCT_THRESHOLD = 10
export const GAP_EUR_THRESHOLD = 500

export function snapKey(businessDate: string, locationId: string): string {
  return `${businessDate}:::${locationId}`
}

export type OpsScanContext = {
  startDate: string
  endDate: string
  openBusinessDate: string
  locIds: string[]
  locName: Map<string, string>
  revenueByKey: Map<string, { ex: number; inc: number }>
  laborKeys: Set<string>
  laborByKey: Map<string, DailyOpsSnapshotLaborSection>
  masterKeys: Set<string>
  borkExByKey: Map<string, number>
  eitjeHoursByKey: Map<string, number>
  inboxByKey: Map<string, BasisReportData[]>
  inboxUnmapped: Array<{ business_date: string; location: string; cron_hour?: number }>
  eitjeInboxDays: Set<string>
}

export type OpsScanWindow = {
  lookbackDays: number
  endDate: string
  startDate: string
}

export function resolveScanWindow(opts?: { lookbackDays?: number; endDate?: string }): OpsScanWindow {
  const lookbackDays = opts?.lookbackDays ?? 30
  const endDate = opts?.endDate ?? amsterdamOpenRegisterBusinessDateYmd()
  const startDate = addCalendarDaysYmd(endDate, -(lookbackDays - 1))
  return { lookbackDays, endDate, startDate }
}

export async function loadOpsScanContext(
  db: Db,
  window: Pick<OpsScanWindow, 'startDate' | 'endDate'>,
): Promise<OpsScanContext> {
  const { startDate, endDate } = window
  const dateFilter = { $gte: startDate, $lte: endDate }
  const locIds = VENUE_STRIP_LOCATIONS.map((v) => v.locationId)
  const locName = new Map(VENUE_STRIP_LOCATIONS.map((v) => [v.locationId, v.locationName]))
  const borkSuffix = resolveBorkAggReadSuffix()
  const borkDaysColl = `bork_business_days${borkSuffix}`

  const [
    revenueRows,
    laborRows,
    masterRows,
    borkRows,
    eitjeRows,
    inboxRows,
    inboxUnmapped,
    eitjeInboxRows,
  ] = await Promise.all([
    db
      .collection(DAILY_OPS_SNAPSHOT_COLLECTIONS.revenueSection)
      .find({ businessDate: dateFilter, locationId: { $in: locIds } })
      .project({ businessDate: 1, locationId: 1, totals: 1 })
      .toArray(),
    db
      .collection(DAILY_OPS_SNAPSHOT_COLLECTIONS.laborSection)
      .find({ businessDate: dateFilter, locationId: { $in: locIds } })
      .project({
        businessDate: 1,
        locationId: 1,
        locationName: 1,
        totals: 1,
        totals_gewerkt: 1,
        operational: 1,
        teams: 1,
        workers: 1,
      })
      .toArray(),
    db
      .collection(DAILY_OPS_SNAPSHOT_COLLECTIONS.master)
      .find({ businessDate: dateFilter, locationId: { $in: locIds } })
      .project({ businessDate: 1, locationId: 1 })
      .toArray(),
    db
      .collection(borkDaysColl)
      .find({
        business_date: dateFilter,
        locationId: { $in: locIds.map((id) => new ObjectId(id)) },
      })
      .project({ business_date: 1, locationId: 1, total_revenue_ex_vat: 1 })
      .toArray(),
    db
      .collection('eitje_time_registration_aggregation')
      .find({ period: dateFilter, locationId: { $in: locIds } })
      .project({ period: 1, locationId: 1, hours: 1 })
      .toArray(),
    db
      .collection('inbox-bork-basis-report')
      .find({ business_date: dateFilter })
      .project({
        business_date: 1,
        location_id: 1,
        location: 1,
        cron_hour: 1,
        final_revenue_ex_vat: 1,
        final_revenue_incl_vat: 1,
        received_at: 1,
      })
      .toArray(),
    db
      .collection('inbox-bork-basis-report')
      .find({
        business_date: dateFilter,
        $or: [{ location_id: { $exists: false } }, { location_id: null }, { location_id: '' }],
      })
      .project({ business_date: 1, location: 1, cron_hour: 1 })
      .limit(50)
      .toArray(),
    db
      .collection('inbox-eitje-hours')
      .find({ date: dateFilter, location_id: { $in: locIds } })
      .project({ date: 1, location_id: 1 })
      .toArray(),
  ])

  const revenueByKey = new Map<string, { ex: number; inc: number }>()
  for (const r of revenueRows) {
    const bd = String(r.businessDate ?? '')
    const lid = String(r.locationId ?? '')
    const totals = r.totals as { ex_vat?: number; inc_vat?: number } | undefined
    revenueByKey.set(snapKey(bd, lid), {
      ex: Number(totals?.ex_vat ?? 0),
      inc: Number(totals?.inc_vat ?? 0),
    })
  }

  const laborKeys = new Set(
    laborRows.map((r) => snapKey(String(r.businessDate), String(r.locationId))),
  )
  const laborByKey = new Map(
    laborRows.map((r) => [
      snapKey(String(r.businessDate), String(r.locationId)),
      r as DailyOpsSnapshotLaborSection,
    ]),
  )
  const masterKeys = new Set(
    masterRows.map((r) => snapKey(String(r.businessDate), String(r.locationId))),
  )

  const borkExByKey = new Map<string, number>()
  for (const r of borkRows) {
    const lid =
      r.locationId instanceof ObjectId ? r.locationId.toHexString() : String(r.locationId ?? '')
    if (!locIds.includes(lid)) continue
    borkExByKey.set(snapKey(String(r.business_date), lid), Number(r.total_revenue_ex_vat ?? 0))
  }

  const eitjeHoursByKey = new Map<string, number>()
  for (const r of eitjeRows) {
    const hours = Number(r.hours ?? 0)
    if (hours <= 0) continue
    eitjeHoursByKey.set(snapKey(String(r.period), String(r.locationId)), hours)
  }

  const inboxByKey = new Map<string, BasisReportData[]>()
  for (const r of inboxRows) {
    const lid = String(r.location_id ?? '')
    if (!lid || !locIds.includes(lid)) continue
    const k = snapKey(String(r.business_date ?? ''), lid)
    if (!inboxByKey.has(k)) inboxByKey.set(k, [])
    inboxByKey.get(k)!.push(r as BasisReportData)
  }

  const eitjeInboxDays = new Set(
    eitjeInboxRows.map((r) => snapKey(String(r.date ?? ''), String(r.location_id ?? ''))),
  )

  return {
    startDate,
    endDate,
    openBusinessDate: amsterdamOpenRegisterBusinessDateYmd(),
    locIds,
    locName,
    revenueByKey,
    laborKeys,
    laborByKey,
    masterKeys,
    borkExByKey,
    eitjeHoursByKey,
    inboxByKey,
    inboxUnmapped: inboxUnmapped as OpsScanContext['inboxUnmapped'],
    eitjeInboxDays,
  }
}

export function hasMorningFinalInbox(rows: BasisReportData[]): boolean {
  return rows.some((r) => calculateBasisCronPriority(r.cron_hour) === 3)
}

export function morningFinalInboxEx(rows: BasisReportData[]): number {
  const sorted = [...rows].sort(
    (a, b) => calculateBasisCronPriority(b.cron_hour) - calculateBasisCronPriority(a.cron_hour),
  )
  const final = sorted.find((r) => calculateBasisCronPriority(r.cron_hour) === 3)
  return Number(final?.final_revenue_ex_vat ?? 0)
}

export function gapIsSignificant(borkEx: number, inboxEx: number): boolean {
  if (borkEx <= REV_EPS && inboxEx <= REV_EPS) return false
  const delta = Math.abs(borkEx - inboxEx)
  if (delta < GAP_EUR_THRESHOLD) return false
  const base = Math.max(borkEx, inboxEx, 1)
  return (delta / base) * 100 >= GAP_PCT_THRESHOLD
}
