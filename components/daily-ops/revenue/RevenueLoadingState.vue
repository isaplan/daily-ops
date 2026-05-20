<template>
  <div class="space-y-4">
    <USkeleton v-for="i in rows" :key="i" class="h-12 w-full rounded-lg" />
  </div>
</template>

<script setup lang="ts">
withDefaults(defineProps<{ rows?: number }>(), { rows: 4 })
</script>
