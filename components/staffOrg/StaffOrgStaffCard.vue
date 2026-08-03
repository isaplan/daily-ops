<template>
  <div
    data-pdf-staff-card
    draggable="true"
    class="cursor-grab rounded border border-gray-400 bg-white px-2 py-1.5 text-left shadow-sm active:cursor-grabbing"
    :class="compact ? 'text-xs' : 'text-sm'"
    @dragstart="onDragStart"
  >
    <div class="flex items-start gap-1">
      <p data-pdf-staff-name class="min-w-0 flex-1 truncate font-semibold text-gray-900">
        {{ member.name }}
      </p>
      <button
        v-if="editableDesiredHours && !editingHours"
        type="button"
        class="shrink-0 rounded p-0.5 text-gray-500 hover:bg-gray-100 hover:text-gray-800"
        title="Set available hours / week"
        @mousedown.stop
        @click.stop="openHoursEditor"
      >
        <UIcon name="i-lucide-plus" class="size-3.5" />
      </button>
    </div>
    <p data-pdf-staff-meta class="truncate text-[11px] text-gray-600">
      <template v-if="editableDesiredHours && editingHours">
        <span class="inline-flex items-center gap-1" @mousedown.stop @click.stop>
          <input
            ref="hoursInput"
            v-model="hoursDraft"
            type="number"
            min="0"
            max="60"
            step="0.5"
            class="w-12 rounded border border-gray-300 bg-white px-1 py-0.5 text-[11px] tabular-nums text-gray-900"
            @keydown.enter.prevent="commitHours"
            @keydown.escape.prevent="cancelHours"
            @blur="commitHours"
          >
          <span>u/w</span>
        </span>
      </template>
      <template v-else>
        <span v-if="cellHours != null" class="font-medium text-gray-700">{{ cellHours }}u</span>
        <template v-else>
          <span v-if="displayWeeklyHours != null">{{ displayWeeklyHours }}u/w</span>
          <template v-if="placedDays && placedDays > 0">
            <span> · {{ placedDays }}d</span>
            <span v-if="hoursPerDay != null"> · {{ hoursPerDay }}u/d</span>
          </template>
          <span v-else-if="suggestedDays != null" class="text-gray-400">
            · ~{{ suggestedDays }}d @{{ typicalDayHours }}u
          </span>
        </template>
        <span v-if="cellHours == null && !hideWage && member.costPerHour"> · €{{ member.costPerHour.toFixed(2) }}/h</span>
      </template>
    </p>
  </div>
</template>

<script setup lang="ts">
/**
 * @registry-id: StaffOrgStaffCard
 * @created: 2026-07-22T18:00:00.000Z
 * @last-modified: 2026-07-28T16:35:00.000Z
 * @description: Draggable staff card — days + u/d; PT hours editor
 * @last-fix: [2026-07-28] + icon edits desiredWeeklyHours for PT / PT Sr
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
    /** Show + → hours input (PT / PT Sr lanes). */
    editableDesiredHours?: boolean
  }>(),
  { compact: false, hideWage: false, editableDesiredHours: false },
)

const emit = defineEmits<{
  'update:desiredHours': [memberId: string, hours: number | null]
}>()

const typicalDayHours = STAFF_ORG_TYPICAL_DAY_HOURS
const editingHours = ref(false)
const hoursDraft = ref('')
const hoursInput = ref<HTMLInputElement | null>(null)

const displayWeeklyHours = computed(() => {
  if (props.editableDesiredHours) {
    const d = props.member.desiredWeeklyHours
    if (d != null && Number.isFinite(d)) return d
  }
  return props.member.weeklyContractHours
})

const hoursForSplit = computed(() =>
  props.editableDesiredHours
    ? (props.member.desiredWeeklyHours ?? props.member.weeklyContractHours)
    : props.member.weeklyContractHours,
)

const suggestedDays = computed(() =>
  suggestedDaysForContract(hoursForSplit.value),
)

const hoursPerDay = computed(() =>
  hoursPerDayFromContract(hoursForSplit.value, props.placedDays ?? 0),
)

function openHoursEditor() {
  const current = props.member.desiredWeeklyHours ?? props.member.weeklyContractHours
  hoursDraft.value = current != null ? String(current) : ''
  editingHours.value = true
  nextTick(() => hoursInput.value?.focus())
}

function commitHours() {
  if (!editingHours.value) return
  editingHours.value = false
  const raw = hoursDraft.value.trim()
  if (raw === '') {
    emit('update:desiredHours', props.member.memberId, null)
    return
  }
  const n = Number(raw)
  if (!Number.isFinite(n) || n < 0) return
  emit('update:desiredHours', props.member.memberId, Math.round(n * 10) / 10)
}

function cancelHours() {
  editingHours.value = false
}

function onDragStart(e: DragEvent) {
  if (editingHours.value) {
    e.preventDefault()
    return
  }
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
