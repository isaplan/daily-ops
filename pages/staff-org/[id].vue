<template>
  <div class="space-y-6 p-4 md:p-6">
    <header class="flex flex-wrap items-start justify-between gap-3">
      <div>
        <NuxtLink to="/staff-org" class="text-sm text-gray-600 hover:text-gray-900">← Scenarios</NuxtLink>
        <h1 class="mt-1 text-2xl font-bold text-gray-900">{{ scenario?.name ?? 'Staff Org' }}</h1>
        <p class="text-sm text-gray-600">
          Team first, then roster.
          <span v-if="scenario" class="ml-1 text-gray-500">
            · {{ (scenario.orgAssignments ?? []).length }} on org
            · {{ scenario.placements.length }} placements
          </span>
        </p>
      </div>
      <div class="flex flex-wrap items-center gap-2">
        <UButton size="sm" variant="outline" :loading="refreshingRoster" @click="refreshRoster">
          Sync roster from members
        </UButton>
      </div>
    </header>

    <div v-if="pending" class="text-sm text-gray-500">Loading…</div>
    <div v-else-if="!scenario" class="text-sm text-red-600">Scenario not found.</div>
    <template v-else>
      <div class="flex flex-wrap gap-2 border-b border-gray-200 pb-2">
        <button
          v-for="t in mainTabs"
          :key="t.id"
          type="button"
          class="rounded-md px-3 py-1.5 text-sm font-medium"
          :class="mainTab === t.id
            ? 'bg-gray-900 text-white'
            : 'bg-gray-100 text-gray-700 hover:bg-gray-200'"
          @click="mainTab = t.id"
        >
          {{ t.label }}
        </button>
      </div>

      <div v-if="mainTab === 'roster'" class="flex flex-wrap gap-2">
        <button
          v-for="t in teams"
          :key="t"
          type="button"
          class="rounded-md px-3 py-1.5 text-sm font-medium capitalize"
          :class="team === t
            ? 'bg-gray-800 text-white'
            : 'bg-gray-100 text-gray-700 hover:bg-gray-200'"
          @click="team = t"
        >
          {{ t }}
        </button>
      </div>

      <StaffOrgTeamBuilder
        v-if="mainTab === 'team'"
        :venues="scenario.venues ?? []"
        :roster="scenario.roster"
        :org-assignments="scenario.orgAssignments ?? []"
        :executive-assignments="scenario.executiveAssignments ?? []"
        :inactive-member-ids="scenario.inactiveMemberIds ?? []"
        :targets="scenario.locationTargets ?? []"
        :rules="scenario.locationRules"
        :slot-hours="slotHours"
        :benchmarks="laborBenchmarks"
        :saving-targets="savingTargets"
        :saving-rules="savingRules"
        @update:org="onOrg"
        @update:executive="onExecutive"
        @update:inactive="onInactive"
        @update:venues="onVenues"
        @save-targets="onSaveTargets"
        @save-rules="onSaveRules"
      />

      <template v-else>
        <div class="flex flex-wrap gap-2">
          <button
            v-for="v in openVenues"
            :key="v.locationId"
            type="button"
            class="rounded-md px-3 py-1.5 text-sm font-medium"
            :class="locationId === v.locationId
              ? 'bg-gray-900 text-white'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'"
            @click="locationId = v.locationId"
          >
            {{ v.short }}
          </button>
        </div>

        <StaffOrgBoard
          :location-id="locationId"
          :team="team"
          :roster="rosterForBoard"
          :full-roster="scenario.roster"
          :org-assignments="scenario.orgAssignments ?? []"
          :placements="scenario.placements"
          :metrics="metrics"
          :slot-hours="slotHours"
          :location-targets="scenario.locationTargets ?? []"
          :inactive-member-ids="scenario.inactiveMemberIds ?? []"
          :weekday-shares="weekdayShares"
          @update:placements="onPlacements"
          @update:inactive="onInactive"
        />
      </template>
    </template>
  </div>
