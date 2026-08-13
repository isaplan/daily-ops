<template>
  <section class="space-y-6">
    <header class="space-y-1">
      <h1 class="text-[34px] font-extrabold leading-tight tracking-[-0.02em] text-gray-900">
        Leave calendar
      </h1>
      <p class="text-base text-gray-600">
        {{ viewMode === 'year' ? 'Year timeline' : 'Month timeline' }} · vacations, leave &amp; sick
      </p>
    </header>

    <div v-if="pending" class="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <USkeleton v-for="i in 4" :key="`sk-${i}`" class="h-24 w-full rounded-lg" />
    </div>

    <UAlert v-else-if="error" color="error" :title="String(error)" />

    <template v-else-if="calendar">
      <div class="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <div class="rounded-lg border-2 border-gray-900 bg-white p-4">
          <p class="text-xs font-semibold uppercase text-gray-500">Spans</p>
          <p class="mt-1 text-2xl font-bold tabular-nums text-gray-900">{{ calendar.totals.entry_count }}</p>
        </div>
        <div class="rounded-lg border-2 border-gray-900 bg-white p-4">
          <p class="text-xs font-semibold uppercase text-gray-500">Vacation</p>
          <p class="mt-1 text-2xl font-bold tabular-nums text-gray-900">{{ calendar.totals.vacation_count }}</p>
        </div>
        <div class="rounded-lg border-2 border-gray-900 bg-white p-4">
          <p class="text-xs font-semibold uppercase text-gray-500">Leave</p>
          <p class="mt-1 text-2xl font-bold tabular-nums text-gray-900">{{ calendar.totals.leave_count }}</p>
        </div>
        <div class="rounded-lg border-2 border-gray-900 bg-white p-4">
          <p class="text-xs font-semibold uppercase text-gray-500">Sick</p>
          <p class="mt-1 text-2xl font-bold tabular-nums text-gray-900">{{ calendar.totals.sick_count }}</p>
        </div>
        <div class="rounded-lg border-2 border-gray-900 bg-white p-4">
          <p class="text-xs font-semibold uppercase text-gray-500">Pending</p>
          <p class="mt-1 text-2xl font-bold tabular-nums text-gray-900">{{ calendar.totals.pending_count }}</p>
        </div>
      </div>

      <div class="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div class="flex min-w-0 flex-1 flex-col gap-2">
          <div class="flex flex-wrap items-center gap-2">
            <p class="w-16 shrink-0 text-xs font-semibold uppercase text-gray-500">Contract</p>
            <nav aria-label="Contract filter" class="flex flex-wrap gap-1.5">
              <button
                v-for="opt in contractFilters"
                :key="opt.id"
                type="button"
                class="rounded-full border-2 border-gray-900 px-3 py-1 text-sm font-semibold transition-colors"
                :class="contractFilter === opt.id
                  ? 'bg-gray-900 text-white'
                  : 'bg-white text-gray-700 hover:bg-gray-100'"
                @click="contractFilter = opt.id"
              >
                {{ opt.label }}
                <span v-if="opt.count != null" class="tabular-nums opacity-70">({{ opt.count }})</span>
              </button>
            </nav>
          </div>

          <div class="flex flex-wrap items-center gap-2">
            <p class="w-16 shrink-0 text-xs font-semibold uppercase text-gray-500">Type</p>
            <nav aria-label="Type filter" class="flex flex-wrap gap-1.5">
              <button
                v-for="opt in kindFilterOptions"
                :key="opt.id"
                type="button"
                class="inline-flex items-center gap-1.5 rounded-full border-2 px-3 py-1 text-sm font-semibold transition-colors"
                :class="isKindOn(opt.id)
                  ? opt.activeClass
                  : 'border-gray-900 bg-white text-gray-700 hover:bg-gray-100'"
                :aria-pressed="isKindOn(opt.id)"
                @click="toggleKind(opt.id)"
              >
                <span
                  v-if="!isKindOn(opt.id)"
                  class="h-2.5 w-2.5 rounded-full"
                  :class="opt.dotClass"
                />
                {{ opt.label }}
              </button>
            </nav>
          </div>

          <div class="flex flex-wrap items-center gap-2">
            <p class="w-16 shrink-0 text-xs font-semibold uppercase text-gray-500">Status</p>
            <nav aria-label="Status filter" class="flex flex-wrap gap-1.5">
              <button
                v-for="opt in statusFilterOptions"
                :key="opt.id"
                type="button"
                class="rounded-full border-2 border-gray-900 px-3 py-1 text-sm font-semibold transition-colors"
                :class="isStatusOn(opt.id)
                  ? 'bg-gray-900 text-white'
                  : 'bg-white text-gray-700 hover:bg-gray-100'"
                :aria-pressed="isStatusOn(opt.id)"
                @click="toggleStatus(opt.id)"
              >
                {{ opt.label }}
              </button>
            </nav>
          </div>
        </div>

        <div class="flex shrink-0 flex-wrap items-center justify-end gap-2 lg:pt-0.5">
          <nav
            aria-label="View mode"
            class="flex gap-1.5"
          >
            <button
              type="button"
              class="rounded-full border-2 border-gray-900 px-3 py-1 text-sm font-semibold transition-colors"
              :class="viewMode === 'year' ? 'bg-gray-900 text-white' : 'bg-white text-gray-700 hover:bg-gray-100'"
              @click="viewMode = 'year'"
            >
              Year
            </button>
            <button
              type="button"
              class="rounded-full border-2 border-gray-900 px-3 py-1 text-sm font-semibold transition-colors"
              :class="viewMode === 'month' ? 'bg-gray-900 text-white' : 'bg-white text-gray-700 hover:bg-gray-100'"
              @click="switchToMonthView"
            >
              Month
            </button>
          </nav>
          <UButton
            size="sm"
            color="neutral"
            variant="outline"
            @click="prevPeriod"
          >
            Prev
          </UButton>
          <p class="min-w-28 text-center text-sm font-semibold tabular-nums text-gray-900">
            {{ periodLabel }}
          </p>
          <UButton
            size="sm"
            color="neutral"
            variant="outline"
            @click="nextPeriod"
          >
            Next
          </UButton>
        </div>
      </div>

      <!-- Gantt: year (all months) or single month -->
      <div class="overflow-x-auto rounded-lg border-2 border-gray-900 bg-white">
        <div class="min-w-[960px]">
          <div
            class="grid border-b-2 border-gray-900 bg-gray-900 text-white"
            :style="gridTemplate"
          >
            <div class="border-r-2 border-black px-2 py-2 text-xs font-bold uppercase tracking-wide">
              Month
            </div>
            <div
              v-for="d in 31"
              :key="`h-${d}`"
              class="border-r border-white/15 py-2 text-center text-[10px] font-semibold tabular-nums last:border-r-0"
            >
              {{ d }}
            </div>
          </div>

          <div
            v-for="row in visibleGanttRows"
            :key="row.month"
            class="grid border-b border-gray-200 last:border-b-0"
            :style="{ ...gridTemplate, minHeight: `${Math.max(72, row.laneCount * BAR_LANE_STEP + 20)}px` }"
          >
            <div
              class="flex items-center justify-center border-r-2 border-gray-900 bg-white px-2 text-sm font-bold text-gray-900"
            >
              {{ row.label }}
            </div>
            <div
              class="relative"
              style="grid-column: 2 / span 31"
            >
              <div class="pointer-events-none absolute inset-0 grid grid-cols-31">
                <div
                  v-for="d in 31"
                  :key="`s-${row.month}-${d}`"
                  class="border-r border-gray-100"
                  :class="d > row.daysInMonth ? 'bg-gray-100/80' : (d % 2 === 0 ? 'bg-gray-50/80' : 'bg-white')"
                />
              </div>

              <button
                v-for="bar in row.bars"
                :key="bar.span.id"
                type="button"
                class="absolute truncate rounded-md border border-black/10 px-2 text-left text-sm font-semibold text-white shadow-sm transition-opacity hover:opacity-90"
                :class="barColor(bar.span.kind)"
                :style="barStyle(bar, row.daysInMonth)"
                :title="barTitle(bar.span)"
                @click="selectSpan(bar.span)"
              >
                {{ barLabel(bar, row.daysInMonth) }}
              </button>
            </div>
          </div>
        </div>
      </div>

      <div class="rounded-lg border-2 border-gray-900 bg-white p-4">
        <div class="mb-3 flex items-center justify-between gap-2">
          <h2 class="text-sm font-semibold text-gray-900">
            {{ detailTitle }}
          </h2>
          <UButton
            v-if="selectedSpan"
            size="xs"
            variant="ghost"
            color="neutral"
            @click="selectedSpan = null"
          >
            Clear
          </UButton>
        </div>
        <p v-if="!selectedSpan" class="text-sm text-gray-500">
          Click a bar to see details.
        </p>
        <div v-else class="space-y-2 text-sm">
          <p class="font-semibold text-gray-900">{{ selectedSpan.userName }}</p>
          <p class="text-gray-600">
            {{ selectedSpan.locationName }}
            · {{ selectedSpan.startDate }} → {{ selectedSpan.endDate }}
            · {{ fmtHours(selectedSpan.hours) }} in {{ selectedSpan.month }}
          </p>
          <div class="flex flex-wrap gap-2">
            <span class="rounded px-1.5 py-0.5 text-[11px] font-semibold uppercase" :class="kindBadgeClass(selectedSpan.kind)">
              {{ selectedSpan.kind }}
            </span>
            <span class="rounded px-1.5 py-0.5 text-[11px] font-semibold uppercase" :class="statusBadgeClass(selectedSpan.status)">
              {{ selectedSpan.status }}
            </span>
            <span
              v-if="selectedSpan.contractBucket"
              class="rounded bg-gray-100 px-1.5 py-0.5 text-[11px] font-semibold uppercase text-gray-700"
            >
              {{ selectedSpan.contractBucket }}
            </span>
          </div>
          <p class="text-gray-600">{{ selectedSpan.reason }}</p>
        </div>
      </div>
    </template>
  </section>
