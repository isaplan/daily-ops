<template>
  <div class="flex gap-6 border-b border-gray-200">
    <button
      v-for="tab in tabs"
      :key="tab.id"
      type="button"
      :class="[
        'pb-2 text-sm font-medium border-b-2 transition-colors',
        modelValue === tab.id
          ? 'text-gray-900 border-gray-900'
          : 'text-gray-600 border-transparent hover:text-gray-900',
      ]"
      @click="$emit('update:modelValue', tab.id)"
    >
      {{ tab.label }}
    </button>
  </div>
</template>

<script setup lang="ts" generic="T extends string">
interface Tab {
  id: T
  label: string
}

withDefaults(
  defineProps<{
    modelValue: T
    tabs: Tab[]
  }>(),
  {}
)

defineEmits<{
  (e: 'update:modelValue', value: T): void
}>()
</script>
