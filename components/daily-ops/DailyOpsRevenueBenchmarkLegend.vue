<template>
  <div class="rounded-lg border border-gray-200 bg-gray-50 p-3 text-xs text-gray-600">
    <div class="flex flex-wrap gap-x-4 gap-y-2">
      <span class="inline-flex items-center gap-1.5">
        <span class="size-2.5 rounded-full bg-[#5B9A6F]" />
        Above median
      </span>
      <span class="inline-flex items-center gap-1.5">
        <span class="size-2.5 rounded-full bg-[#C97B7B]" />
        Below median
      </span>
      <span class="inline-flex items-center gap-1.5">
        <span class="size-2.5 rounded-full bg-gray-300" />
        No benchmark
      </span>
    </div>

    <ul
      v-if="notes.length"
      class="mt-3 space-y-1 border-t border-gray-200 pt-3"
    >
      <li
        v-for="note in notes"
        :key="note"
        class="flex gap-1.5"
      >
        <UIcon name="i-lucide-info" class="mt-0.5 size-3.5 shrink-0 text-gray-400" />
        <span>{{ note }}</span>
      </li>
    </ul>
  </div>
</template>

<script setup lang="ts">
defineProps<{
  notes: string[]
}>()
</script>
