/** true = icon-only narrow bar, false = full sidebar (default on first app load). Persisted in cookie for SSR-safe app-level state. */
export function useSidebar() {
  const cookieState = useCookie<boolean>('sidebar-collapsed', {
    default: () => false,
    sameSite: 'lax',
  })

  const isCollapsed = useState('sidebar-collapsed', () => cookieState.value ?? false)

  watch(isCollapsed, (value) => {
    cookieState.value = value
  }, { immediate: true })

  function toggle() {
    isCollapsed.value = !isCollapsed.value
  }
  return {
    isCollapsed,
    toggle,
  }
}
