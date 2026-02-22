/** true = icon-only narrow bar (default on load), false = full sidebar */
const isCollapsed = ref(true)

export function useSidebar() {
  function toggle() {
    isCollapsed.value = !isCollapsed.value
  }
  return {
    isCollapsed,
    toggle,
  }
}
