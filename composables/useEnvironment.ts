import type { EnvironmentId } from '~/types/environment'
import { ENVIRONMENT_LABELS } from '~/types/environment'

const activeEnvironment = ref<EnvironmentId>('daily-notes')

export function useEnvironment() {
  const route = useRoute()

  const derivedEnvironment = computed((): EnvironmentId => {
    const path = route.path
    if (path.startsWith('/daily-ops')) return 'daily-ops'
    if (path.startsWith('/daily-menu-products')) return 'daily-menu-products'
    if (path.startsWith('/weekly-reports')) return 'weekly-reports'
    return 'daily-notes'
  })

  watch(derivedEnvironment, (env) => {
    activeEnvironment.value = env
  }, { immediate: true })

  const current = computed(() => activeEnvironment.value)

  function setActiveEnvironment(env: EnvironmentId) {
    activeEnvironment.value = env
    const router = useRouter()
    if (env === 'daily-notes') {
      if (route.path.startsWith('/daily-')) router.push('/')
    } else if (env === 'daily-ops') {
      router.push('/daily-ops')
    } else if (env === 'daily-menu-products') {
      router.push('/daily-menu-products')
    } else if (env === 'weekly-reports') {
      router.push('/weekly-reports')
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
