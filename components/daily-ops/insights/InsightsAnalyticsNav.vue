<template>
  <div class="flex w-full min-w-0 flex-col items-end gap-2">
    <div class="flex w-full min-w-0 justify-end">
      <nav
        aria-label="Insights period mode"
        class="scrollbar-hide inline-flex w-max max-w-full min-w-0 shrink-0 flex-nowrap items-center gap-1 overflow-x-auto rounded-md border-2 border-gray-900 bg-white p-1"
      >
        <button
          v-for="m in INSIGHTS_NAV_MODE_CONFIGS"
          :key="m.id"
          type="button"
          class="shrink-0 rounded px-3 py-1.5 text-sm font-semibold transition-colors"
          :class="activeMode === m.id ? 'bg-gray-900 text-white' : 'text-gray-700 hover:bg-gray-100'"
          @click="setMode(m.id)"
        >
          {{ m.label }}
        </button>
      </nav>
    </div>

    <div class="flex w-full min-w-0 justify-end">
      <nav
        aria-label="Insights period"
        class="scrollbar-hide inline-flex w-full max-w-[30rem] min-w-0 shrink-0 flex-nowrap items-center justify-start gap-1 overflow-x-auto overscroll-x-contain rounded-md border-2 border-gray-900 bg-white p-1"
      >
        <button
          v-for="opt in slotOptions"
          :key="opt.id"
          type="button"
          class="shrink-0 rounded px-3 py-1.5 text-sm font-semibold transition-colors"
          :class="activeSlot === opt.id ? 'bg-gray-900 text-white' : 'text-gray-700 hover:bg-gray-100'"
          @click="setSlot(opt.id)"
        >
          {{ slotLabel(opt) }}
        </button>
      </nav>
    </div>
  </div>
</template>

<script setup lang="ts">
import { buildMonthPillOptions } from '~/utils/dailyOpsRevenueNavV2/monthOptions'
import {
  INSIGHTS_NAV_MODE_CONFIGS,
  coerceInsightsNavMode,
  defaultInsightsQuery,
  isInsightsNavMode,
} from '~/utils/dailyOpsInsightsNav/modes'
import { amsterdamOpenRegisterBusinessDateYmd } from '~/utils/dailyOpsBusinessDate'

const route = useRoute()
const router = useRouter()

const activeMode = computed(() =>
  coerceInsightsNavMode(typeof route.query.mode === 'string' ? route.query.mode : ''),
)

const activeSlot = computed(() => {
  const s = route.query.slot
  return typeof s === 'string' ? s : (activeMode.value === 'yearly' ? 'last-year' : 'last-month')
})

const monthOptions = computed(() => buildMonthPillOptions(new Date(`${amsterdamOpenRegisterBusinessDateYmd()}T12:00:00Z`)))

const yearOptions = computed(() => {
  const open = amsterdamOpenRegisterBusinessDateYmd()
  const y = Number(open.slice(0, 4))
  return [
    { id: 'this-year', label: String(y) },
    { id: 'last-year', label: String(y - 1) },
    { id: `y-${y - 2}`, label: String(y - 2) },
    { id: `y-${y - 3}`, label: String(y - 3) },
  ]
})

const slotOptions = computed(() =>
  activeMode.value === 'yearly' ? yearOptions.value : monthOptions.value,
)

function slotLabel(opt: { id: string; label: string; short?: string }): string {
  if (opt.short && (opt.id === 'this-month' || opt.id === 'last-month')) return opt.short
  return opt.label
}

function setMode(mode: typeof INSIGHTS_NAV_MODE_CONFIGS[number]['id']) {
  const cfg = INSIGHTS_NAV_MODE_CONFIGS.find((m) => m.id === mode)
  const merged = { ...route.query } as Record<string, string | string[] | undefined>
  delete merged.period
  router.push({
    query: {
      ...merged,
      mode,
      slot: cfg?.defaultSlot ?? 'last-month',
      anchor: amsterdamOpenRegisterBusinessDateYmd(),
    },
  })
}

function setSlot(slot: string) {
  const merged = { ...route.query } as Record<string, string | string[] | undefined>
  delete merged.period
  router.push({
    query: {
      ...merged,
      mode: activeMode.value,
      slot,
      anchor: amsterdamOpenRegisterBusinessDateYmd(),
    },
  })
}

onMounted(() => {
  const modeRaw = typeof route.query.mode === 'string' ? route.query.mode : ''
  if (!isInsightsNavMode(modeRaw) || !route.query.slot || route.query.period) {
    const merged = { ...route.query } as Record<string, string | string[] | undefined>
    delete merged.period
    router.replace({ query: { ...merged, ...defaultInsightsQuery(amsterdamOpenRegisterBusinessDateYmd()) } })
  }
})
</script>
