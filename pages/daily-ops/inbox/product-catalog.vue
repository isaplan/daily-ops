<template>
  <div class="min-h-screen bg-gray-50 p-4 sm:p-6">
    <div class="mx-auto max-w-7xl space-y-6">
      <div class="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 class="text-3xl font-bold text-gray-900">Product catalog</h1>
          <p class="mt-2 text-gray-600">
            Unified <span class="font-mono text-gray-800">product_catalog</span> — Bork menu (API), grouped like the
            registry: <strong>Hoofdgroep</strong> (Dranken Hoog/Laag, Keuken) → <strong>Productgroep</strong> → product.
            Sold metrics from <span class="font-mono text-gray-800">bork_sales_by_product</span>.
          </p>
          <p v-if="activeRange" class="mt-1 text-sm text-gray-500">
            Sales period: {{ activeRange.range_start }} – {{ activeRange.range_end }}
          </p>
          <NuxtLink
            class="mt-2 inline-block text-sm font-medium text-primary-600 underline-offset-2 hover:text-primary-700 hover:underline"
            to="/daily-ops/inbox"
          >
            ← Inbox home
          </NuxtLink>
        </div>
        <div class="flex flex-wrap gap-2">
          <UButton
            variant="outline"
            color="neutral"
            size="sm"
            :loading="syncing"
            icon="i-lucide-refresh-cw"
            @click="runSync"
          >
            Refresh catalog
          </UButton>
        </div>
      </div>

      <div v-if="syncMessage">
        <UAlert
          :color="syncOk ? 'green' : 'red'"
          :title="syncOk ? 'Catalog synced' : 'Sync failed'"
          :description="syncMessage"
        />
      </div>

      <div v-if="summary" class="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <UCard class="border-2 border-gray-900 bg-white">
          <template #header>
            <span class="text-sm font-medium text-gray-500">In catalog</span>
          </template>
          <p class="text-3xl font-bold tabular-nums">{{ summary.catalog_count }}</p>
        </UCard>
        <UCard class="border-2 border-gray-900 bg-white">
          <template #header>
            <span class="text-sm font-medium text-gray-500">With sales (period)</span>
          </template>
          <p class="text-3xl font-bold tabular-nums text-emerald-700">{{ summary.with_sales }}</p>
        </UCard>
        <UCard class="border-2 border-gray-900 bg-white">
          <template #header>
            <span class="text-sm font-medium text-gray-500">Families</span>
          </template>
          <p class="text-3xl font-bold tabular-nums">{{ summary.distinct_families }}</p>
        </UCard>
        <UCard class="border-2 border-gray-900 bg-white">
          <template #header>
            <span class="text-sm font-medium text-gray-500">Food / Bev / Other</span>
          </template>
          <p class="text-sm tabular-nums text-gray-800">
            {{ summary.categories.food }} / {{ summary.categories.beverage }} /
            {{ summary.categories.other }}
          </p>
        </UCard>
      </div>

      <div class="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
        <div class="mb-4 grid gap-3 md:grid-cols-2 lg:grid-cols-5">
          <UInput v-model="search" placeholder="Search name or family…" @keyup.enter="load(true)" />
          <USelectMenu
            v-model="categoryFilter"
            :items="categoryOptions"
            value-key="value"
            class="w-full"
            placeholder="Category"
          />
          <USelectMenu
            v-model="locationFilter"
            :items="locationOptions"
            value-key="value"
            class="w-full"
            placeholder="Location"
          />
          <UCheckbox
            v-model="onlyWithSales"
            label="Only with sales"
            @update:model-value="onFilterChange"
          />
          <UButton variant="outline" color="neutral" :loading="loading" @click="load(true)">Apply</UButton>
        </div>

        <p v-if="loadError" class="mb-4 text-sm text-red-600">{{ loadError }}</p>

        <div v-if="loading" class="py-12 text-center text-gray-500">Loading…</div>
        <div v-else-if="rows.length === 0" class="py-8 text-center text-sm text-gray-600">
          No products match. Run <strong>Refresh catalog</strong> or widen filters.
        </div>
        <div v-else class="overflow-x-auto">
          <table class="w-full min-w-[960px] text-left text-sm">
            <thead>
              <tr class="border-b border-gray-200 text-xs uppercase tracking-wide text-gray-500">
                <th class="w-8 pb-2 pr-2" />
                <th class="pb-2 pr-3 font-medium">Product</th>
                <th class="pb-2 pr-3 font-medium">Category</th>
                <th class="pb-2 pr-3 font-medium">Hoofdgroep</th>
                <th class="pb-2 pr-3 font-medium">Productgroep</th>
                <th class="pb-2 pr-3 text-right font-medium">List ex</th>
                <th class="pb-2 pr-3 text-right font-medium">List inc</th>
                <th class="pb-2 pr-3 font-medium">VAT</th>
                <th class="pb-2 pr-3 text-right font-medium">Sold</th>
                <th class="pb-2 pr-3 text-right font-medium">Revenue</th>
              </tr>
            </thead>
            <tbody>
              <template v-for="(row, i) in rows" :key="row.product_key">
                <tr
                  class="border-b border-gray-100 transition-colors hover:bg-gray-50"
                  :class="{ 'cursor-pointer': row.locations.length > 0 }"
                  @click="row.locations.length > 0 && toggleExpanded(i)"
                >
                  <td class="py-2.5 pr-2 text-center">
                    <UIcon
                      v-if="row.locations.length > 0"
                      :name="expanded.has(i) ? 'i-lucide-chevron-down' : 'i-lucide-chevron-right'"
                      class="size-4 text-gray-500"
                    />
                  </td>
                  <td class="py-2.5 pr-3">
                    <p class="font-medium text-gray-900">{{ row.display_name }}</p>
                    <p v-if="row.family_name && row.family_name !== row.display_name" class="text-xs text-gray-500">
                      {{ row.family_name }}
                      <span v-if="row.size_label"> · {{ row.size_label }}</span>
                    </p>
                  </td>
                  <td class="py-2.5 pr-3 capitalize text-gray-700">{{ row.category }}</td>
                  <td class="py-2.5 pr-3 text-gray-600">{{ row.hoofdgroep || '—' }}</td>
                  <td class="py-2.5 pr-3 text-gray-600">{{ row.sub_category || '—' }}</td>
                  <td class="py-2.5 pr-3 text-right font-mono tabular-nums">
                    {{ priceRangeEx(row) }}
                  </td>
                  <td class="py-2.5 pr-3 text-right font-mono tabular-nums">
                    {{ priceRangeInc(row) }}
                  </td>
                  <td class="py-2.5 pr-3">
                    <UBadge v-if="row.vat_label === '21'" color="neutral" variant="subtle">21%</UBadge>
                    <UBadge v-else-if="row.vat_label === '6'" color="neutral" variant="subtle">6%</UBadge>
                    <span v-else class="text-gray-400">—</span>
                  </td>
                  <td class="py-2.5 pr-3 text-right tabular-nums">{{ row.sold_quantity.toFixed(0) }}</td>
                  <td class="py-2.5 pr-3 text-right font-mono tabular-nums">{{ money(row.sold_revenue_inc_vat) }}</td>
                </tr>
                <tr v-if="expanded.has(i)" class="border-b border-gray-100 bg-gray-50/80">
                  <td colspan="10" class="px-4 py-3">
                    <table class="ml-6 w-full max-w-4xl text-xs">
                      <thead>
                        <tr class="border-b border-gray-200 text-gray-500">
                          <th class="py-1 pr-3 text-left font-medium">Location</th>
                          <th class="py-1 pr-3 font-medium">Hoofdgroep</th>
                          <th class="py-1 pr-3 font-medium">Productgroep</th>
                          <th class="py-1 pr-3 text-right font-medium">List ex</th>
                          <th class="py-1 pr-3 text-right font-medium">List inc</th>
                          <th class="py-1 pr-3 font-medium">VAT</th>
                          <th class="py-1 pr-3 text-right font-medium">Sold</th>
                          <th class="py-1 pr-3 text-right font-medium">Revenue</th>
                          <th class="py-1 text-right font-medium">Sold @</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr
                          v-for="loc in row.locations"
                          :key="`${row.product_key}-${loc.location_id}`"
                          class="border-b border-gray-100"
                        >
                          <td class="py-1.5 pr-3 text-gray-800">{{ loc.location_name }}</td>
                          <td class="py-1.5 pr-3 text-gray-600">{{ loc.hoofdgroep || '—' }}</td>
                          <td class="py-1.5 pr-3 text-gray-600">{{ loc.sub_category || '—' }}</td>
                          <td class="py-1.5 pr-3 text-right font-mono">{{ money(loc.list_price_ex_vat) }}</td>
                          <td class="py-1.5 pr-3 text-right font-mono">{{ money(loc.list_price_inc_vat) }}</td>
                          <td class="py-1.5 pr-3">{{ loc.vat_label === 'unknown' ? '—' : `${loc.vat_label}%` }}</td>
                          <td class="py-1.5 pr-3 text-right tabular-nums">{{ loc.sold_quantity.toFixed(0) }}</td>
                          <td class="py-1.5 pr-3 text-right font-mono">{{ money(loc.sold_revenue_inc_vat) }}</td>
                          <td class="py-1.5 text-right font-mono text-gray-600">
                            {{ loc.sold_unit_price_inc_vat != null ? money(loc.sold_unit_price_inc_vat) : '—' }}
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </td>
                </tr>
              </template>
            </tbody>
          </table>
        </div>

        <div v-if="pagination && pagination.total > pageSize" class="mt-4 flex justify-center border-t border-gray-100 pt-4">
          <UPagination
            :page="page"
            :total="pagination.total"
            :items-per-page="pageSize"
            @update:page="
              (p) => {
                page = p
                load()
              }
            "
          />
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { ProductCatalogHubRow } from '~/types/product-catalog'