</template>

<script setup lang="ts">
/**
 * @registry-id: pages/staff-org/[id]
 * @created: 2026-07-22T18:00:00.000Z
 * @last-modified: 2026-07-23T11:20:00.000Z
 * @description: Staff Org — TeamBuilder + RosterPlanner tabs
 * @last-fix: [2026-07-23] Save status via toast
 * @adr-ref: ADR-016
 */

import type {
  StaffOrgAssignment,
  StaffOrgCellMetrics,
  StaffOrgExecutiveAssignment,
  StaffOrgLaborBenchmark,
  StaffOrgLocationRule,
  StaffOrgLocationTargets,
  StaffOrgPlacement,
  StaffOrgScenario,
  StaffOrgSlotHours,
  StaffOrgTeam,
  StaffOrgVenue,
} from '~/types/staff-org'
import { defaultStaffOrgVenues } from '~/utils/staffOrg/defaultVenues'
import { buildSlotMetrics } from '~/utils/staffOrg/buildSlotMetrics'

definePageMeta({ keepalive: false })

const route = useRoute()
const id = computed(() => String(route.params.id ?? ''))

type BoardPayload = {
  scenario: StaffOrgScenario
  slotHours: StaffOrgSlotHours[]
  metrics: StaffOrgCellMetrics[]
}

const { data, pending, refresh } = await useAsyncData(
  () => `staff-org-scenario-${id.value}`,
  () => $fetch<{ success: boolean; data: BoardPayload }>(`/api/staff-org/scenarios/${id.value}`),
  { watch: [id] },
)

const scenario = computed(() => data.value?.data.scenario ?? null)
const slotHours = computed(() => data.value?.data.slotHours ?? [])
const metrics = computed(() => data.value?.data.metrics ?? [])

onMounted(() => {
  void refresh()
})

const mainTabs = [
  { id: 'team' as const, label: '1. TeamBuilder' },
  { id: 'roster' as const, label: '2. RosterPlanner' },
]
const mainTab = ref<'team' | 'roster'>('team')

const openVenues = computed(() =>
  (scenario.value?.venues?.length ? scenario.value.venues : defaultStaffOrgVenues())
    .filter((v) => v.status === 'open'),
)
const locationId = ref('')
watch(
  openVenues,
  (list) => {
    if (!list.length) return
    if (!list.some((v) => v.locationId === locationId.value)) {
      locationId.value = list[0]!.locationId
    }
  },
  { immediate: true },
)
const teams: StaffOrgTeam[] = ['keuken', 'bediening', 'bar']
const team = ref<StaffOrgTeam>('bediening')

/** Roster tab: only org-assigned staff at this venue × team (+ inactive for Not active). */
const rosterForBoard = computed(() => {
  const s = scenario.value
  if (!s) return []
  const inactive = new Set(s.inactiveMemberIds ?? [])
  const allowed = new Set(
    (s.orgAssignments ?? [])
      .filter((a) => a.locationId === locationId.value && a.team === team.value)
      .map((a) => a.memberId),
  )
  return s.roster.filter((m) => allowed.has(m.memberId) || inactive.has(m.memberId))
})

/** September weekday mix by default (historical 2024–2025). */
const planningMonth = ref(9)

const { data: shareData } = await useAsyncData(
  () => `staff-org-wd-share-${locationId.value}-${planningMonth.value}`,
  () => $fetch<{
    success: boolean
    data: { shares: Array<{ weekday: number; share: number }> }
  }>(
    `/api/staff-org/weekday-revenue-share?locationId=${locationId.value}&month=${planningMonth.value}&years=2024,2025`,
  ),
  { watch: [locationId, planningMonth] },
)

const weekdayShares = computed(() =>
  (shareData.value?.data.shares ?? []).map((s) => ({
    weekday: s.weekday as 0 | 1 | 2 | 3 | 4 | 5 | 6,
    share: s.share,
  })),
)

