<template>
  <div class="space-y-4">
    <!-- Location Buttons -->
    <div class="space-y-2">
      <label class="text-sm font-medium">Locations</label>
      <div class="flex flex-wrap gap-2">
        <UButton
          v-for="loc in locationOptions"
          :key="loc.value"
          :variant="modelValue.locationId === loc.value ? 'solid' : 'outline'"
          :class="modelValue.locationId === loc.value ? '!bg-gray-900 !text-white' : ''"
          @click="updateFilter({ locationId: loc.value })"
        >
          {{ loc.label }}
        </UButton>
      </div>
    </div>

    <!-- Quick Date Selectors -->
    <div class="space-y-2">
      <label class="text-sm font-medium">Quick Date Selection</label>
      <div class="flex flex-wrap gap-2">
        <UButton
          v-for="preset in datePresets"
          :key="preset.value"
          :variant="isDatePresetSelected(preset) ? 'solid' : 'outline'"
          :class="isDatePresetSelected(preset) ? '!bg-gray-900 !text-white' : ''"
          size="sm"
          @click="applyDatePreset(preset)"
        >
          <div class="text-center">
            <div class="font-medium">{{ preset.label }}</div>
            <div class="text-xs opacity-75">{{ preset.dayName }}</div>
            <div class="text-xs opacity-75">{{ preset.dateStr }}</div>
          </div>
        </UButton>
      </div>
    </div>

    <!-- Manual Date Range -->
    <div class="space-y-2">
      <label class="text-sm font-medium">or specify date range</label>
      <div class="flex gap-2 items-end">
        <div class="space-y-1 flex-1">
          <label class="text-xs text-gray-600">Start Date</label>
          <UInput 
            :model-value="modelValue.startDate" 
            type="date" 
            @update:model-value="updateFilter({ startDate: $event })" 
          />
        </div>
        <div class="space-y-1 flex-1">
          <label class="text-xs text-gray-600">End Date</label>
          <UInput 
            :model-value="modelValue.endDate" 
            type="date" 
            @update:model-value="updateFilter({ endDate: $event })" 
          />
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'

interface FilterValue {
  locationId: string
  startDate: string
  endDate: string
}

interface DatePreset {
  label: string
  dayName: string
  dateStr: string
  value: string
  daysOffset: number
}

const props = defineProps<{
  modelValue: FilterValue
  locations: { _id: string; name: string }[]
}>()

const emit = defineEmits<{
  'update:modelValue': [value: Partial<FilterValue>]
}>()

const locationOptions = computed(() => [
  { label: 'All Locations', value: 'all' },
  ...props.locations.map((l: { _id: string; name: string }) => ({ label: l.name, value: l._id })),
])

const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

const datePresets = computed(() => {
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  return Array.from({ length: 7 }, (_, i) => {
    const date = new Date(today)
    date.setDate(date.getDate() - i)
    const dateStr = date.toISOString().split('T')[0]
    const dayName = dayNames[date.getDay()]
    const label = i === 0 ? 'Today' : i === 1 ? 'Yesterday' : `${i}d ago`

    return {
      label,
      dayName,
      dateStr,
      value: dateStr,
      daysOffset: i,
    }
  })
})

function updateFilter(updates: Partial<FilterValue>) {
  emit('update:modelValue', updates)
}

function applyDatePreset(preset: DatePreset) {
  emit('update:modelValue', {
    startDate: preset.dateStr,
    endDate: preset.dateStr,
  })
}

function isDatePresetSelected(preset: DatePreset): boolean {
  return props.modelValue.startDate === preset.dateStr && props.modelValue.endDate === preset.dateStr
}
</script>
