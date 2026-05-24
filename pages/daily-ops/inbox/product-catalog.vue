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
            :loading="linkingMenus"
            icon="i-lucide-link"
            @click="runMenuLink"
          >
            Link menu items
          </UButton>
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
            <span class="text-sm font-medium text-gray-500">Brands</span>
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
          <UInput v-model="search" placeholder="Search name or family…" />
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
          <UCheckbox v-model="onlyWithSales" label="Only with sales" />
        </div>
        <p v-if="pagination" class="mb-3 text-xs text-gray-500">
          Showing {{ pagination.skip + 1 }}–{{ Math.min(pagination.skip + pagination.limit, pagination.total) }} of
          {{ pagination.total }} ({{ pageSize }} per page). Click a row to expand per-venue prices and sales. If the
          same Bork key maps to different menu groups (e.g. Keuken vs Dranken), they appear as separate lines.
        </p>

        <p v-if="loadError" class="mb-4 text-sm text-red-600">{{ loadError }}</p>

        <div v-if="initialLoading" class="py-12 text-center text-gray-500">Loading catalog…</div>
        <div v-else-if="!refreshing && rows.length === 0" class="py-8 text-center text-sm text-gray-600">
          No products match. Run <strong>Refresh catalog</strong> or widen filters.
        </div>
        <div v-else class="relative overflow-x-auto">
          <div
            v-if="refreshing"
            class="pointer-events-none absolute inset-0 z-10 flex items-start justify-center bg-white/70 pt-16"
            aria-hidden="true"
          >
            <UIcon name="i-lucide-loader-circle" class="size-6 animate-spin text-gray-500" />
          </div>
          <table
            class="w-full min-w-[960px] text-left text-sm transition-opacity duration-150"
            :class="refreshing ? 'opacity-50' : 'opacity-100'"
          >
            <thead>
              <tr class="border-b border-gray-200 text-xs uppercase tracking-wide text-gray-500">
                <th class="w-8 pb-2 pr-2" />
                <th
                  v-for="col in sortColumns"
                  :key="col.field"
                  class="pb-2 pr-3 font-medium"
                  :class="col.align === 'right' ? 'text-right' : ''"
                >
                  <button
                    type="button"
                    class="inline-flex w-full items-center gap-1 hover:text-gray-900"
                    :class="[
                      col.align === 'right' ? 'justify-end' : '',
                      sortBy === col.field ? 'text-gray-900' : 'text-gray-500',
                    ]"
                    @click="toggleSort(col.field)"
                  >
                    <span>{{ col.label }}</span>
                    <UIcon
                      v-if="sortBy === col.field"
                      :name="sortDir === 'asc' ? 'i-lucide-arrow-up' : 'i-lucide-arrow-down'"
                      class="size-3.5 shrink-0"
                    />
                  </button>
                </th>
              </tr>
            </thead>
            <tbody>
              <template v-for="(row, i) in rows" :key="row.product_key">
                <tr
                  class="border-b border-gray-100 transition-colors hover:bg-gray-50"
                  :class="{ 'cursor-pointer': row.locations.length > 0 || (row.menu_prices?.length ?? 0) > 0 }"
                  @click="(row.locations.length > 0 || (row.menu_prices?.length ?? 0) > 0) && toggleExpanded(i)"
                >
                  <td class="py-2.5 pr-2 text-center">
                    <UIcon
                      v-if="row.locations.length > 0 || (row.menu_prices?.length ?? 0) > 0"
                      :name="expanded.has(i) ? 'i-lucide-chevron-down' : 'i-lucide-chevron-right'"
                      class="size-4 text-gray-500"
                    />
                  </td>
                  <td class="py-2.5 pr-3">
                    <p class="font-medium text-gray-900">
                      {{ row.display_name }}
                      <UBadge
                        v-if="row.catalog_status === 'planned'"
                        color="amber"
                        variant="subtle"
                        class="ml-1 align-middle text-[10px]"
                      >
                        planned
                      </UBadge>
                    </p>
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
                  <td colspan="10" class="px-4 py-3 space-y-4">
                    <div v-if="row.menu_prices?.length" class="ml-6">
                      <p class="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">Menus &amp; pricing</p>
                      <table class="w-full max-w-4xl text-xs">
                        <thead>
                          <tr class="border-b border-gray-200 text-gray-500">
                            <th class="py-1 pr-3 text-left font-medium">Menu</th>
                            <th class="py-1 pr-3 text-left font-medium">Line</th>
                            <th class="py-1 pr-3 text-right font-medium">Menu price</th>
                            <th class="py-1 pr-3 text-right font-medium">Cost</th>
                            <th class="py-1 pr-3 text-right font-medium">Margin</th>
                            <th class="py-1 text-left font-medium">Source</th>
                          </tr>
                        </thead>
                        <tbody>
                          <tr
                            v-for="(mp, mi) in row.menu_prices"
                            :key="`${mp.menu_id}-${mp.menu_item_id}-${mi}`"
                            class="border-b border-gray-100"
                          >
                            <td class="py-1.5 pr-3 text-gray-800">
                              <NuxtLink
                                :to="`/daily-menu-products/menu-builder-v2/${mp.menu_id}`"
                                class="text-primary-600 hover:underline"
                              >
                                {{ mp.menu_name }}
                              </NuxtLink>
                              <span v-if="mp.effective_date" class="text-gray-400"> · {{ mp.effective_date }}</span>
                            </td>
                            <td class="py-1.5 pr-3 text-gray-600">{{ mp.menu_item_name }}</td>
                            <td class="py-1.5 pr-3 text-right font-mono">{{ money(mp.price_inc_vat) }}</td>
                            <td class="py-1.5 pr-3 text-right font-mono">{{ money(mp.cost_per_item) }}</td>
                            <td class="py-1.5 pr-3 text-right tabular-nums">
                              {{ mp.margin_percent != null ? `${mp.margin_percent}%` : '—' }}
                            </td>
                            <td class="py-1.5 text-gray-500">
                              {{ mp.source === 'menu_version' ? 'version' : 'live menu' }}
                            </td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                    <p v-else class="ml-6 text-xs text-gray-400">No linked menu prices — run “Link menu items” after adding products in Menu Builder.</p>
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
            @update:page="(p) => { page = p }"
          />
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { watchDebounced } from '@vueuse/core'
import type { ProductCatalogHubRow } from '~/types/product-catalog'

