import { resolveDailyOpsPeriod } from '~/utils/dailyOpsPeriod'
import { DAILY_OPS_PERIOD_IDS, type DailyOpsPeriodId } from '~/types/daily-ops-dashboard'

export type DailyOpsNavKey = 'overview' | 'revenue' | 'productivity' | 'workload' | 'products' | 'insights'

const PERIOD_SET = new Set<string>(DAILY_OPS_PERIOD_IDS)

export function useDailyOpsDashboardRoute() {
  const route = useRoute()
  const router = useRouter()

  const period = computed((): DailyOpsPeriodId => {
    const p = route.query.period
    if (typeof p === 'string' && PERIOD_SET.has(p)) return p as DailyOpsPeriodId
    return 'today'
  })

  const locationId = computed(() => {
    const l = route.query.location
    return typeof l === 'string' && l.length > 0 ? l : null
  })

  const anchor = computed(() => {
    const a = route.query.anchor
    return typeof a === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(a) ? a : null
  })

  const dashboardQuery = computed(() => {
    const q: Record<string, string> = { period: period.value }
    if (locationId.value) q.location = locationId.value
    if (anchor.value) q.anchor = anchor.value
    return q
  })

  function setPeriod(next: DailyOpsPeriodId) {
    router.replace({ path: route.path, query: { ...route.query, period: next } })
  }

  function setLocation(id: string | null) {
    const q = { ...route.query } as Record<string, string | string[] | null | undefined>
    if (id) q.location = id
    else delete q.location
    router.replace({ path: route.path, query: q })
  }

  function navKeyFromPath(path: string): DailyOpsNavKey {
    if (path === '/daily-ops' || path === '/daily-ops/') return 'overview'
    if (path.startsWith('/daily-ops/revenue')) return 'revenue'
    if (path.startsWith('/daily-ops/productivity')) return 'productivity'
    if (path.startsWith('/daily-ops/workload')) return 'workload'
    if (path.startsWith('/daily-ops/products')) return 'products'
    if (path.startsWith('/daily-ops/insights')) return 'insights'
    return 'overview'
  }

  const activeNav = computed(() => navKeyFromPath(route.path))

  const contextHeadline = computed(() => {
    const fmt = new Intl.DateTimeFormat('en-GB', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      timeZone: 'UTC',
    })
    const anchorYmd = anchor.value ?? new Date().toISOString().slice(0, 10)
    const anchorUtc = new Date(`${anchorYmd}T12:00:00.000Z`)
    if (period.value === 'today') {
      return `Today: ${fmt.format(anchorUtc)} (UTC)`
    }
    if (period.value === 'yesterday') {
      const y = new Date(anchorUtc)
      y.setUTCDate(y.getUTCDate() - 1)
      return `Yesterday: ${fmt.format(y)} (UTC)`
    }
    const r = resolveDailyOpsPeriod(period.value, anchorYmd)
    if (period.value === 'this-week') {
      return `This week: ${r.startDate} → ${r.endDate} (UTC)`
    }
    return `Last week: ${r.startDate} → ${r.endDate} (UTC)`
  })

  return {
    period,
    locationId,
    anchor,
    dashboardQuery,
    activeNav,
    contextHeadline,
    setPeriod,
    setLocation,
    navKeyFromPath,
  }
}
