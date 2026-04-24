<template>
  <div class="mx-auto max-w-7xl space-y-6">
    <header class="space-y-1 border-b border-gray-200 pb-4">
      <h1 class="text-2xl font-bold tracking-tight text-gray-900 md:text-3xl">
        <span>{{ title }}</span>
        <span
          v-if="titleAfter"
          class="mt-1 block text-lg font-normal text-gray-500 md:mt-0 md:inline md:text-2xl md:font-semibold"
        >
          <span class="text-gray-400 md:mx-1">·</span>{{ titleAfter }}
        </span>
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
  /** Shown after the title (e.g. import date range) */
  titleAfter?: string
  description?: string
}>()
</script>
