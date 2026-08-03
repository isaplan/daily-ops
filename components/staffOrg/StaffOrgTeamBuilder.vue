<template>
  <div class="space-y-4">
    <div class="flex flex-wrap items-center justify-between gap-2">
      <p class="text-sm text-gray-600">
        Open venues: Keuken / Bediening / Bar. ZZP can sit on multiple venues.
      </p>
      <div class="flex flex-wrap items-center gap-2">
        <UButton
          size="sm"
          variant="ghost"
          color="primary"
          class="cursor-pointer"
          icon="i-lucide-file-down"
          :loading="exportingPdf"
          @click="exportPdf"
        >
          Download PDF
        </UButton>
        <button
          type="button"
          class="rounded-md bg-gray-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-gray-800"
          @click="showAdd = !showAdd"
        >
          + New location
        </button>
      </div>
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

    <div ref="pdfRoot" data-staff-org-print class="space-y-4">
    <div class="rounded-lg border border-gray-400 bg-white p-3">
      <h3 class="mb-1 text-sm font-semibold text-gray-900">Executive staff</h3>
      <p class="mb-3 text-xs text-gray-600">
        Above all locations — responsible company-wide.
      </p>
      <div class="grid gap-2" :class="exportingPdf ? 'grid-cols-3' : 'sm:grid-cols-3'">
        <div
          v-for="area in executiveAreas"
          :key="area.id"
          class="rounded-md border border-dashed border-gray-400 bg-gray-50 p-2"
          @dragover.prevent
          @drop.prevent="onDropExecutive(area.id, $event)"
        >
          <p class="mb-1 text-[11px] font-semibold uppercase tracking-wide text-gray-700">
            {{ area.label }}
            <span class="font-normal text-gray-500">({{ membersInExecutive(area.id).length }})</span>
          </p>
          <div class="flex min-h-[2.5rem] flex-col gap-1">
            <StaffOrgStaffCard
              v-for="m in membersInExecutive(area.id)"
              :key="`e-${area.id}-${m.memberId}`"
              :member="m"
              compact
              hide-wage
            />
            <p v-if="!membersInExecutive(area.id).length" class="text-[10px] text-gray-500">
              Drop
            </p>
          </div>
        </div>
      </div>
    </div>

    <div
      data-pdf-venue-grid
      class="grid gap-3"
      :class="exportingPdf ? pdfVenueGridClass : venueGridClass"
    >
      <div
        v-for="venue in openVenues"
        :key="venue.locationId"
        class="flex flex-col rounded-lg border-2 border-gray-400 bg-white p-3 shadow-sm"
      >
        <div class="mb-2 flex items-start justify-between gap-2">
          <div class="min-w-0">
            <h3 class="text-sm font-semibold text-gray-900">{{ venue.short }}</h3>
            <p class="truncate text-xs text-gray-600">{{ venue.name }}</p>
          </div>
          <div
            v-show="!exportingPdf"
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
            <div
              v-for="teamCol in teamColumns"
              :key="`h-${venue.locationId}-${teamCol}`"
              class="min-w-0 text-center"
            >
              <p class="text-xs font-semibold uppercase tracking-wide text-gray-800">
                {{ teamCol === 'keuken' ? '1. Keuken' : teamCol === 'bediening' ? '2. Bediening' : '3. Bar' }}
              </p>
              <div
                v-if="teamMetricsFor(venue.locationId, teamCol)"
                class="mt-1 space-y-0.5 text-[11px] leading-snug tabular-nums text-gray-700"
              >
                <p>
                  Labor
                  <span class="font-semibold text-gray-900">
                    €{{ formatEur(teamMetricsFor(venue.locationId, teamCol)!.laborCostMonthly) }}
                  </span>
                  <span class="text-gray-500">/mo</span>
                </p>
                <p>
                  Hours
                  <span class="font-semibold text-gray-900">
                    {{ teamMetricsFor(venue.locationId, teamCol)!.hoursAllocatedMonthly.toFixed(0) }}
                  </span>
                  <span class="text-gray-500">
                    / {{ teamMetricsFor(venue.locationId, teamCol)!.hoursAvailableMonthly.toFixed(0) }}u
                  </span>
                </p>
                <p
                  v-if="teamMetricsFor(venue.locationId, teamCol)!.budgetRemainingMonthly != null"
                  :class="budgetClass(teamMetricsFor(venue.locationId, teamCol)!.budgetRemainingMonthly!)"
                >
                  <template v-if="teamMetricsFor(venue.locationId, teamCol)!.budgetRemainingMonthly! > 50">
                    €{{ formatEur(teamMetricsFor(venue.locationId, teamCol)!.budgetRemainingMonthly!) }} left in budget
                  </template>
                  <template v-else-if="teamMetricsFor(venue.locationId, teamCol)!.budgetRemainingMonthly! < -50">
                    €{{ formatEur(Math.abs(teamMetricsFor(venue.locationId, teamCol)!.budgetRemainingMonthly!)) }} over budget
                  </template>
                  <template v-else>
                    On labor budget
                  </template>
                </p>
                <p v-else class="text-gray-500">Set labor % target for budget</p>
              </div>
            </div>
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
                :class="isOpenVacancyLane(teamCol, row.roles[teamCol]!)
                  && !membersInLane(venue.locationId, teamCol, row.roles[teamCol]!).length
                  ? 'border-amber-500 bg-amber-50'
                  : 'border-gray-400 bg-gray-50'"
                @dragover.prevent
                @drop.prevent="onDropRole(venue.locationId, teamCol, row.roles[teamCol]!, $event)"
              >
                <p class="mb-0.5 text-[11px] font-semibold uppercase tracking-wide text-gray-700">
                  {{ laneLabel(teamCol, row.roles[teamCol]!) }}
                  <span class="font-normal text-gray-600">
                    ({{ membersInLane(venue.locationId, teamCol, row.roles[teamCol]!).length }})
                  </span>
                  <span
                    v-if="isOpenVacancyLane(teamCol, row.roles[teamCol]!)
                      && !membersInLane(venue.locationId, teamCol, row.roles[teamCol]!).length"
                    class="ml-0.5 text-amber-800"
                  >open</span>
                </p>
                <p
                  v-if="laneMetricLine(venue.locationId, teamCol, row.roles[teamCol]!)"
                  class="mb-1 text-[10px] leading-snug tabular-nums"
                  :class="laneMetricClass(venue.locationId, teamCol, row.roles[teamCol]!)"
                >
                  {{ laneMetricLine(venue.locationId, teamCol, row.roles[teamCol]!) }}
                </p>
                <div class="flex min-h-[2rem] flex-col gap-1">
                  <StaffOrgStaffCard
                    v-for="m in membersInLane(venue.locationId, teamCol, row.roles[teamCol]!)"
                    :key="m.memberId"
                    :member="m"
                    compact
                    :editable-desired-hours="isPtHoursLane(row.roles[teamCol]!)"
                    @update:desired-hours="onDesiredHours"
                  />
                  <p
                    v-if="!membersInLane(venue.locationId, teamCol, row.roles[teamCol]!).length"
                    class="text-[10px] text-gray-500"
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
        <div v-show="!exportingPdf" class="mt-auto border-t border-gray-100 pt-3">
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

      <!-- Unassigned sits as the rightmost column beside venues -->
      <div
        data-pdf-unassigned
        class="flex flex-col rounded-lg border-2 border-red-500 bg-white p-3"
        @dragover.prevent
        @drop.prevent="onDropUnassigned"
      >
        <div class="mb-2 min-w-0">
          <h3 class="text-sm font-semibold text-gray-900">
            Unassigned
            <span class="font-normal text-gray-600">({{ unassigned.length }})</span>
          </h3>
          <p class="text-xs text-gray-600">Includes staff from closed venues.</p>
        </div>
        <div class="flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto md:max-h-[calc(100vh-16rem)]">
          <StaffOrgStaffCard
            v-for="m in unassigned"
            :key="`u-${m.memberId}`"
            :member="m"
            compact
          />
          <p v-if="!unassigned.length" class="py-4 text-center text-[10px] text-gray-400">
            Drop staff here
          </p>
        </div>
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

    <div class="grid gap-3 md:grid-cols-2">
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
              v-show="!exportingPdf"
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
              v-show="!exportingPdf"
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
 * @last-modified: 2026-07-28T16:35:00.000Z
 * @description: Organogram — Executive + venues (Keuken/Bediening/Bar) + budget
 * @last-fix: [2026-07-28] PT Sr lane above PT; editable PT hours
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
import {
  buildTeamColumnMetrics,
  type StaffOrgTeamColumnMetrics,
} from '~/utils/staffOrg/teamOrgMetrics'

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
  scenarioName?: string
}>()

