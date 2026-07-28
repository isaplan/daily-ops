<template>
  <div class="mt-2 space-y-2 border-t border-gray-100 pt-2 text-xs">
    <template v-if="panel === 'budget'">
      <div class="flex flex-wrap items-center justify-between gap-1">
        <p class="font-semibold uppercase tracking-wide text-gray-500">Budget</p>
        <div class="flex gap-1">
          <button
            type="button"
            class="rounded px-1.5 py-0.5 text-[10px] text-gray-600 hover:bg-gray-100"
            title="Seed from P&L averages"
            @click="applyBenchmark"
          >
            Seed P&L
          </button>
          <button
            type="button"
            class="rounded bg-gray-900 px-1.5 py-0.5 text-[10px] font-medium text-white hover:bg-gray-800"
            :disabled="saving"
            @click="emitSave"
          >
            Save
          </button>
        </div>
      </div>

      <div class="grid grid-cols-2 gap-x-2 gap-y-1 tabular-nums text-gray-800 sm:grid-cols-4">
        <div>
          <p class="text-[9px] uppercase text-gray-400">Open h</p>
          <p class="font-medium">{{ openHours.toFixed(0) }}u</p>
        </div>
        <div>
          <p class="text-[9px] uppercase text-gray-400">Contract €/m</p>
          <p class="font-medium">€{{ formatEur(contractMonthly) }}</p>
        </div>
        <div>
          <p class="text-[9px] uppercase text-gray-400">Food / Keuken</p>
          <p class="font-medium">€{{ formatEur(keukenMonthly) }}</p>
        </div>
        <div>
          <p class="text-[9px] uppercase text-gray-400">Bev / Bed+Bar</p>
          <p class="font-medium">€{{ formatEur(bedieningMonthly) }}</p>
        </div>
      </div>

      <div class="grid gap-1.5 sm:grid-cols-2">
        <label class="text-[10px] text-gray-600">
          Est. monthly rev (€)
          <input
            v-model.number="monthly"
            type="number"
            min="0"
            step="1000"
            class="mt-0.5 w-full rounded border border-gray-300 px-1.5 py-1 text-xs tabular-nums"
          >
        </label>
        <label class="text-[10px] text-gray-600">
          Min €/h (FT)
          <input
            v-model.number="minProd"
            type="number"
            min="0"
            step="1"
            class="mt-0.5 w-full rounded border border-gray-300 px-1.5 py-1 text-xs tabular-nums"
          >
        </label>
        <label class="text-[10px] text-gray-600">
          Keuken share % (food)
          <input
            v-model.number="keukenPct"
            type="number"
            min="0"
            max="100"
            step="1"
            class="mt-0.5 w-full rounded border border-gray-300 px-1.5 py-1 text-xs tabular-nums"
          >
        </label>
        <label class="text-[10px] text-gray-600">
          Bediening+Bar % (bev)
          <input
            v-model.number="bedieningPct"
            type="number"
            min="0"
            max="100"
            step="1"
            class="mt-0.5 w-full rounded border border-gray-300 px-1.5 py-1 text-xs tabular-nums"
          >
        </label>
        <label class="text-[10px] text-gray-600 sm:col-span-2">
          Contract labor €/month (blank = auto from FT)
          <input
            v-model.number="contractOverride"
            type="number"
            min="0"
            step="100"
            class="mt-0.5 w-full rounded border border-gray-300 px-1.5 py-1 text-xs tabular-nums"
          >
        </label>
      </div>

      <div class="overflow-x-auto rounded border border-gray-100">
        <table class="min-w-full text-[10px]">
          <thead>
            <tr class="border-b border-gray-100 text-left text-gray-500">
              <th class="px-1.5 py-1 font-medium">Labor %</th>
              <th class="px-1.5 py-1 font-medium">Actual</th>
              <th class="px-1.5 py-1 font-medium">Target</th>
              <th class="px-1.5 py-1 font-medium">Budget €/m</th>
            </tr>
          </thead>
          <tbody>
            <tr class="border-b border-gray-50">
              <td class="px-1.5 py-1 text-gray-700">Total</td>
              <td class="px-1.5 py-1 tabular-nums text-gray-500">{{ fmtPct(actual.total) }}</td>
              <td class="px-1.5 py-1">
                <input
                  v-model.number="targetTotal"
                  type="number"
                  min="0"
                  max="100"
                  step="0.1"
                  class="w-14 rounded border border-gray-300 px-1 py-0.5 tabular-nums"
                >
              </td>
              <td class="px-1.5 py-1 tabular-nums">{{ fmtBudget(targetTotal) }}</td>
            </tr>
            <tr class="border-b border-gray-50">
              <td class="px-1.5 py-1 text-gray-700">Contract (FT)</td>
              <td class="px-1.5 py-1 tabular-nums text-gray-500">{{ fmtPct(actual.ft) }}</td>
              <td class="px-1.5 py-1">
                <input
                  v-model.number="targetFt"
                  type="number"
                  min="0"
                  max="100"
                  step="0.1"
                  class="w-14 rounded border border-gray-300 px-1 py-0.5 tabular-nums"
                >
              </td>
              <td class="px-1.5 py-1 tabular-nums">{{ fmtBudget(targetFt) }}</td>
            </tr>
            <tr class="border-b border-gray-50">
              <td class="px-1.5 py-1 text-gray-700">Inhuur (PT)</td>
              <td class="px-1.5 py-1 tabular-nums text-gray-500">{{ fmtPct(actual.pt) }}</td>
              <td class="px-1.5 py-1">
                <input
                  v-model.number="targetPt"
                  type="number"
                  min="0"
                  max="100"
                  step="0.1"
                  class="w-14 rounded border border-gray-300 px-1 py-0.5 tabular-nums"
                >
              </td>
              <td class="px-1.5 py-1 tabular-nums">{{ fmtBudget(targetPt) }}</td>
            </tr>
            <tr>
              <td class="px-1.5 py-1 text-gray-700">ZZP</td>
              <td class="px-1.5 py-1 tabular-nums text-gray-500">{{ fmtPct(actual.zzp) }}</td>
              <td class="px-1.5 py-1">
                <input
                  v-model.number="targetZzp"
                  type="number"
                  min="0"
                  max="100"
                  step="0.1"
                  class="w-14 rounded border border-gray-300 px-1 py-0.5 tabular-nums"
                >
              </td>
              <td class="px-1.5 py-1 tabular-nums">{{ fmtBudget(targetZzp) }}</td>
            </tr>
          </tbody>
        </table>
        <p class="px-1.5 py-1 text-[9px] text-gray-400">
          Seed P&amp;L = last 12 sealed months. Actual: total labor %; FT=salaris; PT=inhuur F&amp;B; ZZP=other inhuur.
        </p>
      </div>
    </template>

    <template v-else-if="panel === 'rules'">
      <div class="flex flex-wrap items-center justify-between gap-1">
        <p class="font-semibold uppercase tracking-wide text-gray-500">Min / max FT staff</p>
      </div>
      <p class="text-[10px] leading-snug text-gray-500">
        Per day / evening — Chef, Manager, Floor &amp; FT only (not PT or ZZP).
      </p>
      <div class="flex flex-wrap gap-1">
        <button
          v-for="t in teams"
          :key="t"
          type="button"
          class="rounded-full border px-2 py-0.5 text-[10px] font-semibold capitalize tracking-wide"
          :class="rulesTeam === t
            ? 'border-gray-900 bg-gray-900 text-white'
            : 'border-gray-300 bg-white text-gray-600 hover:border-gray-900'"
          @click="rulesTeam = t"
        >
          {{ t }}
        </button>
      </div>
      <StaffOrgRulesEditor
        class="border-0 p-0 shadow-none"
        hide-title
        :location-id="locationId"
        :team="rulesTeam"
        :rules="rules"
        :saving="savingRules"
        @save="(r) => emit('save-rules', r)"
      />
    </template>
  </div>
