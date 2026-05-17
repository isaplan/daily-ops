<template>
  <div v-if="isAttachmentView" class="mx-auto max-w-7xl space-y-4 px-4 pt-4">
    <NuxtLink
      class="inline-flex text-sm font-medium text-primary-600 hover:text-primary-700 underline-offset-2 hover:underline"
      :to="{ path: route.path, query: cardViewQuery }"
    >
      ← Card view (mapped)
    </NuxtLink>
    <DailyOpsInboxImportTableView
      api-path="/api/inbox/eitje/hours"
      title="Eitje — Hours (attachment)"
      description="Exact rows from parseddatas. Remove ?view=attachment for the card layout (inbox-eitje-hours)."
    />
  </div>

  <div v-else class="min-h-screen bg-gray-50 p-6">
    <div class="max-w-6xl mx-auto">
      <div class="mb-8">
        <div class="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 class="text-3xl font-bold text-gray-900">Eitje — Hours</h1>
            <p class="text-gray-600 mt-2">
              Labor rows from inbox (<span class="font-mono text-gray-800">inbox-eitje-hours</span>), grouped by venue and business day.
            </p>
            <p v-if="titleAfterLine" class="mt-1 text-sm text-gray-500">{{ titleAfterLine }}</p>
          </div>
          <NuxtLink
            class="text-sm font-medium text-primary-600 hover:text-primary-700 underline-offset-2 hover:underline"
            :to="{ path: route.path, query: attachmentQuery }"
          >
            Open raw attachment table →
          </NuxtLink>
        </div>
      </div>
        <UAlert
          v-if="fetchWarning"
          color="warning"
          variant="subtle"
          class="mb-6"
          title="Large import"
          :description="fetchWarning"
        />

        <!-- Filters -->
        <div
          v-if="!loading && groups.length > 0"
          class="mb-6 rounded-lg border border-gray-200 bg-white p-4 shadow-sm"
        >
          <div class="mb-3 flex items-center gap-2 text-gray-700">
            <UIcon name="i-lucide-filter" class="h-5 w-5 shrink-0" aria-hidden="true" />
            <span class="text-sm font-semibold">Filters</span>
          </div>
          <div class="flex flex-wrap items-end gap-4">
            <div class="min-w-[200px] flex-1 space-y-1">
              <label class="text-xs font-medium text-gray-600">Location</label>
              <USelectMenu
                v-model="filterLocation"
                :items="locationOptions"
                value-attribute="value"
                class="w-full"
              />
            </div>
            <div class="min-w-[200px] flex-1 space-y-1">
              <label class="text-xs font-medium text-gray-600">Business Day</label>
              <USelectMenu
                v-model="filterBusinessDate"
                :items="businessDateOptions"
                value-attribute="value"
                class="w-full"
              />
            </div>
            <div class="min-w-[200px] flex-1 space-y-1">
              <label class="text-xs font-medium text-gray-600">Cron time (Amsterdam)</label>
              <USelectMenu
                v-model="filterImportHour"
                :items="importHourOptions"
                value-attribute="value"
                class="w-full"
              />
            </div>
            <UButton color="neutral" variant="outline" icon="i-lucide-rotate-ccw" @click="clearFilters">
              Clear
            </UButton>
          </div>
        </div>

        <div v-if="loading" class="flex justify-center py-12">
          <div class="text-lg text-gray-600">Loading hours…</div>
        </div>

        <div v-else-if="loadError" class="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
          <p class="text-red-800">{{ loadError }}</p>
        </div>

        <div v-else-if="filteredGroups.length > 0" class="space-y-4">
          <div
            v-for="g in filteredGroups"
            :key="g.key"
            class="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden"
          >
            <button
              type="button"
              class="w-full px-6 py-4 flex items-center justify-between hover:bg-gray-50 transition text-left"
              @click="toggleGroup(g.key)"
            >
              <div class="flex-1 min-w-0">
                <h3 class="font-semibold text-gray-900 truncate">
                  {{ g.location_name }}
                </h3>
                <p class="text-sm text-gray-500 mt-1 space-x-2 flex flex-wrap gap-y-1">
                  <span>Business Day:</span>
                  <span
                    v-if="g.businessYmd"
                    class="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded"
                  >
                    Day: {{ formatNlDate(g.businessYmd) }}
                  </span>
                </p>
                <p class="text-sm text-gray-500 mt-1 space-x-2 flex flex-wrap gap-y-1">
                  <span>ISO Day:</span>
                  <span
                    v-if="g.isoYmd"
                    class="text-xs bg-yellow-100 text-yellow-800 px-2 py-1 rounded"
                  >
                    Day: {{ formatNlDate(g.isoYmd) }}
                  </span>
                  <span
                    v-if="g.isoHour !== null"
                    class="text-xs bg-yellow-100 text-yellow-800 px-2 py-1 rounded"
                  >
                    Time: {{ g.isoHour }}:00 Amsterdam
                  </span>
                </p>
              </div>
              <div class="flex items-center gap-6 shrink-0 ml-4">
                <div class="text-right space-y-0.5">
                  <p class="text-lg font-bold text-emerald-700">{{ formatHours(g.totalHours) }} h</p>
                  <p class="text-xs text-gray-500">€{{ formatMoney(g.totalLaborCost) }} labor</p>
                  <p class="text-xs text-gray-500">{{ g.workerCount }} workers · {{ g.rows.length }} rows</p>
                </div>
                <svg
                  :class="[
                    'w-5 h-5 shrink-0 text-gray-400 transition-transform duration-200',
                    expandedGroups.has(g.key) && 'rotate-180',
                  ]"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  aria-hidden="true"
                >
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
                </svg>
              </div>
            </button>

            <div
              v-if="expandedGroups.has(g.key)"
              class="border-t border-gray-200 bg-gray-50"
            >
              <div class="px-6 py-4 space-y-4">
                <div class="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  <div class="rounded-lg border border-emerald-100 bg-emerald-50/80 p-3">
                    <p class="text-xs font-medium uppercase tracking-wide text-emerald-800">Hours worked</p>
                    <p class="mt-1 text-xl font-semibold text-emerald-900">{{ formatHours(g.hoursWorked) }} h</p>
                  </div>
                  <div class="rounded-lg border border-violet-100 bg-violet-50/80 p-3">
                    <p class="text-xs font-medium uppercase tracking-wide text-violet-800">Hours planned</p>
                    <p class="mt-1 text-xl font-semibold text-violet-900">{{ formatHours(g.hoursPlanned) }} h</p>
                  </div>
                  <div class="rounded-lg border border-gray-200 bg-white p-3">
                    <p class="text-xs font-medium uppercase tracking-wide text-gray-600">Hourly cost (avg)</p>
                    <p class="mt-1 text-xl font-semibold text-gray-900">€{{ formatMoney(g.avgCostPerHour) }}</p>
                  </div>
                  <div class="rounded-lg border border-gray-200 bg-white p-3">
                    <p class="text-xs font-medium uppercase tracking-wide text-gray-600">Labor cost (sum)</p>
                    <p class="mt-1 text-xl font-semibold text-gray-900">€{{ formatMoney(g.totalLaborCost) }}</p>
                  </div>
                </div>

                <div class="bg-white rounded border border-gray-200 overflow-hidden">
                  <table class="w-full text-sm">
                    <thead class="bg-gray-100 border-b">
                      <tr>
                        <th class="px-4 py-2 text-left">Worker</th>
                        <th class="px-4 py-2 text-left">Team</th>
                        <th class="px-4 py-2 text-left">Type</th>
                        <th class="px-4 py-2 text-right">Hours</th>
                        <th class="px-4 py-2 text-right">Hourly rate</th>
                        <th class="px-4 py-2 text-right">Cost / hr</th>
                        <th class="px-4 py-2 text-right">Labor</th>
                        <th class="px-4 py-2 text-left">Contract</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr
                        v-for="(row, ri) in g.rows"
                        :key="ri"
                        class="border-b border-gray-100 hover:bg-gray-50/80"
                      >
                        <td class="px-4 py-2 font-medium text-gray-900">{{ cellStr(row, 'employee_name') }}</td>
                        <td class="px-4 py-2 text-gray-700">{{ cellStr(row, 'team_name') }}</td>
                        <td class="px-4 py-2 text-gray-600">{{ cellStr(row, 'shift_type') }}</td>
                        <td class="px-4 py-2 text-right tabular-nums">{{ formatHours(num(row, 'hours')) }}</td>
                        <td class="px-4 py-2 text-right tabular-nums">€{{ formatMoney(num(row, 'hourly_rate')) }}</td>
                        <td class="px-4 py-2 text-right tabular-nums">€{{ formatMoney(num(row, 'cost_per_hour')) }}</td>
                        <td class="px-4 py-2 text-right tabular-nums text-emerald-800">
                          €{{ formatMoney(num(row, 'realized_labor_costs')) }}
                        </td>
                        <td class="px-4 py-2 text-gray-600">{{ cellStr(row, 'contract_type') }}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div v-else-if="!loading && rows.length === 0" class="text-center py-12">
          <p class="text-gray-600">No mapped hours in <span class="font-mono">inbox-eitje-hours</span> yet.</p>
          <p class="mt-2 text-sm text-gray-500">Sync inbox or open Raw attachment rows if imports exist in <span class="font-mono">parseddatas</span>.</p>
        </div>

        <div v-else-if="!loading && groups.length > 0 && filteredGroups.length === 0" class="text-center py-12">
          <p class="text-gray-600">No groups match the selected filters.</p>
          <UButton class="mt-4" color="neutral" variant="outline" @click="clearFilters">Clear filters</UButton>
        </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { InboxImportTableApiResponse } from '~/composables/useInboxApi'

