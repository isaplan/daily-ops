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
              hide-wage
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
        class="flex flex-col rounded-lg border border-gray-200 bg-white p-3"
      >
        <div class="mb-2 flex items-start justify-between gap-2">
          <div class="min-w-0">
            <h3 class="text-sm font-semibold text-gray-900">{{ venue.short }}</h3>
            <p class="truncate text-[10px] text-gray-500">{{ venue.name }}</p>
          </div>
          <div
            class="inline-flex shrink-0 flex-wrap justify-end gap-1"
            role="tablist"
            :aria-label="`${venue.short} panels`"
          >
            <button
              v-for="tab in venuePanelTabs"
              :key="tab.value"
              type="button"
              role="tab"
              class="rounded-full border px-2.5 py-1 text-[11px] font-semibold tracking-wide transition-colors"
              :class="getVenuePanel(venue.locationId) === tab.value
                ? 'border-gray-900 bg-gray-900 text-white'
                : 'border-gray-300 bg-white text-gray-600 hover:border-gray-900 hover:text-gray-900'"
              :aria-selected="getVenuePanel(venue.locationId) === tab.value"
              @click="setVenuePanel(venue.locationId, tab.value)"
            >
              {{ tab.label }}
            </button>
          </div>
        </div>

        <div
          v-if="getVenuePanel(venue.locationId) === 'builder'"
          class="space-y-1.5"
        >
          <div class="grid grid-cols-3 gap-1.5">
            <p
              v-for="teamCol in teamColumns"
              :key="`h-${venue.locationId}-${teamCol}`"
              class="text-center text-[11px] font-semibold uppercase tracking-wide text-gray-700"
            >
              {{ teamCol === 'keuken' ? '1. Keuken' : teamCol === 'bediening' ? '2. Bediening' : '3. Bar' }}
            </p>
          </div>
          <div
            v-for="row in builderRows"
            :key="`${venue.locationId}-${row.key}`"
            class="grid grid-cols-3 gap-1.5"
          >
            <div
              v-for="teamCol in teamColumns"
              :key="`${venue.locationId}-${teamCol}-${row.key}`"
              class="min-w-0"
            >
              <!-- Bar has no top Manager — empty cell so Bar Hoofd aligns with Floor -->
              <div
                v-if="row.roles[teamCol] == null"
                class="mb-0 min-h-[4.5rem] rounded-md border border-transparent bg-transparent p-1.5"
                aria-hidden="true"
              />
              <div
                v-else
                class="rounded-md border border-dashed p-1.5"
                :class="isLeadLane(teamCol, row.roles[teamCol]!)
                  && !membersInLane(venue.locationId, teamCol, row.roles[teamCol]!).length
                  ? 'border-amber-300 bg-amber-50/50'
                  : 'border-gray-200 bg-gray-50/50'"
                @dragover.prevent
                @drop.prevent="onDropRole(venue.locationId, teamCol, row.roles[teamCol]!, $event)"
              >
                <p class="mb-1 text-[9px] font-semibold uppercase tracking-wide text-gray-500">
                  {{ laneLabel(teamCol, row.roles[teamCol]!) }}
                  <span class="font-normal text-gray-400">
                    ({{ membersInLane(venue.locationId, teamCol, row.roles[teamCol]!).length }})
                  </span>
                  <span
                    v-if="isLeadLane(teamCol, row.roles[teamCol]!)
                      && !membersInLane(venue.locationId, teamCol, row.roles[teamCol]!).length"
                    class="ml-0.5 text-amber-700"
                  >open</span>
                </p>
                <div class="flex min-h-[2rem] flex-col gap-1">
                  <StaffOrgStaffCard
                    v-for="m in membersInLane(venue.locationId, teamCol, row.roles[teamCol]!)"
                    :key="m.memberId"
                    :member="m"
                    compact
                  />
                  <p
                    v-if="!membersInLane(venue.locationId, teamCol, row.roles[teamCol]!).length"
                    class="text-[9px] text-gray-400"
                  >
                    Drop
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        <StaffOrgVenueBudgetCard
          v-else-if="targets && getVenuePanel(venue.locationId) === 'budget'"
          :location-id="venue.locationId"
          panel="budget"
          :targets="targets"
          :rules="rules ?? []"
          :roster="roster"
          :org-assignments="orgAssignments"
          :inactive-member-ids="inactiveMemberIds"
          :slot-hours="slotHours ?? []"
          :benchmark="benchmarkFor(venue.locationId)"
          :saving="savingTargets"
          :saving-rules="savingRules"
          @save="(t) => emit('save-targets', t)"
          @save-rules="(r) => emit('save-rules', r)"
        />
        <StaffOrgVenueBudgetCard
          v-else-if="targets && getVenuePanel(venue.locationId) === 'rules'"
          :location-id="venue.locationId"
          panel="rules"
          :targets="targets"
          :rules="rules ?? []"
          :roster="roster"
          :org-assignments="orgAssignments"
          :inactive-member-ids="inactiveMemberIds"
          :slot-hours="slotHours ?? []"
          :benchmark="benchmarkFor(venue.locationId)"
          :saving="savingTargets"
          :saving-rules="savingRules"
          @save="(t) => emit('save-targets', t)"
          @save-rules="(r) => emit('save-rules', r)"
        />
        <p
          v-else-if="getVenuePanel(venue.locationId) !== 'builder'"
          class="py-4 text-center text-xs text-gray-400"
        >
          No targets loaded for this venue.
        </p>
        <div class="mt-auto border-t border-gray-100 pt-3">
          <button
            type="button"
            class="w-full rounded-md border border-red-300 bg-red-50 px-2 py-1.5 text-[11px] font-semibold text-red-700 hover:bg-red-100"
            title="Deactivate this location in the scenario"
            @click="requestCloseVenue(venue)"
          >
            Deactivate location
          </button>
        </div>
      </div>
    </div>

    <UModal
      :open="closeConfirmOpen"
      :ui="{ content: 'w-[calc(100vw-2rem)] max-w-md' }"
      @update:open="onCloseConfirmOpen"
    >
      <template #content>
        <div class="space-y-4 rounded-lg bg-white p-5">
          <div>
            <h2 class="text-base font-semibold text-gray-900">Deactivate location?</h2>
            <p class="mt-2 text-sm text-gray-600">
              Do you really want to close
              <span class="font-medium text-gray-900">{{ pendingCloseVenue?.name ?? 'this location' }}</span>?
              It means that all staff assigned here move to
              <span class="font-medium text-gray-900">Unassigned</span>,
              roster placements for this venue are removed, and the location moves to
              <span class="font-medium text-gray-900">Not active locations</span>
              (you can reopen later).
            </p>
          </div>
          <label class="block text-xs text-gray-600">
            Type <span class="font-semibold text-gray-900">close</span> to confirm
            <input
              v-model="closeConfirmText"
              type="text"
              autocomplete="off"
              class="mt-1 block w-full rounded border border-gray-300 px-2 py-1.5 text-sm"
              placeholder="close"
              @keydown.enter.prevent="confirmCloseVenue"
            >
          </label>
          <div class="flex justify-end gap-2">
            <button
              type="button"
              class="rounded-md px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-100"
              @click="cancelCloseVenue"
            >
              Cancel
            </button>
            <button
              type="button"
              class="rounded-md bg-red-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-40"
              :disabled="!canConfirmClose"
              @click="confirmCloseVenue"
            >
              Deactivate location
            </button>
          </div>
        </div>
      </template>
    </UModal>

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
 * @last-modified: 2026-07-23T11:25:00.000Z
 * @description: Organogram — Executive + venues (Keuken/Bediening/Bar) + budget
 * @last-fix: [2026-07-23] Bedrijfsleider; Bar Hoofd (no bar manager lane)
 * @adr-ref: ADR-016
 */

