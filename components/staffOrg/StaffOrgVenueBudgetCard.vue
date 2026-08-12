<template>
  <div class="mt-2 space-y-2 border-t border-gray-100 pt-2 text-xs">
    <template v-if="panel === 'budget'">
      <div class="flex flex-wrap items-center justify-between gap-1">
        <p class="font-semibold uppercase tracking-wide text-gray-500">Budget</p>
        <div class="flex gap-1">
          <button
            type="button"
            class="rounded px-1.5 py-0.5 text-[10px] text-gray-600 hover:bg-gray-100"
            title="Seed from sealed P&L + Finance cost envelope (10% / COGS 25%)"
            @click="applyBenchmark"
          >
            Seed P&amp;L envelope
          </button>
          <button
            type="button"
            class="rounded bg-gray-900 px-1.5 py-0.5 text-[10px] font-medium text-white hover:bg-gray-800"
            :disabled="saving"
            @click="emitSave"
          >
            {{ saving ? 'Saving…' : 'Save' }}
          </button>
        </div>
      </div>
      <p
        v-if="statusMsg"
        class="text-[10px] leading-snug"
        :class="statusOk ? 'text-emerald-700' : 'text-amber-800'"
      >
        {{ statusMsg }}
      </p>

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

      <div
        v-if="liveEnvelope"
        class="grid grid-cols-2 gap-x-2 gap-y-1 rounded border border-gray-200 bg-gray-50 px-2 py-1.5 tabular-nums sm:grid-cols-5"
      >
        <div>
          <p class="text-[9px] uppercase text-gray-400">Cost (=rev−10%)</p>
          <p class="font-semibold text-gray-900">€{{ formatEur(liveEnvelope.cost_budget) }}</p>
          <p class="text-[9px] text-gray-400">wk €{{ formatEur(liveWeek.cost_budget) }}</p>
        </div>
        <div>
          <p class="text-[9px] uppercase text-gray-400">COGS @25%</p>
          <p class="font-semibold text-gray-900">€{{ formatEur(liveEnvelope.cogs_budget) }}</p>
          <p class="text-[9px] text-gray-400">wk €{{ formatEur(liveWeek.cogs_budget) }}</p>
        </div>
        <div>
          <p class="text-[9px] uppercase text-gray-400">Labor+OH pot</p>
          <p class="font-semibold text-gray-900">€{{ formatEur(liveEnvelope.labor_oh_budget) }}</p>
        </div>
        <div>
          <p class="text-[9px] uppercase text-gray-400">Fixed L+OH</p>
          <p class="font-medium text-gray-800">
            €{{ formatEur(liveEnvelope.fixed_labor + liveEnvelope.fixed_oh) }}
          </p>
          <p class="text-[9px] text-gray-400">
            FT €{{ formatEur(liveEnvelope.fixed_labor) }}
          </p>
        </div>
        <div>
          <p class="text-[9px] uppercase text-gray-400">Flex left</p>
          <p
            class="font-semibold"
            :class="liveEnvelope.flex_budget_ok ? 'text-emerald-700' : 'text-amber-800'"
          >
            €{{ formatEur(liveEnvelope.flex_budget) }}
          </p>
          <p class="text-[9px] text-gray-400">wk €{{ formatEur(liveWeek.flex_budget) }}</p>
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
          Seed = last 12 sealed months + cost envelope (rev−10%, COGS 25% margin-4). Sets rev, contract FT €, FT/flex % targets. Week = month÷4.
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
 * @last-modified: 2026-08-12T01:30:00.000Z
 * @description: Per-venue budget / min-max panels (shown via TeamBuilder pills)
 * @last-fix: [2026-08-12] Restore actual computed (Budget panel crash) + seed/save toasts
 * @adr-ref: ADR-016, ADR-022
 */

import type {
  StaffOrgAssignment,
  StaffOrgCostEnvelopeSnapshot,
  StaffOrgLaborBenchmark,
  StaffOrgLaborCostPctBuckets,
  StaffOrgLocationRule,
  StaffOrgLocationTargets,
  StaffOrgRosterMember,
  StaffOrgSlotHours,
  StaffOrgTeam,
} from '~/types/staff-org'
import {
  buildPnlCostEnvelope,
  laborPctTargetsFromEnvelope,
  weekSliceFromEnvelope,
} from '~/utils/accountingPnl/costEnvelope'
import {
  PNL_BUDGET_TARGET_COGS_PCT,
  PNL_BUDGET_TARGET_MARGIN,
} from '~/types/accounting-pnl-budget'
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
const fixedOhSeed = ref(0)
const envelopeSnap = ref<StaffOrgCostEnvelopeSnapshot | null>(null)
const statusMsg = ref('')
const statusOk = ref(true)
let statusTimer: ReturnType<typeof setTimeout> | null = null
const toast = useToast()

