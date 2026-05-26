<template>
  <div
    class="inline-flex shrink-0 gap-1"
    role="tablist"
    :aria-label="ariaLabel"
  >
    <button
      v-for="(option, idx) in options"
      :key="option.key ?? `${String(option.value)}-${idx}`"
      type="button"
      role="tab"
      class="rounded-full border px-2.5 py-1 text-[11px] font-semibold tracking-wide transition-colors"
      :class="[
        modelValue === option.value
          ? 'border-gray-900 bg-gray-900 text-white'
          : 'border-gray-300 bg-white text-gray-600 hover:border-gray-900 hover:text-gray-900'
      ]"
      :aria-selected="modelValue === option.value"
      @click="$emit('update:modelValue', option.value)"
    >
      {{ option.label }}
    </button>
  </div>
</template>

<script setup lang="ts">
type PillTabValue = string | number

type PillTabOption = {
  value: PillTabValue
  label: string
  key?: string
}

withDefaults(
  defineProps<{
    modelValue: PillTabValue
    options: PillTabOption[]
    ariaLabel?: string
  }>(),
  {
    ariaLabel: 'Select tab',
  }
)

defineEmits<{
  (e: 'update:modelValue', value: PillTabValue): void
}>()
</script>
