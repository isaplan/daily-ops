<template>
  <div class="mx-auto flex w-full min-w-0 max-w-6xl flex-col gap-6">
    <header class="flex w-full shrink-0 items-center justify-between gap-4">
      <h1 class="text-3xl font-bold text-gray-900">Bug alerts</h1>
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
      <div class="flex shrink-0 flex-col gap-4">
      <div class="flex items-center gap-2">
        <span class="text-xs font-semibold uppercase text-gray-500">View</span>
        <UButton
          size="xs"
          variant="soft"
          :color="viewMode === 'grouped' ? 'primary' : 'neutral'"
          @click="viewMode = 'grouped'"
        >
          Grouped
        </UButton>
        <UButton
          size="xs"
          variant="soft"
          :color="viewMode === 'rows' ? 'primary' : 'neutral'"
          @click="viewMode = 'rows'"
        >
          Raw rows
        </UButton>
        <UButton
          size="xs"
          variant="soft"
          :color="showHidden ? 'primary' : 'neutral'"
          @click="showHidden = !showHidden"
        >
          {{ showHidden ? 'Hide hidden' : 'Show hidden' }}
        </UButton>
      </div>

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
        <span v-if="typeof report.hiddenCount === 'number' && report.hiddenCount > 0">
          · hidden {{ report.hiddenCount }}
        </span>
      </p>

      <nav
        aria-label="Filter by area"
        class="scrollbar-hide inline-flex w-full max-w-full min-w-0 flex-nowrap gap-1 overflow-x-auto rounded-md border-2 border-gray-900 bg-white p-1 sm:w-max sm:flex-wrap"
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
      </div>

      <UAlert
        v-if="displayItems.length === 0"
        color="success"
        title="Nothing in this filter"
        description="Try another category or widen the scan window."
      />

      <div
        v-else
        class="min-h-0 w-full min-w-0 max-w-full overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm"
      >
        <div
          class="max-h-[calc(100dvh-17.5rem)] min-h-[12rem] w-full max-w-full overflow-auto overscroll-contain sm:max-h-[calc(100dvh-16rem)] lg:max-h-[calc(100dvh-15rem)]"
        >
          <table class="w-full min-w-[48rem] text-base md:min-w-[56rem]">
            <thead class="border-b border-gray-200 bg-gray-50 text-left text-sm font-semibold uppercase text-gray-500">
              <tr>
                <th class="sticky top-0 z-20 bg-gray-50 px-4 py-3 whitespace-nowrap shadow-[0_1px_0_0_rgb(229,231,235)]">Severity</th>
                <th class="sticky top-0 z-20 bg-gray-50 px-4 py-3 whitespace-nowrap shadow-[0_1px_0_0_rgb(229,231,235)]">Area</th>
                <th class="sticky top-0 z-20 bg-gray-50 px-4 py-3 whitespace-nowrap shadow-[0_1px_0_0_rgb(229,231,235)]">{{ viewMode === 'grouped' ? 'Date range' : 'Date' }}</th>
                <th class="sticky top-0 z-20 bg-gray-50 px-4 py-3 whitespace-nowrap shadow-[0_1px_0_0_rgb(229,231,235)]">Venue</th>
                <th v-if="viewMode === 'grouped'" class="sticky top-0 z-20 bg-gray-50 px-4 py-3 whitespace-nowrap shadow-[0_1px_0_0_rgb(229,231,235)]">Rows</th>
                <th class="sticky top-0 z-20 bg-gray-50 px-4 py-3 whitespace-nowrap shadow-[0_1px_0_0_rgb(229,231,235)]">Status</th>
                <th class="sticky top-0 z-20 bg-gray-50 px-4 py-3 whitespace-nowrap shadow-[0_1px_0_0_rgb(229,231,235)]">Issue</th>
                <th class="sticky top-0 z-20 bg-gray-50 px-4 py-3 text-right whitespace-nowrap shadow-[0_1px_0_0_rgb(229,231,235)]">Action</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-gray-100 bg-white">
            <tr v-for="entry in displayItems" :key="entry.id" class="hover:bg-gray-50">
              <td class="px-4 py-3 align-top">
                <UBadge :color="severityColor(entry.severity)" variant="subtle" size="sm">
                  {{ entry.severity }}
                </UBadge>
              </td>
              <td class="px-4 py-3 align-top">
                <span class="text-sm font-medium text-gray-600">{{ categoryLabel(entry.category) }}</span>
              </td>
              <td class="px-4 py-3 align-top font-mono text-gray-800 whitespace-nowrap">
                {{ entry.businessDateLabel }}
              </td>
              <td class="px-4 py-3 align-top">{{ entry.locationName }}</td>
              <td v-if="viewMode === 'grouped'" class="px-4 py-3 align-top">{{ entry.count }}</td>
              <td class="px-4 py-3 align-top">
                <UBadge
                  :color="displayStatus(entry.item) === 'fixed' ? 'success' : 'warning'"
                  variant="subtle"
                  size="sm"
                >
                  {{ displayStatus(entry.item) }}
                </UBadge>
                <p v-if="fixOverlay(entry.item)?.message" class="text-xs text-gray-600 mt-1 max-w-56">
                  {{ fixOverlay(entry.item)?.message }}
                </p>
              </td>
              <td class="px-4 py-3 align-top">
                <p class="font-semibold text-gray-900">{{ entry.item.title }}</p>
                <p class="text-gray-600 text-sm mt-1">{{ entry.item.message }}</p>
                <p v-if="viewMode === 'grouped' && entry.count > 1" class="text-gray-500 text-xs mt-1">
                  Grouped {{ entry.count }} similar alerts from same origin.
                </p>
                <p class="text-gray-500 text-sm mt-1.5 font-mono break-all">{{ entry.item.fixHint }}</p>
              </td>
              <td class="px-4 py-3 align-top text-right space-y-1">
                <UButton
                  v-if="canTryFix(entry.item)"
                  size="xs"
                  variant="soft"
                  color="primary"
                  :loading="fixingId === entry.item.id"
                  :disabled="displayStatus(entry.item) === 'fixed'"
                  @click="tryFixOne(entry.item)"
                >
                  Try fix
                </UButton>
                <UButton
                  v-else-if="canRebuild(entry.item)"
                  size="xs"
                  variant="soft"
                  :loading="rebuildingId === entry.item.id"
                  @click="rebuildOne(entry.item)"
                >
                  Rebuild snapshot
                </UButton>
                <span v-else class="text-sm text-gray-500">Code / ops fix</span>
              </td>
            </tr>
          </tbody>
        </table>
        </div>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import type {
  OpsNotificationCategory,
  OpsNotificationDto,
  OpsNotificationKind,
  OpsNotificationSeverity,
  OpsNotificationStatus,
} from '~/types/ops-notifications'

