<template>
  <div class="inline-flex max-w-max flex-wrap items-center gap-1 rounded-md border-2 border-gray-900 bg-white p-1">
    <button
      v-for="option in options"
      :key="option.id"
      type="button"
      :class="[
        'rounded px-3 py-1.5 text-sm font-semibold transition-colors',
        modelValue === option.id
          ? 'bg-gray-900 text-white'
          : 'text-gray-700 hover:bg-gray-100'
      ]"
      @click="$emit('update:modelValue', option.id)"
    >
      {{ option.label }}
    </button>
  </div>
</template>

<script setup lang="ts" generic="T extends string">
interface Option {
  id: T
  label: string
}

withDefaults(
  defineProps<{
    modelValue: T
    options: Option[]
  }>(),
  {}
)

defineEmits<{
  (e: 'update:modelValue', value: T): void
}>()
</script>