type CatalogSortField =
  | 'name'
  | 'category'
  | 'hoofdgroep'
  | 'productgroep'
  | 'list_ex'
  | 'list_inc'
  | 'vat'
  | 'sold_qty'
  | 'sold_revenue'

const TEXT_SORT_FIELDS = new Set<CatalogSortField>(['name', 'category', 'hoofdgroep', 'productgroep'])

const sortColumns: Array<{ label: string; field: CatalogSortField; align?: 'right' }> = [
  { label: 'Product', field: 'name' },
  { label: 'Category', field: 'category' },
  { label: 'Hoofdgroep', field: 'hoofdgroep' },
  { label: 'Productgroep', field: 'productgroep' },
  { label: 'List ex', field: 'list_ex', align: 'right' },
  { label: 'List inc', field: 'list_inc', align: 'right' },
  { label: 'VAT', field: 'vat' },
  { label: 'Sold', field: 'sold_qty', align: 'right' },
  { label: 'Revenue', field: 'sold_revenue', align: 'right' },
]

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
const initialLoading = ref(true)
const refreshing = ref(false)
const hasLoaded = ref(false)
const loadError = ref<string | null>(null)
let fetchGeneration = 0
let skipPageWatch = false
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
const pageSize = 30
const expanded = ref(new Set<number>())
const sortBy = ref<CatalogSortField>('name')
const sortDir = ref<'asc' | 'desc'>('asc')
const venueOptions = ref<{ label: string; value: string }[]>([{ label: 'All locations', value: FILTER_ALL }])

const syncing = ref(false)
const syncMessage = ref('')
const syncOk = ref(false)
const linkingMenus = ref(false)

const locationOptions = computed(() => venueOptions.value)

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

const isTextSortField = (field: CatalogSortField) => TEXT_SORT_FIELDS.has(field)

