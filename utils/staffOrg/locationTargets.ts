/**
 * @registry-id: staffOrgLocationTargets
 * @created: 2026-07-23T10:40:00.000Z
 * @last-modified: 2026-08-12T00:50:00.000Z
 * @description: Default + normalize Staff Org location targets (rev split, labor %, cost envelope)
 * @last-fix: [2026-08-12] Phase 2: normalize costEnvelope snapshot on location targets
 * @adr-ref: ADR-016, ADR-022
 *
 * @exports-to:
 * ✓ server/utils/staffOrg/scenarioRepo.ts
 * ✓ components/staffOrg/*
 * ✓ pages/staff-org/[id].vue
 */

import type {
  StaffOrgCostEnvelopeSnapshot,
  StaffOrgLaborCostPctBuckets,
  StaffOrgLocationTargets,
} from '~/types/staff-org'
import { DAILY_OPS_PROFIT_VENUE_LOCATIONS } from '~/utils/dailyOpsProfitIntervals'

/** VKB / BEA Mongo locationIds */
const VKB_ID = '69d6cfa63d2adf93b79d1ae7'
const BEA_ID = '69d6cfa63d2adf93b79d1ae6'

export function emptyLaborCostPctBuckets(): StaffOrgLaborCostPctBuckets {
  return { total: null, ft: null, pt: null, zzp: null }
}

/** Food share → keuken; beverage → bediening+bar. */
export function defaultTeamRevenueSplit(locationId: string): {
  keukenRevenueShare: number
  bedieningRevenueShare: number
} {
  if (locationId === BEA_ID) return { keukenRevenueShare: 0.25, bedieningRevenueShare: 0.75 }
  if (locationId === VKB_ID) return { keukenRevenueShare: 0.5, bedieningRevenueShare: 0.5 }
  return { keukenRevenueShare: 0.5, bedieningRevenueShare: 0.5 }
}

export function defaultLocationTarget(locationId: string, locationName?: string): StaffOrgLocationTargets {
  const split = defaultTeamRevenueSplit(locationId)
  const isKinsbergen = locationId === VKB_ID
    || (locationName?.includes('Kinsbergen') ?? false)
  return {
    locationId,
    estimatedMonthlyRevenue: isKinsbergen ? 150_000 : 0,
    minLaborProductivity: 0,
    keukenRevenueShare: split.keukenRevenueShare,
    bedieningRevenueShare: split.bedieningRevenueShare,
    contractLaborCostMonthly: null,
    laborCostPctActual: emptyLaborCostPctBuckets(),
    laborCostPctTarget: emptyLaborCostPctBuckets(),
    costEnvelope: null,
  }
}

export function defaultLocationTargets(): StaffOrgLocationTargets[] {
  return DAILY_OPS_PROFIT_VENUE_LOCATIONS.map((v) =>
    defaultLocationTarget(v.locationId, v.label),
  )
}

function clampShare(n: unknown, fallback: number): number {
  const v = typeof n === 'number' ? n : Number(n)
  if (!Number.isFinite(v) || v < 0) return fallback
  if (v > 1) return Math.min(1, v / 100)
  return v
}

function normalizeBuckets(raw: unknown): StaffOrgLaborCostPctBuckets {
  if (!raw || typeof raw !== 'object') return emptyLaborCostPctBuckets()
  const r = raw as Record<string, unknown>
  const num = (k: string): number | null => {
    const v = r[k]
    if (v == null || v === '') return null
    const n = Number(v)
    return Number.isFinite(n) ? Math.round(n * 10) / 10 : null
  }
  return {
    total: num('total'),
    ft: num('ft'),
    pt: num('pt'),
    zzp: num('zzp'),
  }
}

function normalizeCostEnvelope(raw: unknown): StaffOrgCostEnvelopeSnapshot | null {
  if (!raw || typeof raw !== 'object') return null
  const r = raw as Record<string, unknown>
  const n = (k: string): number => {
    const v = Number(r[k])
    return Number.isFinite(v) ? Math.round(v * 100) / 100 : 0
  }
  return {
    costBudget: n('costBudget'),
    cogsBudget: n('cogsBudget'),
    laborOhBudget: n('laborOhBudget'),
    fixedLabor: n('fixedLabor'),
    fixedOh: n('fixedOh'),
    flexBudget: n('flexBudget'),
    weekCostBudget: n('weekCostBudget'),
    weekFlexBudget: n('weekFlexBudget'),
    targetMargin: n('targetMargin') || 0.1,
    targetCogsPct: n('targetCogsPct') || 0.25,
  }
}

/** Merge stored targets with defaults so old scenarios gain new fields. */
export function normalizeLocationTargets(raw: unknown): StaffOrgLocationTargets[] {
  const byId = new Map<string, Record<string, unknown>>()
  if (Array.isArray(raw)) {
    for (const row of raw) {
      if (!row || typeof row !== 'object') continue
      const r = row as Record<string, unknown>
      const locationId = String(r.locationId ?? '').trim()
      if (!locationId) continue
      byId.set(locationId, r)
    }
  }

  const ids = new Set<string>([
    ...DAILY_OPS_PROFIT_VENUE_LOCATIONS.map((v) => v.locationId),
    ...byId.keys(),
  ])

  const out: StaffOrgLocationTargets[] = []
  for (const locationId of ids) {
    const base = defaultLocationTarget(locationId)
    const r = byId.get(locationId)
    if (!r) {
      out.push(base)
      continue
    }
    const split = defaultTeamRevenueSplit(locationId)
    let keuken = clampShare(r.keukenRevenueShare, split.keukenRevenueShare)
    let bediening = clampShare(r.bedieningRevenueShare, split.bedieningRevenueShare)
    const sum = keuken + bediening
    if (sum > 0 && Math.abs(sum - 1) > 0.02) {
      keuken = keuken / sum
      bediening = bediening / sum
    }
    out.push({
      locationId,
      estimatedMonthlyRevenue: Math.max(0, Number(r.estimatedMonthlyRevenue) || 0),
      minLaborProductivity: Math.max(0, Number(r.minLaborProductivity) || 0),
      keukenRevenueShare: Math.round(keuken * 1000) / 1000,
      bedieningRevenueShare: Math.round(bediening * 1000) / 1000,
      contractLaborCostMonthly:
        r.contractLaborCostMonthly == null || r.contractLaborCostMonthly === ''
          ? null
          : Math.max(0, Number(r.contractLaborCostMonthly) || 0),
      laborCostPctActual: normalizeBuckets(r.laborCostPctActual),
      laborCostPctTarget: normalizeBuckets(r.laborCostPctTarget),
      costEnvelope: normalizeCostEnvelope(r.costEnvelope),
    })
  }
  return out
}
