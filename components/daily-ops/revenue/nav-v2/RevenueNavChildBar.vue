<template>
  <nav
    v-if="options.length"
    :aria-label="`${activeMode} period`"
    class="scrollbar-hide inline-flex w-max max-w-full min-w-0 shrink-0 flex-nowrap items-center gap-1 overflow-x-auto overscroll-x-contain rounded-md border-2 border-gray-900 bg-white p-1"
  >
    <button
      v-for="opt in options"
      :key="opt.id"
      type="button"
      class="shrink-0 rounded px-3 py-1.5 text-sm font-semibold transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gray-900"
      :class="isActive(opt.id)
        ? compareMode ? 'bg-indigo-600 text-white' : 'bg-gray-900 text-white'
        : 'text-gray-700 hover:bg-gray-100'"
      @click="onSelect(opt.id)"
    >
      <span class="md:hidden">{{ opt.short ?? opt.label }}</span>
      <span class="hidden md:inline">{{ opt.label }}</span>
    </button>
  </nav>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { RevenueNavV2Mode, RevenueNavV2Slot, RevenueNavV2SlotOption } from '~/types/daily-ops-revenue-nav-v2'
import { buildMonthPillOptions } from '~/utils/dailyOpsRevenueNavV2/monthOptions'
import { dailySlotWeekdayLabel } from '~/utils/dailyOpsRevenueNavV2/resolveRange'

const props = defineProps<{
  activeMode: RevenueNavV2Mode
  activeSlot: RevenueNavV2Slot
  compareMode: boolean
  compareSlots: RevenueNavV2Slot[]
}>()

const emit = defineEmits<{
  select: [slot: RevenueNavV2Slot]
}>()

const DAILY_SLOTS: RevenueNavV2Slot[] = ['today', 'yesterday', 'd2', 'd3', 'd4', 'd5', 'd6', 'd7']

const WEEKLY_OPTIONS: RevenueNavV2SlotOption[] = [
  { id: 'this-week',  label: 'This week',  short: 'This wk' },
  { id: 'last-week',  label: 'Last week',  short: 'Last wk' },
  { id: 'w-2',        label: '2 weeks ago', short: '2w ago' },
  { id: 'w-3',        label: '3 weeks ago', short: '3w ago' },
]

const QUARTERLY_OPTIONS: RevenueNavV2SlotOption[] = [
  { id: 'q1',     label: 'Q1' },
  { id: 'q2',     label: 'Q2' },
  { id: 'q3',     label: 'Q3' },
  { id: 'q4',     label: 'Q4' },
  { id: 'last-q', label: 'Last Q', short: 'Prev Q' },
]

const YEARLY_OPTIONS: RevenueNavV2SlotOption[] = [
  { id: 'this-year', label: 'This year', short: 'This yr' },
  { id: 'last-year', label: 'Last year', short: 'Last yr' },
  { id: 'year-2',    label: '2 years ago', short: '2yr ago' },
]

const SEASONAL_OPTIONS: RevenueNavV2SlotOption[] = [
  { id: 'spring',   label: 'Spring' },
  { id: 'summer',   label: 'Summer' },
  { id: 'autumn',   label: 'Autumn' },
  { id: 'winter',   label: 'Winter' },
  { id: 'spring-1', label: 'Spring −1', short: 'Spr −1' },
  { id: 'summer-1', label: 'Summer −1', short: 'Sum −1' },
  { id: 'autumn-1', label: 'Autumn −1', short: 'Aut −1' },
  { id: 'winter-1', label: 'Winter −1', short: 'Win −1' },
]

const PERIOD_OPTIONS: RevenueNavV2SlotOption[] = [
  { id: 'last-7d',  label: 'Last 7 days',   short: '7d' },
  { id: 'last-14d', label: 'Last 14 days',   short: '14d' },
  { id: 'last-28d', label: 'Last 28 days',   short: '28d' },
  { id: 'last-6w',  label: 'Last 6 weeks',   short: '6w' },
  { id: 'last-12w', label: 'Last 12 weeks',  short: '12w' },
  { id: 'last-24w', label: 'Last 24 weeks',  short: '24w' },
  { id: 'last-12m', label: 'Last 12 months', short: '12m' },
]

const options = computed<RevenueNavV2SlotOption[]>(() => {
  switch (props.activeMode) {
    case 'daily':
      return DAILY_SLOTS.map((id) => ({
        id,
        label: dailySlotWeekdayLabel(id),
        short: dailySlotWeekdayLabel(id),
      }))
    case 'weekly':    return WEEKLY_OPTIONS
    case 'monthly':   return buildMonthPillOptions()
    case 'quarterly': return QUARTERLY_OPTIONS
    case 'yearly':    return YEARLY_OPTIONS
    case 'seasonal':  return SEASONAL_OPTIONS
    case 'period':    return PERIOD_OPTIONS
    case 'menu':      return []
    default:          return []
  }
})

function isActive(id: RevenueNavV2Slot): boolean {
  if (props.compareMode) return props.compareSlots.includes(id)
  return props.activeSlot === id
}

function onSelect(id: RevenueNavV2Slot) {
  emit('select', id)
}
</script>