function setStatus (msg: string, ok = true, ms = 4000) {
  statusMsg.value = msg
  statusOk.value = ok
  if (statusTimer) clearTimeout(statusTimer)
  statusTimer = setTimeout(() => {
    statusMsg.value = ''
  }, ms)
}

onBeforeUnmount(() => {
  if (statusTimer) clearTimeout(statusTimer)
})

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
    envelopeSnap.value = t?.costEnvelope ?? null
    fixedOhSeed.value = t?.costEnvelope?.fixedOh
      ?? props.benchmark?.fixedOhMonthly
      ?? 0
  },
  { immediate: true, deep: true },
)

watch(
  () => props.saving,
  (saving, was) => {
    if (was && !saving && statusMsg.value.startsWith('Saving')) {
      setStatus('Budget targets saved.', true, 3000)
    }
  },
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

const liveEnvelope = computed(() => {
  if (!(monthly.value > 0)) return null
  const fl = contractMonthly.value
  const oh = fixedOhSeed.value
  return buildPnlCostEnvelope(monthly.value, fl, oh)
})

const liveWeek = computed(() => {
  const env = liveEnvelope.value
  if (!env) {
    return {
      cost_budget: 0,
      cogs_budget: 0,
      flex_budget: 0,
    }
  }
  return weekSliceFromEnvelope(env)
})

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

function toSnapshot (env: ReturnType<typeof buildPnlCostEnvelope>): StaffOrgCostEnvelopeSnapshot {
  const week = weekSliceFromEnvelope(env)
  return {
    costBudget: env.cost_budget,
    cogsBudget: env.cogs_budget,
    laborOhBudget: env.labor_oh_budget,
    fixedLabor: env.fixed_labor,
    fixedOh: env.fixed_oh,
    flexBudget: env.flex_budget,
    weekCostBudget: week.cost_budget,
    weekFlexBudget: week.flex_budget,
    targetMargin: PNL_BUDGET_TARGET_MARGIN,
    targetCogsPct: PNL_BUDGET_TARGET_COGS_PCT,
  }
}

function applyBenchmark() {
  const b = props.benchmark
  if (!b) {
    const msg = 'No P&L seed loaded — refresh the page and try again.'
    setStatus(msg, false)
    toast.add({ title: msg, color: 'warning', duration: 4000 })
    return
  }
  if (b.monthlyRevenue > 0) {
    monthly.value = b.monthlyRevenue
  }
  keukenPct.value = Math.round(b.keukenRevenueShare * 100)
  bedieningPct.value = Math.round(b.bedieningRevenueShare * 100)
  seededActual.value = { ...b.laborCostPct }
  fixedOhSeed.value = b.fixedOhMonthly
  contractOverride.value = b.fixedLaborMonthly > 0 ? b.fixedLaborMonthly : undefined

  const env = buildPnlCostEnvelope(
    monthly.value,
    b.fixedLaborMonthly,
    b.fixedOhMonthly,
  )
  const pcts = laborPctTargetsFromEnvelope(env)
  targetTotal.value = pcts.total ?? undefined
  targetFt.value = pcts.ft ?? undefined
  targetPt.value = pcts.flex ?? undefined
  targetZzp.value = undefined
  envelopeSnap.value = toSnapshot(env)

  const msgOk = `Seeded: rev €${formatEur(monthly.value)} · cost €${formatEur(env.cost_budget)} · flex €${formatEur(env.flex_budget)} — click Save to keep.`
  setStatus(msgOk, env.flex_budget_ok)
  toast.add({
    title: 'P&L envelope seeded',
    description: `Rev €${formatEur(monthly.value)} · flex €${formatEur(env.flex_budget)}/mo. Save to persist.`,
    color: 'success',
    duration: 4000,
  })
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
  const env = liveEnvelope.value
  setStatus('Saving budget targets…', true, 8000)
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
      costEnvelope: env ? toSnapshot(env) : envelopeSnap.value,
    },
  ])
}
</script>
