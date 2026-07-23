<template>
  <div class="space-y-4">
    <StaffOrgMetricsBar
      :open-hours="summary.openHours"
      :assigned-hours="summary.assignedHours"
      :labor-cost="summary.laborCost"
      :headcount="summary.headcount"
      :under-min-count="summary.underMinCount"
      :over-max-count="summary.overMaxCount"
      :productivity="productivity"
    />

    <div class="grid gap-4 lg:grid-cols-[1fr_240px]">
      <div class="overflow-x-auto rounded-lg border border-gray-200 bg-white">
        <table class="min-w-full border-collapse text-sm">
          <thead>
            <tr class="border-b border-gray-200 bg-gray-50 text-left text-xs uppercase tracking-wide text-gray-500">
              <th class="px-3 py-2 font-medium">Slot</th>
              <th v-for="d in dayLabels" :key="d" class="px-2 py-2 font-medium">{{ d }}</th>
            </tr>
            <tr class="border-b border-gray-100 bg-gray-50/80 text-[10px] text-gray-600">
              <th class="px-3 py-1.5 font-medium text-gray-500">Day plan</th>
              <th v-for="weekday in weekdays" :key="`plan-${weekday}`" class="px-1.5 py-1.5 align-top">
                <div class="space-y-0.5 tabular-nums">
                  <p>
                    Est €{{ formatEur(dayPlan(weekday).estRevenue) }}
                    <span class="text-gray-400">({{ (dayPlan(weekday).share * 100).toFixed(0) }}%)</span>
                  </p>
                  <p>FT {{ dayPlan(weekday).ftHours.toFixed(1) }}u</p>
                  <p :class="dayPlan(weekday).leftoverHours > 0.2 ? 'text-amber-700' : 'text-gray-500'">
                    PT/ZZP {{ dayPlan(weekday).leftoverHours.toFixed(1) }}u
                  </p>
                </div>
              </th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="slot in slots" :key="slot" class="border-b border-gray-100 align-top">
              <td class="px-3 py-2 text-xs font-semibold capitalize text-gray-700">
                {{ slot === 'day' ? 'Dag (→18:00)' : 'Avond (18:00→)' }}
              </td>
              <td v-for="weekday in weekdays" :key="`${slot}-${weekday}`" class="px-1.5 py-1.5">
                <StaffOrgSlotCell
                  :location-id="locationId"
                  :team="team"
                  :weekday="weekday"
                  :slot="slot"
                  :members="membersInCell(weekday, slot)"
                  :open-hours="cellMeta(weekday, slot).openHours"
                  :headcount="cellMeta(weekday, slot).headcount"
                  :min-staff="cellMeta(weekday, slot).minStaff"
                  :max-staff="cellMeta(weekday, slot).maxStaff"
                  :under-min="cellMeta(weekday, slot).underMin"
                  :over-max="cellMeta(weekday, slot).overMax"
                  @drop="(payload) => onDrop(payload, weekday, slot)"
                />
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <aside class="space-y-3">
        <div class="rounded-lg border border-gray-200 bg-white p-3">
          <h3 class="mb-1 text-xs font-semibold uppercase tracking-wide text-gray-500">
            Active roster
          </h3>
          <p class="mb-2 text-[10px] text-gray-500">
            Drag onto days. Drop on <strong>Not active</strong> to free slots (leaving / sick).
          </p>
          <label class="mb-2 flex items-center gap-2 text-xs text-gray-600">
            <input v-model="filterTeamHint" type="checkbox" class="rounded border-gray-300">
            Prefer {{ team }} team hint
          </label>
          <label class="mb-2 flex items-center gap-2 text-xs text-gray-600">
            <input v-model="hideFullyScheduled" type="checkbox" class="rounded border-gray-300">
            Hide fully scheduled
          </label>

          <div
            class="flex max-h-[20rem] flex-col gap-2 overflow-y-auto rounded-md border border-dashed border-gray-300 p-2"
            @dragover.prevent
            @drop.prevent="onDropUnassign"
          >
            <div v-if="unassignedRoster.length">
              <p class="mb-1 text-[10px] font-semibold uppercase tracking-wide text-amber-800">
                Not on board ({{ unassignedRoster.length }})
              </p>
              <div class="flex flex-col gap-1.5">
                <StaffOrgStaffCard
                  v-for="m in unassignedRoster"
                  :key="`u-${m.memberId}`"
                  :member="m"
                  compact
                  :placed-days="0"
                />
              </div>
            </div>
            <div v-if="partialRoster.length">
              <p class="mb-1 text-[10px] font-semibold uppercase tracking-wide text-gray-500">
                On board — add days ({{ partialRoster.length }})
              </p>
              <div class="flex flex-col gap-1.5">
                <StaffOrgStaffCard
                  v-for="m in partialRoster"
                  :key="`p-${m.memberId}`"
                  :member="m"
                  compact
                  :placed-days="daysPlaced(m.memberId)"
                />
              </div>
            </div>
            <div v-if="fullRoster.length && !hideFullyScheduled">
              <p class="mb-1 text-[10px] font-semibold uppercase tracking-wide text-gray-400">
                Fully scheduled ({{ fullRoster.length }})
              </p>
              <div class="flex flex-col gap-1.5 opacity-60">
                <StaffOrgStaffCard
                  v-for="m in fullRoster"
                  :key="`f-${m.memberId}`"
                  :member="m"
                  compact
                  :placed-days="daysPlaced(m.memberId)"
                />
              </div>
            </div>
          </div>
        </div>

        <div
          class="rounded-lg border border-dashed border-red-200 bg-red-50/40 p-3"
          @dragover.prevent="onInactiveDragOver"
          @drop.prevent="onDropInactive"
        >
          <h3 class="mb-1 text-xs font-semibold uppercase tracking-wide text-red-800">
            Not active ({{ inactiveMembers.length }})
          </h3>
          <p class="mb-2 text-[10px] text-red-700/80">
            Leaving / long sick — cleared from board; PT/ZZP budget opens.
          </p>
          <div class="flex min-h-[4rem] flex-col gap-1.5">
            <div
              v-for="m in inactiveMembers"
              :key="`i-${m.memberId}`"
              class="flex items-center gap-1"
            >
              <StaffOrgStaffCard
                :member="m"
                compact
                class="min-w-0 flex-1"
              />
              <button
                type="button"
                class="shrink-0 rounded px-1.5 py-1 text-[10px] font-medium text-red-800 hover:bg-red-100"
                title="Back to active roster"
                @click="reactivateMember(m.memberId)"
              >
                Restore
              </button>
            </div>
            <p v-if="!inactiveMembers.length" class="text-[10px] text-red-600/70">
              Drop staff here to deactivate.
            </p>
          </div>
        </div>
      </aside>
    </div>
  </div>
