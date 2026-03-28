<template>
  <UCard>
    <template #header>
      <div class="space-y-1">
        <h3 class="text-base font-semibold text-gray-900">{{ title }}</h3>
        <p v-if="description" class="text-sm text-gray-500">{{ description }}</p>
      </div>
    </template>
    <slot />
  </UCard>
</template>

<script setup lang="ts">
defineProps<{
  title: string
  description?: string
}>()
</script>
