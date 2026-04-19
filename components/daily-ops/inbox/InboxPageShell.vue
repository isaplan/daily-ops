<template>
  <div class="mx-auto max-w-7xl space-y-6">
    <header class="space-y-1">
      <h1 class="text-2xl font-bold tracking-tight text-gray-900 md:text-3xl">
        {{ title }}
      </h1>
      <p v-if="description" class="text-base text-gray-600">
        {{ description }}
      </p>
    </header>
    <slot />
  </div>
</template>

<script setup lang="ts">
defineProps<{
  title: string
  description?: string
}>()
</script>
