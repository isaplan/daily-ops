<template>
  <div class="flex min-h-0 flex-1 flex-col gap-4">
    <div v-if="pending" class="text-sm text-gray-500">Loading profile…</div>
    <div v-else-if="err" class="text-sm text-red-600">{{ err }}</div>
    <template v-else-if="m">
      <div class="space-y-1 border-b border-gray-200 pb-3">
        <p class="text-xs font-semibold uppercase tracking-wide text-gray-500">Worker</p>
        <p class="text-lg font-semibold text-gray-900">{{ m.name }}</p>
        <p v-if="m.email" class="text-sm text-gray-600">{{ m.email }}</p>
        <p v-if="m.location_name || m.team_name" class="text-xs text-gray-500">
          <span v-if="m.location_name">{{ m.location_name }}</span>
          <span v-if="m.location_name && m.team_name"> · </span>
          <span v-if="m.team_name">{{ m.team_name }}</span>
        </p>
      </div>

      <div v-if="hasWorker" class="space-y-2 text-sm">
        <p class="text-xs font-semibold uppercase tracking-wide text-gray-500">Contract & pay</p>
        <div v-if="m.contract_type" class="flex justify-between gap-2">
          <span class="text-gray-600">Type</span>
          <span class="font-medium text-gray-900">{{ m.contract_type }}</span>
        </div>
        <div v-if="m.contract_start_date" class="flex justify-between gap-2">
          <span class="text-gray-600">Start</span>
          <span class="font-medium">{{ formatDate(m.contract_start_date) }}</span>
        </div>
        <div v-if="m.contract_end_date" class="flex justify-between gap-2">
          <span class="text-gray-600">End</span>
          <span class="font-medium">{{ formatDate(m.contract_end_date) }}</span>
        </div>
        <div v-if="m.hourly_rate != null" class="flex justify-between gap-2">
          <span class="text-gray-600">€/h</span>
          <span class="font-medium tabular-nums">€{{ m.hourly_rate.toFixed(2) }}</span>
        </div>
        <div v-if="m.cost_per_hour != null" class="flex justify-between gap-2">
          <span class="text-gray-600">Cost/h</span>
          <span class="font-medium tabular-nums">€{{ m.cost_per_hour.toFixed(2) }}</span>
        </div>
        <div v-if="m.support_id" class="flex justify-between gap-2">
          <span class="text-gray-600">Support ID</span>
          <span class="font-mono text-xs text-gray-800">{{ m.support_id }}</span>
        </div>
      </div>

      <div v-if="m.eitje_totals" class="space-y-2 border-t border-gray-100 pt-3">
        <p class="text-xs font-semibold uppercase tracking-wide text-gray-500">Hours (Eitje)</p>
        <div class="flex flex-wrap gap-2">
          <span
            class="inline-flex rounded-md bg-emerald-50 px-2 py-1 text-xs font-semibold text-emerald-900 ring-1 ring-emerald-200/80"
          >
            Worked {{ m.eitje_totals.worked_hours.toFixed(1) }}h
          </span>
          <span
            class="inline-flex rounded-md bg-sky-50 px-2 py-1 text-xs font-semibold text-sky-900 ring-1 ring-sky-200/80"
          >
            Planned {{ m.eitje_totals.planned_hours.toFixed(1) }}h
          </span>
        </div>
        <p v-if="m.eitje_places" class="text-[11px] text-gray-500">
          {{ m.eitje_places.months_back }} mo · {{ formatIsoDate(m.eitje_places.range_start) }} – {{ formatIsoDate(m.eitje_places.range_end) }}
        </p>
      </div>

      <div v-if="locationsGrouped.length" class="min-h-0 flex-1 space-y-3 overflow-y-auto border-t border-gray-100 pt-3">
        <p class="text-xs font-semibold uppercase tracking-wide text-gray-500">By location</p>
        <div
          v-for="loc in locationsGrouped"
          :key="loc.location_key"
          class="rounded-lg border border-gray-200 bg-gray-50/80 p-3 text-xs"
        >
          <p class="font-semibold text-gray-900">{{ loc.location_name }}</p>
          <p class="mt-1 text-gray-600">
            Worked {{ loc.worked_total.toFixed(1) }}h · Planned {{ loc.planned_total.toFixed(1) }}h
          </p>
          <ul class="mt-2 space-y-1.5 border-t border-gray-200/80 pt-2">
            <li v-for="(t, ti) in loc.teams" :key="`${loc.location_key}-${ti}`" class="text-gray-700">
              <span class="font-medium">{{ t.team_name }}</span>
              <span class="text-gray-500"> — {{ t.worked_hours.toFixed(1) }}h / {{ t.planned_hours.toFixed(1) }}h</span>
            </li>
          </ul>
        </div>
      </div>
      <p v-else-if="m.eitje_places?.merged?.length === 0" class="text-xs text-gray-500">
        No Eitje shift rows in range for this member.
      </p>

      <p
        v-if="m && !hasWorker && !m.eitje_totals && (!m.eitje_places?.merged || m.eitje_places.merged.length === 0)"
        class="text-xs text-gray-500"
      >
        No contract or hours on file yet — open full page to edit.
      </p>
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'

