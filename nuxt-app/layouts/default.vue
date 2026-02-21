<template>
  <div class="flex flex-nowrap w-full h-full min-h-0 overflow-hidden bg-white text-gray-900">
    <AppSidebar />
    <main class="flex-1 min-w-0 overflow-y-auto overflow-x-hidden bg-[hsl(45,15%,95%)]">
      <slot />
    </main>
  </div>
</template>

<script setup lang="ts">
// Light-theme layout: one sidebar (environment selector + nav) + main content.
// Matches Next.js classic layout (Sidebar + SidebarInset).
</script>
