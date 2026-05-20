<template>
  <div class="mb-6 flex flex-wrap items-end gap-4 rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
    <div class="flex flex-col gap-1">
      <label class="text-xs font-semibold uppercase text-gray-500">Periode</label>
      <select
        :value="period"
        class="min-w-[160px] rounded border border-gray-300 px-2 py-1.5 text-sm"
        @change="onPeriodChange"
      >
        <optgroup label="Dag">
          <option value="today">Vandaag</option>
          <option value="yesterday">Gisteren</option>
        </optgroup>
        <optgroup label="Week">
          <option value="this-week">Deze week</option>
          <option value="last-week">Vorige week</option>
          <option value="wtd">Week tot nu toe</option>
          <option value="last-7d">Laatste 7 dagen</option>
        </optgroup>
        <optgroup label="Maand">
          <option value="this-month">Deze maand</option>
          <option value="last-month">Vorige maand</option>
          <option value="mtd">Maand tot nu toe</option>
          <option value="last-30d">Laatste 30 dagen</option>
        </optgroup>
        <optgroup label="Kwartaal">
          <option value="q1">Q1</option>
          <option value="q2">Q2</option>
          <option value="q3">Q3</option>
          <option value="q4">Q4</option>
          <option value="last-q">Vorig kwartaal</option>
        </optgroup>
        <optgroup label="Seizoen">
          <option value="lente">Lente</option>
          <option value="zomer">Zomer</option>
          <option value="herfst">Herfst</option>
          <option value="winter">Winter</option>
        </optgroup>
        <optgroup label="Jaar">
          <option value="this-year">Dit jaar</option>
          <option value="last-year">Vorig jaar</option>
          <option value="ytd">Jaar tot nu toe</option>
        </optgroup>
        <optgroup label="Rollend">
          <option value="last-14d">Laatste 14 dagen</option>
          <option value="last-60d">Laatste 60 dagen</option>
          <option value="last-90d">Laatste 90 dagen</option>
        </optgroup>
        <option value="custom">Aangepast…</option>
      </select>
    </div>

    <div v-if="period === 'custom'" class="flex gap-2">
      <div class="flex flex-col gap-1">
        <label class="text-xs font-semibold uppercase text-gray-500">Van</label>
        <input v-model="customStart" type="date" class="rounded border border-gray-300 px-2 py-1.5 text-sm" />
      </div>
      <div class="flex flex-col gap-1">
        <label class="text-xs font-semibold uppercase text-gray-500">Tot</label>
        <input v-model="customEnd" type="date" class="rounded border border-gray-300 px-2 py-1.5 text-sm" />
      </div>
      <button
        type="button"
        class="self-end rounded bg-gray-900 px-3 py-1.5 text-sm font-semibold text-white"
        @click="applyCustom"
      >
        Toepassen
      </button>
    </div>

    <div class="flex flex-col gap-1">
      <label class="text-xs font-semibold uppercase text-gray-500">Vergelijk met</label>
      <select
        :value="compareTo"
        class="min-w-[140px] rounded border border-gray-300 px-2 py-1.5 text-sm"
        @change="onCompareChange"
      >
        <option value="none">Geen</option>
        <option value="previous">Vorige periode</option>
        <option value="ly">Vorig jaar</option>
      </select>
    </div>

    <div class="flex flex-col gap-1">
      <label class="text-xs font-semibold uppercase text-gray-500">Locatie</label>
      <select
        :value="locationId ?? 'all'"
        class="min-w-[140px] rounded border border-gray-300 px-2 py-1.5 text-sm"
        @change="onLocationChange"
      >
        <option value="all">Alle zaken</option>
        <option value="69d6cfa63d2adf93b79d1ae7">Van Kinsbergen</option>
        <option value="69d6cfa63d2adf93b79d1ae6">Bar Bea</option>
        <option value="69d6cfa73d2adf93b79d1ae8">l'Amour Toujours</option>
      </select>
    </div>

    <p class="text-sm text-gray-600">
      {{ primaryRange.label }} · {{ primaryRange.startDate }} – {{ primaryRange.endDate }}
      <span v-if="compareRange"> · vs {{ compareRange.label }}</span>
    </p>
  </div>
</template>

<script setup lang="ts">
import type { DailyOpsRevenueCompareKind, DailyOpsRevenuePeriodId } from '~/types/daily-ops-revenue'

const {
  period,
  compareTo,
  locationId,
  primaryRange,
  compareRange,
  setPeriod,
  setCompareTo,
  setLocation,
  setCustomRange,
} = useDailyOpsRevenuePeriod()

const customStart = ref(primaryRange.value.startDate)
const customEnd = ref(primaryRange.value.endDate)

watch(primaryRange, (r) => {
  customStart.value = r.startDate
  customEnd.value = r.endDate
})

function onPeriodChange(e: Event) {
  const v = (e.target as HTMLSelectElement).value as DailyOpsRevenuePeriodId
  setPeriod(v)
}

function onCompareChange(e: Event) {
  setCompareTo((e.target as HTMLSelectElement).value as DailyOpsRevenueCompareKind)
}

function onLocationChange(e: Event) {
  const v = (e.target as HTMLSelectElement).value
  setLocation(v === 'all' ? null : v)
}

function applyCustom() {
  if (customStart.value && customEnd.value) {
    setCustomRange(customStart.value, customEnd.value)
  }
}
</script>
