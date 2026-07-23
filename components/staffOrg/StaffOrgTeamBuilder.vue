<template>
  <div class="space-y-4">
    <div class="flex flex-wrap items-center justify-between gap-2">
      <p class="text-sm text-gray-600">
        Open venues: Keuken / Bediening / Bar. ZZP can sit on multiple venues.
      </p>
      <button
        type="button"
        class="rounded-md bg-gray-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-gray-800"
        @click="showAdd = !showAdd"
      >
        + New location
      </button>
    </div>

    <div
      v-if="showAdd"
      class="flex flex-wrap items-end gap-2 rounded-lg border border-gray-200 bg-gray-50 p-3"
    >
      <label class="text-xs text-gray-600">
        Name
        <input
          v-model="newName"
          type="text"
          class="mt-0.5 block w-40 rounded border border-gray-300 px-2 py-1 text-sm"
          placeholder="New venue"
        >
      </label>
      <label class="text-xs text-gray-600">
        Short
        <input
          v-model="newShort"
          type="text"
          maxlength="6"
          class="mt-0.5 block w-20 rounded border border-gray-300 px-2 py-1 text-sm uppercase"
          placeholder="NV"
        >
      </label>
      <button
        type="button"
        class="rounded-md bg-gray-900 px-3 py-1.5 text-sm text-white disabled:opacity-40"
        :disabled="!newName.trim()"
        @click="addVenue"
      >
        Add
      </button>
      <button type="button" class="text-sm text-gray-500 hover:text-gray-800" @click="showAdd = false">
        Cancel
      </button>
    </div>

    <div class="rounded-lg border border-gray-200 bg-white p-3">
      <h3 class="mb-1 text-sm font-semibold text-gray-900">Executive staff</h3>
      <p class="mb-3 text-[10px] text-gray-500">
        Above all locations — responsible company-wide.
      </p>
      <div class="grid gap-2 sm:grid-cols-3">
        <div
          v-for="area in executiveAreas"
          :key="area.id"
          class="rounded-md border border-dashed border-gray-200 bg-gray-50/50 p-2"
          @dragover.prevent
          @drop.prevent="onDropExecutive(area.id, $event)"
        >
          <p class="mb-1 text-[10px] font-semibold uppercase tracking-wide text-gray-500">
            {{ area.label }}
            <span class="font-normal text-gray-400">({{ membersInExecutive(area.id).length }})</span>
          </p>
          <div class="flex min-h-[2.5rem] flex-col gap-1">
            <StaffOrgStaffCard
              v-for="m in membersInExecutive(area.id)"
              :key="`e-${area.id}-${m.memberId}`"
              :member="m"
              compact
            />
            <p v-if="!membersInExecutive(area.id).length" class="text-[9px] text-gray-400">
              Drop
            </p>
          </div>
        </div>
      </div>
    </div>

    <div class="grid gap-3" :class="openVenues.length >= 3 ? 'xl:grid-cols-3' : openVenues.length === 2 ? 'md:grid-cols-2' : ''">
      <div
        v-for="venue in openVenues"
        :key="venue.locationId"
        class="rounded-lg border border-gray-200 bg-white p-3"
      >
        <div class="mb-2 flex items-center justify-between gap-2">
          <h3 class="text-sm font-semibold text-gray-900">{{ venue.short }}</h3>
          <button
            type="button"
            class="text-[10px] font-medium text-red-700 hover:underline"
            title="Close venue — staff become unassigned"
            @click="closeVenue(venue.locationId)"
          >
            Close
          </button>
        </div>
        <p class="mb-2 truncate text-[10px] text-gray-500">{{ venue.name }}</p>
        <div class="grid grid-cols-3 gap-1.5">
          <div
            v-for="teamCol in teamColumns"
            :key="`${venue.locationId}-${teamCol}`"
            class="min-w-0"
          >
            <p class="mb-1.5 text-center text-[11px] font-semibold uppercase tracking-wide text-gray-700">
              {{ teamCol === 'keuken' ? '1. Keuken' : teamCol === 'bediening' ? '2. Bediening' : '3. Bar' }}
            </p>
            <div
              v-for="lane in roleLanes"
              :key="`${venue.locationId}-${teamCol}-${lane.role}`"
              class="mb-1.5 rounded-md border border-dashed p-1.5"
              :class="lane.role === 'manager' && !membersInLane(venue.locationId, teamCol, lane.role).length
                ? 'border-amber-300 bg-amber-50/50'
                : 'border-gray-200 bg-gray-50/50'"
              @dragover.prevent
              @drop.prevent="onDropRole(venue.locationId, teamCol, lane.role, $event)"
            >
              <p class="mb-1 text-[9px] font-semibold uppercase tracking-wide text-gray-500">
                {{ laneLabel(teamCol, lane.role, lane.label) }}
                <span class="font-normal text-gray-400">
                  ({{ membersInLane(venue.locationId, teamCol, lane.role).length }})
                </span>
                <span
                  v-if="lane.role === 'manager' && !membersInLane(venue.locationId, teamCol, lane.role).length"
                  class="ml-0.5 text-amber-700"
                >open</span>
              </p>
              <div class="flex min-h-[2rem] flex-col gap-1">
                <StaffOrgStaffCard
                  v-for="m in membersInLane(venue.locationId, teamCol, lane.role)"
                  :key="m.memberId"
                  :member="m"
                  compact
                />
                <p
                  v-if="!membersInLane(venue.locationId, teamCol, lane.role).length"
                  class="text-[9px] text-gray-400"
                >
                  Drop
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <div class="grid gap-3 md:grid-cols-3">
      <div
        class="rounded-lg border border-dashed border-gray-300 bg-white p-3"
        @dragover.prevent
        @drop.prevent="onDropUnassigned"
      >
        <h3 class="mb-1 text-xs font-semibold uppercase tracking-wide text-gray-500">
          Unassigned ({{ unassigned.length }})
        </h3>
        <p class="mb-2 text-[10px] text-gray-500">Includes staff from closed venues.</p>
        <div class="flex max-h-40 flex-col gap-1 overflow-y-auto">
          <StaffOrgStaffCard
            v-for="m in unassigned"
            :key="`u-${m.memberId}`"
            :member="m"
            compact
          />
        </div>
      </div>

      <div
        class="rounded-lg border border-dashed border-red-200 bg-red-50/40 p-3"
        @dragover.prevent
        @drop.prevent="onDropInactive"
      >
        <h3 class="mb-1 text-xs font-semibold uppercase tracking-wide text-red-800">
          Not active ({{ inactiveMembers.length }})
        </h3>
        <p class="mb-2 text-[10px] text-red-700/80">Leaving / contract end.</p>
        <div class="flex max-h-40 flex-col gap-1 overflow-y-auto">
          <div
            v-for="m in inactiveMembers"
            :key="`i-${m.memberId}`"
            class="flex items-center gap-1"
          >
            <StaffOrgStaffCard :member="m" compact class="min-w-0 flex-1" />
            <button
              type="button"
              class="shrink-0 rounded px-1.5 py-1 text-[10px] font-medium text-red-800 hover:bg-red-100"
              @click="reactivate(m.memberId)"
            >
              Restore
            </button>
          </div>
        </div>
      </div>

      <div class="rounded-lg border border-dashed border-gray-300 bg-gray-50/80 p-3">
        <h3 class="mb-1 text-xs font-semibold uppercase tracking-wide text-gray-600">
          Not active locations ({{ closedVenues.length }})
        </h3>
        <p class="mb-2 text-[10px] text-gray-500">Closed in this scenario — reopen anytime.</p>
        <div class="flex max-h-40 flex-col gap-1.5 overflow-y-auto">
          <div
            v-for="v in closedVenues"
            :key="v.locationId"
            class="flex items-center justify-between gap-2 rounded border border-gray-200 bg-white px-2 py-1.5"
          >
            <div class="min-w-0">
              <p class="truncate text-xs font-medium text-gray-800">{{ v.short }}</p>
              <p class="truncate text-[10px] text-gray-500">{{ v.name }}</p>
            </div>
            <button
              type="button"
              class="shrink-0 text-[10px] font-medium text-gray-800 hover:underline"
              @click="reopenVenue(v.locationId)"
            >
              Reopen
            </button>
          </div>
          <p v-if="!closedVenues.length" class="text-[10px] text-gray-400">
            No closed locations.
          </p>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
