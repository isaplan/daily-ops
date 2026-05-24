import type { DailyOpsSimplePnLAssumptions } from '~/types/daily-ops-revenue'

const DEFAULT_PNL_ASSUMPTIONS: DailyOpsSimplePnLAssumptions = {
  foodCogsPct: 30,
  bevCogsPct: 4,
  overheadPct: 25,
}

const STORAGE_KEY = 'daily-ops-revenue-pnl-assumptions'

function clampPct(n: number, fallback: number): number {
  return Number.isFinite(n) && n >= 0 && n <= 100 ? n : fallback
}

export function useDailyOpsRevenuePnlAssumptions() {
  const route = useRoute()
  const router = useRouter()

  const fromQuery = computed((): DailyOpsSimplePnLAssumptions => ({
    foodCogsPct: clampPct(
      Number(route.query.foodCogsPct),
      DEFAULT_PNL_ASSUMPTIONS.foodCogsPct,
    ),
    bevCogsPct: clampPct(
      Number(route.query.bevCogsPct),
      DEFAULT_PNL_ASSUMPTIONS.bevCogsPct,
    ),
    overheadPct: clampPct(
      Number(route.query.overheadPct),
      DEFAULT_PNL_ASSUMPTIONS.overheadPct,
    ),
  }))

  const assumptions = ref<DailyOpsSimplePnLAssumptions>({ ...fromQuery.value })

  watch(fromQuery, (q) => {
    assumptions.value = { ...q }
  })

  if (import.meta.client) {
    onMounted(() => {
      if (
        route.query.foodCogsPct ||
        route.query.bevCogsPct ||
        route.query.overheadPct
      ) {
        return
      }
      try {
        const raw = localStorage.getItem(STORAGE_KEY)
        if (!raw) return
        const parsed = JSON.parse(raw) as DailyOpsSimplePnLAssumptions
        assumptions.value = {
          foodCogsPct: clampPct(parsed.foodCogsPct, DEFAULT_PNL_ASSUMPTIONS.foodCogsPct),
          bevCogsPct: clampPct(parsed.bevCogsPct, DEFAULT_PNL_ASSUMPTIONS.bevCogsPct),
          overheadPct: clampPct(parsed.overheadPct, DEFAULT_PNL_ASSUMPTIONS.overheadPct),
        }
      } catch {
        /* ignore */
      }
    })
  }

  const pnlQueryParams = computed(() => ({
    foodCogsPct: String(assumptions.value.foodCogsPct),
    bevCogsPct: String(assumptions.value.bevCogsPct),
    overheadPct: String(assumptions.value.overheadPct),
  }))

  function applyAssumptions(next: DailyOpsSimplePnLAssumptions) {
    assumptions.value = {
      foodCogsPct: clampPct(next.foodCogsPct, DEFAULT_PNL_ASSUMPTIONS.foodCogsPct),
      bevCogsPct: clampPct(next.bevCogsPct, DEFAULT_PNL_ASSUMPTIONS.bevCogsPct),
      overheadPct: clampPct(next.overheadPct, DEFAULT_PNL_ASSUMPTIONS.overheadPct),
    }
    if (import.meta.client) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(assumptions.value))
    }
    router.replace({
      path: route.path,
      query: {
        ...route.query,
        foodCogsPct: String(assumptions.value.foodCogsPct),
        bevCogsPct: String(assumptions.value.bevCogsPct),
        overheadPct: String(assumptions.value.overheadPct),
      },
    })
  }

  function resetAssumptions() {
    applyAssumptions({ ...DEFAULT_PNL_ASSUMPTIONS })
  }

  return {
    assumptions,
    pnlQueryParams,
    applyAssumptions,
    resetAssumptions,
    defaults: DEFAULT_PNL_ASSUMPTIONS,
  }
}
