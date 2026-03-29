<template>
  <div class="border-t pt-4">
    <p class="mb-2 text-sm font-semibold text-gray-900">Endpoints being synced:</p>
    <div class="grid grid-cols-1 gap-2 text-sm md:grid-cols-2">
      <div v-for="endpoint in endpoints" :key="endpoint" class="flex items-center gap-2 text-gray-600">
        <UIcon name="i-lucide-check-circle-2" class="size-4 text-green-600" />
        <span>{{ endpoint }}</span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
defineProps<{
  endpoints: string[]
}>()
</script>
