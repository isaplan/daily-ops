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
        :source-weekday="weekday"
        :source-slot="slot"
        :cell-hours="m.hours"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
/**
 * @registry-id: StaffOrgSlotCell
 * @created: 2026-07-22T18:00:00.000Z
 * @last-modified: 2026-07-22T22:15:00.000Z
 * @description: Drop target cell for weekday × day/evening slot
 * @last-fix: [2026-07-22] Multi-day: cards carry source cell for move
 * @adr-ref: ADR-016
 */

import type { StaffOrgRosterMember, StaffOrgSlot, StaffOrgTeam, StaffOrgWeekday } from '~/types/staff-org'

const props = defineProps<{
  locationId: string
  team: StaffOrgTeam
  weekday: StaffOrgWeekday
  slot: StaffOrgSlot
  members: Array<{
    member: StaffOrgRosterMember
    hours?: number
    placedDays: number
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

function onDragOver(e: DragEvent) {
  if (props.openHours == null) return
  e.dataTransfer && (e.dataTransfer.dropEffect = 'copy')
  draggingOver.value = true
}

function onDrop(e: DragEvent) {
  draggingOver.value = false
  if (props.openHours == null) return
  const memberId = e.dataTransfer?.getData('application/x-staff-org-member')
  if (!memberId) return
  let sourceWeekday: StaffOrgWeekday | undefined
  let sourceSlot: StaffOrgSlot | undefined
  const raw = e.dataTransfer?.getData('application/x-staff-org-source')
  if (raw) {
    try {
      const parsed = JSON.parse(raw) as { weekday?: number; slot?: string }
      if (typeof parsed.weekday === 'number') sourceWeekday = parsed.weekday as StaffOrgWeekday
      if (parsed.slot === 'day' || parsed.slot === 'evening') sourceSlot = parsed.slot
    } catch {
      // ignore
    }
  }
  emit('drop', { memberId, sourceWeekday, sourceSlot })
}
</script>