</template>

<script setup lang="ts">
/**
 * @registry-id: StaffLeaveCalendarTab
 * @created: 2026-08-13T14:13:52.000Z
 * @last-modified: 2026-08-13T16:22:00.000Z
 * @last-fix: [2026-08-13] Period nav below KPIs, top-right of filters (above Gantt)
 *
 * @exports-to:
 * ✓ pages/daily-ops/staff/leave.vue
 */
import type {
  DailyOpsStaffLeaveKind,
  DailyOpsStaffLeaveSpanDto,
} from '~/types/daily-ops-staff'
import { amsterdamOpenRegisterBusinessDateYmd } from '~/utils/dailyOpsBusinessDate'

type ContractFilter = 'all' | 'ft' | 'pt' | 'zzp'
type StatusPill = 'accepted' | 'pending' | 'denied' | 'registered'

const ALL_KINDS: DailyOpsStaffLeaveKind[] = ['vacation', 'leave', 'sick']
const ALL_STATUSES: StatusPill[] = ['accepted', 'pending', 'denied', 'registered']

const { calendar, year, pending, error, prevYear, nextYear, setYear } = useDailyOpsStaffLeaveCalendar()

type ViewMode = 'year' | 'month'
const viewMode = ref<ViewMode>('month')
/** 1–12 — default: current Amsterdam calendar month */
const focusMonth = ref((() => {
  const ymd = amsterdamOpenRegisterBusinessDateYmd()
  const m = Number(ymd.slice(5, 7))
  return Number.isFinite(m) && m >= 1 && m <= 12 ? m : new Date().getMonth() + 1
})())

