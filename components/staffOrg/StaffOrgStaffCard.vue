<template>
  <div
    draggable="true"
    class="cursor-grab rounded border border-gray-200 bg-white px-2 py-1.5 text-left shadow-sm active:cursor-grabbing"
    :class="compact ? 'text-xs' : 'text-sm'"
    @dragstart="onDragStart"
  >
    <p class="truncate font-medium text-gray-900">{{ member.name }}</p>
    <p class="truncate text-[10px] text-gray-500">
      <span v-if="cellHours != null" class="font-medium text-gray-700">{{ cellHours }}u</span>
      <template v-else>
        <span v-if="member.weeklyContractHours != null">{{ member.weeklyContractHours }}u/w</span>
        <template v-if="placedDays && placedDays > 0">
          <span> · {{ placedDays }}d</span>
          <span v-if="hoursPerDay != null"> · {{ hoursPerDay }}u/d</span>
        </template>
        <span v-else-if="suggestedDays != null" class="text-gray-400">
          · ~{{ suggestedDays }}d @{{ typicalDayHours }}u
        </span>
      </template>
      <span v-if="cellHours == null && !hideWage && member.costPerHour"> · €{{ member.costPerHour.toFixed(2) }}/h</span>
    </p>
  </div>
</template>

<script setup lang="ts">
/**
 * @registry-id: StaffOrgStaffCard
 * @created: 2026-07-22T18:00:00.000Z
 * @last-modified: 2026-07-23T10:50:00.000Z
 * @description: Draggable FT staff card — days + u/d from contract split
 * @last-fix: [2026-07-23] Optional hideWage for executive staff
 * @adr-ref: ADR-016
 */

import type { StaffOrgRosterMember, StaffOrgSlot, StaffOrgWeekday } from '~/types/staff-org'
import {
  hoursPerDayFromContract,
  STAFF_ORG_TYPICAL_DAY_HOURS,
  suggestedDaysForContract,
} from '~/utils/staffOrg/contractHours'

const props = withDefaults(
  defineProps<{
    member: StaffOrgRosterMember
    compact?: boolean
    placedDays?: number
    /** Hours for this cell after contract split. */
    cellHours?: number
    sourceWeekday?: StaffOrgWeekday
    sourceSlot?: StaffOrgSlot
    /** Hide €/h (e.g. executive staff). */
    hideWage?: boolean
  }>(),
  { compact: false, hideWage: false },
)

const typicalDayHours = STAFF_ORG_TYPICAL_DAY_HOURS

const suggestedDays = computed(() =>
  suggestedDaysForContract(props.member.weeklyContractHours),
)

const hoursPerDay = computed(() =>
  hoursPerDayFromContract(props.member.weeklyContractHours, props.placedDays ?? 0),
)

function onDragStart(e: DragEvent) {
  if (!e.dataTransfer) return
  e.dataTransfer.setData('application/x-staff-org-member', props.member.memberId)
  if (props.sourceWeekday != null && props.sourceSlot) {
    e.dataTransfer.setData(
      'application/x-staff-org-source',
      JSON.stringify({ weekday: props.sourceWeekday, slot: props.sourceSlot }),
    )
  }
  e.dataTransfer.effectAllowed = 'copyMove'
}
</script>
