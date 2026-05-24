<template>
  <div class="max-w-6xl mx-auto space-y-8">
    <header class="flex w-full items-center justify-between gap-4">
      <h1 class="text-3xl font-bold text-gray-900">Ops notifications</h1>
      <div class="flex shrink-0 items-center gap-1">
        <UTooltip text="Active notification rules">
          <UButton
            variant="outline"
            size="sm"
            icon="i-lucide-info"
            aria-label="View active notification rules"
            @click="showRulesModal = true"
          />
        </UTooltip>
        <UButton
          variant="outline"
          size="sm"
          icon="i-lucide-refresh-cw"
          :loading="pending"
          @click="refresh()"
        >
          Rescan
        </UButton>
      </div>
    </header>

    <OpsNotificationsRulesModal :open="showRulesModal" @update:open="showRulesModal = $event" />

    <div v-if="pending && !report" class="space-y-3">
      <USkeleton v-for="i in 4" :key="i" class="h-14 w-full rounded-lg" />
    </div>

    <UAlert v-else-if="error" color="error" title="Scan failed" :description="error.message" />

    <template v-else-if="report">
      <div class="grid grid-cols-1 sm:grid-cols-3 gap-3 max-w-xl">
        <button
          type="button"
          class="rounded-lg border border-gray-200 bg-white p-3 shadow-sm text-left transition-shadow hover:shadow-md"
          :class="activeSeverity === 'all' ? 'ring-2 ring-gray-900 ring-offset-1' : ''"
          @click="activeSeverity = 'all'"
        >
          <p class="text-xs font-semibold uppercase text-gray-500">Total</p>
          <p class="text-xl font-bold text-gray-900">{{ report.total }}</p>
        </button>
        <button
          type="button"
          class="rounded-lg border border-red-200 bg-red-50 p-3 text-left transition-shadow hover:shadow-md"
          :class="activeSeverity === 'critical' ? 'ring-2 ring-red-700 ring-offset-1' : ''"
          @click="activeSeverity = 'critical'"
        >
          <p class="text-xs font-semibold uppercase text-red-700">Critical</p>
          <p class="text-xl font-bold text-red-900">{{ report.criticalCount }}</p>
        </button>
        <button
          type="button"
          class="rounded-lg border border-amber-200 bg-amber-50 p-3 text-left transition-shadow hover:shadow-md"
          :class="activeSeverity === 'warning' ? 'ring-2 ring-amber-600 ring-offset-1' : ''"
          @click="activeSeverity = 'warning'"
        >
          <p class="text-xs font-semibold uppercase text-amber-800">Warning</p>
          <p class="text-xl font-bold text-amber-900">{{ report.warningCount }}</p>
        </button>
      </div>

      <p class="text-xs text-gray-500">
        Window {{ report.rangeStart }} → {{ report.rangeEnd }} · scanned {{ formatTime(report.scannedAt) }}
      </p>

      <nav
        aria-label="Filter by area"
        class="inline-flex w-max max-w-full flex-wrap justify-start gap-1 rounded-md border-2 border-gray-900 bg-white p-1"
      >
        <button
          v-for="cat in categoryFilters"
          :key="cat.id"
          type="button"
          class="rounded px-4 py-2 text-sm font-semibold transition-colors"
          :class="activeCategory === cat.id ? 'bg-gray-900 text-white' : 'text-gray-700 hover:bg-gray-100'"
          @click="activeCategory = cat.id"
        >
          {{ cat.label }} ({{ cat.count }})
        </button>
      </nav>

      <UAlert
        v-if="filteredItems.length === 0"
        color="success"
        title="Nothing in this filter"
        description="Try another category or widen the scan window."
      />

      <div v-else class="rounded-lg border border-gray-200 bg-white shadow-sm overflow-hidden">
        <table class="min-w-full text-base">
          <thead class="bg-gray-50 text-left text-sm font-semibold uppercase text-gray-500">
            <tr>
              <th class="px-4 py-3">Severity</th>
              <th class="px-4 py-3">Area</th>
              <th class="px-4 py-3">Date</th>
              <th class="px-4 py-3">Venue</th>
              <th class="px-4 py-3">Issue</th>
              <th class="px-4 py-3 text-right">Action</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-gray-100">
            <tr v-for="item in filteredItems" :key="item.id" class="hover:bg-gray-50">
              <td class="px-4 py-3 align-top">
                <UBadge :color="severityColor(item.severity)" variant="subtle" size="sm">
                  {{ item.severity }}
                </UBadge>
              </td>
              <td class="px-4 py-3 align-top">
                <span class="text-sm font-medium text-gray-600">{{ categoryLabel(item.category) }}</span>
              </td>
              <td class="px-4 py-3 align-top font-mono text-gray-800 whitespace-nowrap">
                {{ item.businessDate === 'system' ? '—' : item.businessDate }}
              </td>
              <td class="px-4 py-3 align-top">{{ item.locationName }}</td>
              <td class="px-4 py-3 align-top">
                <p class="font-semibold text-gray-900">{{ item.title }}</p>
                <p class="text-gray-600 text-sm mt-1">{{ item.message }}</p>
                <p class="text-gray-500 text-sm mt-1.5 font-mono break-all">{{ item.fixHint }}</p>
              </td>
              <td class="px-4 py-3 align-top text-right">
                <UButton
                  v-if="canRebuild(item)"
                  size="xs"
                  variant="soft"
                  :loading="rebuildingId === item.id"
                  @click="rebuildOne(item)"
                >
                  Rebuild snapshot
                </UButton>
                <span v-else class="text-sm text-gray-500">Code / ops fix</span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import type {
  OpsNotificationCategory,
  OpsNotificationDto,
  OpsNotificationSeverity,
} from '~/types/ops-notifications'