const contractFilter = ref<ContractFilter>('all')
const kindOn = ref<DailyOpsStaffLeaveKind[]>([...ALL_KINDS])
const statusOn = ref<StatusPill[]>([...ALL_STATUSES])
const selectedSpan = ref<DailyOpsStaffLeaveSpanDto | null>(null)

const MONTH_LABELS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
] as const

const periodLabel = computed(() => {
  if (viewMode.value === 'year') return String(year.value)
  return `${MONTH_LABELS[focusMonth.value - 1]} ${year.value}`
})

function switchToMonthView () {
  viewMode.value = 'month'
  // Prefer current calendar month when entering month view for this year
  const now = new Date()
  if (year.value === now.getFullYear()) {
    focusMonth.value = now.getMonth() + 1
  }
}

function prevPeriod () {
  if (viewMode.value === 'year') {
    prevYear()
    return
  }
  if (focusMonth.value <= 1) {
    focusMonth.value = 12
    setYear(year.value - 1)
  } else {
    focusMonth.value -= 1
  }
}

function nextPeriod () {
  if (viewMode.value === 'year') {
    nextYear()
    return
  }
  if (focusMonth.value >= 12) {
    focusMonth.value = 1
    setYear(year.value + 1)
  } else {
    focusMonth.value += 1
  }
}