import type {
  StaffOrgAssignment,
  StaffOrgExecutiveArea,
  StaffOrgExecutiveAssignment,
  StaffOrgLaborBenchmark,
  StaffOrgLocationRule,
  StaffOrgLocationTargets,
  StaffOrgRole,
  StaffOrgRosterMember,
  StaffOrgSlotHours,
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
  targets?: StaffOrgLocationTargets[]
  rules?: StaffOrgLocationRule[]
  slotHours?: StaffOrgSlotHours[]
  benchmarks?: StaffOrgLaborBenchmark[]
  savingTargets?: boolean
  savingRules?: boolean
}>()

const emit = defineEmits<{
  'update:org': [orgAssignments: StaffOrgAssignment[]]
  'update:executive': [executiveAssignments: StaffOrgExecutiveAssignment[]]
  'update:inactive': [inactiveMemberIds: string[]]
  'update:venues': [venues: StaffOrgVenue[]]
  'save-targets': [targets: StaffOrgLocationTargets[]]
  'save-rules': [rules: StaffOrgLocationRule[]]
}>()

function benchmarkFor(locationId: string): StaffOrgLaborBenchmark | null {
  return props.benchmarks?.find((b) => b.locationId === locationId) ?? null
}

type VenuePanel = 'builder' | 'budget' | 'rules'
const venuePanelTabs: Array<{ value: VenuePanel; label: string }> = [
  { value: 'builder', label: 'Builder' },
  { value: 'budget', label: 'Budget' },
  { value: 'rules', label: 'Min / max staff' },
]
const venuePanels = ref<Record<string, VenuePanel>>({})