const toggleSort = (field: CatalogSortField) => {
  if (sortBy.value === field) {
    sortDir.value = sortDir.value === 'asc' ? 'desc' : 'asc'
  } else {
    sortBy.value = field
    sortDir.value = isTextSortField(field) ? 'asc' : 'desc'
  }
}

const buildQueryParams = () => {
  const params = new URLSearchParams({
    skip: String((page.value - 1) * pageSize),
    limit: String(pageSize),
    sort_by: sortBy.value,
    sort_dir: sortDir.value,
  })
  if (search.value.trim()) params.set('search', search.value.trim())
  if (categoryFilter.value !== FILTER_ALL) params.set('category', categoryFilter.value)
  if (locationFilter.value !== FILTER_ALL) params.set('location', locationFilter.value)
  if (onlyWithSales.value) params.set('only_with_sales', '1')
  return params
}

const toggleExpanded = (i: number) => {
  const next = new Set(expanded.value)
  if (next.has(i)) next.delete(i)
  else next.add(i)
  expanded.value = next
}

const refreshCatalog = async (opts: { resetPage?: boolean } = {}) => {
  if (opts.resetPage) {
    skipPageWatch = true
    if (page.value !== 1) page.value = 1
    else skipPageWatch = false
    expanded.value = new Set()
  }

  const generation = ++fetchGeneration
  const isFirstLoad = !hasLoaded.value
  if (isFirstLoad) initialLoading.value = true
  else refreshing.value = true
  loadError.value = null

  try {
    const res = await $fetch<{
      success: boolean
      data?: ProductCatalogHubRow[]
      range?: { range_start: string; range_end: string }
      pagination?: { skip: number; limit: number; total: number }
      summary?: typeof summary.value
      venues?: Array<{ location_id: string; location_name: string }>
    }>(`/api/daily-ops/product-catalog?${buildQueryParams()}`)

    if (generation !== fetchGeneration) return

    if (res.success) {
      rows.value = res.data ?? []
      activeRange.value = res.range ?? null
      pagination.value = res.pagination ?? null
      summary.value = res.summary ?? null
      if (res.venues?.length) {
        venueOptions.value = [
          { label: 'All locations', value: FILTER_ALL },
          ...res.venues.map((v) => ({ label: v.location_name, value: v.location_id })),
        ]
      }
      hasLoaded.value = true
    } else {
      loadError.value = 'Failed to load catalog'
    }
  } catch (e) {
    if (generation !== fetchGeneration) return
    loadError.value = e instanceof Error ? e.message : 'Load failed'
  } finally {
    if (generation !== fetchGeneration) return
    initialLoading.value = false
    refreshing.value = false
  }
}

watch([categoryFilter, locationFilter, onlyWithSales, sortBy, sortDir], () => {
  void refreshCatalog({ resetPage: true })
})

watch(page, () => {
  if (skipPageWatch) {
    skipPageWatch = false
    return
  }
  expanded.value = new Set()
  void refreshCatalog()
})

watchDebounced(
  search,
  () => {
    void refreshCatalog({ resetPage: true })
  },
  { debounce: 350 }
)

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
    if (res.success) await refreshCatalog({ resetPage: true })
  } catch (e) {
    syncOk.value = false
    syncMessage.value = e instanceof Error ? e.message : 'Sync failed'
  } finally {
    syncing.value = false
  }
}

const runMenuLink = async () => {
  linkingMenus.value = true
  syncMessage.value = ''
  try {
    const res = await $fetch<{
      success: boolean
      linked: number
      planned_created: number
      skipped_no_name: number
    }>('/api/menu/catalog-link/auto', { method: 'POST', body: { limit: 3000 } })
    syncOk.value = true
    syncMessage.value = `Linked ${res.linked} menu item(s) (${res.planned_created} planned catalog SKU(s) created).`
    await refreshCatalog()
  } catch (e) {
    syncOk.value = false
    syncMessage.value = e instanceof Error ? e.message : 'Menu link failed'
  } finally {
    linkingMenus.value = false
  }
}

onMounted(() => {
  void refreshCatalog()
})
</script>