const emit = defineEmits<{
  'update:org': [orgAssignments: StaffOrgAssignment[]]
  'update:executive': [executiveAssignments: StaffOrgExecutiveAssignment[]]
  'update:inactive': [inactiveMemberIds: string[]]
  'update:venues': [venues: StaffOrgVenue[]]
  'update:desiredHours': [memberId: string, hours: number | null]
  'save-targets': [targets: StaffOrgLocationTargets[]]
  'save-rules': [rules: StaffOrgLocationRule[]]
}>()

function benchmarkFor(locationId: string): StaffOrgLaborBenchmark | null {
  return props.benchmarks?.find((b) => b.locationId === locationId) ?? null
}

function formatEur(n: number): string {
  return Math.round(n).toLocaleString('nl-NL')
}

function budgetClass(remaining: number): string {
  if (remaining > 50) return 'font-medium text-emerald-700'
  if (remaining < -50) return 'font-medium text-red-600'
  return 'font-medium text-gray-700'
}

const teamMetricsByVenue = computed(() => {
  const map = new Map<string, Map<StaffOrgTeam, StaffOrgTeamColumnMetrics>>()
  if (!props.targets?.length) return map
  for (const v of props.venues.filter((x) => x.status === 'open')) {
    const rows = buildTeamColumnMetrics({
      locationId: v.locationId,
      targets: props.targets,
      roster: props.roster,
      orgAssignments: props.orgAssignments,
      inactiveMemberIds: props.inactiveMemberIds,
      slotHours: props.slotHours ?? [],
    })
    map.set(v.locationId, new Map(rows.map((r) => [r.team, r])))
  }
  return map
})

