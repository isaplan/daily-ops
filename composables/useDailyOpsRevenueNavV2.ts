/**
 * @registry-id: useDailyOpsRevenueNavV2
 * @created: 2026-06-08T00:00:00.000Z
 * @last-modified: 2026-06-08T00:00:00.000Z
 * @description: Revenue Nav V2 — URL-synced mode/slot/compare state (ADR-011)
 * @adr-ref: ADR-011, ADR-010
 *
 * @exports-to:
 * ✓ components/daily-ops/revenue/nav-v2/RevenueAnalyticsNavV2.vue
 * ✓ components/daily-ops/revenue/nav-v2/RevenueNavModeTabs.vue
 * ✓ components/daily-ops/revenue/nav-v2/RevenueNavChildBar.vue
 */

import { computed, watch } from 'vue'
import { useRoute, useRouter } from '#imports'
import type {
  RevenueNavV2Granularity,
  RevenueNavV2Mode,
  RevenueNavV2Query,
  RevenueNavV2Range,
  RevenueNavV2Slot,
} from '~/types/daily-ops-revenue-nav-v2'
import { REVENUE_NAV_V2_MODES } from '~/types/daily-ops-revenue-nav-v2'
import { defaultSlotForMode, modeForSlot } from '~/utils/dailyOpsRevenueNavV2/modes'
import { resolveRevenueNavV2Range } from '~/utils/dailyOpsRevenueNavV2/resolveRange'

const VALID_MODES = new Set<string>(REVENUE_NAV_V2_MODES)
const VALID_GRANULARITIES = new Set<string>(['day', 'week', 'month'])

function coerceMode(v: unknown): RevenueNavV2Mode {
  return VALID_MODES.has(String(v)) ? (v as RevenueNavV2Mode) : 'daily'
}

function coerceGranularity(v: unknown): RevenueNavV2Granularity {
  return VALID_GRANULARITIES.has(String(v)) ? (v as RevenueNavV2Granularity) : 'day'
}

function coerceSlot(v: unknown, mode: RevenueNavV2Mode): RevenueNavV2Slot {
  const s = String(v ?? '')
  if (!s) return defaultSlotForMode(mode)
  // Basic safety — slot must look reasonable (alphanumeric + dashes)
  if (!/^[a-z0-9-]+$/.test(s) && !s.startsWith('m-')) return defaultSlotForMode(mode)
  return s as RevenueNavV2Slot
}

export function useDailyOpsRevenueNavV2() {
  const route = useRoute()
  const router = useRouter()

  // --- Read URL → parsed state ---
  const query = computed<RevenueNavV2Query>(() => {
    const q = route.query
    const mode = coerceMode(q.mode)
    const rawSlot = q.slot
    const slot = coerceSlot(rawSlot, mode)
    const location = typeof q.location === 'string' && q.location ? q.location : null
    const space = typeof q.space === 'string' && q.space ? q.space : null
    const compare = q.compare === '1'
    const compareSlots: RevenueNavV2Slot[] = typeof q.cs === 'string'
      ? q.cs.split(',').filter(Boolean).map((s) => s as RevenueNavV2Slot)
      : []
    const granularity = coerceGranularity(q.granularity ?? '')
    const pick = typeof q.pick === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(q.pick) ? q.pick : null

    return { mode, slot, location, space, compare, compareSlots, granularity, pick }
  })

  // --- Derived resolved range ---
  const range = computed<RevenueNavV2Range | null>(() => {
    const { slot, pick, granularity } = query.value
    return resolveRevenueNavV2Range(slot, { pick, granularity })
  })

  const compareRanges = computed<RevenueNavV2Range[]>(() => {
    const { compareSlots, granularity } = query.value
    return compareSlots
      .map((s) => resolveRevenueNavV2Range(s, { granularity }))
      .filter((r): r is RevenueNavV2Range => r !== null)
  })

  // --- Mutation helpers (write to URL) ---
  function setMode(mode: RevenueNavV2Mode) {
    const currentMode = modeForSlot(query.value.slot)
    // Only reset slot if mode actually changed
    const slot = currentMode === mode ? query.value.slot : defaultSlotForMode(mode)
    push({ mode, slot, compare: false, compareSlots: [] })
  }

  function setSlot(slot: RevenueNavV2Slot) {
    const mode = modeForSlot(slot)
    push({ mode, slot })
  }

  function toggleCompare(on?: boolean) {
    const next = on != null ? on : !query.value.compare
    push({ compare: next, compareSlots: next ? query.value.compareSlots : [] })
  }

  function setCompareSlots(slots: RevenueNavV2Slot[]) {
    push({ compareSlots: slots })
  }

  function setLocation(location: string | null) {
    push({ location })
  }

  function setGranularity(granularity: RevenueNavV2Granularity) {
    push({ granularity })
  }

  function setPick(pick: string | null) {
    push({ pick })
  }

  // --- Internal push ---
  function push(patch: Partial<RevenueNavV2Query>) {
    const current = query.value
    const next: Record<string, string | undefined> = {
      mode: patch.mode ?? current.mode,
      slot: patch.slot ?? current.slot,
    }
    const location = patch.location !== undefined ? patch.location : current.location
    if (location) next.location = location

    const space = patch.space !== undefined ? patch.space : current.space
    if (space) next.space = space

    const compare = patch.compare !== undefined ? patch.compare : current.compare
    if (compare) next.compare = '1'

    const compareSlots = patch.compareSlots !== undefined ? patch.compareSlots : current.compareSlots
    if (compareSlots.length) next.cs = compareSlots.join(',')

    const granularity = patch.granularity ?? current.granularity
    if (granularity !== 'day') next.granularity = granularity

    const pick = patch.pick !== undefined ? patch.pick : current.pick
    if (pick) next.pick = pick

    router.push({ query: next })
  }

  return {
    query,
    range,
    compareRanges,
    setMode,
    setSlot,
    toggleCompare,
    setCompareSlots,
    setLocation,
    setGranularity,
    setPick,
  }
}
