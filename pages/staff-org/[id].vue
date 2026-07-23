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
        <span v-if="saveState" class="text-xs" :class="saveStateClass">{{ saveState }}</span>
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
        @update:org="onOrg"
        @update:executive="onExecutive"
        @update:inactive="onInactive"
        @update:venues="onVenues"
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
          :placements="scenario.placements"
          :metrics="metrics"
          :slot-hours="slotHours"
          :location-targets="scenario.locationTargets ?? []"
          :inactive-member-ids="scenario.inactiveMemberIds ?? []"
          :weekday-shares="weekdayShares"
          @update:placements="onPlacements"
          @update:inactive="onInactive"
        />

        <StaffOrgTargetsEditor
          :location-id="locationId"
          :targets="scenario.locationTargets ?? []"
          :saving="savingTargets"
          @save="onSaveTargets"
        />

        <StaffOrgRulesEditor
          :location-id="locationId"
          :team="team"
          :rules="scenario.locationRules"
          :saving="savingRules"
          @save="onSaveRules"
        />
      </template>
    </template>
  </div>
</template>

<script setup lang="ts">
/**
 * @registry-id: pages/staff-org/[id]
 * @created: 2026-07-22T18:00:00.000Z
 * @last-modified: 2026-07-23T01:45:00.000Z
 * @description: Staff Org — TeamBuilder + RosterPlanner tabs
 * @last-fix: [2026-07-23] Scenario venues open/closed + new location
 * @adr-ref: ADR-016
 */

