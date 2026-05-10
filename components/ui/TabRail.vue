<template>
  <div
    class="inline-flex shrink-0 rounded-md border border-black bg-white p-0.5"
    role="tablist"
  >
    <button
      v-for="opt in options"
      :key="String(opt.value)"
      type="button"
      role="tab"
      :aria-selected="modelValue === opt.value"
      :class="[
        'rounded px-3 py-1.5 text-sm font-medium transition-colors',
        modelValue === opt.value
          ? 'bg-gray-900 text-white'
          : 'text-gray-600 hover:bg-gray-100',
      ]"
      @click="$emit('update:modelValue', opt.value)"
    >
      {{ opt.label }}
    </button>
  </div>
</template>

<script setup lang="ts" generic="T extends string">
withDefaults(
  defineProps<{
    /** Selected segment; use `null` when nothing is active (e.g. aside closed). */
    modelValue: T | null
    options: { value: T; label: string }[]
  }>(),
  {},
)

defineEmits<{
  (e: 'update:modelValue', value: T): void
}>()
</script>
