/**
 * @registry-id: useChartExpand
 * @created: 2026-06-05T00:00:00.000Z
 * @last-modified: 2026-06-05T00:00:00.000Z
 * @description: Fullscreen chart expand state, sizing, and body scroll lock
 * @last-fix: [2026-06-05] Shared expand logic for Daily Ops charts
 *
 * @exports-to:
 * ✓ components/daily-ops/DailyOpsChartExpandShell.vue
 */

export function useChartExpand(defaultWidth = 720, defaultHeight = 400) {
  const expandedOpen = ref(false)
  const chartWrapEl = ref<HTMLElement | null>(null)
  const expandedWrapEl = ref<HTMLElement | null>(null)
  const containerWidth = ref(defaultWidth)
  const expandedWidth = ref(defaultWidth)
  const expandedHeight = ref(defaultHeight)

  let chartResizeObserver: ResizeObserver | undefined
  let expandedResizeObserver: ResizeObserver | undefined

  function measureContainer(): void {
    containerWidth.value = chartWrapEl.value?.clientWidth ?? defaultWidth
  }

  function measureExpanded(): void {
    expandedWidth.value = expandedWrapEl.value?.clientWidth ?? containerWidth.value
    expandedHeight.value = expandedWrapEl.value?.clientHeight ?? defaultHeight
  }

  function onExpandedEscape(event: KeyboardEvent): void {
    if (event.key === 'Escape') expandedOpen.value = false
  }

  function setBodyScrollLocked(open: boolean): void {
    if (typeof document === 'undefined') return
    document.body.style.overflow = open ? 'hidden' : ''
    if (open) {
      window.addEventListener('keydown', onExpandedEscape)
    } else {
      window.removeEventListener('keydown', onExpandedEscape)
    }
  }

  watch(expandedOpen, async (open: boolean) => {
    setBodyScrollLocked(open)

    if (open) {
      await nextTick()
      measureExpanded()
      if (typeof ResizeObserver !== 'undefined' && expandedWrapEl.value) {
        expandedResizeObserver?.disconnect()
        expandedResizeObserver = new ResizeObserver(measureExpanded)
        expandedResizeObserver.observe(expandedWrapEl.value)
      }
    } else {
      expandedResizeObserver?.disconnect()
    }
  })

  onMounted(() => {
    measureContainer()
    if (typeof ResizeObserver === 'undefined' || !chartWrapEl.value) return
    chartResizeObserver = new ResizeObserver(measureContainer)
    chartResizeObserver.observe(chartWrapEl.value)
  })

  onUnmounted(() => {
    chartResizeObserver?.disconnect()
    expandedResizeObserver?.disconnect()
    setBodyScrollLocked(false)
  })

  return {
    expandedOpen,
    chartWrapEl,
    expandedWrapEl,
    containerWidth,
    expandedWidth,
    expandedHeight,
  }
}