const FILTER_ALL = '__all__'

const categoryOptions = [
  { label: 'All categories', value: FILTER_ALL },
  { label: 'Food', value: 'food' },
  { label: 'Beverage', value: 'beverage' },
  { label: 'Other', value: 'other' },
]

const search = ref('')
const categoryFilter = ref(FILTER_ALL)
const locationFilter = ref(FILTER_ALL)
const onlyWithSales = ref(false)
const loading = ref(false)
const loadError = ref<string | null>(null)
const rows = ref<ProductCatalogHubRow[]>([])
const summary = ref<{
  catalog_count: number
  with_sales: number
  distinct_families: number
  categories: { food: number; beverage: number; other: number }
} | null>(null)
const activeRange = ref<{ range_start: string; range_end: string } | null>(null)
const pagination = ref<{ skip: number; limit: number; total: number } | null>(null)
const page = ref(1)
const pageSize = 50
const expanded = ref(new Set<number>())

const syncing = ref(false)
const syncMessage = ref('')
const syncOk = ref(false)

const locationOptions = computed(() => {
  const names = new Map<string, string>()
  for (const row of rows.value) {
    for (const loc of row.locations) {
      names.set(loc.location_id, loc.location_name)
    }
  }
  return [
    { label: 'All locations', value: FILTER_ALL },
    ...[...names.entries()]
      .sort((a, b) => a[1].localeCompare(b[1], 'nl'))
      .map(([value, label]) => ({ label, value })),
  ]
})

