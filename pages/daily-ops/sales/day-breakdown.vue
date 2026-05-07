<script setup lang="ts">
import { ref, computed } from 'vue'

const runtime = useRuntimeConfig()

type DetailView = 'summary' | 'hourly' | 'worker' | 'table' | 'product'

type BorkAggRow = {
  _id?: unknown
  date?: string
  hour?: number
  business_date?: string
  business_hour?: number
  locationName?: string
  total_revenue?: number
  total_quantity?: number
  workerId?: string
  workerName?: string
  tableNumber?: string | number
  productName?: string
  products?: unknown
  /** bork_sales_by_guest_account */
  accountName?: string
}

/** Align quick picks + default with Bork `business_date` (register opens 08:00 Amsterdam). */
const AMSTERDAM_TZ = 'Europe/Amsterdam'

function calendarYmdInAmsterdam(d: Date): string {
  const p = new Intl.DateTimeFormat('en-CA', {
    timeZone: AMSTERDAM_TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(d)
  const g = (t: string) => p.find((x) => x.type === t)?.value ?? ''
  return `${g('year')}-${g('month')}-${g('day')}`
}

function hourInAmsterdam(d: Date): number {
  const p = new Intl.DateTimeFormat('en-GB', {
    timeZone: AMSTERDAM_TZ,
    hour: '2-digit',
    hour12: false,
  }).formatToParts(d)
  return parseInt(p.find((x) => x.type === 'hour')?.value ?? '0', 10)
}

function addCalendarDaysYmd(ymd: string, delta: number): string {
  const parts = ymd.split('-').map((x) => Number(x))
  const y = parts[0] ?? 0
  const m = parts[1] ?? 1
  const d = parts[2] ?? 1
  const dt = new Date(Date.UTC(y, m - 1, d + delta))
  const yy = dt.getUTCFullYear()
  const mm = String(dt.getUTCMonth() + 1).padStart(2, '0')
  const dd = String(dt.getUTCDate()).padStart(2, '0')
  return `${yy}-${mm}-${dd}`
}

/** `business_date` for the register day that is “open” at instant `d` (before 08:00 Amsterdam = previous calendar day). */
function registerBusinessDateForInstant(d: Date): string {
  const cal = calendarYmdInAmsterdam(d)
  if (hourInAmsterdam(d) < 8) return addCalendarDaysYmd(cal, -1)
  return cal
}

function weekdayLongForBusinessYmd(ymd: string): string {
  const parts = ymd.split('-').map((x) => Number(x))
  const y = parts[0] ?? 0
  const m = parts[1] ?? 1
  const d = parts[2] ?? 1
  const ref = new Date(Date.UTC(y, m - 1, d, 12, 0, 0))
  return new Intl.DateTimeFormat('en-GB', { timeZone: AMSTERDAM_TZ, weekday: 'long' }).format(ref)
}

/** Last completed register day (typical “yesterday” for ops). */
function defaultSelectedBusinessDate(): string {
  return addCalendarDaysYmd(registerBusinessDateForInstant(new Date()), -1)
}

const selectedDate = ref<string>(defaultSelectedBusinessDate())
const detailView = ref<DetailView>('summary')
const selectedLocation = ref<'all' | string>('all')

/** Bork `Price×Qty` is incl. VAT; Z report is often ex-VAT (mixed rates -> tune %). */
const revenueBasis = ref<'incl' | 'ex'>('incl')
const exVatPercentInput = ref('')
const exVatPercentApplied = ref('')

const defaultVatPercent = computed(() => {
  const raw = (runtime.public as Record<string, unknown>).borkDisplayExVatPercent
  const p = typeof raw === 'string' || typeof raw === 'number' ? Number(raw) : Number.NaN
  return Number.isFinite(p) && p >= 0 ? p : 21
})

const effectiveVatPercent = computed(() => {
  const o = exVatPercentApplied.value.trim()
  if (o !== '' && Number.isFinite(Number(o)) && Number(o) >= 0) return Number(o)
  return defaultVatPercent.value
})

const applyVatPercent = () => {
  exVatPercentApplied.value = exVatPercentInput.value.trim()
}

/** 1 = incl; ex = ÷(1+p/100). */
const revenueScale = computed(() => {
  if (revenueBasis.value === 'incl') return 1
  const p = effectiveVatPercent.value
  if (p <= 0) return 1
  return 100 / (100 + p)
})

const scaleRev = (n: number | null | undefined) => (n ?? 0) * revenueScale.value

const showLocationColumn = computed(() => selectedLocation.value === 'all')

// Location options (from unified_location_mapping)
const locations = ['all', 'Bar Bea', 'Van Kinsbergen', 'l\'Amour Toujours']

// Last 7 register business days (i=0 = today’s open register day; before 08:00 that is still “yesterday”)
const last7Days = computed(() => {
  const registerToday = registerBusinessDateForInstant(new Date())
  const days: { date: string; label: string; dayName: string }[] = []
  for (let i = 0; i < 7; i++) {
    const dateStr = addCalendarDaysYmd(registerToday, -i)
    const label = i === 0 ? 'Today' : i === 1 ? 'Yesterday' : `${i}d ago`
    days.push({ date: dateStr, label, dayName: weekdayLongForBusinessYmd(dateStr) })
  }
  return days
})

/** Plain-text window for the selected `business_date` (matches rebuild 08:00 rule). */
const registerDayPeriodLabel = computed(() => {
  const d = selectedDate.value
  const next = addCalendarDaysYmd(d, 1)
  return `${d} 08:00 → ${next} 07:59 · ${AMSTERDAM_TZ}`
})

// Fetch aggregation data for this day
const { data: dayData, pending, error, refresh } = await useFetch('/api/bork/v2/day-breakdown', {
  query: computed(() => ({
    date: selectedDate.value,
    location: selectedLocation.value,
  })),
})

// Summary metrics
const summary = computed(() => {
  if (!dayData.value?.hourly) return null
  
  return {
    totalRevenue: dayData.value.hourly.reduce((sum: number, h: any) => sum + (h.total_revenue || 0), 0),
    totalQuantity: dayData.value.hourly.reduce((sum: number, h: any) => sum + (h.total_quantity || 0), 0),
    workerCount: new Set(dayData.value.worker?.map((w: any) => w.workerId)).size || 0,
    tableCount: new Set(dayData.value.table?.map((t: any) => t.tableNumber)).size || 0,
    productCount: dayData.value.product?.length || 0,
  }
})

/** Missing BH sorts after 23 so BH0…BH23 come first. */
const bhOrder = (bh: number | undefined) =>
  bh === undefined || bh === null || Number.isNaN(bh) ? 1000 : bh

/** BH 0→23 first (same BH across register days groups by `business_date`), then location / wall time. */
const compareByBusinessDayTimeline = (a: BorkAggRow, b: BorkAggRow): number => {
  const bh = bhOrder(a.business_hour) - bhOrder(b.business_hour)
  if (bh !== 0) return bh
  const bd = String(a.business_date ?? '').localeCompare(String(b.business_date ?? ''))
  if (bd !== 0) return bd
  const loc = String(a.locationName ?? '').localeCompare(String(b.locationName ?? ''))
  if (loc !== 0) return loc
  const ds = String(a.date ?? '').localeCompare(String(b.date ?? ''))
  if (ds !== 0) return ds
  return (a.hour ?? -1) - (b.hour ?? -1)
}

const sortedHourly = computed((): BorkAggRow[] => {
  const rows = (dayData.value?.hourly ?? []) as BorkAggRow[]
  return [...rows].sort(compareByBusinessDayTimeline)
})

const sortedWorkers = computed((): BorkAggRow[] => {
  const rows = (dayData.value?.worker ?? []) as BorkAggRow[]
  return [...rows].sort((a, b) => {
    const t = compareByBusinessDayTimeline(a, b)
    if (t !== 0) return t
    return String(a.workerName ?? '').localeCompare(String(b.workerName ?? ''))
  })
})

const sortedTables = computed((): BorkAggRow[] => {
  const rows = (dayData.value?.table ?? []) as BorkAggRow[]
  return [...rows].sort((a, b) => {
    const t = compareByBusinessDayTimeline(a, b)
    if (t !== 0) return t
    return String(a.tableNumber ?? '').localeCompare(String(b.tableNumber ?? ''), undefined, { numeric: true })
  })
})

const sortedGuest = computed((): BorkAggRow[] => {
  const rows = (dayData.value?.guest ?? []) as BorkAggRow[]
  return [...rows].sort((a, b) => {
    const t = compareByBusinessDayTimeline(a, b)
    if (t !== 0) return t
    return String(a.accountName ?? '').localeCompare(String(b.accountName ?? ''))
  })
})

/** Guest / bar / no TableNr — same lines as hourly but excluded from bork_sales_by_table. */
const mergedTableGuestRows = computed(() => [...sortedGuest.value, ...sortedTables.value])

const sortedProducts = computed((): BorkAggRow[] => {
  const rows = (dayData.value?.product ?? []) as BorkAggRow[]
  return [...rows].sort((a, b) => {
    const t = compareByBusinessDayTimeline(a, b)
    if (t !== 0) return t
    return String(a.productName ?? '').localeCompare(String(b.productName ?? ''))
  })
})

/** Roll up hourly rows by unified location (for summary tile). */
const locationRollup = computed(() => {
  const rows = sortedHourly.value
  const map = new Map<string, { revenue: number; qty: number }>()
  for (const h of rows) {
    const loc = h.locationName || '—'
    const cur = map.get(loc) ?? { revenue: 0, qty: 0 }
    cur.revenue += h.total_revenue ?? 0
    cur.qty += h.total_quantity ?? 0
    map.set(loc, cur)
  }
  return [...map.entries()]
    .map(([locationName, t]) => ({ locationName, ...t }))
    .sort((a, b) => b.revenue - a.revenue)
})

const nearlyEqualEur = (a: number, b: number) => Math.abs(a - b) < 0.02

// Verification checks
const verification = computed(() => {
  if (!dayData.value?.hourly) return null

  const hourlyTotal = dayData.value.hourly.reduce((sum: number, h: BorkAggRow) => sum + (h.total_revenue ?? 0), 0)
  const workerTotal = dayData.value.worker?.reduce((sum: number, w: BorkAggRow) => sum + (w.total_revenue ?? 0), 0) ?? 0
  const tableTotal = dayData.value.table?.reduce((sum: number, t: BorkAggRow) => sum + (t.total_revenue ?? 0), 0) ?? 0
  const guestTotal = dayData.value.guest?.reduce((sum: number, g: BorkAggRow) => sum + (g.total_revenue ?? 0), 0) ?? 0
  const tablePlusGuestTotal = tableTotal + guestTotal
  const productTotal = dayData.value.product?.reduce((sum: number, p: BorkAggRow) => sum + (p.total_revenue ?? 0), 0) ?? 0

  const disc: { name: string; match: boolean; diff: number }[] = [
    { name: 'Hourly vs Worker', match: nearlyEqualEur(hourlyTotal, workerTotal), diff: Math.abs(hourlyTotal - workerTotal) },
    {
      name: 'Hourly vs seated + direct (TableNr + no table)',
      match: nearlyEqualEur(hourlyTotal, tablePlusGuestTotal),
      diff: Math.abs(hourlyTotal - tablePlusGuestTotal),
    },
  ]
  if (productTotal > 0.01) {
    disc.push({
      name: 'Hourly vs Product (catalog)',
      match: nearlyEqualEur(hourlyTotal, productTotal),
      diff: Math.abs(hourlyTotal - productTotal),
    })
  }

  const allMatch =
    nearlyEqualEur(hourlyTotal, workerTotal) &&
    nearlyEqualEur(hourlyTotal, tablePlusGuestTotal) &&
    (productTotal <= 0.01 || nearlyEqualEur(hourlyTotal, productTotal))

  return {
    hourlyTotal,
    workerTotal,
    tableTotal,
    guestTotal,
    tablePlusGuestTotal,
    productTotal,
    allMatch,
    discrepancies: disc,
  }
})

const formatEur = (value: number | null | undefined) => {
  if (value === null || value === undefined) return '—'
  return new Intl.NumberFormat('nl-NL', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 2,
  }).format(value)
}

/** Revenue for display (incl. or estimated ex-VAT). */
const formatRev = (value: number | null | undefined) => formatEur(scaleRev(value))

/**
 * Clock in parens from ticket `date`+`hour` when present (matches ISO column).
 * Synthetic padded rows use 08:00-register slot math only.
 */
const formatBusinessHourLabelFromRow = (row: BorkAggRow) => {
  const bh = row.business_hour
  if (bh === undefined || bh === null || Number.isNaN(bh)) return '—'
  if (row.date != null && row.hour !== undefined && row.hour !== null) {
    return `BH ${bh} (${String(row.hour).padStart(2, '0')}:00)`
  }
  const start = (bh + 8) % 24
  return `BH ${bh} (${String(start).padStart(2, '0')}:00)`
}

const tableOrGuestLabel = (row: BorkAggRow) =>
  row.accountName != null && String(row.accountName).trim() !== ''
    ? `Direct: ${row.accountName}`
    : String(row.tableNumber ?? '—')

const formatIsoHourLabel = (dateStr: string | undefined, hour: number | undefined) => {
  if (!dateStr || hour === undefined || hour === null) return '—'
  return `${dateStr} ${String(hour).padStart(2, '0')}:00`
}

const formatAvgPerItem = (revenue?: number | null, qty?: number | null) => {
  const q = qty ?? 0
  if (q <= 0) return formatEur(0)
  return formatEur(scaleRev(revenue) / q)
}

const rowKey = (row: BorkAggRow, idx: number) => String(row._id ?? `${row.date}-${row.hour}-${row.locationName}-${idx}`)

const recordKeysCount = (value: unknown) =>
  value !== null && typeof value === 'object' ? Object.keys(value as Record<string, unknown>).length : 0
</script>

<template>
  <div class="space-y-6">
    <!-- Header -->
    <div>
      <h1 class="text-3xl font-bold text-gray-900">Day Breakdown</h1>
      <p class="text-gray-500">
        Reads V2 aggregates (<code class="text-xs">bork_sales_by_hour</code> + suffix from env, same as sales dashboards). Bork lines are
        <strong>incl. VAT</strong> (<code class="text-xs">Price×Qty</code>). Your Z (ex-VAT) needs a VAT split; use
        <strong>Ex-VAT</strong> below (default 21%, or set a % that matches your Z - e.g. mixed 9/21 gives an effective %).
        Seated tables exclude orders without <code class="text-xs">TableNr</code>; those show as <strong>direct / guest</strong>.
        For <strong>completed</strong> register days, Basis Report totals from inbox are compared to hourly API revenue below.
      </p>
    </div>

    <!-- Error State -->
    <UCard v-if="error" class="border-red-200">
      <p class="text-red-600"><strong>Error:</strong> {{ error }}</p>
    </UCard>

    <UAlert
      v-if="!pending && dayData?.dataHealth?.emptyAggregatesMessage"
      color="warning"
      variant="subtle"
      class="border border-amber-200"
      title="No hourly aggregate rows for this business date"
      :description="dayData.dataHealth.emptyAggregatesMessage"
    />
    <UAlert
      v-if="!pending && dayData?.dataHealth?.fallbackNotice"
      color="info"
      variant="subtle"
      title="Read from alternate aggregate suffix"
      :description="dayData.dataHealth.fallbackNotice"
    />

    <!-- Filters -->
    <UCard>
      <template #header>
        <h2 class="font-semibold">Filters</h2>
      </template>
      <div class="space-y-4">
        <div class="grid gap-4 md:grid-cols-2">
          <div class="space-y-2">
            <label class="text-sm font-medium">Business Day Period</label>
            <p class="text-sm text-gray-600 pt-2">
              {{ registerDayPeriodLabel }}
            </p>
          </div>
        </div>
        <div class="flex flex-wrap items-end gap-3 border-t border-gray-100 pt-4">
          <div class="space-y-1">
            <span class="text-sm font-medium">Revenue Display</span>
            <div class="flex gap-2" role="group" aria-label="Revenue display mode">
              <UButton
                size="sm"
                :variant="revenueBasis === 'incl' ? 'solid' : 'outline'"
                @click="revenueBasis = 'incl'"
              >
                Including VAT
              </UButton>
              <UButton
                size="sm"
                :variant="revenueBasis === 'ex' ? 'solid' : 'outline'"
                @click="revenueBasis = 'ex'"
              >
                Excluding VAT (estimate)
              </UButton>
            </div>
          </div>
          <div v-if="revenueBasis === 'ex'" class="flex flex-wrap items-end gap-2">
            <div class="flex flex-col gap-1">
              <label class="text-xs font-medium text-gray-600">VAT % (empty = {{ defaultVatPercent }}% from env)</label>
              <UInput
                v-model="exVatPercentInput"
                type="number"
                placeholder="21"
                size="sm"
                class="w-24"
                min="0"
                step="0.01"
                @keyup.enter="applyVatPercent"
              />
            </div>
            <UButton size="sm" variant="outline" @click="applyVatPercent">Apply</UButton>
          </div>
          <p v-if="revenueBasis === 'ex'" class="text-xs text-gray-500 max-w-md pb-1">
            Formula: incl / (1 + VAT% / 100). For EUR 17,855 -> EUR 15,763, effective is about <strong>13.2%</strong>.
            Enter <code class="text-xs">13.2</code> and click Apply.
          </p>
        </div>
      </div>
    </UCard>

    <!-- Loading State -->
    <div v-if="pending" class="grid gap-4 md:grid-cols-5">
      <USkeleton v-for="i in 5" :key="i" class="h-24 w-full rounded-lg" />
    </div>

    <!-- Content -->
      <template v-else-if="summary && verification">
        <!-- Location Filter Buttons -->
        <div class="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
          <UButton
            v-for="loc in locations"
            :key="loc"
            class="border-2 border-gray-900 !bg-white !text-gray-900 h-full transition-all"
            :class="selectedLocation === loc ? 'ring-2 ring-blue-500 shadow-md' : 'hover:shadow-md'"
            @click="selectedLocation = loc; refresh()"
          >
            {{ loc === 'all' ? 'All Locations' : loc }}
          </UButton>
        </div>

        <!-- Day Selection -->
        <div class="flex gap-2 flex-wrap items-center">
          <!-- Last 7 Days Buttons -->
          <UButton
            v-for="(day, idx) in last7Days"
            :key="idx"
            class="border-2 border-gray-900 !bg-white !text-gray-900 transition-all flex flex-col items-center justify-center"
            :class="selectedDate === day.date ? 'ring-2 ring-blue-500 shadow-md' : 'hover:shadow-md'"
            size="sm"
            @click="selectedDate = day.date; refresh()"
          >
            <span>{{ day.label }}</span>
            <span class="text-xs text-gray-500 mt-0.5">{{ day.dayName }}</span>
            <span class="text-xs text-gray-400">{{ day.date }}</span>
          </UButton>
          
          <!-- Date Picker -->
          <div class="flex gap-2 items-center">
            <span class="text-sm text-gray-600">or</span>
            <UInput
              v-model="selectedDate"
              type="date"
              size="sm"
              class="w-40"
              @update:model-value="() => void refresh()"
            />
          </div>
        </div>

        <!-- Summary Cards (Clickable) -->
      <div class="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
        <!-- Total Revenue → summary table (not hourly detail) -->
        <UCard
          class="cursor-pointer border-2 border-gray-900 !bg-white ring-0 shadow-none transition-all hover:shadow-lg"
          :class="detailView === 'summary' ? 'ring-2 ring-blue-500' : ''"
          @click="detailView = 'summary'"
        >
          <template #header>
            <span class="text-sm font-medium">Total Revenue</span>
          </template>
          <p class="text-2xl font-bold text-gray-900">{{ formatRev(summary.totalRevenue) }}</p>
          <p class="mt-1 text-xs text-gray-500">{{ summary.totalQuantity }} items</p>
        </UCard>

        <!-- Revenue per Hour -->
        <UCard
          class="cursor-pointer border-2 border-gray-900 !bg-white ring-0 shadow-none transition-all hover:shadow-lg"
          :class="detailView === 'hourly' ? 'ring-2 ring-blue-500' : ''"
          @click="detailView = 'hourly'"
        >
          <template #header>
            <span class="text-sm font-medium">Hourly</span>
          </template>
          <p class="text-2xl font-bold text-gray-900">{{ formatRev(verification.hourlyTotal) }}</p>
          <p class="mt-1 text-xs" :class="verification.hourlyTotal === summary.totalRevenue ? 'text-green-600' : 'text-red-600'">
            {{ verification.hourlyTotal === summary.totalRevenue ? '✓ Matches' : '✗ Mismatch' }}
          </p>
        </UCard>

        <!-- Revenue per Worker -->
        <UCard
          class="cursor-pointer border-2 border-gray-900 !bg-white ring-0 shadow-none transition-all hover:shadow-lg"
          :class="detailView === 'worker' ? 'ring-2 ring-blue-500' : ''"
          @click="detailView = 'worker'"
        >
          <template #header>
            <span class="text-sm font-medium">Workers</span>
          </template>
          <p class="text-2xl font-bold text-gray-900">{{ formatRev(verification.workerTotal) }}</p>
          <p class="mt-1 text-xs text-gray-600">{{ summary.workerCount }} workers</p>
        </UCard>

        <!-- Revenue per Table -->
        <UCard
          class="cursor-pointer border-2 border-gray-900 !bg-white ring-0 shadow-none transition-all hover:shadow-lg"
          :class="detailView === 'table' ? 'ring-2 ring-blue-500' : ''"
          @click="detailView = 'table'"
        >
          <template #header>
            <span class="text-sm font-medium">Tables + direct</span>
          </template>
          <p class="text-2xl font-bold text-gray-900">{{ formatRev(verification.tablePlusGuestTotal) }}</p>
          <p class="mt-1 text-xs text-gray-600">
            {{ summary.tableCount }} tables · {{ (dayData?.guest ?? []).length }} direct rows
          </p>
        </UCard>

        <!-- Revenue per Product -->
        <UCard
          class="cursor-pointer border-2 border-gray-900 !bg-white ring-0 shadow-none transition-all hover:shadow-lg"
          :class="detailView === 'product' ? 'ring-2 ring-blue-500' : ''"
          @click="detailView = 'product'"
        >
          <template #header>
            <span class="text-sm font-medium">Products</span>
          </template>
          <p class="text-2xl font-bold text-gray-900">{{ formatRev(verification.productTotal) }}</p>
          <p class="mt-1 text-xs text-gray-600">{{ summary.productCount }} products</p>
        </UCard>
      </div>

      <!-- Verification Status -->
      <UCard class="border-2 border-gray-900 !bg-white ring-0 shadow-none">
        <template #header>
          <h2 class="text-lg font-semibold text-gray-900">
            Verification
            <span :class="verification.allMatch ? 'text-green-600' : 'text-red-600'">
              {{ verification.allMatch ? '✓ All Match' : '✗ Discrepancies Found' }}
            </span>
          </h2>
        </template>
        <div class="space-y-2">
          <div
            v-for="check in verification.discrepancies"
            :key="check.name"
            class="flex items-center justify-between rounded-lg bg-gray-50 p-3"
          >
            <span class="text-sm font-medium text-gray-700">{{ check.name }}</span>
            <span
              :class="check.match ? 'text-green-600 font-semibold' : 'text-red-600 font-semibold'"
            >
              {{ check.match ? '✓ Match' : `✗ Diff: ${formatRev(check.diff)}` }}
            </span>
          </div>
        </div>
        <p class="mt-3 text-xs text-gray-600">
          Seated subtotal {{ formatRev(verification.tableTotal) }} + direct (no table)
          {{ formatRev(verification.guestTotal) }} = {{ formatRev(verification.tablePlusGuestTotal) }}
        </p>
      </UCard>

      <!-- Basis Report (inbox) vs API — completed register days only -->
      <UCard
        v-if="dayData?.basisReference"
        class="border-2 border-gray-900 !bg-white ring-0 shadow-none"
      >
        <template #header>
          <h2 class="text-lg font-semibold text-gray-900">
            Basis Report vs API (incl. VAT)
          </h2>
        </template>
        <div v-if="!dayData.basisReference.eligible" class="text-sm text-gray-600">
          {{ dayData.basisReference.reason }}
        </div>
        <div v-else class="space-y-3">
          <p class="text-xs text-gray-600">
            {{ dayData.basisReference.basisSource }}. One row per venue (latest batch per location). API column is Σ hourly
            <code class="text-xs">total_revenue</code> for this business day (matches your summary cards).
            <span v-if="dayData.collectionSuffix != null" class="block mt-1">
              Aggregate suffix: <code class="text-xs">{{ dayData.collectionSuffix || '(none)' }}</code>
            </span>
          </p>
          <p v-if="dayData.basisReference.note" class="text-sm text-amber-800 bg-amber-50 rounded-lg px-3 py-2">
            {{ dayData.basisReference.note }}
          </p>
          <div
            v-if="dayData.basisReference.rows?.length"
            class="flex items-center gap-2 text-sm font-medium"
            :class="dayData.basisReference.overallMatch ? 'text-green-700' : 'text-red-700'"
          >
            {{ dayData.basisReference.overallMatch ? '✓ Basis totals align with API' : '✗ Mismatch — review rows or rebuild window' }}
            <span class="text-gray-600 font-normal">
              (Σ Basis {{ formatEur(dayData.basisReference.basisGrandTotal) }} · Σ API
              {{ formatEur(dayData.basisReference.apiGrandTotal) }})
            </span>
          </div>
          <div v-if="dayData.basisReference.rows?.length" class="overflow-x-auto">
            <table class="w-full text-sm">
              <thead class="border-b border-gray-200 bg-gray-50">
                <tr>
                  <th class="px-3 py-2 text-left font-medium text-gray-700">Basis (inbox)</th>
                  <th class="px-3 py-2 text-left font-medium text-gray-700">API location</th>
                  <th class="px-3 py-2 text-right font-medium text-gray-700">Basis</th>
                  <th class="px-3 py-2 text-right font-medium text-gray-700">API Σ hourly</th>
                  <th class="px-3 py-2 text-right font-medium text-gray-700">Δ</th>
                  <th class="px-3 py-2 text-right font-medium text-gray-700">OK</th>
                </tr>
              </thead>
              <tbody>
                <tr
                  v-for="(br, idx) in dayData.basisReference.rows"
                  :key="'br-' + idx"
                  class="border-b border-gray-100 hover:bg-gray-50"
                >
                  <td class="px-3 py-2 text-gray-900">{{ br.basisLocationLabel }}</td>
                  <td class="px-3 py-2 text-gray-700">{{ br.matchedApiLocation ?? '—' }}</td>
                  <td class="px-3 py-2 text-right">{{ br.basisInclVat != null ? formatEur(br.basisInclVat) : '—' }}</td>
                  <td class="px-3 py-2 text-right">{{ br.apiInclVat != null ? formatEur(br.apiInclVat) : '—' }}</td>
                  <td class="px-3 py-2 text-right">{{ formatEur(br.diff) }}</td>
                  <td class="px-3 py-2 text-right" :class="br.match ? 'text-green-600 font-semibold' : 'text-red-600 font-semibold'">
                    {{ br.match ? '✓' : '✗' }}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
          <p v-else-if="dayData.basisReference.eligible && !dayData.basisReference.note" class="text-sm text-gray-500">
            No comparison rows — no overlapping basis and API locations for this filter.
          </p>
        </div>
      </UCard>

      <!-- Detail Table -->
      <UCard class="border-2 border-gray-900 !bg-white ring-0 shadow-none">
        <template #header>
          <h2 class="text-lg font-semibold text-gray-900">
            {{
              detailView === 'summary'
                ? 'Summary by location'
                : detailView === 'hourly'
                  ? 'Hourly breakdown'
                  : detailView === 'worker'
                    ? 'Worker breakdown'
                    : detailView === 'table'
                      ? 'Direct + seated tables'
                      : 'Product breakdown'
            }}
          </h2>
        </template>

        <!-- Summary: revenue rolled up from hourly rows -->
        <div v-if="detailView === 'summary'" class="overflow-x-auto">
          <table class="w-full text-sm">
            <thead class="border-b border-gray-200 bg-gray-50">
              <tr>
                <th class="px-4 py-2 text-left font-medium text-gray-700">Location</th>
                <th class="px-4 py-2 text-right font-medium text-gray-700">Revenue</th>
                <th class="px-4 py-2 text-right font-medium text-gray-700">Quantity</th>
                <th class="px-4 py-2 text-right font-medium text-gray-700">Avg / item</th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="(loc, idx) in locationRollup"
                :key="loc.locationName + String(idx)"
                class="border-b border-gray-100 hover:bg-gray-50"
              >
                <td class="px-4 py-2 text-gray-900 font-medium">{{ loc.locationName }}</td>
                <td class="px-4 py-2 text-right font-semibold text-gray-900">{{ formatRev(loc.revenue) }}</td>
                <td class="px-4 py-2 text-right text-gray-600">{{ loc.qty }}</td>
                <td class="px-4 py-2 text-right text-gray-600">{{ formatAvgPerItem(loc.revenue, loc.qty) }}</td>
              </tr>
              <tr v-if="locationRollup.length === 0" class="border-b border-gray-100">
                <td colspan="4" class="px-4 py-4 text-center text-gray-500">No hourly rows for this filter.</td>
              </tr>
              <tr v-else class="border-t-2 border-gray-300 bg-gray-50 font-semibold">
                <td class="px-4 py-2 text-gray-900">Total</td>
                <td class="px-4 py-2 text-right text-gray-900">{{ formatRev(summary?.totalRevenue ?? 0) }}</td>
                <td class="px-4 py-2 text-right text-gray-900">{{ summary?.totalQuantity ?? 0 }}</td>
                <td class="px-4 py-2 text-right text-gray-900">{{ formatAvgPerItem(summary?.totalRevenue, summary?.totalQuantity) }}</td>
              </tr>
            </tbody>
          </table>
        </div>

        <!-- Hourly Table -->
        <div v-if="detailView === 'hourly'" class="overflow-x-auto">
          <table class="w-full text-sm">
            <thead class="border-b border-gray-200 bg-gray-50">
              <tr>
                <th class="px-3 py-2 text-left font-medium text-gray-700">Business hour</th>
                <th class="px-3 py-2 text-left font-medium text-gray-700">ISO hour</th>
                <th class="px-3 py-2 text-left font-medium text-gray-700">Location</th>
                <th class="px-3 py-2 text-right font-medium text-gray-700">Revenue</th>
                <th class="px-3 py-2 text-right font-medium text-gray-700">Qty</th>
                <th class="px-3 py-2 text-right font-medium text-gray-700">Avg / item</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="(hour, idx) in sortedHourly" :key="rowKey(hour, idx)" class="border-b border-gray-100 hover:bg-gray-50">
                <td class="px-3 py-2 text-gray-900">{{ formatBusinessHourLabelFromRow(hour) }}</td>
                <td class="px-3 py-2 text-gray-800">{{ formatIsoHourLabel(hour.date, hour.hour) }}</td>
                <td class="px-3 py-2 text-gray-800">{{ hour.locationName ?? '—' }}</td>
                <td class="px-3 py-2 text-right font-semibold text-gray-900">{{ formatRev(hour.total_revenue) }}</td>
                <td class="px-3 py-2 text-right text-gray-600">{{ hour.total_quantity ?? 0 }}</td>
                <td class="px-3 py-2 text-right text-gray-600">{{ formatAvgPerItem(hour.total_revenue, hour.total_quantity) }}</td>
              </tr>
            </tbody>
          </table>
        </div>

        <!-- Worker Table -->
        <div v-if="detailView === 'worker'" class="overflow-x-auto">
          <table class="w-full text-sm">
            <thead class="border-b border-gray-200 bg-gray-50">
              <tr>
                <th v-if="showLocationColumn" class="px-3 py-2 text-left font-medium text-gray-700">Location</th>
                <th class="px-3 py-2 text-left font-medium text-gray-700">Ticket date</th>
                <th class="px-3 py-2 text-left font-medium text-gray-700">Business hour</th>
                <th class="px-3 py-2 text-left font-medium text-gray-700">ISO hour</th>
                <th class="px-3 py-2 text-left font-medium text-gray-700">Worker</th>
                <th class="px-3 py-2 text-right font-medium text-gray-700">Revenue</th>
                <th class="px-3 py-2 text-right font-medium text-gray-700">Items</th>
                <th class="px-3 py-2 text-right font-medium text-gray-700">Avg / item</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="(worker, idx) in sortedWorkers" :key="rowKey(worker, idx)" class="border-b border-gray-100 hover:bg-gray-50">
                <td v-if="showLocationColumn" class="px-3 py-2 text-gray-800">{{ worker.locationName ?? '—' }}</td>
                <td class="px-3 py-2 text-gray-600">{{ worker.date ?? '—' }}</td>
                <td class="px-3 py-2 text-gray-900">{{ formatBusinessHourLabelFromRow(worker) }}</td>
                <td class="px-3 py-2 text-gray-800">{{ formatIsoHourLabel(worker.date, worker.hour) }}</td>
                <td class="px-3 py-2 text-gray-900">{{ worker.workerName ?? '—' }}</td>
                <td class="px-3 py-2 text-right font-semibold text-gray-900">{{ formatRev(worker.total_revenue) }}</td>
                <td class="px-3 py-2 text-right text-gray-600">{{ worker.total_quantity ?? 0 }}</td>
                <td class="px-3 py-2 text-right text-gray-600">{{ formatAvgPerItem(worker.total_revenue, worker.total_quantity) }}</td>
              </tr>
            </tbody>
          </table>
        </div>

        <!-- Table Revenue -->
        <div v-if="detailView === 'table'" class="overflow-x-auto">
          <table class="w-full text-sm">
            <thead class="border-b border-gray-200 bg-gray-50">
              <tr>
                <th v-if="showLocationColumn" class="px-3 py-2 text-left font-medium text-gray-700">Location</th>
                <th class="px-3 py-2 text-left font-medium text-gray-700">Ticket date</th>
                <th class="px-3 py-2 text-left font-medium text-gray-700">Business hour</th>
                <th class="px-3 py-2 text-left font-medium text-gray-700">ISO hour</th>
                <th class="px-3 py-2 text-left font-medium text-gray-700">Table / direct</th>
                <th class="px-3 py-2 text-right font-medium text-gray-700">Revenue</th>
                <th class="px-3 py-2 text-right font-medium text-gray-700">Items</th>
                <th class="px-3 py-2 text-left font-medium text-gray-700">Products</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="(row, idx) in mergedTableGuestRows" :key="rowKey(row, idx)" class="border-b border-gray-100 hover:bg-gray-50">
                <td v-if="showLocationColumn" class="px-3 py-2 text-gray-800">{{ row.locationName ?? '—' }}</td>
                <td class="px-3 py-2 text-gray-600">{{ row.date ?? '—' }}</td>
                <td class="px-3 py-2 text-gray-900">{{ formatBusinessHourLabelFromRow(row) }}</td>
                <td class="px-3 py-2 text-gray-800">{{ formatIsoHourLabel(row.date, row.hour) }}</td>
                <td class="px-3 py-2 text-gray-900 font-semibold">{{ tableOrGuestLabel(row) }}</td>
                <td class="px-3 py-2 text-right font-semibold text-gray-900">{{ formatRev(row.total_revenue) }}</td>
                <td class="px-3 py-2 text-right text-gray-600">{{ row.total_quantity ?? 0 }}</td>
                <td class="px-3 py-2 text-gray-600 text-xs">{{ recordKeysCount(row.products) }} lines</td>
              </tr>
            </tbody>
          </table>
        </div>

        <!-- Product Table -->
        <div v-if="detailView === 'product'" class="overflow-x-auto">
          <table class="w-full text-sm">
            <thead class="border-b border-gray-200 bg-gray-50">
              <tr>
                <th v-if="showLocationColumn" class="px-3 py-2 text-left font-medium text-gray-700">Location</th>
                <th class="px-3 py-2 text-left font-medium text-gray-700">Ticket date</th>
                <th class="px-3 py-2 text-left font-medium text-gray-700">Business hour</th>
                <th class="px-3 py-2 text-left font-medium text-gray-700">ISO hour</th>
                <th class="px-3 py-2 text-left font-medium text-gray-700">Product</th>
                <th class="px-3 py-2 text-right font-medium text-gray-700">Revenue</th>
                <th class="px-3 py-2 text-right font-medium text-gray-700">Qty</th>
                <th class="px-3 py-2 text-right font-medium text-gray-700">Avg / item</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="(product, idx) in sortedProducts" :key="rowKey(product, idx)" class="border-b border-gray-100 hover:bg-gray-50">
                <td v-if="showLocationColumn" class="px-3 py-2 text-gray-800">{{ product.locationName ?? '—' }}</td>
                <td class="px-3 py-2 text-gray-600">{{ product.date ?? '—' }}</td>
                <td class="px-3 py-2 text-gray-900">{{ formatBusinessHourLabelFromRow(product) }}</td>
                <td class="px-3 py-2 text-gray-800">{{ formatIsoHourLabel(product.date, product.hour) }}</td>
                <td class="px-3 py-2 text-gray-900">{{ product.productName ?? '—' }}</td>
                <td class="px-3 py-2 text-right font-semibold text-gray-900">{{ formatRev(product.total_revenue) }}</td>
                <td class="px-3 py-2 text-right text-gray-600">{{ product.total_quantity ?? 0 }}</td>
                <td class="px-3 py-2 text-right text-gray-600">{{ formatAvgPerItem(product.total_revenue, product.total_quantity) }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </UCard>
    </template>
  </div>
</template>
