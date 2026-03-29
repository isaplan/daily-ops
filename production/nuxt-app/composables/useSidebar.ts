/** true = icon-only narrow bar (default on load), false = full sidebar. useState so state is shared and survives hydration. */
export function useSidebar() {
  const isCollapsed = useState('sidebar-collapsed', () => true)
  function toggle() {
    isCollapsed.value = !isCollapsed.value
  }
  return {
    isCollapsed,
    toggle,
  }
}
