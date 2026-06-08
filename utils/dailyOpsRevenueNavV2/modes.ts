/**
 * @registry-id: revenueNavV2Modes
 * @created: 2026-06-08T00:00:00.000Z
 * @last-modified: 2026-06-08T00:00:00.000Z
 * @description: Mode definitions + default slot per mode for Revenue Nav V2
 * @adr-ref: ADR-011
 *
 * @exports-to:
 * ✓ composables/useDailyOpsRevenueNavV2.ts
 * ✓ components/daily-ops/revenue/nav-v2/RevenueNavModeTabs.vue
 */

import type { RevenueNavV2Mode, RevenueNavV2Slot } from '~/types/daily-ops-revenue-nav-v2'

export type ModeConfig = {
  id: RevenueNavV2Mode
  label: string
  defaultSlot: RevenueNavV2Slot
}

export const REVENUE_NAV_V2_MODE_CONFIGS: ModeConfig[] = [
  { id: 'daily',     label: 'Daily',     defaultSlot: 'today' },
  { id: 'weekly',    label: 'Weekly',    defaultSlot: 'this-week' },
  { id: 'monthly',   label: 'Monthly',   defaultSlot: 'this-month' },
  { id: 'quarterly', label: 'Quarterly', defaultSlot: 'q1' },
  { id: 'yearly',    label: 'Yearly',    defaultSlot: 'this-year' },
  { id: 'seasonal',  label: 'Seasonal',  defaultSlot: 'spring' },
  { id: 'menu',      label: 'Menu',      defaultSlot: 'menu-all' },
  { id: 'period',    label: 'Period',    defaultSlot: 'last-7d' },
]

export function defaultSlotForMode(mode: RevenueNavV2Mode): RevenueNavV2Slot {
  return REVENUE_NAV_V2_MODE_CONFIGS.find((m) => m.id === mode)?.defaultSlot ?? 'today'
}

export function modeForSlot(slot: RevenueNavV2Slot): RevenueNavV2Mode {
  if (['today', 'yesterday', 'd2', 'd3', 'd4', 'd5', 'd6', 'd7'].includes(slot)) return 'daily'
  if (['this-week', 'last-week', 'w-2', 'w-3'].includes(slot)) return 'weekly'
  if (slot === 'this-month' || slot === 'last-month' || slot.startsWith('m-')) return 'monthly'
  if (['q1', 'q2', 'q3', 'q4', 'last-q'].includes(slot)) return 'quarterly'
  if (['this-year', 'last-year', 'year-2'].includes(slot)) return 'yearly'
  if (['spring', 'summer', 'autumn', 'winter', 'spring-1', 'summer-1', 'autumn-1', 'winter-1'].includes(slot)) return 'seasonal'
  if (slot.startsWith('menu-')) return 'menu'
  return 'period'
}