const showHidden = ref(false)
const visibleQuery = useOpsNotificationsList(30, false)
const hiddenQuery = useOpsNotificationsList(30, true)
const report = computed(() => (showHidden.value ? hiddenQuery.report.value : visibleQuery.report.value))
const pending = computed(() => (showHidden.value ? hiddenQuery.pending.value : visibleQuery.pending.value))
const error = computed(() => (showHidden.value ? hiddenQuery.error.value : visibleQuery.error.value))
const refresh = async () => {
  if (showHidden.value) await hiddenQuery.refresh()
  else await visibleQuery.refresh()
}
const showRulesModal = ref(false)
const activeCategory = ref<OpsNotificationCategory | 'all'>('all')
const activeSeverity = ref<'all' | OpsNotificationSeverity>('all')
const viewMode = ref<'grouped' | 'rows'>('grouped')

const severityFilteredItems = computed(() => {
  const items = report.value?.items ?? []
  if (activeSeverity.value === 'all') return items
  return items.filter((i: OpsNotificationDto) => i.severity === activeSeverity.value)
})

const categoryFilters = computed(() => {
  const items = severityFilteredItems.value
  const countByCat = (cat: OpsNotificationCategory) =>
    items.filter((i: OpsNotificationDto) => i.category === cat).length
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
    items = items.filter((i: OpsNotificationDto) => i.category === activeCategory.value)
  }
  return items
})

type DisplayEntry = {
  id: string
  item: OpsNotificationDto
  severity: OpsNotificationSeverity
  category: OpsNotificationCategory
  locationName: string
  count: number
  businessDateLabel: string
}

