<template>
  <div v-if="pnl" class="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
    <div class="mb-3 flex flex-wrap items-center justify-between gap-2">
      <h2 class="text-lg font-semibold">Eenvoudige P&amp;L</h2>
      <button
        type="button"
        class="rounded border border-gray-300 px-2 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50"
        @click="showAssumptions = !showAssumptions"
      >
        Aannames
      </button>
    </div>

    <div
      v-if="showAssumptions"
      class="mb-4 grid max-w-md gap-3 rounded border border-gray-100 bg-gray-50 p-3 text-sm"
    >
      <label class="flex items-center justify-between gap-2">
        <span>Inkoop keuken %</span>
        <input v-model.number="draft.foodCogsPct" type="number" min="0" max="100" class="w-20 rounded border px-2 py-1" />
      </label>
      <label class="flex items-center justify-between gap-2">
        <span>Inkoop drank %</span>
        <input v-model.number="draft.bevCogsPct" type="number" min="0" max="100" class="w-20 rounded border px-2 py-1" />
      </label>
      <label class="flex items-center justify-between gap-2">
        <span>Vaste lasten %</span>
        <input v-model.number="draft.overheadPct" type="number" min="0" max="100" class="w-20 rounded border px-2 py-1" />
      </label>
      <div class="flex gap-2">
        <button
          type="button"
          class="rounded bg-gray-900 px-3 py-1 text-xs font-semibold text-white disabled:opacity-60"
          :disabled="saving"
          @click="onApply"
        >
          {{ saving ? 'Opslaan…' : 'Toepassen' }}
        </button>
        <button type="button" class="rounded border px-3 py-1 text-xs" :disabled="saving" @click="onReset">
          Standaard
        </button>
      </div>
    </div>

    <p
      v-if="pnl.laborCoverage.pctComplete < 100"
      class="mb-2 text-xs text-amber-700"
    >
      Personeelsdata {{ pnl.laborCoverage.pctComplete }}% compleet
      ({{ pnl.laborCoverage.daysFound }}/{{ pnl.laborCoverage.daysExpected }} dagen)
    </p>

    <table class="w-full min-w-[320px] text-sm">
      <thead v-if="hasCompare">
        <tr class="text-left text-xs text-gray-500">
          <th class="py-1" />
          <th class="py-1 text-right">Huidig</th>
          <th class="py-1 text-right">{{ pnl.compare!.label }}</th>
          <th class="py-1 text-right">Δ</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="row in rows" :key="row.key">
          <td class="py-1">{{ row.label }}</td>
          <td class="py-1 text-right" :class="row.negative ? 'text-red-700' : ''">{{ row.fmt(pnl) }}</td>
          <td v-if="hasCompare" class="py-1 text-right" :class="row.negative ? 'text-red-700' : ''">
            {{ row.fmtCompare(pnl) }}
          </td>
          <td v-if="hasCompare" class="py-1 text-right" :class="deltaClass(row.delta(pnl))">
            {{ formatDelta(row.delta(pnl)) }}
          </td>
        </tr>
        <tr class="border-t font-bold">
          <td class="py-2">Resultaat</td>
          <td class="py-2 text-right">{{ formatEur(pnl.result) }}</td>
          <td v-if="hasCompare" class="py-2 text-right">{{ formatEur(pnl.compare!.result) }}</td>
          <td v-if="hasCompare" class="py-2 text-right" :class="deltaClass(resultDelta)">
            {{ formatDelta(resultDelta) }}
          </td>
        </tr>
      </tbody>
    </table>
  </div>
</template>

<script setup lang="ts">
import type { DailyOpsSimplePnLDto } from '~/types/daily-ops-revenue'

const props = defineProps<{ pnl: DailyOpsSimplePnLDto | null }>()
const emit = defineEmits<{ assumptionsSaved: [] }>()
const { assumptions, applyAssumptions, resetAssumptions, saving } = useDailyOpsRevenuePnlAssumptions()
const { formatEur } = useDashboardEurFormat()
const { revenueDelta, formatDelta, deltaClass } = useDailyOpsRevenueCompare()

const showAssumptions = ref(false)
const draft = ref({ ...assumptions.value })

watch(assumptions, (a) => {
  draft.value = { ...a }
})

async function onApply() {
  await applyAssumptions({ ...draft.value })
  showAssumptions.value = false
  emit('assumptionsSaved')
}

async function onReset() {
  await resetAssumptions()
  draft.value = { ...assumptions.value }
}

const hasCompare = computed(() => props.pnl?.compare != null)
const resultDelta = computed(() =>
  props.pnl?.compare
    ? revenueDelta(props.pnl.result, props.pnl.compare.result)
    : null,
)

function money(n: number, neg = false) {
  return neg ? `−${formatEur(Math.abs(n))}` : formatEur(n)
}

const rows = computed(() => {
  const a = props.pnl?.assumptions
  return [
  {
    key: 'rev',
    label: 'Omzet',
    negative: false,
    fmt: (p: DailyOpsSimplePnLDto) => money(p.revenue),
    fmtCompare: (p: DailyOpsSimplePnLDto) => money(p.compare!.revenue),
    delta: (p: DailyOpsSimplePnLDto) => revenueDelta(p.revenue, p.compare!.revenue),
  },
  {
    key: 'food',
    label: `Inkoop keuken (${a?.foodCogsPct ?? 30}%)`,
    negative: true,
    fmt: (p: DailyOpsSimplePnLDto) => money(p.foodCogs, true),
    fmtCompare: (p: DailyOpsSimplePnLDto) => money(p.compare!.foodCogs, true),
    delta: (p: DailyOpsSimplePnLDto) => revenueDelta(-p.foodCogs, -p.compare!.foodCogs),
  },
  {
    key: 'bev',
    label: `Inkoop drank (${a?.bevCogsPct ?? 30}%)`,
    negative: true,
    fmt: (p: DailyOpsSimplePnLDto) => money(p.bevCogs, true),
    fmtCompare: (p: DailyOpsSimplePnLDto) => money(p.compare!.bevCogs, true),
    delta: (p: DailyOpsSimplePnLDto) => revenueDelta(-p.bevCogs, -p.compare!.bevCogs),
  },
  {
    key: 'lab',
    label: 'Personeel (geladen)',
    negative: true,
    fmt: (p: DailyOpsSimplePnLDto) => money(p.laborCost, true),
    fmtCompare: (p: DailyOpsSimplePnLDto) => money(p.compare!.laborCost, true),
    delta: (p: DailyOpsSimplePnLDto) => revenueDelta(-p.laborCost, -p.compare!.laborCost),
  },
  {
    key: 'oh',
    label: `Vaste lasten (${a?.overheadPct ?? 25}%)`,
    negative: true,
    fmt: (p: DailyOpsSimplePnLDto) => money(p.overhead, true),
    fmtCompare: (p: DailyOpsSimplePnLDto) => money(p.compare!.overhead, true),
    delta: (p: DailyOpsSimplePnLDto) => revenueDelta(-p.overhead, -p.compare!.overhead),
  },
]
})
</script>
