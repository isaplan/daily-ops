<template>
  <DailyOpsDashboardShell>
    <UAlert v-if="error" color="error" :title="String(error)" />

    <div v-else-if="pending && !data" class="space-y-4">
      <USkeleton class="h-10 w-72 rounded-lg" />
      <USkeleton class="h-28 w-full rounded-lg" />
      <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <USkeleton v-for="i in 6" :key="i" class="h-24 rounded-lg" />
      </div>
    </div>

    <UAlert
      v-else-if="!data && !pending"
      color="error"
      title="Could not load insights"
      description="Try refreshing or pick a different month."
    />

    <div v-else-if="data" class="space-y-6">
      <header class="space-y-1">
        <h1 class="text-[34px] font-extrabold leading-tight tracking-[-0.02em] text-gray-900">
          Performance insights
        </h1>
        <p class="text-base text-gray-600">
          {{ data.compare_label }}
          <span class="text-gray-400">·</span>
          {{ locationTitle }}
        </p>
      </header>

      <UAlert
        v-if="data.data_gap"
        color="warning"
        title="No data for this period"
        description="Pick another month or year — we need sealed snapshot data."
      />

      <UCard class="border-2 border-gray-900 bg-white">
        <p class="text-lg font-semibold leading-snug text-gray-900">
          {{ data.verdict.headline }}
        </p>
        <ul v-if="data.verdict.bullets.length" class="mt-3 space-y-2 text-sm text-gray-700">
          <li v-for="(line, i) in data.verdict.bullets" :key="i">
            {{ line }}
          </li>
        </ul>
      </UCard>

      <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <div
          v-for="tile in kpiTiles"
          :key="tile.id"
          class="rounded-lg border-2 border-gray-900 bg-white p-4"
        >
          <p class="text-sm font-medium text-gray-500">
            {{ tile.label }}
          </p>
          <p class="mt-2 text-2xl font-semibold tabular-nums text-gray-900">
            {{ tile.value }}
          </p>
          <p
            v-if="tile.delta"
            class="mt-1 text-xs font-medium tabular-nums"
            :class="tile.deltaClass"
          >
            {{ tile.delta }}
          </p>
          <p
            v-if="tile.benchmarkHint"
            class="mt-0.5 text-xs tabular-nums text-amber-800"
          >
            {{ tile.benchmarkHint }}
          </p>
        </div>
      </div>

      <div
        v-if="data.compare_rows.length"
        class="overflow-x-auto rounded-lg border-2 border-gray-900 bg-white p-4"
      >
        <h2 class="mb-3 text-sm font-semibold text-gray-900">
          {{ data.prior_range ? `${data.range.label} compared to ${data.prior_range.label}` : data.range.label }}
        </h2>
        <table class="min-w-full text-left text-sm">
          <thead>
            <tr class="border-b border-gray-200 text-xs text-gray-500">
              <th class="py-2 pr-4 font-medium">
                Metric
              </th>
              <th class="py-2 pr-4 font-medium text-right">
                {{ data.range.label }}
              </th>
              <th class="py-2 pr-4 font-medium text-right">
                {{ data.prior_range?.label ?? 'Prior' }}
              </th>
              <th class="py-2 font-medium text-right">
                Change
              </th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="row in data.compare_rows"
              :key="row.id"
              class="border-b border-gray-100 tabular-nums"
            >
              <td class="py-2.5 pr-4 font-medium text-gray-900">
                {{ row.label }}
              </td>
              <td class="py-2.5 pr-4 text-right">
                {{ row.current }}
              </td>
              <td class="py-2.5 pr-4 text-right text-gray-600">
                {{ row.prior }}
              </td>
              <td
                class="py-2.5 text-right font-medium"
                :class="row.good === true ? 'text-emerald-700' : row.good === false ? 'text-amber-800' : 'text-gray-600'"
              >
                {{ row.change }}
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <InsightsTrendSection
        v-if="data.trend.length"
        :trend="data.trend"
        :mode="data.mode"
        :trend-label="data.trend_label"
        :highlight-key="data.range.key"
        :location-id="locationId"
        :benchmark-id="benchmarkId"
        @update:benchmark-id="setBenchmarkId"
      />

      <p v-if="data.assumptions_note" class="text-xs text-gray-500">
        {{ data.assumptions_note }}
      </p>
    </div>
  </DailyOpsDashboardShell>