type MergedRow = {
  location_name: string
  team_name: string
  worked_hours: number
  planned_hours: number
  worked_records: number
  planned_records: number
}

type MemberPayload = {
  _id: string
  name: string
  email?: string
  location_name?: string
  team_name?: string
  contract_type?: string
  contract_start_date?: string
  contract_end_date?: string
  hourly_rate?: number
  cost_per_hour?: number
  support_id?: string
  eitje_places?: {
    months_back: number
    range_start: string
    range_end: string
    merged: MergedRow[]
  }
  eitje_totals?: {
    worked_hours: number
    planned_hours: number
    places_count: number
  }
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

const hasWorker = computed(() => {
  const x = m.value
  if (!x) return false
  return !!(
    x.contract_type ||
    x.contract_start_date ||
    x.contract_end_date ||
    x.hourly_rate != null ||
    x.cost_per_hour != null ||
    (x.support_id && x.support_id.trim())
  )
})

type TeamInLoc = {
  team_name: string
  worked_hours: number
  planned_hours: number
  worked_records: number
  planned_records: number
}
type LocCard = {
  location_key: string
  location_name: string
  teams: TeamInLoc[]
  worked_total: number
  planned_total: number
}

const locationsGrouped = computed((): LocCard[] => {
  const merged = m.value?.eitje_places?.merged ?? []
  const map = new Map<string, { location_name: string; teams: TeamInLoc[] }>()
  for (const row of merged) {
    const locName = (row.location_name ?? 'Unknown').trim() || 'Unknown'
    const key = locName.toLowerCase()
    let g = map.get(key)
    if (!g) {
      g = { location_name: locName, teams: [] }
      map.set(key, g)
    }
    g.teams.push({
      team_name: row.team_name ?? 'Unknown',
      worked_hours: row.worked_hours,
      planned_hours: row.planned_hours,
      worked_records: row.worked_records,
      planned_records: row.planned_records,
    })
  }
  const out: LocCard[] = []
  for (const [location_key, g] of map) {
    g.teams.sort((a, b) => a.team_name.localeCompare(b.team_name, undefined, { sensitivity: 'base' }))
    const worked_total = g.teams.reduce((s, t) => s + t.worked_hours, 0)
    const planned_total = g.teams.reduce((s, t) => s + t.planned_hours, 0)
    out.push({ location_key, location_name: g.location_name, teams: g.teams, worked_total, planned_total })
  }
  out.sort((a, b) => a.location_name.localeCompare(b.location_name, undefined, { sensitivity: 'base' }))
  return out
})

function formatDate(val: string | null | undefined) {
  if (!val) return ''
  try {
    return new Date(val).toLocaleDateString()
  } catch {
    return ''
  }
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
