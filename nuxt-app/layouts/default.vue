<template>
  <div class="relative flex h-full flex-1 flex-nowrap w-full min-h-0 overflow-hidden bg-white text-gray-900">
    <aside
      class="h-full shrink-0 border-r border-gray-200 flex flex-col overflow-hidden transition-[width] duration-200 ease-linear bg-[hsl(45,15%,95%)]"
      :class="isCollapsed ? 'w-16' : 'w-64'"
    >
      <AppSidebar :collapsed="isCollapsed" class="h-full min-w-0" :class="isCollapsed ? 'w-16' : 'w-64'" />
    </aside>
    <UButton
      type="button"
      variant="ghost"
      size="icon"
      :class="[
        'absolute z-20 h-8 w-8 shrink-0 hover:bg-gray-100 transition-[left] duration-200',
        isCollapsed ? 'left-16 pl-2' : 'left-64 pl-2',
        'top-3',
      ]"
      :aria-label="isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'"
      @click="toggle"
    >
      <UIcon
        :name="isCollapsed ? 'i-lucide-panel-left-open' : 'i-lucide-panel-left-close'"
        class="size-6 pl-4"
      />
    </UButton>
    <main class="flex min-w-0 flex-1 flex-col overflow-y-auto overflow-x-hidden bg-[hsl(45,15%,95%)] shadow-[0_0_15px_rgba(0,0,0,0.06)] transition-[width] duration-200 ease-linear">
      <div class="mx-auto flex min-h-0 w-11/12 flex-1 flex-col px-6 py-8">
        <slot />
      </div>
    </main>
  </div>
</template>

<script setup lang="ts">
const { isCollapsed, toggle } = useSidebar()
</script>