function teamMetricsFor(
  locationId: string,
  team: StaffOrgTeam,
): StaffOrgTeamColumnMetrics | null {
  return teamMetricsByVenue.value.get(locationId)?.get(team) ?? null
}

function laneMetricLine(
  locationId: string,
  team: StaffOrgTeam,
  role: StaffOrgRole,
): string | null {
  const m = teamMetricsFor(locationId, team)
  if (!m) return null

  if (role === 'pt_sr' || role === 'pt' || role === 'zzp') {
    const hours = m.flexHoursRemainingMonthly
    const budget = m.flexBudgetRemainingMonthly
    const own = m.byRole[role]
    const ownBits: string[] = []
    if (own && own.headcount > 0) {
      ownBits.push(`€${formatEur(own.laborCostMonthly)}`)
      ownBits.push(`${own.hoursAllocatedMonthly.toFixed(0)}u`)
    }
    const remain = budget != null
      ? `left ${hours.toFixed(0)}u · €${formatEur(budget)}`
      : `left ${hours.toFixed(0)}u`
    return ownBits.length ? `${ownBits.join(' · ')} · ${remain}` : remain
  }

  const slice = m.byRole[role]
  if (!slice) return null
  return `€${formatEur(slice.laborCostMonthly)} · ${slice.hoursAllocatedMonthly.toFixed(0)}u/mo`
}

