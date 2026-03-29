<template>
  <UButton variant="outline" :loading="loading" :disabled="disabled || loading" @click="$emit('click')">
    <template #leading>
      <UIcon :name="loading ? 'i-lucide-loader-2' : 'i-lucide-flask-conical'" :class="loading ? 'animate-spin' : ''" />
    </template>
    {{ loading ? loadingLabel : label }}
  </UButton>
</template>

<script setup lang="ts">
withDefaults(defineProps<{
  loading?: boolean
  disabled?: boolean
  label?: string
  loadingLabel?: string
}>(), {
  loading: false,
  disabled: false,
  label: 'Test Connection',
  loadingLabel: 'Testing...',
})

defineEmits<{
  (e: 'click'): void
}>()
</script>
