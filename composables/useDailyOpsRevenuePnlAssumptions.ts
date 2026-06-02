import type { DailyOpsSimplePnLAssumptions } from '~/types/daily-ops-revenue'
import type { PnlAssumptionsSettingDto } from '~/types/app-settings'
import { DEFAULT_PNL_ASSUMPTIONS, normalizePnlAssumptions } from '~/utils/dailyOpsPnlAssumptionsDefaults'

const LEGACY_STORAGE_KEY = 'daily-ops-revenue-pnl-assumptions'

export function useDailyOpsRevenuePnlAssumptions() {
  const assumptions = ref<DailyOpsSimplePnLAssumptions>({ ...DEFAULT_PNL_ASSUMPTIONS })
  const updatedAt = ref<string | null>(null)
  const source = ref<'mongo' | 'default'>('default')
  const saving = ref(false)

  const { data, pending, refresh, error } = useAsyncData(
    'daily-ops-pnl-assumptions',
    () => $fetch<PnlAssumptionsSettingDto>('/api/app-settings/pnl-assumptions'),
    { server: false },
  )

  watch(
    data,
    (dto) => {
      if (!dto) return
      assumptions.value = { ...dto.assumptions }
      updatedAt.value = dto.updatedAt
      source.value = dto.source
    },
    { immediate: true },
  )

  if (import.meta.client) {
    onMounted(async () => {
      if (source.value !== 'default') return
      try {
        const raw = localStorage.getItem(LEGACY_STORAGE_KEY)
        if (!raw) return
        const parsed = normalizePnlAssumptions(JSON.parse(raw) as Partial<DailyOpsSimplePnLAssumptions>)
        const unchanged =
          parsed.foodCogsPct === DEFAULT_PNL_ASSUMPTIONS.foodCogsPct &&
          parsed.bevCogsPct === DEFAULT_PNL_ASSUMPTIONS.bevCogsPct &&
          parsed.overheadPct === DEFAULT_PNL_ASSUMPTIONS.overheadPct
        localStorage.removeItem(LEGACY_STORAGE_KEY)
        if (!unchanged) await applyAssumptions(parsed)
      } catch {
        /* ignore legacy parse errors */
      }
    })
  }

  async function applyAssumptions(next: DailyOpsSimplePnLAssumptions) {
    saving.value = true
    try {
      const saved = await $fetch<PnlAssumptionsSettingDto>('/api/app-settings/pnl-assumptions', {
        method: 'PUT',
        body: next,
      })
      assumptions.value = { ...saved.assumptions }
      updatedAt.value = saved.updatedAt
      source.value = saved.source
      await refresh()
    } finally {
      saving.value = false
    }
  }

  async function resetAssumptions() {
    await applyAssumptions({ ...DEFAULT_PNL_ASSUMPTIONS })
  }

  return {
    assumptions,
    updatedAt,
    source,
    pending,
    saving,
    error,
    refresh,
    applyAssumptions,
    resetAssumptions,
    defaults: DEFAULT_PNL_ASSUMPTIONS,
  }
}