const FILTER_ALL = '__all__' as const

const route = useRoute()

const isAttachmentView = computed(() => route.query.view === 'attachment')

const cardViewQuery = computed((): Record<string, string> => {
  const next: Record<string, string> = {}
  for (const [k, v] of Object.entries(route.query)) {
    if (k === 'view') continue
    if (v === undefined || v === null) continue
    next[k] = Array.isArray(v) ? String(v[0]) : String(v)
  }
  return next
})

const attachmentQuery = computed((): Record<string, string> => {
  const next: Record<string, string> = {}
  for (const [k, v] of Object.entries(route.query)) {
    if (v === undefined || v === null) continue
    next[k] = Array.isArray(v) ? String(v[0]) : String(v)
  }
  next.view = 'attachment'
  return next
})

const loading = ref(false)
const loadError = ref<string | null>(null)
const rows = ref<Record<string, unknown>[]>([])
const storedRange = ref<{ minParsedAt: string | null; maxParsedAt: string | null } | null>(null)
const fetchWarning = ref<string | null>(null)
const expandedGroups = ref(new Set<string>())
const filterLocation = ref<string>(FILTER_ALL)
const filterBusinessDate = ref<string>(FILTER_ALL)
const filterImportHour = ref<string>(FILTER_ALL)

/** Mapped `inbox-eitje-hours` docs are labor rows; one request keeps payloads small and avoids 500s. */
const MAPPED_ROWS_LIMIT = 20

