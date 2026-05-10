<template>
  <div class="inline-flex max-w-max flex-wrap items-center gap-1 rounded-md border-2 border-gray-900 bg-white p-1" :style="shadow ? { boxShadow: '2px 2px 0 0 rgba(0,0,0,0.08)' } : {}">
    <slot />
  </div>
</template>

<script setup lang="ts">
withDefaults(
  defineProps<{
    shadow?: boolean
  }>(),
  {
    shadow: false,
  }
)
</script>
