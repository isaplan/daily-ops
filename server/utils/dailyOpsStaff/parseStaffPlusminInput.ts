/**
 * @registry-id: dailyOpsStaffParsePlusminInput
 * @created: 2026-06-25T14:00:00.000Z
 * @last-modified: 2026-06-25T14:00:00.000Z
 * @description: Map Nav V2 + API query → plus/min summary ranges
 * @last-fix: [2026-06-25] Display + month + week range resolver
 *
 * @exports-to:
 * ✓ server/api/daily-ops/staff/plusmin-summary.get.ts
 */

import type { RevenueNavV2Slot } from '~/types/daily-ops-revenue-nav-v2'
import { resolveNavV2RevenueApiQuery } from '~/utils/dailyOpsRevenueNavV2/toRevenueApiQuery'
import { resolveRevenueNavV2Range } from '~/utils/dailyOpsRevenueNavV2/resolveRange'
import { modeForSlot } from '~/utils/dailyOpsRevenueNavV2/modes'
import { parseStaffQuery } from './parseStaffQuery'
import type { StaffPlusminSummaryInput } from './fetchStaffPlusminSummary'

function slotFromQuery(q: Record<string, unknown>): RevenueNavV2Slot {
  const slot = typeof q.slot === 'string' ? q.slot : ''
  if (slot) return slot as RevenueNavV2Slot
  const ctx = parseStaffQuery(q)
  if (ctx.period === 'this-week' || ctx.period === 'last-week') return ctx.period
  if (ctx.period === 'this-month' || ctx.period === 'last-month') return ctx.period
  return 'this-month'
}

export function parseStaffPlusminInput(q: Record<string, unknown>): StaffPlusminSummaryInput {
  const slot = slotFromQuery(q)
  const mode = typeof q.mode === 'string' ? q.mode : modeForSlot(slot)
  const pick = typeof q.pick === 'string' ? q.pick : null
  const granularity =
    q.granularity === 'week' || q.granularity === 'month' ? q.granularity : null

  const displayResolved =
    resolveNavV2RevenueApiQuery({ slot, pick, granularity }) ??
    (() => {
      const ctx = parseStaffQuery(q)
      return {
        period: ctx.period,
        startDate: ctx.startDate,
        endDate: ctx.endDate,
        label: ctx.label,
        granularity: 'day' as const,
      }
    })()

  const monthSlot: RevenueNavV2Slot = mode === 'monthly' ? slot : 'this-month'
  const weekSlot: RevenueNavV2Slot = mode === 'weekly' ? slot : 'this-week'

  const monthRange = resolveRevenueNavV2Range(monthSlot, {
    pick: mode === 'monthly' ? pick : null,
    granularity,
  })
  const weekRange = resolveRevenueNavV2Range(weekSlot, { granularity })

  if (!monthRange || !weekRange) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid plus/min period' })
  }

  return {
    displayStart: displayResolved.startDate,
    displayEnd: displayResolved.endDate,
    displayLabel: displayResolved.label,
    monthStart: monthRange.startDate,
    monthEnd: monthRange.endDate,
    monthLabel: monthRange.label,
    weekStart: weekRange.startDate,
    weekEnd: weekRange.endDate,
    weekLabel: weekRange.label,
  }
}
