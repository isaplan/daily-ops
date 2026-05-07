<template>
  <div class="relative flex h-full flex-1 flex-nowrap w-full min-h-0 overflow-hidden bg-white text-gray-900">
    <aside
      class="h-full shrink-0 border-r border-gray-200 flex flex-col overflow-hidden transition-[width] duration-200 ease-linear bg-[hsl(45,15%,95%)] w-16 min-w-16 max-w-16"
      :class="{ '!w-48 !min-w-48 !max-w-48': showExpanded }"
    >
      <AppSidebar :collapsed="!showExpanded" class="h-full min-w-0 w-16 min-w-16 max-w-16" :class="{ '!w-48 !min-w-48 !max-w-48': showExpanded }" />
    </aside>
    <UButton
      type="button"
      variant="ghost"
      size="md"
      :class="[
        'absolute z-20 flex h-10 w-10 shrink-0 items-center justify-center rounded-md hover:bg-gray-100 active:bg-gray-200 max-sm:h-11 max-sm:w-11 transition-[left] duration-200 touch-manipulation left-16 top-2 sm:top-3',
        showExpanded && '!left-48',
      ]"
      :aria-label="showExpanded ? 'Collapse sidebar' : 'Expand sidebar'"
      @click="toggle"
    >
      <UIcon
        name="i-lucide-panel-left-open"
        class="size-5 shrink-0 transition-transform duration-200 ease-out"
        :class="showExpanded && '-scale-x-100'"
      />
    </UButton>
    <main class="flex min-w-0 flex-1 flex-col overflow-y-auto overflow-x-hidden bg-[hsl(45,15%,95%)] shadow-[0_0_15px_rgba(0,0,0,0.06)] transition-[width] duration-200 ease-linear">
      <div class="flex min-h-0 w-full min-w-0 flex-1 flex-col px-10 py-8">
        <slot />
      </div>
    </main>
  </div>
</template>

<script setup lang="ts">
const { isCollapsed, toggle } = useSidebar()
// Only apply expanded width after mount so SSR and first paint stay collapsed (avoids flash)
const ready = ref(false)
onMounted(() => { ready.value = true })
const showExpanded = computed(() => ready.value && !isCollapsed.value)
</script>