const { report, pending, error, refresh } = useOpsNotificationsList(30)
const showRulesModal = ref(false)
const activeCategory = ref<OpsNotificationCategory | 'all'>('all')
const activeSeverity = ref<'all' | OpsNotificationSeverity>('all')

const severityFilteredItems = computed(() => {
  const items = report.value?.items ?? []
  if (activeSeverity.value === 'all') return items
  return items.filter((i) => i.severity === activeSeverity.value)
})

const categoryFilters = computed(() => {
  const items = severityFilteredItems.value
  const countByCat = (cat: OpsNotificationCategory) =>
    items.filter((i) => i.category === cat).length
  return [
    { id: 'all' as const, label: 'All', count: items.length },
    { id: 'snapshot' as const, label: 'Snapshot', count: countByCat('snapshot') },
    { id: 'source' as const, label: 'Bork vs Inbox', count: countByCat('source') },
    { id: 'cron' as const, label: 'Cron', count: countByCat('cron') },
    { id: 'integrity' as const, label: 'Integrity', count: countByCat('integrity') },
    { id: 'architecture' as const, label: 'ADR / code', count: countByCat('architecture') },
  ]
})

const filteredItems = computed(() => {
  let items = severityFilteredItems.value
  if (activeCategory.value !== 'all') {
    items = items.filter((i) => i.category === activeCategory.value)
  }
  return items
})

const rebuildingId = ref<string | null>(null)
const toast = useToast()

function severityColor(sev: OpsNotificationSeverity): 'error' | 'warning' | 'neutral' {
  if (sev === 'critical') return 'error'
  if (sev === 'warning') return 'warning'
  return 'neutral'
}

function categoryLabel(cat: OpsNotificationCategory): string {
  const map: Record<OpsNotificationCategory, string> = {
    snapshot: 'Snapshot',
    source: 'Source',
    cron: 'Cron',
    integrity: 'Integrity',
    architecture: 'ADR',
  }
  return map[cat]
}

function canRebuild(item: OpsNotificationDto): boolean {
  return item.category === 'snapshot' && item.businessDate !== 'system' && item.locationId !== 'platform'
}

function formatTime(iso: string): string {
  try {
    return new Date(iso).toLocaleString('nl-NL', { timeZone: 'Europe/Amsterdam' })
  } catch {
    return iso
  }
}

async function rebuildOne(item: OpsNotificationDto) {
  rebuildingId.value = item.id
  try {
    const res = await $fetch<{ ok: boolean; errors: Array<{ error: string }> }>(
      '/api/ops-notifications/rebuild',
      {
        method: 'POST',
        body: { businessDate: item.businessDate, locationId: item.locationId },
      },
    )
    if (res.ok) {
      toast.add({ title: 'Snapshot rebuilt', description: `${item.locationName} ${item.businessDate}`, color: 'success' })
      await refresh()
    } else {
      toast.add({
        title: 'Rebuild failed',
        description: res.errors[0]?.error ?? 'Unknown error',
        color: 'error',
      })
    }
  } catch (e) {
    toast.add({
      title: 'Rebuild failed',
      description: e instanceof Error ? e.message : 'Request failed',
      color: 'error',
    })
  } finally {
    rebuildingId.value = null
  }
}
</script>