function formatShortImportDate(iso: string | null | undefined): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

const titleAfterLine = computed(() => {
  const r = storedRange.value
  if (!r?.maxParsedAt) return ''
  const lo = formatShortImportDate(r.minParsedAt)
  const hi = formatShortImportDate(r.maxParsedAt)
  if (lo && hi && lo !== hi) return `Stored row imports ${lo} – ${hi}`
  if (hi) return `Latest stored import ${hi}`
  return ''
})

function toggleGroup(key: string) {
  if (expandedGroups.value.has(key)) expandedGroups.value.delete(key)
  else expandedGroups.value.add(key)
}

function clearFilters() {
  filterLocation.value = FILTER_ALL
  filterBusinessDate.value = FILTER_ALL
  filterImportHour.value = FILTER_ALL
}

/** Format YYYY-MM-DD as a civil calendar day in Europe/Amsterdam (not browser local midnight). */
function formatNlDate(ymd: string): string {
  try {
    const [y, m, d] = ymd.split('-').map((x) => parseInt(x, 10))
    if (!y || !m || !d) return ymd
    const utcNoon = Date.UTC(y, m - 1, d, 12, 0, 0)
    return new Date(utcNoon).toLocaleDateString('nl-NL', {
      timeZone: 'Europe/Amsterdam',
      weekday: 'short',
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    })
  } catch {
    return ymd
  }
}

function formatMoney(n: number): string {
  if (!Number.isFinite(n)) return '—'
  return n.toFixed(2).replace('.', ',')
}

function formatHours(n: number): string {
  if (!Number.isFinite(n)) return '—'
  return (Math.round(n * 100) / 100).toFixed(2).replace('.', ',')
}

