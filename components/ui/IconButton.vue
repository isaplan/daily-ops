<template>
  <button
    type="button"
    :class="[
      'p-1.5 rounded transition-colors',
      variant === 'destructive'
        ? 'text-gray-400 hover:bg-red-50 hover:text-red-600'
        : 'text-gray-400 hover:bg-gray-100 hover:text-gray-900',
    ]"
    :aria-label="label"
  >
    <UIcon :name="icon" class="size-4" />
  </button>
</template>

<script setup lang="ts">
withDefaults(
  defineProps<{
    icon: string
    label?: string
    variant?: 'default' | 'destructive'
  }>(),
  {
    variant: 'default',
  }
)
</script>
