<template>
  <div class="relative flex h-full flex-1 flex-nowrap w-full min-h-0 overflow-hidden bg-white text-gray-900">
    <aside
      class="h-full shrink-0 border-r border-gray-200 flex flex-col overflow-hidden transition-[width] duration-200 ease-linear bg-[hsl(45,15%,95%)] w-16 min-w-16 max-w-16"
      :class="{ '!w-64 !min-w-64 !max-w-64': showExpanded }"
    >
      <AppSidebar :collapsed="!showExpanded" class="h-full min-w-0 w-16 min-w-16 max-w-16" :class="{ '!w-64 !min-w-64 !max-w-64': showExpanded }" />
    </aside>
    <UButton
      type="button"
      variant="ghost"
      size="icon"
      :class="[
        'absolute z-20 h-8 w-8 shrink-0 hover:bg-gray-100 transition-[left] duration-200 left-16 pl-2 top-3',
        showExpanded && '!left-64',
      ]"
      :aria-label="showExpanded ? 'Collapse sidebar' : 'Expand sidebar'"
      @click="toggle"
    >
      <UIcon
        :name="showExpanded ? 'i-lucide-panel-left-close' : 'i-lucide-panel-left-open'"
        class="size-6 pl-4"
      />
    </UButton>
    <main class="flex min-w-0 flex-1 flex-col overflow-y-auto overflow-x-hidden bg-[hsl(45,15%,95%)] shadow-[0_0_15px_rgba(0,0,0,0.06)] transition-[width] duration-200 ease-linear">
      <div class="flex min-h-0 w-full flex-1 flex-col px-6 py-8">
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
