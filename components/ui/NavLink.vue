<template>
  <NuxtLink
    :to="to"
    :class="[
      'flex items-center rounded-md text-sm font-medium no-underline transition-colors',
      collapsed ? 'justify-center p-2' : 'gap-3 px-3 py-2',
      active
        ? 'bg-gray-200 text-gray-900'
        : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900',
    ]"
  >
    <UIcon v-if="icon" :name="icon" class="size-4 shrink-0" />
    <span v-if="!collapsed" class="truncate">
      <slot />
    </span>
  </NuxtLink>
</template>

<script setup lang="ts">
withDefaults(
  defineProps<{
    to: string
    active?: boolean
    icon?: string
    collapsed?: boolean
  }>(),
  {
    active: false,
    collapsed: false,
  }
)
</script>