/**
 * @registry-id: StaffOrgTeamBuilder
 * @created: 2026-07-23T01:10:00.000Z
 * @last-modified: 2026-07-23T02:15:00.000Z
 * @description: Organogram — Executive + venues (Keuken/Bediening/Bar)
 * @last-fix: [2026-07-23] Executive staff strip (General / Keuken / Operations)
 * @adr-ref: ADR-016
 */

import type {
  StaffOrgAssignment,
  StaffOrgExecutiveArea,
  StaffOrgExecutiveAssignment,
  StaffOrgRole,
  StaffOrgRosterMember,
  StaffOrgTeam,
  StaffOrgVenue,
} from '~/types/staff-org'
import { isZzpRole } from '~/utils/staffOrg/seedOrgAssignments'

const props = defineProps<{
  venues: StaffOrgVenue[]
  roster: StaffOrgRosterMember[]
  orgAssignments: StaffOrgAssignment[]
  executiveAssignments: StaffOrgExecutiveAssignment[]
  inactiveMemberIds: string[]
}>()

const emit = defineEmits<{
  'update:org': [orgAssignments: StaffOrgAssignment[]]
  'update:executive': [executiveAssignments: StaffOrgExecutiveAssignment[]]
  'update:inactive': [inactiveMemberIds: string[]]
  'update:venues': [venues: StaffOrgVenue[]]
}>()