function laneMetricClass(
  locationId: string,
  team: StaffOrgTeam,
  role: StaffOrgRole,
): string {
  if (role !== 'pt_sr' && role !== 'pt' && role !== 'zzp') return 'text-gray-700'
  const m = teamMetricsFor(locationId, team)
  const budget = m?.flexBudgetRemainingMonthly
  if (budget == null) return 'text-gray-700'
  if (budget > 50) return 'text-emerald-700'
  if (budget < -50) return 'text-red-600'
  return 'text-gray-700'
}

type VenuePanel = 'builder' | 'budget' | 'rules'
const venuePanelTabs: Array<{ value: VenuePanel; label: string }> = [
  { value: 'builder', label: 'Builder' },
  { value: 'budget', label: 'Budget' },
  { value: 'rules', label: 'Min / max FT' },
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
    key: 'pt_sr',
    roles: { keuken: 'pt_sr', bediening: 'pt_sr', bar: 'pt_sr' },
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
  keuken: {
    manager: 'Chef',
    floor_manager: 'Sous-Chef',
    ft: 'FT',
    pt_sr: 'PT Sr',
    pt: 'PT',
    zzp: 'ZZP',
  },
  bediening: {
    manager: 'Bedrijfsleider',
    floor_manager: 'Floor',
    ft: 'FT',
    pt_sr: 'PT Sr',
    pt: 'PT',
    zzp: 'ZZP',
  },
  bar: {
    floor_manager: 'Bar Hoofd',
    ft: 'FT',
    pt_sr: 'PT Sr',
    pt: 'PT',
    zzp: 'ZZP',
  },
}

function laneLabel(team: StaffOrgTeam, role: StaffOrgRole): string {
  return LANE_LABELS[team][role] ?? role
}

function isPtHoursLane(role: StaffOrgRole): boolean {
  return role === 'pt_sr' || role === 'pt'
}

function onDesiredHours(memberId: string, hours: number | null) {
  emit('update:desiredHours', memberId, hours)
}

/** Empty vacancy highlight: Chef / Bedrijfsleider / Bar Hoofd / FT. */
function isOpenVacancyLane(team: StaffOrgTeam, role: StaffOrgRole): boolean {
  if (role === 'ft') return true
  if (team === 'bar') return role === 'floor_manager'
  return role === 'manager'
}

const showAdd = ref(false)
const newName = ref('')
const newShort = ref('')

const openVenues = computed(() => props.venues.filter((v) => v.status === 'open'))
const closedVenues = computed(() => props.venues.filter((v) => v.status === 'closed'))

/** Venues + Unassigned column on the right. */
const venueGridClass = computed(() => {
  const cols = openVenues.value.length + 1
  if (cols >= 4) return 'xl:grid-cols-4 lg:grid-cols-2'
  if (cols === 3) return 'xl:grid-cols-3 md:grid-cols-2'
  if (cols === 2) return 'md:grid-cols-2'
  return ''
})

/** Fixed desktop columns for PDF — always like the wide HTML (Scenario-11). */
const pdfVenueGridClass = computed(() => {
  const cols = openVenues.value.length + 1
  if (cols >= 4) return 'grid-cols-4'
  if (cols === 3) return 'grid-cols-3'
  if (cols === 2) return 'grid-cols-2'
  return 'grid-cols-1'
})

/** CSS width that matches the wide organogram layout users expect in PDF. */
const PDF_EXPORT_WIDTH_PX = 1280

const pdfRoot = ref<HTMLElement | null>(null)
const exportingPdf = ref(false)
const toast = useToast()