const gridTemplate = {
  gridTemplateColumns: '7.5rem repeat(31, minmax(0, 1fr))',
} as const

const contractFilters = computed(() => {
  const t = calendar.value?.totals
  return [
    { id: 'all' as const, label: 'All', count: t?.entry_count ?? null },
    { id: 'ft' as const, label: 'FT', count: t?.ft_count ?? null },
    { id: 'pt' as const, label: 'PT', count: t?.pt_count ?? null },
    { id: 'zzp' as const, label: 'ZZP', count: t?.zzp_count ?? null },
  ]
})

const kindFilterOptions = [
  {
    id: 'vacation' as const,
    label: 'Vacation',
    dotClass: 'bg-sky-600',
    activeClass: 'border-sky-600 bg-sky-600 text-white',
  },
  {
    id: 'leave' as const,
    label: 'Leave',
    dotClass: 'bg-amber-500',
    activeClass: 'border-amber-500 bg-amber-500 text-white',
  },
  {
    id: 'sick' as const,
    label: 'Sick',
    dotClass: 'bg-rose-500',
    activeClass: 'border-rose-500 bg-rose-500 text-white',
  },
]

const statusFilterOptions = [
  { id: 'accepted' as const, label: 'Accepted' },
  { id: 'pending' as const, label: 'Pending' },
  { id: 'denied' as const, label: 'Denied' },
  { id: 'registered' as const, label: 'Registered' },
]

function isKindOn (id: DailyOpsStaffLeaveKind): boolean {
  return kindOn.value.includes(id)
}

function toggleKind (id: DailyOpsStaffLeaveKind) {
  if (kindOn.value.includes(id)) {
    if (kindOn.value.length === 1) return
    kindOn.value = kindOn.value.filter((k) => k !== id)
  } else {
    kindOn.value = [...kindOn.value, id]
  }
}

function isStatusOn (id: StatusPill): boolean {
  return statusOn.value.includes(id)
}

function toggleStatus (id: StatusPill) {
  if (statusOn.value.includes(id)) {
    if (statusOn.value.length === 1) return
    statusOn.value = statusOn.value.filter((s) => s !== id)
  } else {
    statusOn.value = [...statusOn.value, id]
  }
}

function statusMatches (raw: string, allowed: StatusPill[]): boolean {
  const s = raw.toLowerCase()
  for (const a of allowed) {
    if (a === 'pending' && (s === 'pending' || s === 'requested')) return true
    if (a === 'accepted' && (s === 'accepted' || s === 'approved')) return true
    if (a === 'denied' && (s === 'denied' || s === 'rejected' || s === 'declined')) return true
    if (a === 'registered' && s === 'registered') return true
  }
  return false
}

function matchesSpan (s: DailyOpsStaffLeaveSpanDto): boolean {
  if (contractFilter.value !== 'all' && s.contractBucket !== contractFilter.value) return false
  if (!kindOn.value.includes(s.kind)) return false
  return statusMatches(s.status, statusOn.value)
}

type LaneBar = { span: DailyOpsStaffLeaveSpanDto; lane: number }

function packLanes (spans: DailyOpsStaffLeaveSpanDto[]): { bars: LaneBar[]; laneCount: number } {
  const sorted = [...spans].sort((a, b) => a.dayStart - b.dayStart || a.dayEnd - b.dayEnd)
  const laneEnds: number[] = []
  const bars: LaneBar[] = []
  for (const span of sorted) {
    let lane = laneEnds.findIndex((end) => end < span.dayStart)
    if (lane === -1) {
      lane = laneEnds.length
      laneEnds.push(span.dayEnd)
    } else {
      laneEnds[lane] = span.dayEnd
    }
    bars.push({ span, lane })
  }
  return { bars, laneCount: Math.max(1, laneEnds.length) }
}

type GanttRow = {
  month: string
  label: string
  daysInMonth: number
  bars: LaneBar[]
  laneCount: number
}

const ganttRows = computed((): GanttRow[] => {
  return (calendar.value?.months ?? []).map((m) => {
    const filtered = m.spans.filter(matchesSpan)
    const packed = packLanes(filtered)
    return {
      month: m.month,
      label: m.label,
      daysInMonth: m.daysInMonth,
      bars: packed.bars,
      laneCount: packed.laneCount,
    }
  })
})

