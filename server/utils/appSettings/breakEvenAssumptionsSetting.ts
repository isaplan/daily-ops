/**
 * @registry-id: breakEvenAssumptionsSetting
 * @created: 2026-07-24T11:30:00.000Z
 * @last-modified: 2026-08-09T01:05:00.000Z
 * @description: Mongo app_settings store for rolling/actual break-even assumptions
 * @last-fix: [2026-08-09] @adr-ref + PERIOD_CACHE_ADR L2/L4 (feeds ratio snapshots)
 *   Prior: [2026-08-05] Accept blended BreakEvenSource in normalizeSlice
 * @adr-ref: ADR-013, ADR-014, ADR-019, ADR-022, PERIOD_CACHE_ADR L2, L4
 *
 * @exports-to:
 * ✓ server/utils/accountingPnl/refreshFinanceAssumptions.ts
 * ✓ server/utils/dailyOpsPeriodCache/ratioSnapshot.ts
 */

import type { Db } from 'mongodb'
import { APP_SETTING_KEYS } from '~/types/app-settings'
import type { BreakEvenAssumptionsValue, BreakEvenVenueKey, BreakEvenVenueSlice } from '~/types/break-even'
import { getAppSettingValue, setAppSettingValue } from './appSettingsStore'

const SCHEMA_VERSION = 1

function emptySlice (venueId: BreakEvenVenueKey): BreakEvenVenueSlice {
  return {
    venueId,
    monthlyBreakEven: 0,
    monthlyRevenue: 0,
    monthlyLabor: 0,
    monthlyFixedLabor: 0,
    monthlyFlexLabor: 0,
    monthlyCogs: 0,
    monthlyFixed: 0,
    cogsPct: 0,
    laborPct: 0,
    fixedLaborPct: 0,
    flexLaborPct: 0,
    source: 'default',
    year: null,
    month: null,
    monthsInWindow: 0,
  }
}

export function defaultBreakEvenAssumptions (): BreakEvenAssumptionsValue {
  return {
    schemaVersion: 1,
    rollingWindowMonths: 12,
    computedAt: new Date(0).toISOString(),
    rolling: {
      vkb: emptySlice('vkb'),
      bea: emptySlice('bea'),
      lat: emptySlice('lat'),
      combined: emptySlice('combined'),
    },
    actualByMonth: {},
  }
}

function normalizeSlice (raw: unknown, venueId: BreakEvenVenueKey): BreakEvenVenueSlice {
  if (!raw || typeof raw !== 'object') return emptySlice(venueId)
  const r = raw as Record<string, unknown>
  const num = (k: string): number => {
    const v = Number(r[k])
    return Number.isFinite(v) ? v : 0
  }
  const source = r.source
  const laborPct = num('laborPct')
  const fixedLaborPct = r.fixedLaborPct != null ? num('fixedLaborPct') : laborPct
  const flexLaborPct = r.flexLaborPct != null ? num('flexLaborPct') : 0
  const monthlyLabor = num('monthlyLabor')
  return {
    venueId,
    monthlyBreakEven: num('monthlyBreakEven'),
    monthlyRevenue: num('monthlyRevenue'),
    monthlyLabor,
    monthlyFixedLabor: r.monthlyFixedLabor != null ? num('monthlyFixedLabor') : monthlyLabor,
    monthlyFlexLabor: r.monthlyFlexLabor != null ? num('monthlyFlexLabor') : 0,
    monthlyCogs: num('monthlyCogs'),
    monthlyFixed: num('monthlyFixed'),
    cogsPct: num('cogsPct'),
    laborPct,
    fixedLaborPct,
    flexLaborPct,
    source:
      source === 'actual_month'
      || source === 'rolling_12m'
      || source === 'blended'
      || source === 'default'
        ? source
        : 'default',
    year: r.year == null ? null : Number(r.year) || null,
    month: r.month == null ? null : Number(r.month) || null,
    monthsInWindow: num('monthsInWindow'),
  }
}

export function normalizeBreakEvenAssumptions (raw: unknown): BreakEvenAssumptionsValue {
  const base = defaultBreakEvenAssumptions()
  if (!raw || typeof raw !== 'object') return base
  const r = raw as Record<string, unknown>
  const rollingRaw = (r.rolling && typeof r.rolling === 'object' ? r.rolling : {}) as Record<string, unknown>
  const actualRaw = (r.actualByMonth && typeof r.actualByMonth === 'object' ? r.actualByMonth : {}) as Record<
    string,
    unknown
  >

  const rolling = {
    vkb: normalizeSlice(rollingRaw.vkb, 'vkb'),
    bea: normalizeSlice(rollingRaw.bea, 'bea'),
    lat: normalizeSlice(rollingRaw.lat, 'lat'),
    combined: normalizeSlice(rollingRaw.combined, 'combined'),
  }

  const actualByMonth: BreakEvenAssumptionsValue['actualByMonth'] = {}
  for (const [mk, val] of Object.entries(actualRaw)) {
    if (!val || typeof val !== 'object') continue
    const v = val as Record<string, unknown>
    actualByMonth[mk] = {
      vkb: normalizeSlice(v.vkb, 'vkb'),
      bea: normalizeSlice(v.bea, 'bea'),
      lat: normalizeSlice(v.lat, 'lat'),
      combined: normalizeSlice(v.combined, 'combined'),
    }
  }

  return {
    schemaVersion: 1,
    rollingWindowMonths: 12,
    computedAt: typeof r.computedAt === 'string' ? r.computedAt : base.computedAt,
    rolling,
    actualByMonth,
  }
}

export async function loadBreakEvenAssumptions (db: Db): Promise<BreakEvenAssumptionsValue> {
  const loaded = await getAppSettingValue(db, APP_SETTING_KEYS.BREAK_EVEN_ASSUMPTIONS, defaultBreakEvenAssumptions())
  return normalizeBreakEvenAssumptions(loaded.value)
}

export async function saveBreakEvenAssumptions (
  db: Db,
  next: BreakEvenAssumptionsValue,
  updatedBy?: string | null,
): Promise<BreakEvenAssumptionsValue> {
  const value = normalizeBreakEvenAssumptions(next)
  const saved = await setAppSettingValue<BreakEvenAssumptionsValue>(db, {
    key: APP_SETTING_KEYS.BREAK_EVEN_ASSUMPTIONS,
    category: 'calculations',
    schemaVersion: SCHEMA_VERSION,
    description: 'Rolling 12-month + sealed-month break-even targets from accounting P&L',
    value,
    updatedBy: updatedBy ?? null,
  })
  return normalizeBreakEvenAssumptions(saved.value)
}