</template>

<script setup lang="ts">
/**
 * @registry-id: StaffOrgBoard
 * @created: 2026-07-22T18:00:00.000Z
 * @last-modified: 2026-07-23T00:55:00.000Z
 * @description: Day/evening × Mon–Sun board — multi-day placements per staff
 * @last-fix: [2026-07-23] Not active drop zone clears placements / opens PT-ZZP
 * @adr-ref: ADR-016
 */

import type {
  StaffOrgCellMetrics,
  StaffOrgLocationTargets,
  StaffOrgPlacement,
  StaffOrgRosterMember,
  StaffOrgSlot,
  StaffOrgSlotHours,
  StaffOrgTeam,
  StaffOrgWeekday,
} from '~/types/staff-org'
import { rebalanceContractHours } from '~/utils/staffOrg/contractHours'
import { buildProductivityView, weeklyRevenueFromMonthly } from '~/utils/staffOrg/productivity'

export type StaffOrgWeekdayShareRow = {
  weekday: StaffOrgWeekday
  share: number
}

const props = defineProps<{
  locationId: string
  team: StaffOrgTeam
  roster: StaffOrgRosterMember[]
  placements: StaffOrgPlacement[]
  metrics: StaffOrgCellMetrics[]
  slotHours: StaffOrgSlotHours[]
  locationTargets: StaffOrgLocationTargets[]
  inactiveMemberIds: string[]
  /** Historical weekday share of monthly revenue (sums ~1). */
  weekdayShares?: StaffOrgWeekdayShareRow[]
}>()

const emit = defineEmits<{
  'update:placements': [placements: StaffOrgPlacement[]]
  'update:inactive': [inactiveMemberIds: string[]]
}>()

const dayLabels = ['Ma', 'Di', 'Wo', 'Do', 'Vr', 'Za', 'Zo']
const weekdays = [0, 1, 2, 3, 4, 5, 6] as StaffOrgWeekday[]
const slots: StaffOrgSlot[] = ['day', 'evening']
const filterTeamHint = ref(true)
const hideFullyScheduled = ref(true)