const executiveAreas: Array<{ id: StaffOrgExecutiveArea; label: string }> = [
  { id: 'general', label: 'General' },
  { id: 'keuken', label: 'Keuken' },
  { id: 'operations', label: 'Operations' },
]

const teamColumns: StaffOrgTeam[] = ['keuken', 'bediening', 'bar']
const roleLanes: Array<{ role: StaffOrgRole; label: string }> = [
  { role: 'manager', label: 'Manager' },
  { role: 'floor_manager', label: 'Floor' },
  { role: 'ft', label: 'FT' },
  { role: 'pt', label: 'PT' },
  { role: 'zzp', label: 'ZZP' },
]

function laneLabel(team: StaffOrgTeam, role: StaffOrgRole, fallback: string): string {
  if (team === 'keuken') {
    if (role === 'manager') return 'Chef'
    if (role === 'floor_manager') return 'Sous-Chef'
  }
  return fallback
}

const showAdd = ref(false)
const newName = ref('')
const newShort = ref('')

const openVenues = computed(() => props.venues.filter((v) => v.status === 'open'))
const closedVenues = computed(() => props.venues.filter((v) => v.status === 'closed'))

const rosterById = computed(() => new Map(props.roster.map((m) => [m.memberId, m])))
const inactiveSet = computed(() => new Set(props.inactiveMemberIds))

const assignedIds = computed(() => {
  const ids = new Set<string>()
  for (const a of props.orgAssignments) {
    if (!inactiveSet.value.has(a.memberId)) ids.add(a.memberId)
  }
  for (const e of props.executiveAssignments) {
    if (!inactiveSet.value.has(e.memberId)) ids.add(e.memberId)
  }
  return ids
})

function membersInExecutive(area: StaffOrgExecutiveArea): StaffOrgRosterMember[] {
  return props.executiveAssignments
    .filter((e) => e.area === area && !inactiveSet.value.has(e.memberId))
    .map((e) => rosterById.value.get(e.memberId))
    .filter((m): m is StaffOrgRosterMember => Boolean(m))
    .sort((a, b) => a.name.localeCompare(b.name, 'nl'))
}

function membersInLane(
  locationId: string,
  team: StaffOrgTeam,
  role: StaffOrgRole,
): StaffOrgRosterMember[] {
  return props.orgAssignments
    .filter(
      (a) =>
        a.locationId === locationId
        && a.team === team
        && a.role === role
        && !inactiveSet.value.has(a.memberId),
    )
    .map((a) => rosterById.value.get(a.memberId))
    .filter((m): m is StaffOrgRosterMember => Boolean(m))
    .sort((a, b) => a.name.localeCompare(b.name, 'nl'))
}

const unassigned = computed(() =>
  props.roster
    .filter((m) => !inactiveSet.value.has(m.memberId) && !assignedIds.value.has(m.memberId))
    .sort((a, b) => a.name.localeCompare(b.name, 'nl')),
)

