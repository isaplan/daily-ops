/**
 * @registry-id: dailyOpsRevenueFetchRange
 * @created: 2026-05-20T00:00:00.000Z
 * @last-modified: 2026-05-24T14:00:00.000Z
 * @description: Revenue + items for a date range — **snapshot read only** (ADR-004)
 * @last-fix: [2026-05-24] Removed Bork aggregate fallback on GET; missing snapshot → zeros + unknown
 * @adr-ref: ADR-004
 *
 * @architecture:
 *   Daily Ops revenue APIs must NOT read bork_* or inbox on GET.
 *   Writers (dailyOpsSnapshotService) materialize inbox + Bork into snapshot sections.
 *
 * @exports-to:
 * ✓ server/api/daily-ops/revenue/*
 */

import type { Db } from 'mongodb'
import { DAILY_OPS_SNAPSHOT_COLLECTIONS } from '~/types/daily-ops-snapshot'
import type { DailyOpsSnapshotRevenueSection } from '~/types/daily-ops-snapshot'
import type { DailyOpsRevenueQueryContext } from '~/types/daily-ops-revenue'
import { eachBusinessDate } from './dateRange'
import { rollupFoodBeverageFromCategories } from '../borkFoodBeverageSplit'
import {
  headlineExVatFromSnapshotRevenue,
  morningInboxMapKey,
  pickMorningFinalBasisReport,
} from '../inbox/basis-report-mapper'
import { loadMorningBasisInboxByLocDate } from '../inbox/loadMorningBasisInbox'
import { getGmailConnectionStatus } from '../../services/gmailOAuthService'

export type RevenueRangeTotals = {
  /** Lead-source headline (ex VAT). */
  revenue: number
  /** Lead-source inc VAT (same snapshots as `revenue`). */
  revenueIncVat: number
  /** Bork cross-check ex VAT from snapshot `borkTotals` (written at snapshot build). */
  borkRevenueIncVat: number
  borkRevenueExVat: number
  itemsCount: number
  foodRevenue: number
  beverageRevenue: number
  leadSource: 'inbox_basis' | 'bork_api' | 'unknown'
  /** True when no snapshot revenue rows exist for the requested range. */
  dataGap: boolean
}

function round2(n: number): number {
  return Math.round(n * 100) / 100
}

const EMPTY_TOTALS: RevenueRangeTotals = {
  revenue: 0,
  revenueIncVat: 0,
  borkRevenueIncVat: 0,
  borkRevenueExVat: 0,
  itemsCount: 0,
  foodRevenue: 0,
  beverageRevenue: 0,
  leadSource: 'unknown',
  dataGap: true,
}

async function sumFoodBevFromProductSnapshots(
  db: Db,
  ctx: Pick<DailyOpsRevenueQueryContext, 'startDate' | 'endDate' | 'locationId'>,
): Promise<{ food: number; beverage: number }> {
  const filter: Record<string, unknown> = {
    businessDate: { $gte: ctx.startDate, $lte: ctx.endDate },
  }
  if (ctx.locationId) filter.locationId = ctx.locationId
  const rows = await db.collection(DAILY_OPS_SNAPSHOT_COLLECTIONS.revenueProductsSection).find(filter).toArray()
  let food = 0
  let beverage = 0
  for (const doc of rows) {
    const cats = (doc as { categories?: Array<{ name: string; revenue_ex_vat: number }> }).categories ?? []
    const split = rollupFoodBeverageFromCategories(cats)
    food += split.food
    beverage += split.beverage
  }
  return { food, beverage }
}

/** Snapshot-only range rollup — no bork_* / inbox reads. */
export async function fetchRevenueRange(
  db: Db,
  ctx: DailyOpsRevenueQueryContext,
): Promise<RevenueRangeTotals> {
  const filter: Record<string, unknown> = {
    businessDate: { $gte: ctx.startDate, $lte: ctx.endDate },
  }
  if (ctx.locationId) filter.locationId = ctx.locationId

  const [rows, morningInboxByLocDate, gmailStatus] = await Promise.all([
    db.collection(DAILY_OPS_SNAPSHOT_COLLECTIONS.revenueSection).find(filter).toArray(),
    loadMorningBasisInboxByLocDate(db, ctx.startDate, ctx.endDate),
    getGmailConnectionStatus(),
  ])
  if (rows.length === 0) return { ...EMPTY_TOTALS }

  const forceBorkHeadline = gmailStatus.needsReconnect
  let revenue = 0
  let revenueIncVat = 0
  let borkRevenueIncVat = 0
  let borkRevenueExVat = 0
  let itemsCount = 0
  let inboxDays = 0
  for (const r of rows) {
    const doc = r as DailyOpsSnapshotRevenueSection
    const morning =
      morningInboxByLocDate.get(morningInboxMapKey(doc.businessDate, doc.locationId)) ?? []
    const ex = headlineExVatFromSnapshotRevenue(doc, morning, { forceBorkHeadline })
    const morningPick = forceBorkHeadline ? null : pickMorningFinalBasisReport(morning)
    const useInbox = morningPick != null && Number(morningPick.final_revenue_ex_vat ?? 0) > 0
    revenue += ex
    revenueIncVat += useInbox
      ? Number(
          morningPick!.final_revenue_incl_vat ??
            (morningPick as { final_revenue_inc_vat?: number }).final_revenue_inc_vat ??
            0,
        )
      : Number(doc.borkTotals?.inc_vat ?? 0)
    borkRevenueExVat += Number(doc.borkTotals?.ex_vat ?? 0)
    borkRevenueIncVat += Number(doc.borkTotals?.inc_vat ?? 0)
    itemsCount += Number(doc.totals?.quantity ?? doc.borkTotals?.quantity ?? 0)
    if (useInbox) inboxDays++
  }

  const foodBev = await sumFoodBevFromProductSnapshots(db, {
    startDate: ctx.startDate,
    endDate: ctx.endDate,
    locationId: ctx.locationId,
  })

  return {
    revenue: round2(revenue),
    revenueIncVat: round2(revenueIncVat),
    borkRevenueIncVat: round2(borkRevenueIncVat),
    borkRevenueExVat: round2(borkRevenueExVat),
    itemsCount,
    foodRevenue: foodBev.food,
    beverageRevenue: foodBev.beverage,
    leadSource: inboxDays > 0 ? 'inbox_basis' : revenue > 0 ? 'bork_api' : 'unknown',
    dataGap: false,
  }
}

export async function fetchRevenueRangeForDates(
  db: Db,
  startDate: string,
  endDate: string,
  locationId?: string,
): Promise<RevenueRangeTotals> {
  return fetchRevenueRange(db, {
    period: 'custom',
    startDate,
    endDate,
    label: '',
    compareKind: 'none',
    locationId,
  })
}

export function listDatesInRange(startDate: string, endDate: string): string[] {
  return [...eachBusinessDate(startDate, endDate)]
}