const rosterById = computed(() => new Map(props.roster.map((m) => [m.memberId, m])))

const inactiveSet = computed(() => new Set(props.inactiveMemberIds))

const boardPlacements = computed(() =>
  props.placements.filter(
    (p) =>
      p.locationId === props.locationId
      && p.team === props.team
      && !inactiveSet.value.has(p.memberId),
  ),
)

const daysPlacedByMember = computed(() => {
  const map = new Map<string, Set<number>>()
  for (const p of props.placements) {
    if (inactiveSet.value.has(p.memberId)) continue
    const set = map.get(p.memberId) ?? new Set()
    set.add(p.weekday)
    map.set(p.memberId, set)
  }
  return map
})

function daysPlaced(memberId: string): number {
  return daysPlacedByMember.value.get(memberId)?.size ?? 0
}

const teamFilteredRoster = computed(() => {
  const list = filterTeamHint.value
    ? props.roster.filter((m) => m.teamHint === props.team || m.teamHint == null)
    : props.roster
  const preferred = list.length > 0 ? list : props.roster
  return [...preferred]
    .filter((m) => !inactiveSet.value.has(m.memberId))
    .sort((a, b) => a.name.localeCompare(b.name, 'nl'))
})

const inactiveMembers = computed(() =>
  props.roster
    .filter((m) => inactiveSet.value.has(m.memberId))
    .sort((a, b) => a.name.localeCompare(b.name, 'nl')),
)

const unassignedRoster = computed(() =>
  teamFilteredRoster.value.filter((m) => daysPlaced(m.memberId) === 0),
)

const partialRoster = computed(() =>
  teamFilteredRoster.value.filter((m) => {
    const d = daysPlaced(m.memberId)
    if (d <= 0) return false
    const suggested = m.weeklyContractHours != null && m.weeklyContractHours > 0
      ? Math.max(1, Math.round(m.weeklyContractHours / 8))
      : 5
    return d < suggested
  }),
)

const fullRoster = computed(() =>
  teamFilteredRoster.value.filter((m) => {
    const d = daysPlaced(m.memberId)
    if (d <= 0) return false
    const suggested = m.weeklyContractHours != null && m.weeklyContractHours > 0
      ? Math.max(1, Math.round(m.weeklyContractHours / 8))
      : 5
    return d >= suggested
  }),
)

function membersInCell(weekday: StaffOrgWeekday, slot: StaffOrgSlot) {
  return boardPlacements.value
    .filter((p) => p.weekday === weekday && p.slot === slot)
    .map((p) => {
      const member = rosterById.value.get(p.memberId)
      if (!member) return null
      return {
        member,
        hours: p.hours,
        placedDays: daysPlaced(p.memberId),
      }
    })
    .filter((m): m is { member: StaffOrgRosterMember; hours?: number; placedDays: number } => Boolean(m))
}

function cellMeta(weekday: StaffOrgWeekday, slot: StaffOrgSlot) {
  const m = props.metrics.find(
    (x) =>
      x.locationId === props.locationId
      && x.team === props.team
      && x.weekday === weekday
      && x.slot === slot,
  )
  const hours = props.slotHours.find(
    (x) =>
      x.locationId === props.locationId
      && x.team === props.team
      && x.weekday === weekday
      && x.slot === slot,
  )
  return {
    openHours: m?.openHours ?? hours?.openHours ?? null,
    headcount: m?.headcount ?? 0,
    minStaff: m?.minStaff ?? 0,
    maxStaff: m?.maxStaff ?? 8,
    underMin: m?.underMin ?? false,
    overMax: m?.overMax ?? false,
  }
}

const summary = computed(() => {
  const cells = props.metrics.filter(
    (m) => m.locationId === props.locationId && m.team === props.team,
  )
  return {
    openHours: cells.reduce((s, c) => s + (c.openHours ?? 0), 0),
    assignedHours: cells.reduce((s, c) => s + c.assignedHours, 0),
    laborCost: cells.reduce((s, c) => s + c.laborCost, 0),
    headcount: boardPlacements.value.length,
    underMinCount: cells.filter((c) => c.underMin && c.openHours != null).length,
    overMaxCount: cells.filter((c) => c.overMax).length,
  }
})

/** Location-wide FT hours (all teams) vs revenue targets. */
const productivity = computed(() =>
  buildProductivityView({
    locationId: props.locationId,
    targets: props.locationTargets,
    placements: props.placements,
  }),
)