const money = (v: number | null | undefined) => {
  if (v == null || Number.isNaN(v)) return '—'
  return `€${Number(v).toFixed(2)}`
}

const priceRangeInc = (row: ProductCatalogHubRow) => {
  const { min, max } = row.price_range_inc_vat
  if (min == null) return '—'
  if (max != null && max !== min) return `${money(min)} – ${money(max)}`
  return money(min)
}

const priceRangeEx = (row: ProductCatalogHubRow) => {
  const ex = row.locations
    .map((l) => l.list_price_ex_vat)
    .filter((p): p is number => p != null && p > 0)
  if (ex.length === 0) return '—'
  const min = Math.min(...ex)
  const max = Math.max(...ex)
  if (max !== min) return `${money(min)} – ${money(max)}`
  return money(min)
}

const onFilterChange = () => {
  void load(true)
}

const toggleExpanded = (i: number) => {
  const next = new Set(expanded.value)
  if (next.has(i)) next.delete(i)
  else next.add(i)
  expanded.value = next
}

const load = async (resetPage = false) => {
  if (resetPage) page.value = 1
  loading.value = true
  loadError.value = null
  expanded.value = new Set()
  try {
    const params = new URLSearchParams({
      skip: String((page.value - 1) * pageSize),
      limit: String(pageSize),
    })
    if (search.value.trim()) params.set('search', search.value.trim())
    if (categoryFilter.value !== FILTER_ALL) params.set('category', categoryFilter.value)
    if (locationFilter.value !== FILTER_ALL) params.set('location', locationFilter.value)
    if (onlyWithSales.value === true) params.set('only_with_sales', '1')

    const res = await $fetch<{
      success: boolean
      data?: ProductCatalogHubRow[]
      range?: { range_start: string; range_end: string }
      pagination?: { skip: number; limit: number; total: number }
      summary?: typeof summary.value
    }>(`/api/daily-ops/product-catalog?${params}`)

    if (res.success) {
      rows.value = res.data ?? []
      activeRange.value = res.range ?? null
      pagination.value = res.pagination ?? null
      summary.value = res.summary ?? null
    } else {
      loadError.value = 'Failed to load catalog'
    }
  } catch (e) {
    loadError.value = e instanceof Error ? e.message : 'Load failed'
  } finally {
    loading.value = false
  }
}

const runSync = async () => {
  syncing.value = true
  syncMessage.value = ''
  try {
    const res = await $fetch<{ success: boolean; message?: string }>(
      '/api/daily-ops/product-catalog/sync',
      { method: 'POST' }
    )
    syncOk.value = !!res.success
    syncMessage.value = res.message ?? (res.success ? 'Done' : 'Failed')
    if (res.success) await load(true)
  } catch (e) {
    syncOk.value = false
    syncMessage.value = e instanceof Error ? e.message : 'Sync failed'
  } finally {
    syncing.value = false
  }
}

onMounted(() => {
  void load(true)
})
</script>