async function exportPdf() {
  if (!pdfRoot.value || exportingPdf.value || !import.meta.client) return
  toast.add({
    title: 'Creating your PDF.',
    icon: 'i-lucide-file-down',
    color: 'primary',
    duration: 4000,
  })

  const previousPanels = { ...venuePanels.value }
  const nextPanels: Record<string, VenuePanel> = { ...venuePanels.value }
  for (const v of openVenues.value) {
    nextPanels[v.locationId] = 'builder'
  }
  venuePanels.value = nextPanels
  exportingPdf.value = true
  await nextTick()

  const root = pdfRoot.value
  const base = (props.scenarioName?.trim() || 'staff-org').replace(/[^a-z0-9]+/gi, '_')

  // Lock wide desktop layout so PDF never depends on current window width
  const prevWidth = root.style.width
  const prevMinWidth = root.style.minWidth
  const prevMaxWidth = root.style.maxWidth
  root.style.width = `${PDF_EXPORT_WIDTH_PX}px`
  root.style.minWidth = `${PDF_EXPORT_WIDTH_PX}px`
  root.style.maxWidth = `${PDF_EXPORT_WIDTH_PX}px`

  // Expand clipped lists so the screenshot includes full Unassigned / lanes
  const expandBackups: Array<{ el: HTMLElement; maxHeight: string; overflow: string }> = []
  for (const el of root.querySelectorAll<HTMLElement>('*')) {
    const cs = getComputedStyle(el)
    if (cs.maxHeight === 'none' && cs.overflowY !== 'auto' && cs.overflowY !== 'scroll') continue
    expandBackups.push({
      el,
      maxHeight: el.style.maxHeight,
      overflow: el.style.overflow,
    })
    el.style.maxHeight = 'none'
    el.style.overflow = 'visible'
  }
  await nextTick()
  await new Promise<void>((r) => requestAnimationFrame(() => r()))

  try {
    const { toJpeg } = await import('html-to-image')
    const { jsPDF } = await import('jspdf')

    const widthPx = PDF_EXPORT_WIDTH_PX
    const heightPx = Math.ceil(Math.max(root.scrollHeight, root.offsetHeight))
    if (heightPx < 40) {
      throw new Error('PDF content height is empty — wait for the page to finish loading.')
    }

    // Browser paints the live HTML at fixed desktop width (Scenario-11 layout).
    const dataUrl = await toJpeg(root, {
      quality: 0.98,
      pixelRatio: 2,
      backgroundColor: '#ffffff',
      cacheBust: true,
      width: widthPx,
      height: heightPx,
      style: {
        transform: 'none',
        margin: '0',
        width: `${widthPx}px`,
        maxWidth: `${widthPx}px`,
      },
    })

    const marginMm = 8
    const pxToMm = (px: number) => (px * 25.4) / 96
    const contentW = pxToMm(widthPx)
    const contentH = pxToMm(heightPx)
    const pageW = contentW + marginMm * 2
    const pageH = contentH + marginMm * 2

    const pdf = new jsPDF({
      orientation: pageW >= pageH ? 'landscape' : 'portrait',
      unit: 'mm',
      format: [pageW, pageH],
      compress: true,
    })
    pdf.addImage(dataUrl, 'JPEG', marginMm, marginMm, contentW, contentH)
    pdf.save(`${base}.pdf`)

    toast.add({
      title: 'PDF downloaded.',
      icon: 'i-lucide-check',
      color: 'success',
      duration: 3000,
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error'
    toast.add({
      title: 'PDF failed.',
      description: msg,
      icon: 'i-lucide-alert-circle',
      color: 'error',
      duration: 8000,
    })
  } finally {
    for (const b of expandBackups) {
      b.el.style.maxHeight = b.maxHeight
      b.el.style.overflow = b.overflow
    }
    root.style.width = prevWidth
    root.style.minWidth = prevMinWidth
    root.style.maxWidth = prevMaxWidth
    venuePanels.value = previousPanels
    exportingPdf.value = false
  }
}

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