const visibleGanttRows = computed((): GanttRow[] => {
  if (viewMode.value === 'year') return ganttRows.value
  const key = `${year.value}-${String(focusMonth.value).padStart(2, '0')}`
  return ganttRows.value.filter((r) => r.month === key)
})

const detailTitle = computed(() => {
  if (!selectedSpan.value) return 'Details'
  return `${selectedSpan.value.label}`
})

/** Tall bars so name + type + venue stay readable. */
const BAR_HEIGHT_PX = 44
const BAR_LANE_STEP = 50
const BAR_TOP_PAD = 10

function barStyle (bar: LaneBar, daysInMonth: number) {
  const start = Math.max(1, Math.min(bar.span.dayStart, daysInMonth))
  const end = Math.max(start, Math.min(bar.span.dayEnd, daysInMonth))
  const left = ((start - 1) / 31) * 100
  const width = ((end - start + 1) / 31) * 100
  return {
    left: `${left}%`,
    width: `calc(${width}% - 2px)`,
    top: `${BAR_TOP_PAD + bar.lane * BAR_LANE_STEP}px`,
    height: `${BAR_HEIGHT_PX}px`,
    lineHeight: `${BAR_HEIGHT_PX}px`,
  }
}

/** Days visible in this month row (clamped). */
function barDaySpan (bar: LaneBar, daysInMonth: number): number {
  const start = Math.max(1, Math.min(bar.span.dayStart, daysInMonth))
  const end = Math.max(start, Math.min(bar.span.dayEnd, daysInMonth))
  return end - start + 1
}

function shortLocationLabel (locationName: string): string {
  const n = locationName.trim().toLowerCase()
  if (!n) return ''
  if (n.includes('kinsbergen')) return 'VKB'
  if (n.includes('bar bea') || n.includes('barbea')) return 'Bea'
  if (n.includes('amour')) return 'LAT'
  const first = locationName.trim().split(/\s+/)[0] ?? ''
  return first.length > 10 ? `${first.slice(0, 9)}…` : first
}

/** Append venue short code when the bar is wide enough (≥7 days). */
function barLabel (bar: LaneBar, daysInMonth: number): string {
  const base = bar.span.label
  const loc = shortLocationLabel(bar.span.locationName ?? '')
  if (!loc) return base
  if (barDaySpan(bar, daysInMonth) < 7) return base
  if (base.toLowerCase().includes(loc.toLowerCase())) return base
  if (base.toLowerCase().includes((bar.span.locationName ?? '').trim().toLowerCase())) return base
  return `${base} · ${loc}`
}

function barColor (kind: DailyOpsStaffLeaveKind): string {
  if (kind === 'vacation') return 'bg-sky-600'
  if (kind === 'sick') return 'bg-rose-500'
  return 'bg-amber-500'
}

function barTitle (s: DailyOpsStaffLeaveSpanDto): string {
  return [
    s.userName,
    s.kind,
    s.status,
    `${s.startDate} → ${s.endDate}`,
    s.locationName,
    s.reason,
    s.contractBucket ? s.contractBucket.toUpperCase() : null,
  ].filter(Boolean).join(' · ')
}

function selectSpan (span: DailyOpsStaffLeaveSpanDto) {
  selectedSpan.value = span
}

function fmtHours (n: number): string {
  return `${n.toFixed(n % 1 === 0 ? 0 : 1)}h`
}

function kindBadgeClass (kind: DailyOpsStaffLeaveKind): string {
  if (kind === 'vacation') return 'bg-sky-100 text-sky-800'
  if (kind === 'sick') return 'bg-rose-100 text-rose-800'
  return 'bg-amber-100 text-amber-800'
}

function statusBadgeClass (status: string): string {
  const s = status.toLowerCase()
  if (s === 'approved' || s === 'accepted') return 'bg-emerald-100 text-emerald-800'
  if (s === 'pending' || s === 'requested') return 'bg-yellow-100 text-yellow-900'
  if (s === 'rejected' || s === 'declined' || s === 'denied') return 'bg-red-100 text-red-800'
  if (s === 'registered') return 'bg-gray-100 text-gray-700'
  return 'bg-gray-100 text-gray-700'
}

watch(year, () => {
  selectedSpan.value = null
})
</script>

<style scoped>
.grid-cols-31 {
  grid-template-columns: repeat(31, minmax(0, 1fr));
}
</style>