</template>

<script setup lang="ts">
import InsightsTrendSection from '~/components/daily-ops/insights/InsightsTrendSection.vue'
import type { DailyOpsInsightsDelta } from '~/types/daily-ops-insights'
import { formatDashboardEur } from '~/utils/dashboardEurFormat'

type LocationRow = { _id: string; name: string }

const { data, pending, error, locationId, benchmark, benchmarkId, setBenchmarkId } = useDailyOpsInsightsMetrics()

const { data: locationsRes } = await useFetch<{ success: boolean; data: LocationRow[] }>('/api/locations')

const locationTitle = computed(() => {
  if (!locationId.value) return 'All locations'
  const hit = (locationsRes.value?.data ?? []).find((row) => row._id === locationId.value)
  return hit?.name ?? 'Selected location'
})

const priorShort = computed(() => data.value?.prior_range?.label ?? 'prior period')

function formatEur(n: number): string {
  return formatDashboardEur(n)
}

function deltaText(delta: DailyOpsInsightsDelta | null, key: keyof DailyOpsInsightsDelta): string | undefined {
  if (!delta) return undefined
  const raw = delta[key]
  if (raw == null || typeof raw !== 'number') return undefined
  const prefix = raw > 0 ? '+' : ''
  const unit = key === 'labor_pct_revenue_pp' ? ' pp' : '%'
  return `${prefix}${raw.toFixed(1)}${unit} vs ${priorShort.value}`
}

function deltaClass(delta: DailyOpsInsightsDelta | null, key: keyof DailyOpsInsightsDelta, invert = false): string {
  if (!delta) return 'text-gray-500'
  const raw = delta[key]
  if (raw == null || typeof raw !== 'number' || raw === 0) return 'text-gray-500'
  const good = invert ? raw < 0 : raw > 0
  return good ? 'text-emerald-700' : 'text-amber-800'
}

function benchmarkLaborHint(laborPct: number | null): string | undefined {
  if (laborPct == null) return undefined
  const target = benchmark.value.labor_pct
  const diff = laborPct - target
  const sign = diff > 0 ? '+' : ''
  return `vs ${benchmark.value.shortLabel} ${target}% (${sign}${diff.toFixed(1)} pp)`
}

const kpiTiles = computed(() => {
  const c = data.value?.current
  const d = data.value?.delta ?? null
  if (!c) return []

  return [
    {
      id: 'revenue',
      label: 'Revenue',
      value: formatEur(c.revenue),
      delta: deltaText(d, 'revenue_pct'),
      deltaClass: deltaClass(d, 'revenue_pct'),
    },
    {
      id: 'labor',
      label: 'Staff costs',
      value: formatEur(c.labor),
      delta: deltaText(d, 'labor_pct'),
      deltaClass: deltaClass(d, 'labor_pct', true),
    },
    {
      id: 'hours',
      label: 'Hours worked',
      value: `${c.gewerkt_hours.toFixed(0)}h`,
      delta: deltaText(d, 'hours_pct'),
      deltaClass: deltaClass(d, 'hours_pct'),
    },
    {
      id: 'staff',
      label: 'People who worked',
      value: c.staff_count > 0 ? String(c.staff_count) : '—',
      delta: deltaText(d, 'staff_pct'),
      deltaClass: deltaClass(d, 'staff_pct'),
    },
    {
      id: 'labor_pct',
      label: 'Staff % of revenue',
      value: c.labor_pct_revenue != null ? `${c.labor_pct_revenue.toFixed(1)}%` : '—',
      delta: deltaText(d, 'labor_pct_revenue_pp'),
      deltaClass: deltaClass(d, 'labor_pct_revenue_pp', true),
      benchmarkHint: benchmarkLaborHint(c.labor_pct_revenue),
    },
    {
      id: 'rev_h',
      label: 'Revenue per hour',
      value: c.revenue_per_hour != null ? `€${c.revenue_per_hour.toFixed(0)}/h` : '—',
      delta: deltaText(d, 'revenue_per_hour_pct'),
      deltaClass: deltaClass(d, 'revenue_per_hour_pct'),
    },
  ]
})
</script>