const inactiveMembers = computed(() =>
  props.roster
    .filter((m) => inactiveSet.value.has(m.memberId))
    .sort((a, b) => a.name.localeCompare(b.name, 'nl')),
)

function readMemberId(e: DragEvent): string | null {
  return e.dataTransfer?.getData('application/x-staff-org-member') || null
}

function onDropExecutive(area: StaffOrgExecutiveArea, e: DragEvent) {
  const memberId = readMemberId(e)
  if (!memberId) return
  emit(
    'update:org',
    props.orgAssignments.filter((a) => a.memberId !== memberId),
  )
  const next = props.executiveAssignments.filter((x) => x.memberId !== memberId)
  next.push({ memberId, area })
  emit('update:executive', next)
  if (inactiveSet.value.has(memberId)) {
    emit(
      'update:inactive',
      props.inactiveMemberIds.filter((id) => id !== memberId),
    )
  }
}

function upsertAssignment(
  memberId: string,
  locationId: string,
  team: StaffOrgTeam,
  role: StaffOrgRole,
) {
  if (props.executiveAssignments.some((e) => e.memberId === memberId)) {
    emit(
      'update:executive',
      props.executiveAssignments.filter((e) => e.memberId !== memberId),
    )
  }

  let next: StaffOrgAssignment[]

  if (isZzpRole(role)) {
    next = props.orgAssignments.filter(
      (a) => !(a.memberId === memberId && a.locationId === locationId && a.team === team),
    )
    next = next.filter((a) => !(a.memberId === memberId && !isZzpRole(a.role)))
  } else {
    next = props.orgAssignments.filter((a) => a.memberId !== memberId)
  }

  if (role === 'manager') {
    next = next.map((a) =>
      a.locationId === locationId && a.team === team && a.role === 'manager'
        ? { ...a, role: 'ft' as const }
        : a,
    )
  }

  next.push({ memberId, locationId, team, role })
  emit('update:org', next)
  if (inactiveSet.value.has(memberId)) {
    emit(
      'update:inactive',
      props.inactiveMemberIds.filter((id) => id !== memberId),
    )
  }
}

function onDropRole(
  locationId: string,
  team: StaffOrgTeam,
  role: StaffOrgRole,
  e: DragEvent,
) {
  const memberId = readMemberId(e)
  if (!memberId) return
  upsertAssignment(memberId, locationId, team, role)
}

function onDropUnassigned(e: DragEvent) {
  const memberId = readMemberId(e)
  if (!memberId) return
  emit(
    'update:org',
    props.orgAssignments.filter((a) => a.memberId !== memberId),
  )
  emit(
    'update:executive',
    props.executiveAssignments.filter((a) => a.memberId !== memberId),
  )
}

function onDropInactive(e: DragEvent) {
  const memberId = readMemberId(e)
  if (!memberId) return
  emit(
    'update:org',
    props.orgAssignments.filter((a) => a.memberId !== memberId),
  )
  emit(
    'update:executive',
    props.executiveAssignments.filter((a) => a.memberId !== memberId),
  )
  emit('update:inactive', [...new Set([...props.inactiveMemberIds, memberId])])
}

function reactivate(memberId: string) {
  emit(
    'update:inactive',
    props.inactiveMemberIds.filter((id) => id !== memberId),
  )
}

function closeVenue(locationId: string) {
  emit(
    'update:venues',
    props.venues.map((v) =>
      v.locationId === locationId ? { ...v, status: 'closed' as const } : v,
    ),
  )
}

function reopenVenue(locationId: string) {
  emit(
    'update:venues',
    props.venues.map((v) =>
      v.locationId === locationId ? { ...v, status: 'open' as const } : v,
    ),
  )
}

function addVenue() {
  const name = newName.value.trim()
  if (!name) return
  const short = (newShort.value.trim() || name.slice(0, 3)).toUpperCase()
  const locationId = `custom-${Date.now().toString(36)}`
  emit('update:venues', [
    ...props.venues,
    { locationId, name, short, status: 'open' as const },
  ])
  newName.value = ''
  newShort.value = ''
  showAdd.value = false
}
</script>
