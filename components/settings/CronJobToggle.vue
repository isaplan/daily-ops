<template>
  <div class="space-y-4">
    <div class="flex items-center justify-between gap-4">
      <div class="space-y-1">
        <p class="text-sm font-medium text-gray-900">{{ label }}</p>
        <p class="text-sm text-gray-500">{{ description }}</p>
        <p v-if="scheduleNote" class="text-xs text-gray-500">{{ scheduleNote }}</p>
      </div>
      <USwitch 
        :model-value="enabled" 
        @update:model-value="onToggle"
        :ui="{
          base: 'data-[state=checked]:bg-gray-900 data-[state=unchecked]:bg-gray-400'
        }"
      />
    </div>

    <EndpointCheckList :endpoints="endpoints" />

    <p v-if="lastRunLabel" class="text-sm text-gray-500">
      Last run: {{ lastRunLabel }}
    </p>
    <p v-else class="text-sm text-gray-500">
      Cron job not configured yet. Toggle the switch to create it.
    </p>

    <UButton variant="outline" size="sm" :disabled="!enabled || runNowLoading" :loading="runNowLoading" @click="$emit('run-now')">
      Run Now
    </UButton>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import EndpointCheckList from '~/components/settings/EndpointCheckList.vue'

const props = withDefaults(defineProps<{
  label: string
  description: string
  scheduleNote?: string
  enabled: boolean
  lastRun?: string | null
  endpoints: string[]
  runNowLoading?: boolean
}>(), {
  scheduleNote: '',
  lastRun: null,
  runNowLoading: false,
})

const emit = defineEmits<{
  (e: 'toggle', value: boolean): void
  (e: 'run-now'): void
}>()

const onToggle = (value: boolean) => emit('toggle', value)

const lastRunLabel = computed(() => {
  if (!props.lastRun) return null
  return new Date(props.lastRun).toLocaleString()
})
</script>