</template>

<script setup lang="ts">
/**
 * @registry-id: StaffOrgVenueBudgetCard
 * @created: 2026-07-23T10:40:00.000Z
 * @last-modified: 2026-07-27T17:20:00.000Z
 * @description: Per-venue budget / min-max panels (shown via TeamBuilder pills)
 * @last-fix: [2026-07-27] Seed P&L footnote: rolling 12m + Lonen FT/PT/ZZP
 * @adr-ref: ADR-016
 */

import type {
  StaffOrgAssignment,
  StaffOrgLaborBenchmark,
  StaffOrgLaborCostPctBuckets,
  StaffOrgLocationRule,
  StaffOrgLocationTargets,
  StaffOrgRosterMember,
  StaffOrgSlotHours,
  StaffOrgTeam,
} from '~/types/staff-org'
import { monthlyContractLaborFromOrg } from '~/utils/staffOrg/contractLabor'
import { emptyLaborCostPctBuckets } from '~/utils/staffOrg/locationTargets'

const props = defineProps<{
  locationId: string
  panel: 'budget' | 'rules'
  targets: StaffOrgLocationTargets[]
  rules: StaffOrgLocationRule[]
  roster: StaffOrgRosterMember[]
  orgAssignments: StaffOrgAssignment[]
  inactiveMemberIds: string[]
  slotHours: StaffOrgSlotHours[]
  benchmark?: StaffOrgLaborBenchmark | null
  saving?: boolean
  savingRules?: boolean
}>()

const emit = defineEmits<{
  save: [targets: StaffOrgLocationTargets[]]
  'save-rules': [rules: StaffOrgLocationRule[]]
}>()

const teams: StaffOrgTeam[] = ['keuken', 'bediening', 'bar']
const rulesTeam = ref<StaffOrgTeam>('bediening')

