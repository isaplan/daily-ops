<template>
  <div
    data-pdf-staff-card
    draggable="true"
    class="cursor-grab rounded border px-2 py-1.5 text-left shadow-sm active:cursor-grabbing"
    :class="cardClass"
    @dragstart="onDragStart"
  >
    <div class="flex items-start gap-1">
      <p
        data-pdf-staff-name
        class="min-w-0 flex-1 truncate font-semibold"
        :class="conflict ? 'text-red-900' : placeholder ? 'text-amber-900' : 'text-gray-900'"
      >
        {{ member.name }}
      </p>
      <button
        v-if="showPlus && !editingPanel"
        type="button"
        class="shrink-0 rounded p-0.5 text-gray-500 hover:bg-gray-100 hover:text-gray-800"
        title="Days, hours & locations"
        @mousedown.stop
        @click.stop="openPanel"
      >
        <UIcon name="i-lucide-plus" class="size-3.5" />
      </button>
    </div>

    <div
      v-if="editingPanel"
      class="mt-1 space-y-1.5"
      @mousedown.stop
      @click.stop
    >
      <div class="flex flex-wrap items-center gap-1 text-[11px] text-gray-600">
        <input
          ref="daysInput"
          v-model="daysDraft"
          type="number"
          min="1"
          max="7"
          step="1"
          class="w-10 rounded border border-gray-300 bg-white px-1 py-0.5 text-[11px] tabular-nums text-gray-900"
          @keydown.enter.prevent="commitPanel"
          @keydown.escape.prevent="closePanel"
        >
        <span>d/w</span>
        <template v-if="editableDesiredHours">
          <input
            ref="hoursInput"
            v-model="hoursDraft"
            type="number"
            min="0"
            max="60"
            step="0.5"
            class="ml-1 w-12 rounded border border-gray-300 bg-white px-1 py-0.5 text-[11px] tabular-nums text-gray-900"
            @keydown.enter.prevent="commitPanel"
            @keydown.escape.prevent="closePanel"
          >
          <span>u/w</span>
        </template>
        <button
          type="button"
          class="rounded px-1 text-[10px] font-medium text-gray-600 hover:bg-gray-100"
          @click="commitPanel"
        >
          OK
        </button>
      </div>
      <div
        v-if="locationOptions.length"
        class="flex flex-wrap gap-1"
      >
        <button
          v-for="v in locationOptions"
          :key="v.locationId"
          type="button"
          class="rounded-full border px-2 py-0.5 text-[10px] font-semibold tracking-wide transition-colors"
          :class="activeLocationIdSet.has(v.locationId)
            ? 'border-gray-900 bg-gray-900 text-white'
            : 'border-gray-300 bg-white text-gray-600 hover:border-gray-900'"
          :aria-pressed="activeLocationIdSet.has(v.locationId)"
          :title="activeLocationIdSet.has(v.locationId) ? `Remove from ${v.short}` : `Add to ${v.short}`"
          @click="emit('toggle:location', member.memberId, v.locationId)"
        >
          {{ v.short }}
        </button>
      </div>
      <button
        type="button"
        class="text-[10px] text-gray-500 hover:text-gray-800"
        @click="closePanel"
      >
        Close
      </button>
    </div>

    <p
      v-else
      data-pdf-staff-meta
      class="truncate text-[11px] text-gray-600"
    >
      <span
        v-if="cellHours != null"
        class="font-medium text-gray-700"
      >{{ cellHours }}u</span>
      <template v-else>
        <span v-if="displayWeeklyHours != null">{{ displayWeeklyHours }}u/w</span>
        <span
          v-if="displayDays != null"
          class="font-medium text-gray-800"
        >
          ·
          <template v-if="placedDays && placedDays > 0">{{ placedDays }}/{{ displayDays }}d</template>
          <template v-else>{{ displayDays }}d/w</template>
        </span>
        <span
          v-if="placedDays && placedDays > 0 && hoursPerDay != null"
          class="text-gray-600"
        >
          · {{ hoursPerDay }}u/d
        </span>
      </template>
      <span v-if="cellHours == null && !hideWage && member.costPerHour"> · €{{ member.costPerHour.toFixed(2) }}/h</span>
      <span
        v-if="activeLocationLabels"
        class="text-gray-500"
      > · {{ activeLocationLabels }}</span>
    </p>
  </div>
</template>

<script setup lang="ts">
/**
 * @registry-id: StaffOrgStaffCard
 * @created: 2026-07-22T18:00:00.000Z
 * @last-modified: 2026-08-13T14:00:00.000Z
 * @description: Draggable staff card — days/hours editor + multi-location pills
 * @last-fix: [2026-08-13] Red day-conflict + TBD need placeholder styles
 * @adr-ref: ADR-016
 */

import type { StaffOrgRosterMember, StaffOrgSlot, StaffOrgTeam, StaffOrgWeekday } from '~/types/staff-org'
import {
  hoursPerDayFromContract,
  suggestedDaysForMember,
} from '~/utils/staffOrg/contractHours'