function getVenuePanel(locationId: string): VenuePanel {
  return venuePanels.value[locationId] ?? 'builder'
}

function setVenuePanel(locationId: string, panel: VenuePanel) {
  venuePanels.value = {
    ...venuePanels.value,
    [locationId]: panel,
  }
}

const executiveAreas: Array<{ id: StaffOrgExecutiveArea; label: string }> = [
  { id: 'general', label: 'General' },
  { id: 'keuken', label: 'Keuken' },
  { id: 'operations', label: 'Operations' },
]

const teamColumns: StaffOrgTeam[] = ['keuken', 'bediening', 'bar']

/**
 * Shared rows so Bar Hoofd aligns with Floor / Sous-Chef.
 * Bar has no top Manager cell (null spacer).
 */
const builderRows: Array<{
  key: string
  roles: Record<StaffOrgTeam, StaffOrgRole | null>
}> = [
  {
    key: 'lead',
    roles: { keuken: 'manager', bediening: 'manager', bar: null },
  },
  {
    key: 'floor',
    roles: { keuken: 'floor_manager', bediening: 'floor_manager', bar: 'floor_manager' },
  },
  {
    key: 'ft',
    roles: { keuken: 'ft', bediening: 'ft', bar: 'ft' },
  },
  {
    key: 'pt',
    roles: { keuken: 'pt', bediening: 'pt', bar: 'pt' },
  },
  {
    key: 'zzp',
    roles: { keuken: 'zzp', bediening: 'zzp', bar: 'zzp' },
  },
]

const LANE_LABELS: Record<StaffOrgTeam, Partial<Record<StaffOrgRole, string>>> = {
  keuken: { manager: 'Chef', floor_manager: 'Sous-Chef', ft: 'FT', pt: 'PT', zzp: 'ZZP' },
  bediening: { manager: 'Bedrijfsleider', floor_manager: 'Floor', ft: 'FT', pt: 'PT', zzp: 'ZZP' },
  bar: { floor_manager: 'Bar Hoofd', ft: 'FT', pt: 'PT', zzp: 'ZZP' },
}

function laneLabel(team: StaffOrgTeam, role: StaffOrgRole): string {
  return LANE_LABELS[team][role] ?? role
}

/** Empty lead highlight: Chef / Bedrijfsleider / Bar Hoofd. */
function isLeadLane(team: StaffOrgTeam, role: StaffOrgRole): boolean {
  if (team === 'bar') return role === 'floor_manager'
  return role === 'manager'
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
  // Bar: only one Bar Hoofd (floor_manager)
  if (team === 'bar' && role === 'floor_manager') {
    next = next.map((a) =>
      a.locationId === locationId && a.team === 'bar' && a.role === 'floor_manager'
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

const closeConfirmOpen = ref(false)
const closeConfirmText = ref('')
const pendingCloseVenue = ref<StaffOrgVenue | null>(null)

const canConfirmClose = computed(
  () => closeConfirmText.value.trim().toLowerCase() === 'close',
)

function requestCloseVenue(venue: StaffOrgVenue) {
  pendingCloseVenue.value = venue
  closeConfirmText.value = ''
  closeConfirmOpen.value = true
}

function onCloseConfirmOpen(open: boolean) {
  closeConfirmOpen.value = open
  if (!open) {
    pendingCloseVenue.value = null
    closeConfirmText.value = ''
  }
}

function cancelCloseVenue() {
  onCloseConfirmOpen(false)
}

function confirmCloseVenue() {
  if (!canConfirmClose.value || !pendingCloseVenue.value) return
  closeVenue(pendingCloseVenue.value.locationId)
  onCloseConfirmOpen(false)
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