const weeklyRevenue = computed(() => {
  const t = props.locationTargets.find((x) => x.locationId === props.locationId)
  return weeklyRevenueFromMonthly(t?.estimatedMonthlyRevenue ?? 0)
})

const shareByWeekday = computed(() => {
  const map = new Map<number, number>()
  for (const s of props.weekdayShares ?? []) map.set(s.weekday, s.share)
  return map
})

function dayPlan(weekday: StaffOrgWeekday) {
  const share = shareByWeekday.value.get(weekday) ?? 0
  const estRevenue = weeklyRevenue.value * share
  // Open hours for this location × team across day+evening
  const open = props.slotHours
    .filter(
      (s) =>
        s.locationId === props.locationId
        && s.team === props.team
        && s.weekday === weekday
        && s.openHours != null,
    )
    .reduce((sum, s) => sum + (s.openHours ?? 0), 0)
  const ftHours = boardPlacements.value
    .filter((p) => p.weekday === weekday)
    .reduce((sum, p) => sum + (p.hours ?? 0), 0)
  const leftoverHours = Math.max(0, Math.round((open - ftHours) * 10) / 10)
  return {
    share,
    estRevenue: Math.round(estRevenue),
    openHours: open,
    ftHours: Math.round(ftHours * 10) / 10,
    leftoverHours,
  }
}

function formatEur(n: number): string {
  return Math.round(n).toLocaleString('nl-NL')
}

function emitPlacements(next: StaffOrgPlacement[], memberId: string) {
  emit('update:placements', rebalanceContractHours(next, props.roster, [memberId]))
}

function onDrop(
  payload: { memberId: string; sourceWeekday?: StaffOrgWeekday; sourceSlot?: StaffOrgSlot },
  weekday: StaffOrgWeekday,
  slot: StaffOrgSlot,
) {
  const { memberId, sourceWeekday, sourceSlot } = payload
  // Reactivate if dragging from Not active onto a cell
  if (inactiveSet.value.has(memberId)) {
    emit(
      'update:inactive',
      props.inactiveMemberIds.filter((id) => id !== memberId),
    )
  }

  let next = [...props.placements]

  if (sourceWeekday != null && sourceSlot) {
    next = next.filter(
      (p) => !(
        p.memberId === memberId
        && p.locationId === props.locationId
        && p.team === props.team
        && p.weekday === sourceWeekday
        && p.slot === sourceSlot
      ),
    )
  }

  const already = next.some(
    (p) =>
      p.memberId === memberId
      && p.locationId === props.locationId
      && p.team === props.team
      && p.weekday === weekday
      && p.slot === slot,
  )
  if (!already) {
    next = next.filter(
      (p) => !(
        p.memberId === memberId
        && p.locationId === props.locationId
        && p.team === props.team
        && p.weekday === weekday
      ),
    )
    next.push({
      memberId,
      locationId: props.locationId,
      team: props.team,
      weekday,
      slot,
    })
  }

  emitPlacements(next, memberId)
}

function onDropUnassign(e: DragEvent) {
  const memberId = e.dataTransfer?.getData('application/x-staff-org-member')
  if (!memberId) return
  const raw = e.dataTransfer?.getData('application/x-staff-org-source')
  if (raw) {
    try {
      const parsed = JSON.parse(raw) as { weekday?: number; slot?: string }
      if (
        typeof parsed.weekday === 'number'
        && (parsed.slot === 'day' || parsed.slot === 'evening')
      ) {
        const next = props.placements.filter(
          (p) => !(
            p.memberId === memberId
            && p.locationId === props.locationId
            && p.team === props.team
            && p.weekday === parsed.weekday
            && p.slot === parsed.slot
          ),
        )
        emitPlacements(next, memberId)
        return
      }
    } catch {
      // fall through
    }
  }
  emitPlacements(
    props.placements.filter((p) => p.memberId !== memberId),
    memberId,
  )
}

function onInactiveDragOver(e: DragEvent) {
  if (e.dataTransfer) e.dataTransfer.dropEffect = 'move'
}

function onDropInactive(e: DragEvent) {
  const memberId = e.dataTransfer?.getData('application/x-staff-org-member')
  if (!memberId) return
  emit('update:inactive', [...new Set([...props.inactiveMemberIds, memberId])])
}

function reactivateMember(memberId: string) {
  emit(
    'update:inactive',
    props.inactiveMemberIds.filter((id) => id !== memberId),
  )
}
</script>
