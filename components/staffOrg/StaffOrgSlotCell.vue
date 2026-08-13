<template>
  <div
    class="min-h-[4.5rem] rounded-md border p-1.5 transition-colors"
    :class="cellClass"
    @dragover.prevent="onDragOver"
    @dragleave="draggingOver = false"
    @drop.prevent="onDrop"
  >
    <div class="mb-1 flex items-center justify-between gap-1 text-[10px] text-gray-500">
      <span v-if="openHours != null">{{ openHours.toFixed(1) }}u open</span>
      <span v-else>Closed</span>
      <span :class="headcountClass">{{ headcount }}/{{ minStaff }}–{{ maxStaff }}</span>
    </div>
    <div class="flex flex-col gap-1">
      <StaffOrgStaffCard
        v-for="m in members"
        :key="m.member.memberId"
        :member="m.member"
        compact
        :placed-days="m.placedDays"
        :day-conflict="m.dayConflict"
        :placeholder="m.placeholder"
        :hide-wage="m.placeholder"
        :source-weekday="weekday"
        :source-slot="m.slot ?? slot"
        :source-team="team"
        :cell-hours="m.hours"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
/**
 * @registry-id: StaffOrgSlotCell
 * @created: 2026-07-22T18:00:00.000Z
 * @last-modified: 2026-08-13T14:00:00.000Z
 * @description: Drop target cell for weekday × team (day/evening combined)
 * @last-fix: [2026-08-13] Pass dayConflict + placeholder to staff cards
 * @adr-ref: ADR-016
 */

import type { StaffOrgRosterMember, StaffOrgSlot, StaffOrgTeam, StaffOrgWeekday } from '~/types/staff-org'

const props = defineProps<{
  locationId: string
  team: StaffOrgTeam
  weekday: StaffOrgWeekday
  /** Default slot used when dropping into this cell. */
  slot: StaffOrgSlot
  members: Array<{
    member: StaffOrgRosterMember
    hours?: number
    placedDays: number
    slot?: StaffOrgSlot
    dayConflict?: boolean
    placeholder?: boolean
  }>
  openHours: number | null
  headcount: number
  minStaff: number
  maxStaff: number
  underMin: boolean
  overMax: boolean
}>()

const emit = defineEmits<{
  drop: [payload: {
    memberId: string
    sourceWeekday?: StaffOrgWeekday
    sourceSlot?: StaffOrgSlot
    sourceTeam?: StaffOrgTeam
    /** Keep source cell (Alt/⌥ or ZZP duplicate). */
    copy?: boolean
  }]
}>()

const draggingOver = ref(false)

const cellClass = computed(() => {
  if (props.openHours == null) return 'border-dashed border-gray-200 bg-gray-50 opacity-60'
  if (props.overMax) return 'border-red-300 bg-red-50'
  if (props.underMin) return 'border-amber-300 bg-amber-50'
  if (draggingOver.value) return 'border-gray-400 bg-gray-100'
  return 'border-gray-200 bg-white'
})

const headcountClass = computed(() => {
  if (props.overMax) return 'font-semibold text-red-600'
  if (props.underMin) return 'font-semibold text-amber-700'
  return 'text-gray-500'
})

function onDragOver (e: DragEvent) {
  if (props.openHours == null) return
  e.dataTransfer && (e.dataTransfer.dropEffect = e.altKey || e.metaKey ? 'copy' : 'copy')
  draggingOver.value = true
}

function onDrop (e: DragEvent) {
  draggingOver.value = false
  if (props.openHours == null) return
  const memberId = e.dataTransfer?.getData('application/x-staff-org-member')
  if (!memberId) return
  let sourceWeekday: StaffOrgWeekday | undefined
  let sourceSlot: StaffOrgSlot | undefined
  let sourceTeam: StaffOrgTeam | undefined
  const raw = e.dataTransfer?.getData('application/x-staff-org-source')
  if (raw) {
    try {
      const parsed = JSON.parse(raw) as { weekday?: number; slot?: string; team?: string }
      if (typeof parsed.weekday === 'number') sourceWeekday = parsed.weekday as StaffOrgWeekday
      if (parsed.slot === 'day' || parsed.slot === 'evening') sourceSlot = parsed.slot
      if (parsed.team === 'keuken' || parsed.team === 'bediening' || parsed.team === 'bar') {
        sourceTeam = parsed.team
      }
    } catch {
      // ignore
    }
  }
  emit('drop', {
    memberId,
    sourceWeekday,
    sourceSlot,
    sourceTeam,
    copy: Boolean(e.altKey || e.metaKey),
  })
}
</script>