/** Amsterdam calendar YYYY-MM-DD for an instant */
function toAmsterdamYmd(d: Date): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Amsterdam',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(d)
  const y = parts.find((p) => p.type === 'year')?.value
  const m = parts.find((p) => p.type === 'month')?.value
  const day = parts.find((p) => p.type === 'day')?.value
  if (!y || !m || !day) return ''
  return `${y}-${m}-${day}`
}

function amsterdamHour(d: Date): number {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/Amsterdam',
    hour: 'numeric',
    hour12: false,
  }).formatToParts(d)
  const h = parts.find((p) => p.type === 'hour')?.value
  return h ? parseInt(h, 10) : 0
}

function parseUnknownDate(value: unknown): Date | null {
  if (value == null) return null
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value
  if (typeof value === 'string') {
    const s = value.trim()
    const ddmmyyyy = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/)
    if (ddmmyyyy?.[1] && ddmmyyyy[2] && ddmmyyyy[3]) {
      const day = parseInt(ddmmyyyy[1], 10)
      const month = parseInt(ddmmyyyy[2], 10)
      const year = parseInt(ddmmyyyy[3], 10)
      if (!day || !month || !year) return null
      return new Date(Date.UTC(year, month - 1, day, 12, 0, 0))
    }
    const d = new Date(s)
    return Number.isNaN(d.getTime()) ? null : d
  }
  return null
}

function rowBusinessYmd(row: Record<string, unknown>): string | null {
  const d = parseUnknownDate(row.date)
  if (!d) return null
  return toAmsterdamYmd(d)
}

function rowLatestInstant(row: Record<string, unknown>): Date | null {
  const candidates = [row.parsedAt, row.importedAt, row.created_at]
  let best: Date | null = null
  for (const c of candidates) {
    const d = parseUnknownDate(c)
    if (!d) continue
    if (!best || d.getTime() > best.getTime()) best = d
  }
  return best
}

function shiftBucket(shiftType: unknown): 'planned' | 'worked' {
  const s = String(shiftType ?? '').toLowerCase()
  if (/gepland|planned|\bplan\b|rooster|schedule/.test(s)) return 'planned'
  return 'worked'
}

type HoursDayGroup = {
  key: string
  location_name: string
  businessYmd: string | null
  isoYmd: string | null
  isoHour: number | null
  rows: Record<string, unknown>[]
  totalHours: number
  hoursWorked: number
  hoursPlanned: number
  totalLaborCost: number
  avgCostPerHour: number
  workerCount: number
}

const groups = computed((): HoursDayGroup[] => {
  const map = new Map<string, Record<string, unknown>[]>()
  for (const row of rows.value) {
    const loc = String(row.location_name ?? '').trim() || '—'
    const bd = rowBusinessYmd(row)
    const key = `${loc}||${bd ?? 'unknown'}`
    if (!map.has(key)) map.set(key, [])
    map.get(key)!.push(row)
  }

  const out: HoursDayGroup[] = []
  for (const [groupKey, gRows] of map.entries()) {
    const loc = String(gRows[0]?.location_name ?? '').trim() || '—'
    const bd = rowBusinessYmd(gRows[0] ?? {})
    let latest: Date | null = null
    for (const r of gRows) {
      const t = rowLatestInstant(r)
      if (t && (!latest || t.getTime() > latest.getTime())) latest = t
    }
    const isoYmd = latest ? toAmsterdamYmd(latest) : null
    const cronFromRow = gRows.find((r) => typeof r.cron_hour === 'number')
    const isoHour =
      typeof cronFromRow?.cron_hour === 'number'
        ? (cronFromRow.cron_hour as number)
        : latest
          ? amsterdamHour(latest)
          : null

    let totalHours = 0
    let hoursWorked = 0
    let hoursPlanned = 0
    let totalLaborCost = 0
    const workers = new Set<string>()
    let costHourSum = 0
    let costHourN = 0

    for (const r of gRows) {
      const h = typeof r.hours === 'number' && Number.isFinite(r.hours) ? r.hours : Number(r.hours) || 0
      totalHours += h
      if (shiftBucket(r.shift_type) === 'planned') hoursPlanned += h
      else hoursWorked += h

      const labor = typeof r.realized_labor_costs === 'number' && Number.isFinite(r.realized_labor_costs)
        ? r.realized_labor_costs
        : Number(r.realized_labor_costs) || 0
      totalLaborCost += labor

      const cph = typeof r.cost_per_hour === 'number' && Number.isFinite(r.cost_per_hour)
        ? r.cost_per_hour
        : Number(r.cost_per_hour)
      if (typeof cph === 'number' && Number.isFinite(cph) && cph > 0) {
        costHourSum += cph
        costHourN += 1
      }

      const en = String(r.employee_name ?? '').trim()
      if (en) workers.add(en)
    }

    const avgCostPerHour = costHourN > 0 ? costHourSum / costHourN : 0

    out.push({
      key: groupKey,
      location_name: loc,
      businessYmd: bd,
      isoYmd,
      isoHour,
      rows: [...gRows].sort((a, b) => {
        const na = String(a.employee_name ?? '')
        const nb = String(b.employee_name ?? '')
        return na.localeCompare(nb, 'nl')
      }),
      totalHours,
      hoursWorked,
      hoursPlanned,
      totalLaborCost,
      avgCostPerHour,
      workerCount: workers.size,
    })
  }

  return out.sort((a, b) => {
    const da = a.businessYmd ?? ''
    const db = b.businessYmd ?? ''
    if (da !== db) return db.localeCompare(da)
    return a.location_name.localeCompare(b.location_name, 'nl')
  })
})