const { data: benchmarkData } = await useAsyncData(
  'staff-org-labor-benchmarks',
  () => $fetch<{
    success: boolean
    data: { year: number; venues: StaffOrgLaborBenchmark[] }
  }>('/api/staff-org/labor-benchmarks'),
)

const laborBenchmarks = computed(() => benchmarkData.value?.data.venues ?? [])

const toast = useToast()
const SAVE_TOAST_ID = 'staff-org-save'

const savingRules = ref(false)
const savingTargets = ref(false)
const refreshingRoster = ref(false)
let saveTimer: ReturnType<typeof setTimeout> | null = null
let patchChain: Promise<void> = Promise.resolve()
/** Bumped on every local board edit + each PATCH start; stale responses ignored. */
let saveGen = 0

function clearSaveTimer() {
  if (saveTimer) {
    clearTimeout(saveTimer)
    saveTimer = null
  }
}

function showSaveToast(
  title: string,
  color: 'neutral' | 'green' | 'red' = 'neutral',
  duration = 2000,
) {
  const existing = toast.toasts.value.some((t) => t.id === SAVE_TOAST_ID)
  if (existing) {
    toast.update(SAVE_TOAST_ID, { title, color, duration })
  } else {
    toast.add({ id: SAVE_TOAST_ID, title, color, duration })
  }
}

function recomputeLocalMetrics() {
  const payload = data.value?.data
  if (!payload?.scenario) return
  payload.metrics = buildSlotMetrics({
    placements: payload.scenario.placements,
    rules: payload.scenario.locationRules,
    roster: payload.scenario.roster,
    slotHours: payload.slotHours,
  })
}

function prunePlacementsToOrg() {
  const s = data.value?.data.scenario
  if (!s) return
  const inactive = new Set(s.inactiveMemberIds ?? [])
  const allowed = new Set(
    (s.orgAssignments ?? []).map((a) => `${a.memberId}|${a.locationId}|${a.team}`),
  )
  s.placements = s.placements.filter((p) => {
    if (inactive.has(p.memberId)) return false
    return allowed.has(`${p.memberId}|${p.locationId}|${p.team}`)
  })
}

/** Latest board fields from local scenario (avoids stale closures). */
function boardPatchBody(extra: Record<string, unknown> = {}): Record<string, unknown> {
  const s = data.value?.data.scenario
  if (!s) return { ...extra }
  return {
    orgAssignments: s.orgAssignments ?? [],
    executiveAssignments: s.executiveAssignments ?? [],
    placements: s.placements ?? [],
    inactiveMemberIds: s.inactiveMemberIds ?? [],
    venues: s.venues,
    ...extra,
  }
}

function scheduleBoardSave() {
  saveGen += 1
  const targetId = id.value
  clearSaveTimer()
  saveTimer = setTimeout(() => {
    if (targetId !== id.value) return
    void flushBoardSave()
  }, 400)
}

async function flushBoardSave(extra: Record<string, unknown> = {}) {
  clearSaveTimer()
  const targetId = id.value
  if (!data.value?.data.scenario || targetId !== id.value) return
  await patchScenario(boardPatchBody(extra), targetId)
}

function onOrg(orgAssignments: StaffOrgAssignment[]) {
  if (!data.value?.data.scenario) return
  data.value.data.scenario.orgAssignments = orgAssignments
  const orgIds = new Set(orgAssignments.map((a) => a.memberId))
  data.value.data.scenario.executiveAssignments = (
    data.value.data.scenario.executiveAssignments ?? []
  ).filter((e) => !orgIds.has(e.memberId))
  prunePlacementsToOrg()
  recomputeLocalMetrics()
  scheduleBoardSave()
}

function onExecutive(executiveAssignments: StaffOrgExecutiveAssignment[]) {
  if (!data.value?.data.scenario) return
  data.value.data.scenario.executiveAssignments = executiveAssignments
  const execIds = new Set(executiveAssignments.map((e) => e.memberId))
  data.value.data.scenario.orgAssignments = (data.value.data.scenario.orgAssignments ?? [])
    .filter((a) => !execIds.has(a.memberId))
  prunePlacementsToOrg()
  recomputeLocalMetrics()
  scheduleBoardSave()
}

