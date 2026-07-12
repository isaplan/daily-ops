/**
 * @registry-id: useDailyOpsRevenueViewMode
 * @last-modified: 2026-07-02T00:00:00.000Z
 * @description: Chart/table view preference (localStorage)
 * @last-fix: [2026-07-02] ADR-013 read-cache metadata
 * @adr-ref: ADR-013
 * @data-source: none
 * @read-cache-json: none
 *
 * @exports-to:
 * ✓ components/daily-ops/DailyOpsTodayRevenueCard.vue
 */
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
