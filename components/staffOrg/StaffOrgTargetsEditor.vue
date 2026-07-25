<template>
  <div class="rounded-lg border border-gray-200 bg-white p-4">
    <div class="mb-3 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h3 class="text-sm font-semibold text-gray-900">Revenue & min productivity</h3>
        <p class="text-xs text-gray-500">
          Monthly ÷ 4 = weekly revenue. Hour budget = weekly ÷ min €/h (FT only).
          Example: €150.000 → €37.500/w; at €75/h → max 500u/w.
        </p>
      </div>
      <UButton size="xs" variant="outline" :loading="saving" @click="emitSave">Save targets</UButton>
    </div>
    <div class="flex flex-wrap gap-4">
      <label class="text-xs text-gray-600">
        Est. monthly revenue (€)
        <input
          v-model.number="monthly"
          type="number"
          min="0"
          step="1000"
          class="mt-1 block w-40 rounded border border-gray-300 px-2 py-1.5 text-sm tabular-nums"
        >
      </label>
      <label class="text-xs text-gray-600">
        Min labor productivity (€/h FT)
        <input
          v-model.number="minProd"
          type="number"
          min="0"
          step="1"
          class="mt-1 block w-40 rounded border border-gray-300 px-2 py-1.5 text-sm tabular-nums"
        >
      </label>
      <div class="text-xs text-gray-500 self-end pb-1.5">
        Weekly ≈ €{{ weeklyPreview.toLocaleString('nl-NL') }}
        <span v-if="minProd > 0 && weeklyPreview > 0">
          · budget ≈ {{ Math.round(weeklyPreview / minProd) }}u
        </span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
/**
 * @registry-id: StaffOrgTargetsEditor
 * @created: 2026-07-22T22:45:00.000Z
 * @last-modified: 2026-07-22T22:45:00.000Z
 * @description: Edit monthly revenue + min €/h for one location
 * @last-fix: [2026-07-22] Initial targets editor
 * @adr-ref: ADR-016
 */

import type { StaffOrgLocationTargets } from '~/types/staff-org'
import { STAFF_ORG_WEEKS_PER_MONTH } from '~/types/staff-org'

const props = defineProps<{
  locationId: string
  targets: StaffOrgLocationTargets[]
  saving?: boolean
}>()

const emit = defineEmits<{
  save: [targets: StaffOrgLocationTargets[]]
}>()

const monthly = ref(0)
const minProd = ref(0)

watch(
  () => [props.locationId, props.targets] as const,
  () => {
    const t = props.targets.find((x) => x.locationId === props.locationId)
    monthly.value = t?.estimatedMonthlyRevenue ?? 0
    minProd.value = t?.minLaborProductivity ?? 0
  },
  { immediate: true, deep: true },
)

const weeklyPreview = computed(() =>
  monthly.value > 0 ? Math.round(monthly.value / STAFF_ORG_WEEKS_PER_MONTH) : 0,
)

function emitSave() {
  const others = props.targets.filter((t) => t.locationId !== props.locationId)
  const prev = props.targets.find((t) => t.locationId === props.locationId)
  emit('save', [
    ...others,
    {
      locationId: props.locationId,
      estimatedMonthlyRevenue: Math.max(0, Number(monthly.value) || 0),
      minLaborProductivity: Math.max(0, Number(minProd.value) || 0),
      keukenRevenueShare: prev?.keukenRevenueShare ?? 0.5,
      bedieningRevenueShare: prev?.bedieningRevenueShare ?? 0.5,
      contractLaborCostMonthly: prev?.contractLaborCostMonthly ?? null,
      laborCostPctActual: prev?.laborCostPctActual ?? {
        total: null, ft: null, pt: null, zzp: null,
      },
      laborCostPctTarget: prev?.laborCostPctTarget ?? {
        total: null, ft: null, pt: null, zzp: null,
      },
    },
  ])
}
</script>
