import type { EnvironmentId } from '~/types/environment'
import { ENVIRONMENT_LABELS } from '~/types/environment'

const activeEnvironment = ref<EnvironmentId>('daily-notes')

const ENV_HOME: Record<EnvironmentId, string> = {
  'daily-ops': '/daily-ops',
  'daily-notes': '/notes/all',
  'daily-menu-products': '/daily-menu-products',
  'weekly-reports': '/weekly-reports',
}

function pathMatchesEnvironment(path: string, env: EnvironmentId): boolean {
  if (env === 'daily-ops') return path.startsWith('/daily-ops')
  if (env === 'daily-notes') return path.startsWith('/notes')
  if (env === 'daily-menu-products') return path.startsWith('/daily-menu-products')
  if (env === 'weekly-reports') return path.startsWith('/weekly-reports')
  return false
}

export function useEnvironment() {
  const route = useRoute()

  const derivedEnvironment = computed((): EnvironmentId => {
    const path = route.path
    if (path.startsWith('/daily-ops')) return 'daily-ops'
    if (path.startsWith('/daily-menu-products')) return 'daily-menu-products'
    if (path.startsWith('/weekly-reports')) return 'weekly-reports'
    if (path.startsWith('/notes')) return 'daily-notes'
    return 'daily-notes'
  })

  watch(derivedEnvironment, (env) => {
    activeEnvironment.value = env
  }, { immediate: true })

  const current = computed(() => activeEnvironment.value)

  function setActiveEnvironment(env: EnvironmentId) {
    activeEnvironment.value = env
    if (!pathMatchesEnvironment(route.path, env)) {
      void navigateTo(ENV_HOME[env])
    }
  }

  function getEnvironmentLabel(env: EnvironmentId) {
    return ENVIRONMENT_LABELS[env] ?? env
  }

  return {
    activeEnvironment: current,
    setActiveEnvironment,
    getEnvironmentLabel,
    derivedEnvironment,
  }
}
