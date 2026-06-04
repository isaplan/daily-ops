<template>
  <button
    v-if="visible"
    type="button"
    aria-label="Refresh page"
    class="fixed bottom-6 right-6 z-50 flex size-12 items-center justify-center rounded-full border-2 border-gray-900 bg-white text-gray-900 shadow-lg transition-colors touch-manipulation hover:bg-gray-100 active:bg-gray-200"
    @click="refreshPage"
  >
    <UIcon name="i-lucide-refresh-cw" class="size-5" />
  </button>
</template>

<script setup lang="ts">
const route = useRoute()
const { showPwaRefreshFab } = usePwaMobileTablet()

const visible = computed(
  () => showPwaRefreshFab.value && route.path.startsWith('/daily-ops'),
)

function refreshPage(): void {
  if (import.meta.client) window.location.reload()
}
</script>
