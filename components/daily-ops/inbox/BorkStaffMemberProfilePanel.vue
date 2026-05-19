<template>
  <div class="flex min-h-0 flex-1 flex-col gap-4">
    <div v-if="pending" class="text-sm text-gray-500">Loading profile…</div>
    <div v-else-if="err" class="text-sm text-red-600">{{ err }}</div>
    <template v-else-if="m">
      <div class="space-y-1 border-b border-gray-200 pb-3">
        <p class="text-xs font-semibold uppercase tracking-wide text-gray-500">Waiter</p>
        <p class="text-lg font-semibold text-gray-900">{{ m.name }}</p>
        <p v-if="m.email" class="text-sm text-gray-600">{{ m.email }}</p>
        <p v-if="m.location_name || m.team_name" class="text-xs text-gray-500">
          <span v-if="m.location_name">{{ m.location_name }}</span>
          <span v-if="m.location_name && m.team_name"> · </span>
          <span v-if="m.team_name">{{ m.team_name }}</span>
        </p>
      </div>

      <div v-if="m.bork_sales" class="space-y-2 border-b border-gray-100 pb-3 text-sm">
        <p class="text-xs font-semibold uppercase tracking-wide text-gray-500">Bork sales (ex VAT)</p>
        <div class="flex flex-wrap gap-2">
          <span
            class="inline-flex rounded-md bg-amber-50 px-2 py-1 text-xs font-semibold text-amber-950 ring-1 ring-amber-200/80"
          >
            {{ money(m.bork_sales.totals.total_sales_ex_vat) }}
          </span>
          <span
            v-if="m.bork_sales.totals.avg_sales_per_day != null"
            class="inline-flex rounded-md bg-gray-100 px-2 py-1 text-xs font-semibold text-gray-800"
          >
            {{ money(m.bork_sales.totals.avg_sales_per_day) }}/day
          </span>
          <span
            v-if="m.bork_sales.totals.productivity_per_hour != null"
            class="inline-flex rounded-md bg-violet-50 px-2 py-1 text-xs font-semibold text-violet-950 ring-1 ring-violet-200/80"
          >
            {{ money(m.bork_sales.totals.productivity_per_hour) }}/h
          </span>
        </div>
        <p class="text-[11px] text-gray-500">
          {{ m.bork_sales.totals.days_active }} active day(s) ·
          {{ formatIsoDate(m.bork_sales.range_start) }} – {{ formatIsoDate(m.bork_sales.range_end) }}
        </p>
      </div>

      <div v-if="borkByLocation.length" class="min-h-0 flex-1 space-y-2 overflow-y-auto border-t border-gray-100 pt-3">
        <p class="text-xs font-semibold uppercase tracking-wide text-gray-500">By location</p>
        <ul class="space-y-2">
          <li
            v-for="loc in borkByLocation"
            :key="loc.location_id"
            class="rounded-lg border border-gray-200 bg-gray-50/80 px-3 py-2 text-xs"
          >
            <p class="font-semibold text-gray-900">{{ loc.location_name }}</p>
            <p class="mt-1 text-gray-600 tabular-nums">
              {{ money(loc.total_sales_ex_vat) }} · {{ loc.days_active }} day(s)
            </p>
          </li>
        </ul>
      </div>

      <div v-if="m.eitje_totals" class="space-y-2 border-t border-gray-100 pt-3 text-sm">
        <p class="text-xs font-semibold uppercase tracking-wide text-gray-500">Hours (Eitje)</p>
        <span
          class="inline-flex rounded-md bg-emerald-50 px-2 py-1 text-xs font-semibold text-emerald-900 ring-1 ring-emerald-200/80"
        >
          Worked {{ m.eitje_totals.worked_hours.toFixed(1) }}h
        </span>
      </div>

      <p v-if="!m.bork_sales" class="text-xs text-gray-500">
        No Bork sales linked — confirm unified user mapping and Bork sync for this member.
      </p>
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'

type BorkSales = {
  range_start: string
  range_end: string
  totals: {
    total_sales_ex_vat: number
    days_active: number
    avg_sales_per_day: number | null
    productivity_per_hour: number | null
  }
  by_location: Array<{
    location_id: string
    location_name: string
    total_sales_ex_vat: number
    days_active: number
  }>
}

type MemberPayload = {
  _id: string
  name: string
  email?: string
  location_name?: string
  team_name?: string
  bork_sales?: BorkSales
  eitje_totals?: { worked_hours: number }
}

const props = defineProps<{ memberId: string }>()

const res = ref<{ success: boolean; data: MemberPayload } | null>(null)
const pending = ref(false)
const fetchError = ref<string | null>(null)

watch(
  () => props.memberId,
  async (id: string) => {
    const clean = String(id ?? '').trim()
    if (!clean) {
      res.value = null
      fetchError.value = null
      return
    }
    pending.value = true
    fetchError.value = null
    try {
      res.value = await $fetch<{ success: boolean; data: MemberPayload }>(`/api/members/${clean}`)
    } catch (e) {
      res.value = null
      fetchError.value = e instanceof Error ? e.message : 'Failed to load member'
    } finally {
      pending.value = false
    }
  },
  { immediate: true }
)

const m = computed(() => (res.value?.success && res.value.data ? res.value.data : null))
const err = computed(() => {
  if (pending.value) return ''
  if (fetchError.value) return fetchError.value
  if (!m.value) return 'Member not found'
  return ''
})

const borkByLocation = computed(() => m.value?.bork_sales?.by_location ?? [])

function money(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return '—'
  return `€${n.toLocaleString('nl-NL', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`
}

function formatIsoDate(val: string | null | undefined) {
  if (!val) return ''
  try {
    const [y, mo, d] = val.split('-').map(Number)
    if (!y || !mo || !d) return val
    return new Date(y, mo - 1, d).toLocaleDateString()
  } catch {
    return val ?? ''
  }
}
</script>