const locationOptions = computed(() => {
  const names = new Set<string>()
  for (const g of groups.value) names.add(g.location_name)
  const opts = [...names].sort((a, b) => a.localeCompare(b, 'nl')).map((label) => ({ label, value: label }))
  return [{ label: 'All locations', value: FILTER_ALL }, ...opts]
})

const businessDateOptions = computed(() => {
  const dates = new Set<string>()
  for (const g of groups.value) {
    if (g.businessYmd) dates.add(g.businessYmd)
  }
  const opts = [...dates]
    .sort()
    .reverse()
    .map((d) => ({ label: formatNlDate(d), value: d }))
  return [{ label: 'All business days', value: FILTER_ALL }, ...opts]
})

const importHourOptions = computed(() => {
  const hours = new Set<number>()
  for (const g of groups.value) {
    if (typeof g.isoHour === 'number') hours.add(g.isoHour)
  }
  const opts = [...hours]
    .sort((a, b) => b - a)
    .map((h) => ({ label: `${h}:00 Amsterdam`, value: String(h) }))
  return [{ label: 'All cron times', value: FILTER_ALL }, ...opts]
})

const filteredGroups = computed(() => {
  return groups.value.filter((g: HoursDayGroup) => {
    if (filterLocation.value !== FILTER_ALL && g.location_name !== filterLocation.value) return false
    if (filterBusinessDate.value !== FILTER_ALL && g.businessYmd !== filterBusinessDate.value) return false
    if (filterImportHour.value !== FILTER_ALL) {
      const want = Number(filterImportHour.value)
      if (g.isoHour !== want) return false
    }
    return true
  })
})

function cellStr(row: Record<string, unknown>, key: string): string {
  const v = row[key]
  if (v === null || v === undefined || v === '') return '—'
  return String(v)
}

function num(row: Record<string, unknown>, key: string): number {
  const v = row[key]
  if (typeof v === 'number' && Number.isFinite(v)) return v
  const n = Number(v)
  return Number.isFinite(n) ? n : 0
}

async function loadMappedRows() {
  loading.value = true
  loadError.value = null
  fetchWarning.value = null
  storedRange.value = null
  try {
    const qs = new URLSearchParams({
      view: 'mapped',
      page: '1',
      limit: String(MAPPED_ROWS_LIMIT),
    })
    const res = await $fetch<InboxImportTableApiResponse>(`/api/inbox/eitje/hours?${qs.toString()}`)
    if (!res.success || !res.data) {
      loadError.value = 'Failed to load mapped hours'
      return
    }
    rows.value = res.data.rows
    const sr = res.data.storedRowTimeRange
    storedRange.value = sr ? { minParsedAt: sr.minParsedAt ?? null, maxParsedAt: sr.maxParsedAt ?? null } : null
    if (res.data.pagination.hasMore) {
      fetchWarning.value = `Showing the ${MAPPED_ROWS_LIMIT} most recent stored rows (newest imports first). More data exists in the database; use Mongo or the attachment table for full history.`
    }
  } catch (e) {
    loadError.value = e instanceof Error ? e.message : 'Error loading hours'
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  if (!isAttachmentView.value) void loadMappedRows()
})

watch(isAttachmentView, (attachment: boolean) => {
  if (!attachment && rows.value.length === 0 && !loading.value) void loadMappedRows()
})
</script>
