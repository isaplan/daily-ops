<template>
  <div class="rounded-lg border border-gray-200 bg-white p-4">
    <div class="mb-3 flex items-center justify-between gap-2">
      <div v-if="!hideTitle" class="min-w-0">
        <h3 class="text-sm font-semibold text-gray-900">Min / max FT staff</h3>
        <p class="mt-0.5 text-[10px] leading-snug text-gray-500">
          Chef, Manager, Floor &amp; FT only — not PT or ZZP.
        </p>
      </div>
      <span v-else class="flex-1" />
      <UButton size="xs" variant="outline" :loading="saving" @click="emitSave">Save rules</UButton>
    </div>
    <div class="overflow-x-auto">
      <table class="min-w-full text-xs">
        <thead>
          <tr class="border-b border-gray-200 text-left text-gray-500">
            <th class="px-2 py-1 font-medium">Slot</th>
            <th v-for="d in dayLabels" :key="d" class="px-2 py-1 font-medium">{{ d }}</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="slot in slots" :key="slot" class="border-b border-gray-100">
            <td class="px-2 py-2 font-medium capitalize text-gray-700">{{ slot }}</td>
            <td v-for="weekday in weekdays" :key="`${slot}-${weekday}`" class="px-1 py-1">
              <div class="flex items-center gap-0.5">
                <input
                  type="number"
                  min="0"
                  max="20"
                  class="w-10 rounded border border-gray-300 px-1 py-0.5 text-center"
                  :value="ruleFor(weekday, slot).minStaff"
                  @change="onMin(weekday, slot, ($event.target as HTMLInputElement).value)"
                >
                <span class="text-gray-400">–</span>
                <input
                  type="number"
                  min="0"
                  max="20"
                  class="w-10 rounded border border-gray-300 px-1 py-0.5 text-center"
                  :value="ruleFor(weekday, slot).maxStaff"
                  @change="onMax(weekday, slot, ($event.target as HTMLInputElement).value)"
                >
              </div>
            </td>
          </tr>
          <tr class="text-[9px] uppercase tracking-wide text-gray-400">
            <td class="px-2 py-0.5" />
            <td
              v-for="weekday in weekdays"
              :key="`lbl-${weekday}`"
              class="px-1 py-0.5"
            >
              <div class="flex items-center gap-0.5">
                <span class="w-10 text-center">min</span>
                <span class="invisible">–</span>
                <span class="w-10 text-center">max</span>
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

<script setup lang="ts">
/**
 * @registry-id: StaffOrgRulesEditor
 * @created: 2026-07-22T18:00:00.000Z
 * @last-modified: 2026-07-24T12:35:00.000Z
 * @description: Edit min/max FT staff per weekday × day/evening for one location/team
 * @last-fix: [2026-07-24] Footer min/max labels under evening row
 * @adr-ref: ADR-016
 */

import type {
  StaffOrgLocationRule,
  StaffOrgSlot,
  StaffOrgTeam,
  StaffOrgWeekday,
} from '~/types/staff-org'

const props = withDefaults(
  defineProps<{
    locationId: string
    team: StaffOrgTeam
    rules: StaffOrgLocationRule[]
    saving?: boolean
    /** Hide title when parent already shows Min / max FT heading. */
    hideTitle?: boolean
  }>(),
  { hideTitle: false },
)

const emit = defineEmits<{
  save: [rules: StaffOrgLocationRule[]]
}>()

const dayLabels = ['Ma', 'Di', 'Wo', 'Do', 'Vr', 'Za', 'Zo']
const weekdays = [0, 1, 2, 3, 4, 5, 6] as StaffOrgWeekday[]
const slots: StaffOrgSlot[] = ['day', 'evening']

const localRules = ref<StaffOrgLocationRule[]>([])

watch(
  () => props.rules,
  (r) => {
    localRules.value = r.map((x) => ({ ...x }))
  },
  { immediate: true, deep: true },
)

function ruleFor(weekday: StaffOrgWeekday, slot: StaffOrgSlot): StaffOrgLocationRule {
  const existing = localRules.value.find(
    (r) =>
      r.locationId === props.locationId
      && r.team === props.team
      && r.weekday === weekday
      && r.slot === slot,
  )
  if (existing) return existing
  const created: StaffOrgLocationRule = {
    locationId: props.locationId,
    team: props.team,
    weekday,
    slot,
    minStaff: 0,
    maxStaff: 8,
  }
  localRules.value.push(created)
  return created
}

function onMin(weekday: StaffOrgWeekday, slot: StaffOrgSlot, raw: string) {
  const r = ruleFor(weekday, slot)
  r.minStaff = Math.max(0, Number(raw) || 0)
}

function onMax(weekday: StaffOrgWeekday, slot: StaffOrgSlot, raw: string) {
  const r = ruleFor(weekday, slot)
  r.maxStaff = Math.max(0, Number(raw) || 0)
}

function emitSave() {
  emit(
    'save',
    localRules.value.filter(
      (r) => r.locationId === props.locationId && r.team === props.team,
    ),
  )
}
</script>
