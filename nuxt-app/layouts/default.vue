<template>
  <div class="flex h-screen overflow-hidden bg-white text-gray-900">
    <AppSidebar />
    <main class="flex-1 overflow-y-auto min-w-0">
      <slot />
    </main>
  </div>
</template>

<script setup lang="ts">
// Light-theme layout: one sidebar (environment selector + nav) + main content.
// Matches Next.js classic layout (Sidebar + SidebarInset).
</script>