const monthly = ref(0)
const minProd = ref(0)
const keukenPct = ref(50)
const bedieningPct = ref(50)
const contractOverride = ref<number | undefined>(undefined)
const targetTotal = ref<number | undefined>(undefined)
const targetFt = ref<number | undefined>(undefined)
const targetPt = ref<number | undefined>(undefined)
const targetZzp = ref<number | undefined>(undefined)
const seededActual = ref<StaffOrgLaborCostPctBuckets>(emptyLaborCostPctBuckets())

watch(
  () => [props.locationId, props.targets] as const,
  () => {
    const t = props.targets.find((x) => x.locationId === props.locationId)
    monthly.value = t?.estimatedMonthlyRevenue ?? 0
    minProd.value = t?.minLaborProductivity ?? 0
    keukenPct.value = Math.round((t?.keukenRevenueShare ?? 0.5) * 100)
    bedieningPct.value = Math.round((t?.bedieningRevenueShare ?? 0.5) * 100)
    contractOverride.value = t?.contractLaborCostMonthly ?? undefined
    targetTotal.value = t?.laborCostPctTarget?.total ?? undefined
    targetFt.value = t?.laborCostPctTarget?.ft ?? undefined
    targetPt.value = t?.laborCostPctTarget?.pt ?? undefined
    targetZzp.value = t?.laborCostPctTarget?.zzp ?? undefined
    seededActual.value = t?.laborCostPctActual ?? emptyLaborCostPctBuckets()
  },
  { immediate: true, deep: true },
)

const actual = computed(() => ({
  total: seededActual.value.total ?? props.benchmark?.laborCostPct.total ?? null,
  ft: seededActual.value.ft ?? props.benchmark?.laborCostPct.ft ?? null,
  pt: seededActual.value.pt ?? props.benchmark?.laborCostPct.pt ?? null,
  zzp: seededActual.value.zzp ?? props.benchmark?.laborCostPct.zzp ?? null,
}))

const derivedContract = computed(() =>
  monthlyContractLaborFromOrg({
    locationId: props.locationId,
    roster: props.roster,
    orgAssignments: props.orgAssignments,
    inactiveMemberIds: props.inactiveMemberIds,
  }),
)

const contractMonthly = computed(() =>
  contractOverride.value != null && contractOverride.value > 0
    ? contractOverride.value
    : derivedContract.value,
)

const openHours = computed(() =>
  props.slotHours
    .filter((s) => s.locationId === props.locationId && s.openHours != null)
    .reduce((sum, s) => sum + (s.openHours ?? 0), 0),
)

const keukenMonthly = computed(() =>
  Math.round(monthly.value * (keukenPct.value / 100)),
)
const bedieningMonthly = computed(() =>
  Math.round(monthly.value * (bedieningPct.value / 100)),
)

function formatEur(n: number): string {
  return Math.round(n).toLocaleString('nl-NL')
}

function fmtPct(n: number | null): string {
  return n != null ? `${n}%` : '—'
}

function fmtBudget(pct: number | undefined): string {
  if (pct == null || !(monthly.value > 0)) return '—'
  return `€${formatEur(monthly.value * (pct / 100))}`
}

function applyBenchmark() {
  const b = props.benchmark
  if (!b) return
  if (b.monthlyRevenue > 0 && !(monthly.value > 0)) {
    monthly.value = b.monthlyRevenue
  }
  keukenPct.value = Math.round(b.keukenRevenueShare * 100)
  bedieningPct.value = Math.round(b.bedieningRevenueShare * 100)
  seededActual.value = { ...b.laborCostPct }
  if (b.laborCostPct.total != null && targetTotal.value == null) {
    targetTotal.value = b.laborCostPct.total
  }
}

function emitSave() {
  const others = props.targets.filter((t) => t.locationId !== props.locationId)
  let k = Math.max(0, Number(keukenPct.value) || 0) / 100
  let bed = Math.max(0, Number(bedieningPct.value) || 0) / 100
  const sum = k + bed
  if (sum > 0) {
    k /= sum
    bed /= sum
  }
  emit('save', [
    ...others,
    {
      locationId: props.locationId,
      estimatedMonthlyRevenue: Math.max(0, Number(monthly.value) || 0),
      minLaborProductivity: Math.max(0, Number(minProd.value) || 0),
      keukenRevenueShare: Math.round(k * 1000) / 1000,
      bedieningRevenueShare: Math.round(bed * 1000) / 1000,
      contractLaborCostMonthly:
        contractOverride.value == null || Number(contractOverride.value) === 0
          ? null
          : Math.max(0, Number(contractOverride.value) || 0),
      laborCostPctActual: { ...actual.value },
      laborCostPctTarget: {
        total: targetTotal.value ?? null,
        ft: targetFt.value ?? null,
        pt: targetPt.value ?? null,
        zzp: targetZzp.value ?? null,
      },
    },
  ])
}
</script>