import type {
  StaffOrgAssignment,
  StaffOrgCellMetrics,
  StaffOrgExecutiveAssignment,
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

const saveState = ref('')
const saveFailed = ref(false)
const savingRules = ref(false)
const savingTargets = ref(false)
const refreshingRoster = ref(false)
let saveTimer: ReturnType<typeof setTimeout> | null = null
let patchChain: Promise<void> = Promise.resolve()
let patchSeq = 0

const saveStateClass = computed(() =>
  saveFailed.value ? 'text-red-600' : 'text-gray-500',
)

function clearSaveTimer() {
  if (saveTimer) {
    clearTimeout(saveTimer)
    saveTimer = null
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

function onOrg(orgAssignments: StaffOrgAssignment[]) {
  if (!data.value?.data.scenario) return
  const targetId = id.value
  data.value.data.scenario.orgAssignments = orgAssignments
  // Venue placement removes executive
  const orgIds = new Set(orgAssignments.map((a) => a.memberId))
  data.value.data.scenario.executiveAssignments = (
    data.value.data.scenario.executiveAssignments ?? []
  ).filter((e) => !orgIds.has(e.memberId))
  prunePlacementsToOrg()
  recomputeLocalMetrics()
  clearSaveTimer()
  saveTimer = setTimeout(() => {
    if (targetId !== id.value) return
    void patchScenario(
      {
        orgAssignments,
        executiveAssignments: data.value?.data.scenario.executiveAssignments,
        placements: data.value?.data.scenario.placements,
        inactiveMemberIds: data.value?.data.scenario.inactiveMemberIds ?? [],
        venues: data.value?.data.scenario.venues,
      },
      targetId,
    )
  }, 400)
}

function onExecutive(executiveAssignments: StaffOrgExecutiveAssignment[]) {
  if (!data.value?.data.scenario) return
  const targetId = id.value
  data.value.data.scenario.executiveAssignments = executiveAssignments
  const execIds = new Set(executiveAssignments.map((e) => e.memberId))
  data.value.data.scenario.orgAssignments = (data.value.data.scenario.orgAssignments ?? [])
    .filter((a) => !execIds.has(a.memberId))
  prunePlacementsToOrg()
  recomputeLocalMetrics()
  clearSaveTimer()
  saveTimer = setTimeout(() => {
    if (targetId !== id.value) return
    void patchScenario(
      {
        executiveAssignments,
        orgAssignments: data.value?.data.scenario.orgAssignments,
        placements: data.value?.data.scenario.placements,
        inactiveMemberIds: data.value?.data.scenario.inactiveMemberIds ?? [],
      },
      targetId,
    )
  }, 400)
}

function onVenues(venues: StaffOrgVenue[]) {
  if (!data.value?.data.scenario) return
  const targetId = id.value
  data.value.data.scenario.venues = venues
  const closed = new Set(venues.filter((v) => v.status === 'closed').map((v) => v.locationId))
  data.value.data.scenario.orgAssignments = (data.value.data.scenario.orgAssignments ?? [])
    .filter((a) => !closed.has(a.locationId))
  prunePlacementsToOrg()
  recomputeLocalMetrics()
  clearSaveTimer()
  saveTimer = setTimeout(() => {
    if (targetId !== id.value) return
    void patchScenario(
      {
        venues,
        orgAssignments: data.value?.data.scenario.orgAssignments,
        placements: data.value?.data.scenario.placements,
        inactiveMemberIds: data.value?.data.scenario.inactiveMemberIds ?? [],
      },
      targetId,
    )
  }, 400)
}

function onInactive(inactiveMemberIds: string[]) {
  if (!data.value?.data.scenario) return
  const targetId = id.value
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
  clearSaveTimer()
  saveTimer = setTimeout(() => {
    if (targetId !== id.value) return
    void patchScenario(
      {
        inactiveMemberIds,
        orgAssignments: data.value?.data.scenario.orgAssignments,
        executiveAssignments: data.value?.data.scenario.executiveAssignments,
        placements: data.value?.data.scenario.placements,
      },
      targetId,
    )
  }, 400)
}

async function patchScenario(body: Record<string, unknown>, targetId: string) {
  const seq = ++patchSeq
  saveFailed.value = false
  saveState.value = 'Saving…'

  const run = async () => {
    try {
      const res = await $fetch<{ success: boolean; data: BoardPayload }>(
        `/api/staff-org/scenarios/${targetId}`,
        { method: 'PATCH', body },
      )
      if (seq !== patchSeq || targetId !== id.value) return
      data.value = res
      saveState.value = 'Saved'
      setTimeout(() => {
        if (saveState.value === 'Saved') saveState.value = ''
      }, 1500)
    } catch {
      if (seq !== patchSeq || targetId !== id.value) return
      saveFailed.value = true
      saveState.value = 'Save failed'
      await refresh()
    }
  }

  patchChain = patchChain.then(run, run)
  await patchChain
}

function onPlacements(placements: StaffOrgPlacement[]) {
  if (!data.value?.data.scenario) return
  const targetId = id.value
  data.value.data.scenario.placements = placements
  recomputeLocalMetrics()
  clearSaveTimer()
  saveTimer = setTimeout(() => {
    if (targetId !== id.value) return
    void patchScenario(
      {
        placements,
        inactiveMemberIds: data.value?.data.scenario.inactiveMemberIds ?? [],
        orgAssignments: data.value?.data.scenario.orgAssignments ?? [],
      },
      targetId,
    )
  }, 400)
}

async function onSaveRules(rules: StaffOrgLocationRule[]) {
  clearSaveTimer()
  savingRules.value = true
  try {
    const others = (scenario.value?.locationRules ?? []).filter(
      (r) => !(r.locationId === locationId.value && r.team === team.value),
    )
    const forBoard = rules.filter(
      (r) => r.locationId === locationId.value && r.team === team.value,
    )
    const locationRules = [...others, ...forBoard]
    if (data.value?.data.scenario) {
      data.value.data.scenario.locationRules = locationRules
      recomputeLocalMetrics()
    }
    await patchScenario({
      locationRules,
      placements: scenario.value?.placements,
    }, id.value)
  } finally {
    savingRules.value = false
  }
}

async function onSaveTargets(locationTargets: StaffOrgLocationTargets[]) {
  clearSaveTimer()
  savingTargets.value = true
  try {
    if (data.value?.data.scenario) {
      data.value.data.scenario.locationTargets = locationTargets
    }
    await patchScenario({ locationTargets }, id.value)
  } finally {
    savingTargets.value = false
  }
}

async function refreshRoster() {
  clearSaveTimer()
  refreshingRoster.value = true
  try {
    await patchScenario({
      refreshRoster: true,
      placements: scenario.value?.placements,
      orgAssignments: scenario.value?.orgAssignments,
    }, id.value)
  } finally {
    refreshingRoster.value = false
  }
}

watch(id, () => {
  clearSaveTimer()
  patchSeq += 1
  saveState.value = ''
  saveFailed.value = false
  void refresh()
})

onBeforeUnmount(() => {
  clearSaveTimer()
  patchSeq += 1
})
</script>
