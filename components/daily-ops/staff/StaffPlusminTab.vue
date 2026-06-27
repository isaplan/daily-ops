<template>
  <section class="space-y-6">
    <header class="space-y-1">
      <h1 class="text-[34px] font-extrabold leading-tight tracking-[-0.02em] text-gray-900">
        Plus / min hours
      </h1>
      <p class="text-base text-gray-600">
        Worked vs contract · {{ summary?.display.label ?? '—' }}
      </p>
    </header>

    <div v-if="pending" class="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <USkeleton v-for="i in 4" :key="`sk-${i}`" class="h-28 w-full rounded-lg" />
    </div>

    <UAlert v-else-if="error" color="error" :title="String(error)" />

    <template v-else-if="summary">
      <div class="grid gap-4 sm:grid-cols-3">
        <div class="rounded-lg border-2 border-gray-900 bg-white p-4">
          <p class="text-sm font-medium text-gray-500">Plus hours (total)</p>
          <p class="mt-2 text-2xl font-semibold tabular-nums text-emerald-700">
            +{{ fmtHours(summary.totals.plusHours) }}
          </p>
        </div>
        <div class="rounded-lg border-2 border-gray-900 bg-white p-4">
          <p class="text-sm font-medium text-gray-500">Min hours (total)</p>
          <p class="mt-2 text-2xl font-semibold tabular-nums text-red-700">
            {{ fmtHours(summary.totals.minusHours) }}
          </p>
        </div>
        <div class="rounded-lg border-2 border-gray-900 bg-white p-4">
          <p class="text-sm font-medium text-gray-500">Net ±</p>
          <p
            class="mt-2 text-2xl font-semibold tabular-nums"
            :class="summary.totals.delta >= 0 ? 'text-emerald-700' : 'text-red-700'"
          >
            {{ signedHours(summary.totals.delta) }}
          </p>
        </div>
      </div>

      <div class="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <button
          v-for="card in kpiCards"
          :key="card.id"
          type="button"
          class="rounded-lg border-2 bg-white p-4 text-left transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gray-900"
          :class="expandedKpi === card.id
            ? 'border-gray-900 ring-2 ring-gray-900/10'
            : 'border-gray-900 hover:bg-gray-50'"
          @click="toggleKpi(card.id)"
        >
          <p class="text-xs font-semibold uppercase text-gray-500">{{ card.eyebrow }}</p>
          <p class="mt-1 text-2xl font-bold tabular-nums" :class="card.tone">{{ card.count }}</p>
          <p class="mt-1 text-sm text-gray-600">{{ card.caption }}</p>
          <p class="mt-2 text-xs font-medium text-gray-500">Click to {{ expandedKpi === card.id ? 'hide' : 'show' }} names</p>
        </button>
      </div>

      <div
        v-if="expandedKpi && expandedRows.length"
        class="rounded-lg border-2 border-gray-900 bg-white p-4"
      >
        <div class="mb-3 flex items-center justify-between gap-2">
          <h2 class="text-sm font-semibold">{{ expandedTitle }}</h2>
          <UButton size="xs" variant="ghost" color="neutral" @click="expandedKpi = null">Close</UButton>
        </div>
        <ul class="divide-y divide-gray-100">
          <li
            v-for="row in expandedRows"
            :key="row.memberId"
            class="flex items-center justify-between gap-3 py-2"
          >
            <button
              type="button"
              class="text-left text-sm font-semibold text-gray-900 hover:underline"
              @click="openMember(row.memberId)"
            >
              {{ row.userName }}
            </button>
            <span class="shrink-0 text-sm tabular-nums text-gray-700">{{ signedHours(row.delta) }}</span>
          </li>
        </ul>
      </div>

      <div class="rounded-lg border-2 border-gray-900 bg-white p-4">
        <h2 class="mb-3 text-sm font-semibold">Per venue · {{ summary.display.label }}</h2>
        <div class="overflow-x-auto">
          <table class="min-w-full text-sm">
            <thead>
              <tr class="text-left text-xs text-gray-500">
                <th class="py-1 pr-4">Venue</th>
                <th class="py-1 text-right">Worked</th>
                <th class="py-1 text-right">Contract</th>
                <th class="py-1 text-right">Net ±</th>
                <th class="py-1 text-right">+</th>
                <th class="py-1 text-right">−</th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="v in summary.byVenue"
                :key="v.locationId"
                class="border-t border-gray-100"
              >
                <td class="py-1 pr-4">{{ v.locationName }}</td>
                <td class="py-1 text-right tabular-nums">{{ fmtHours(v.worked) }}</td>
                <td class="py-1 text-right tabular-nums">{{ fmtHours(v.contract) }}</td>
                <td class="py-1 text-right tabular-nums">{{ signedHours(v.delta) }}</td>
                <td class="py-1 text-right tabular-nums text-emerald-700">+{{ fmtHours(v.plusHours) }}</td>
                <td class="py-1 text-right tabular-nums text-red-700">{{ fmtHours(v.minusHours) }}</td>
              </tr>
            </tbody>
          </table>
        </div>
        <p v-if="!summary.byVenue.length" class="text-sm text-gray-600">No venue breakdown for this range.</p>
      </div>

      <div class="rounded-lg border-2 border-gray-900 bg-white p-4">
        <h2 class="mb-3 text-sm font-semibold">All staff · {{ summary.display.label }}</h2>
        <div class="overflow-x-auto">
          <table class="min-w-full text-sm">
            <thead>
              <tr class="text-left text-xs text-gray-500">
                <th class="py-1 pr-4">Name</th>
                <th class="py-1">Team</th>
                <th class="py-1 text-right">Worked</th>
                <th class="py-1 text-right">Contract</th>
                <th class="py-1 text-right">±</th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="m in summary.members"
                :key="m.memberId"
                class="cursor-pointer border-t border-gray-100 hover:bg-gray-50"
                @click="openMember(m.memberId)"
              >
                <td class="py-1 pr-4 font-semibold text-gray-900">{{ m.userName }}</td>
                <td class="py-1 text-gray-600">{{ m.teamName }}</td>
                <td class="py-1 text-right tabular-nums">{{ fmtHours(m.workedHours) }}</td>
                <td class="py-1 text-right tabular-nums">{{ fmtHours(m.contractHours) }}</td>
                <td class="py-1 text-right tabular-nums">{{ signedHours(m.displayDelta) }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </template>
  </section>
</template>

<script setup lang="ts">
import type { DailyOpsStaffPlusminMemberRow } from '~/types/daily-ops-staff'

type KpiId = 'month-over' | 'month-under' | 'week-over' | 'week-under'

const { summary, pending, error } = useDailyOpsStaffPlusmin()
const { dashboardQuery } = useDailyOpsDashboardRoute()

const expandedKpi = ref<KpiId | null>(null)

const kpiCards = computed(() => {
  const s = summary.value
  if (!s) return []
  return [
    {
      id: 'month-over' as const,
      eyebrow: `Month · ${s.month.label}`,
      count: s.monthKpis.over.length,
      caption: `Over +${s.month.overThreshold}h`,
      tone: 'text-emerald-700',
    },
    {
      id: 'month-under' as const,
      eyebrow: `Month · ${s.month.label}`,
      count: s.monthKpis.under.length,
      caption: `Under ${s.month.underThreshold}h`,
      tone: 'text-red-700',
    },
    {
      id: 'week-over' as const,
      eyebrow: `Week · ${s.week.label}`,
      count: s.weekKpis.over.length,
      caption: `Over +${s.week.overThreshold}h`,
      tone: 'text-emerald-700',
    },
    {
      id: 'week-under' as const,
      eyebrow: `Week · ${s.week.label}`,
      count: s.weekKpis.under.length,
      caption: `Under ${s.week.underThreshold}h`,
      tone: 'text-red-700',
    },
  ]
})

const expandedRows = computed((): Array<DailyOpsStaffPlusminMemberRow & { delta: number }> => {
  const s = summary.value
  if (!s || !expandedKpi.value) return []
  switch (expandedKpi.value) {
    case 'month-over':
      return s.monthKpis.over.map((r: DailyOpsStaffPlusminMemberRow) => ({ ...r, delta: r.monthDelta }))
    case 'month-under':
      return s.monthKpis.under.map((r: DailyOpsStaffPlusminMemberRow) => ({ ...r, delta: r.monthDelta }))
    case 'week-over':
      return s.weekKpis.over.map((r: DailyOpsStaffPlusminMemberRow) => ({ ...r, delta: r.weekDelta }))
    case 'week-under':
      return s.weekKpis.under.map((r: DailyOpsStaffPlusminMemberRow) => ({ ...r, delta: r.weekDelta }))
    default:
      return []
  }
})

const expandedTitle = computed(() => {
  const card = kpiCards.value.find((c: { id: KpiId }) => c.id === expandedKpi.value)
  return card ? `${card.eyebrow} — ${card.caption}` : 'Staff'
})

function toggleKpi(id: KpiId) {
  expandedKpi.value = expandedKpi.value === id ? null : id
}

function fmtHours(n: number) {
  return Number.isFinite(n) ? Math.abs(n).toFixed(1) : '—'
}

function signedHours(n: number) {
  if (!Number.isFinite(n)) return '—'
  return `${n > 0 ? '+' : ''}${n.toFixed(1)}`
}

function openMember(memberId: string) {
  void navigateTo({
    path: '/daily-ops/staff',
    query: { ...dashboardQuery.value, member: memberId },
  })
}
</script>