export type StaffOrgLocationPill = {
  locationId: string
  short: string
}

const props = withDefaults(
  defineProps<{
    member: StaffOrgRosterMember
    compact?: boolean
    placedDays?: number
    /** Hours for this cell after contract split. */
    cellHours?: number
    sourceWeekday?: StaffOrgWeekday
    sourceSlot?: StaffOrgSlot
    sourceTeam?: StaffOrgTeam
    /** Same weekday already placed at another venue. */
    dayConflict?: boolean
    /** TBD need-FT/PT/ZZP placeholder. */
    placeholder?: boolean
    /** Hide €/h (e.g. executive staff). */
    hideWage?: boolean
    /** Show hours input in + panel (PT / PT Sr lanes). */
    editableDesiredHours?: boolean
    /** Show + for days/w editor (RosterPlanner / FT). */
    editableDesiredDays?: boolean
    /** Open venues for multi-location pills. */
    locationOptions?: StaffOrgLocationPill[]
    /** Location ids where this member already has an org assignment. */
    activeLocationIds?: string[]
  }>(),
  {
    compact: false,
    dayConflict: false,
    placeholder: false,
    hideWage: false,
    editableDesiredHours: false,
    editableDesiredDays: false,
    locationOptions: () => [],
    activeLocationIds: () => [],
  },
)

const emit = defineEmits<{
  'update:desiredHours': [memberId: string, hours: number | null]
  'update:desiredDays': [memberId: string, days: number | null]
  'toggle:location': [memberId: string, locationId: string]
}>()

const editingPanel = ref(false)
const hoursDraft = ref('')
const daysDraft = ref('')
const hoursInput = ref<HTMLInputElement | null>(null)
const daysInput = ref<HTMLInputElement | null>(null)

const conflict = computed(() => props.dayConflict)
const placeholder = computed(() => props.placeholder)

const cardClass = computed(() => {
  const size = props.compact ? 'text-xs' : 'text-sm'
  if (conflict.value) {
    return `${size} border-red-500 bg-red-50`
  }
  if (placeholder.value) {
    return `${size} border-dashed border-amber-400 bg-amber-50/70`
  }
  return `${size} border-gray-400 bg-white`
})

const showPlus = computed(
  () =>
    !placeholder.value
    && (props.editableDesiredHours
      || props.editableDesiredDays
      || props.locationOptions.length > 0),
)

const activeLocationIdSet = computed(() => new Set(props.activeLocationIds))

const activeLocationLabels = computed(() => {
  if (!props.locationOptions.length || props.activeLocationIds.length <= 1) return null
  const shorts = props.locationOptions
    .filter((v) => activeLocationIdSet.value.has(v.locationId))
    .map((v) => v.short)
  return shorts.length > 1 ? shorts.join('+') : null
})

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

const displayDays = computed(() => suggestedDaysForMember(props.member))

const hoursPerDay = computed(() =>
  hoursPerDayFromContract(hoursForSplit.value, props.placedDays ?? 0),
)

function openPanel () {
  const currentH = props.member.desiredWeeklyHours ?? props.member.weeklyContractHours
  hoursDraft.value = currentH != null ? String(currentH) : ''
  const currentD = suggestedDaysForMember(props.member)
  daysDraft.value = currentD != null ? String(currentD) : ''
  editingPanel.value = true
  nextTick(() => daysInput.value?.focus())
}

function closePanel () {
  editingPanel.value = false
}

function commitPanel () {
  const rawD = String(daysDraft.value ?? '').trim()
  if (rawD === '') {
    emit('update:desiredDays', props.member.memberId, null)
  } else {
    const n = Number(rawD)
    if (Number.isFinite(n) && n >= 1) {
      emit('update:desiredDays', props.member.memberId, Math.min(7, Math.max(1, Math.round(n))))
    }
  }

  if (props.editableDesiredHours) {
    const rawH = String(hoursDraft.value ?? '').trim()
    if (rawH === '') {
      emit('update:desiredHours', props.member.memberId, null)
    } else {
      const n = Number(rawH)
      if (Number.isFinite(n) && n >= 0) {
        emit('update:desiredHours', props.member.memberId, Math.round(n * 10) / 10)
      }
    }
  }
  closePanel()
}

function onDragStart (e: DragEvent) {
  if (editingPanel.value) {
    e.preventDefault()
    return
  }
  if (!e.dataTransfer) return
  e.dataTransfer.setData('application/x-staff-org-member', props.member.memberId)
  if (props.sourceWeekday != null && props.sourceSlot) {
    e.dataTransfer.setData(
      'application/x-staff-org-source',
      JSON.stringify({
        weekday: props.sourceWeekday,
        slot: props.sourceSlot,
        team: props.sourceTeam,
      }),
    )
  }
  e.dataTransfer.effectAllowed = 'copyMove'
}
</script>
