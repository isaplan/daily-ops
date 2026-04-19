<template>
  <div class="flex items-center gap-2 shrink-0">
    <span class="text-xs font-medium" :class="modelValue ? 'text-gray-900' : 'text-gray-500'">
      {{ modelValue ? 'ON' : 'OFF' }}
    </span>
    <div
      class="rounded-full border-2 p-0.5"
      :class="modelValue ? 'border-black' : 'border-gray-400'"
      :style="{ backgroundColor: modelValue ? '#000000' : '#e5e7eb' }"
    >
      <USwitch
        :model-value="modelValue"
        @update:model-value="onUpdate"
        :ui="{
          base: 'bg-transparent border-0',
          thumb: 'bg-white',
        }"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
defineProps<{
  modelValue: boolean
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', value: boolean): void
}>()

const onUpdate = (value: boolean) => emit('update:modelValue', value)
</script>
