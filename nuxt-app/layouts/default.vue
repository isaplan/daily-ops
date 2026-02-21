<template>
  <div class="relative flex flex-nowrap w-full h-full min-h-0 overflow-hidden bg-white text-gray-900">
    <aside
      class="shrink-0 border-r border-gray-200 flex flex-col overflow-hidden transition-[width] duration-200 ease-linear bg-[hsl(45,15%,95%)]"
      :class="sidebarOpen ? 'w-64' : 'w-0'"
    >
      <AppSidebar v-show="sidebarOpen" class="w-64" />
    </aside>
    <UButton
      type="button"
      variant="ghost"
      size="icon"
      :class="[
        'absolute z-10 h-8 w-8 hover:bg-gray-100 transition-[left] duration-200',
        sidebarOpen ? 'left-64 pl-2' : 'left-4',
        'top-3',
      ]"
      aria-label="Toggle Sidebar"
      @click="toggle"
    >
      <UIcon
        :name="sidebarOpen ? 'i-lucide-panel-left-close' : 'i-lucide-panel-left-open'"
        class="size-6 pl-4"
      />
    </UButton>
    <main class="flex-1 min-w-0 overflow-y-auto overflow-x-hidden bg-[hsl(45,15%,95%)] shadow-[0_0_15px_rgba(0,0,0,0.06)]">
      <div class="w-11/12 mx-auto py-8 px-6">
        <slot />
      </div>
    </main>
  </div>
</template>

<script setup lang="ts">
const { sidebarOpen, toggle } = useSidebar()
</script>