function onVenues(venues: StaffOrgVenue[]) {
  if (!data.value?.data.scenario) return
  data.value.data.scenario.venues = venues
  const closed = new Set(venues.filter((v) => v.status === 'closed').map((v) => v.locationId))
  data.value.data.scenario.orgAssignments = (data.value.data.scenario.orgAssignments ?? [])
    .filter((a) => !closed.has(a.locationId))
  prunePlacementsToOrg()
  recomputeLocalMetrics()
  scheduleBoardSave()
}

function onInactive(inactiveMemberIds: string[]) {
  if (!data.value?.data.scenario) return
  data.value.data.scenario.inactiveMemberIds = inactiveMemberIds
  data.value.data.scenario.orgAssignments = (data.value.data.scenario.orgAssignments ?? [])
    .filter((a) => !inactiveMemberIds.includes(a.memberId))
  data.value.data.scenario.executiveAssignments = (
    data.value.data.scenario.executiveAssignments ?? []
  ).filter((a) => !inactiveMemberIds.includes(a.memberId))
  data.value.data.scenario.placements = data.value.data.scenario.placements.filter(
    (p) => !inactiveMemberIds.includes(p.memberId),
  )
  recomputeLocalMetrics()
  scheduleBoardSave()
}

async function patchScenario(body: Record<string, unknown>, targetId: string) {
  const seq = ++saveGen
  showSaveToast('Saving…', 'neutral', 0)

  const run = async () => {
    try {
      const res = await $fetch<{ success: boolean; data: BoardPayload }>(
        `/api/staff-org/scenarios/${targetId}`,
        { method: 'PATCH', body },
      )
      // Stale response — local edits happened while this PATCH was in flight
      if (seq !== saveGen || targetId !== id.value) return
      data.value = res
      showSaveToast('Saved', 'green', 1800)
    } catch {
      if (seq !== saveGen || targetId !== id.value) return
      showSaveToast('Save failed', 'red', 4000)
      await refresh()
    }
  }

  patchChain = patchChain.then(run, run)
  await patchChain
}

function onPlacements(placements: StaffOrgPlacement[]) {
  if (!data.value?.data.scenario) return
  data.value.data.scenario.placements = placements
  recomputeLocalMetrics()
  scheduleBoardSave()
}

async function onSaveRules(rules: StaffOrgLocationRule[]) {
  savingRules.value = true
  try {
    const sample = rules[0]
    if (!sample) return
    const others = (scenario.value?.locationRules ?? []).filter(
      (r) => !(r.locationId === sample.locationId && r.team === sample.team),
    )
    const forBoard = rules.filter(
      (r) => r.locationId === sample.locationId && r.team === sample.team,
    )
    const locationRules = [...others, ...forBoard]
    if (data.value?.data.scenario) {
      data.value.data.scenario.locationRules = locationRules
      recomputeLocalMetrics()
    }
    // Flush board + rules together so pending DnD is not dropped
    await flushBoardSave({ locationRules })
  } finally {
    savingRules.value = false
  }
}

async function onSaveTargets(locationTargets: StaffOrgLocationTargets[]) {
  savingTargets.value = true
  try {
    if (data.value?.data.scenario) {
      data.value.data.scenario.locationTargets = locationTargets
    }
    await flushBoardSave({ locationTargets })
  } finally {
    savingTargets.value = false
  }
}

async function refreshRoster() {
  refreshingRoster.value = true
  try {
    await flushBoardSave({ refreshRoster: true })
  } finally {
    refreshingRoster.value = false
  }
}

watch(id, () => {
  clearSaveTimer()
  saveGen += 1
  void refresh()
})

onBeforeUnmount(() => {
  clearSaveTimer()
  saveGen += 1
})
</script>
