const sidebarOpen = ref(true)

export function useSidebar() {
  function toggle() {
    sidebarOpen.value = !sidebarOpen.value
  }
  return {
    sidebarOpen,
    toggle,
  }
}
