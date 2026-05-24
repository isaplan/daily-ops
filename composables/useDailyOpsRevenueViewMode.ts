export type RevenueViewMode = 'chart' | 'table'

export function useDailyOpsRevenueViewMode(storageKey: string, defaultMode: RevenueViewMode = 'table') {
  const mode = ref<RevenueViewMode>(defaultMode)

  if (import.meta.client) {
    onMounted(() => {
      const saved = localStorage.getItem(storageKey)
      if (saved === 'chart' || saved === 'table') mode.value = saved
    })
    watch(mode, (m) => localStorage.setItem(storageKey, m))
  }

  function setMode(next: RevenueViewMode) {
    mode.value = next
  }

  return { mode, setMode }
}
