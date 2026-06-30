<template>
  <div class="flex w-full min-w-0 flex-col items-end gap-2">
    <div class="flex w-full min-w-0 justify-end">
      <nav
        aria-label="Staff period mode"
        class="scrollbar-hide inline-flex w-max max-w-full min-w-0 shrink-0 flex-nowrap items-center gap-1 overflow-x-auto rounded-md border-2 border-gray-900 bg-white p-1"
      >
        <button
          v-for="m in STAFF_NAV_MODE_CONFIGS"
          :key="m.id"
          type="button"
          class="shrink-0 rounded px-3 py-1.5 text-sm font-semibold transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gray-900"
          :class="activeMode === m.id
            ? 'bg-gray-900 text-white'
            : 'text-gray-700 hover:bg-gray-100'"
          @click="setMode(m.id)"
        >
          {{ m.label }}
        </button>
      </nav>
    </div>
  </div>
</template>

<script setup lang="ts">
import {
  STAFF_NAV_MODE_CONFIGS,
  coerceStaffNavMode,
  defaultStaffNavQuery,
  isStaffNavMode,
} from '~/utils/dailyOpsStaffNav/modes'
import { amsterdamOpenRegisterBusinessDateYmd } from '~/utils/dailyOpsBusinessDate'

const route = useRoute()
const router = useRouter()

const activeMode = computed(() =>
  coerceStaffNavMode(typeof route.query.mode === 'string' ? route.query.mode : ''),
)

function setMode(mode: typeof STAFF_NAV_MODE_CONFIGS[number]['id']) {
  const cfg = STAFF_NAV_MODE_CONFIGS.find((m) => m.id === mode)
  const merged = { ...route.query } as Record<string, string | string[] | undefined>
  delete merged.period
  delete merged.compareTo
  delete merged.comparePeriod
  delete merged.pick
  delete merged.compare
  delete merged.cs
  delete merged.granularity
  router.push({
    query: {
      ...merged,
      mode,
      slot: cfg?.defaultSlot ?? 'this-month',
      anchor: amsterdamOpenRegisterBusinessDateYmd(),
    },
  })
}

onMounted(() => {
  const modeRaw = typeof route.query.mode === 'string' ? route.query.mode : ''
  if (!isStaffNavMode(modeRaw)) {
    const defaults = defaultStaffNavQuery(amsterdamOpenRegisterBusinessDateYmd())
    const merged = { ...route.query } as Record<string, string | string[] | undefined>
    delete merged.period
    delete merged.compareTo
    delete merged.comparePeriod
    delete merged.pick
    delete merged.compare
    delete merged.cs
    delete merged.granularity
    router.replace({ query: { ...merged, ...defaults } })
  }
})
</script>