const displayItems = computed<DisplayEntry[]>(() => {
  if (viewMode.value === 'rows') {
    return filteredItems.value.map((item: OpsNotificationDto) => ({
      id: item.id,
      item,
      severity: item.severity,
      category: item.category,
      locationName: item.locationName,
      count: 1,
      businessDateLabel: item.businessDate === 'system' ? '—' : item.businessDate,
    }))
  }
  const byOrigin = new Map<string, OpsNotificationDto[]>()
  for (const item of filteredItems.value) {
    const key = `${item.kind}|${item.locationId}`
    const bucket = byOrigin.get(key) ?? []
    bucket.push(item)
    byOrigin.set(key, bucket)
  }
  return [...byOrigin.values()].map((bucket) => {
    const first = bucket[0]!
    const dates = bucket
      .map((i) => i.businessDate)
      .filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d))
      .sort()
    let businessDateLabel = first.businessDate === 'system' ? '—' : first.businessDate
    if (dates.length > 1) businessDateLabel = `${dates[0]} → ${dates[dates.length - 1]}`
    return {
      id: `group:${first.kind}:${first.locationId}`,
      item: first,
      severity: first.severity,
      category: first.category,
      locationName: first.locationName,
      count: bucket.length,
      businessDateLabel,
    }
  })
})

const rebuildingId = ref<string | null>(null)
const fixingId = ref<string | null>(null)
const fixOverlays = ref<Record<string, { status: OpsNotificationStatus; message: string }>>({})
const toast = useToast()

const TRY_FIX_KINDS: OpsNotificationKind[] = [
  'bork_revenue_aggregation_stale',
  'bork_inbox_revenue_gap',
  'missing_revenue_snapshot',
  'missing_labor_snapshot',
  'missing_master_snapshot',
  'revenue_snapshot_empty',
  'revenue_snapshot_stale_basis',
  'eitje_labor_aggregation_stale',
  'labor_snapshot_inconsistent',
  'unparsed_basis_attachment',
]

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
  return (
    item.category === 'snapshot' &&
    /^\d{4}-\d{2}-\d{2}$/.test(item.businessDate) &&
    item.locationId !== 'platform'
  )
}

function canTryFix(item: OpsNotificationDto): boolean {
  const hasValidBusinessDate = /^\d{4}-\d{2}-\d{2}$/.test(item.businessDate)
  return (
    TRY_FIX_KINDS.includes(item.kind) &&
    hasValidBusinessDate &&
    item.locationId !== 'platform'
  )
}

function fixOverlay(item: OpsNotificationDto) {
  return fixOverlays.value[item.id]
}

function displayStatus(item: OpsNotificationDto): OpsNotificationStatus {
  return fixOverlay(item)?.status ?? item.status ?? 'open'
}

function formatTime(iso: string): string {
  try {
    return new Date(iso).toLocaleString('nl-NL', { timeZone: 'Europe/Amsterdam' })
  } catch {
    return iso
  }
}

async function tryFixOne(item: OpsNotificationDto) {
  fixingId.value = item.id
  try {
    const res = await $fetch<{
      ok: boolean
      fixed: boolean
      status: OpsNotificationStatus
      message: string
    }>('/api/ops-notifications/try-fix', {
      method: 'POST',
      body: {
        kind: item.kind,
        businessDate: item.businessDate,
        locationId: item.locationId,
        meta: item.meta,
      },
    } as any)
    fixOverlays.value = {
      ...fixOverlays.value,
      [item.id]: { status: res.status, message: res.message },
    }
    toast.add({
      title: res.fixed ? 'Fixed' : 'Try fix failed',
      description: res.message,
      color: res.fixed ? 'success' : 'warning',
    })
    await refresh()
  } catch (e) {
    fixOverlays.value = {
      ...fixOverlays.value,
      [item.id]: {
        status: 'open',
        message: `Tried fix, failed: ${e instanceof Error ? e.message : 'Request failed'}`,
      },
    }
    toast.add({
      title: 'Try fix failed',
      description: e instanceof Error ? e.message : 'Request failed',
      color: 'error',
    })
  } finally {
    fixingId.value = null
  }
}

async function rebuildOne(item: OpsNotificationDto) {
  rebuildingId.value = item.id
  try {
    const res = await $fetch<{ ok: boolean; errors: Array<{ error: string }> }>(
      '/api/ops-notifications/rebuild',
      ({
        method: 'POST',
        body: { businessDate: item.businessDate, locationId: item.locationId },
      } as any),
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
    const msg = (() => {
      const maybe = e as { data?: { message?: string }; message?: string }
      return maybe?.data?.message ?? maybe?.message ?? 'Request failed'
    })()
    toast.add({
      title: 'Rebuild failed',
      description: msg,
      color: 'error',
    })
  } finally {
    rebuildingId.value = null
  }
}
</script>
