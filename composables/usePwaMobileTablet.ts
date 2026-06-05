/** Mobile/tablet + standalone PWA detection for PWA-only UX (refresh FAB, datalab viewer). */
export function usePwaMobileTablet() {
  const isMobileTablet = ref(false)
  const isStandalonePwa = ref(false)

  let mobileMq: MediaQueryList | undefined
  let standaloneMq: MediaQueryList | undefined

  function sync(): void {
    if (!import.meta.client) return
    isMobileTablet.value = mobileMq?.matches ?? false
    isStandalonePwa.value =
      (standaloneMq?.matches ?? false) ||
      (window.navigator as Navigator & { standalone?: boolean }).standalone === true
  }

  onMounted(() => {
    mobileMq = window.matchMedia('(max-width: 1023px)')
    standaloneMq = window.matchMedia('(display-mode: standalone)')
    sync()
    mobileMq.addEventListener('change', sync)
    standaloneMq.addEventListener('change', sync)
  })

  onUnmounted(() => {
    mobileMq?.removeEventListener('change', sync)
    standaloneMq?.removeEventListener('change', sync)
  })

  /** Mobile/tablet browser or installed PWA on phone/tablet — not desktop/laptop. */
  const useMobilePwaFlow = computed(() => isMobileTablet.value)

  /** Show refresh FAB on daily-ops when mobile/tablet or installed PWA. */
  const showPwaRefreshFab = computed(() => isMobileTablet.value || isStandalonePwa.value)

  return { useMobilePwaFlow, showPwaRefreshFab, isStandalonePwa, isMobileTablet }
}
