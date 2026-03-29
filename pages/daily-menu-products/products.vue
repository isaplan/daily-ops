<template>
  <div class="max-w-full space-y-6">
    <div class="flex items-center justify-between gap-4">
      <NuxtLink
        to="/daily-menu-products"
        class="text-sm font-medium text-gray-600 hover:text-gray-900"
      >
        ← Daily Menu & Products
      </NuxtLink>
      <UButton
        :loading="pending"
        icon="i-lucide-refresh-cw"
        variant="ghost"
        size="sm"
        @click="refresh"
      >
        Refresh
      </UButton>
    </div>
    <div class="rounded-lg border border-gray-200 bg-white shadow-sm">
      <div class="border-b border-gray-200 px-4 py-3 flex items-center justify-between">
        <h1 class="text-lg font-semibold text-gray-900">Products ({{ total }})</h1>
        <span v-if="pending" class="text-xs text-gray-500 flex items-center gap-1">
          <UIcon name="i-lucide-loader-2" class="animate-spin size-3" />
          Loading...
        </span>
      </div>
      <div class="overflow-x-auto">
        <table class="min-w-full divide-y divide-gray-200 text-sm">
          <thead class="bg-gray-50">
            <tr>
              <th class="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase whitespace-nowrap">Group</th>
              <th class="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase whitespace-nowrap">Type</th>
              <th class="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase whitespace-nowrap">Title</th>
              <th class="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase whitespace-nowrap">Alcohol</th>
              <th class="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase whitespace-nowrap max-w-[140px]">Description</th>
              <th class="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase whitespace-nowrap">Cost batch/krat</th>
              <th class="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase whitespace-nowrap">Cost per item</th>
              <th class="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase whitespace-nowrap">Waste</th>
              <th class="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase whitespace-nowrap">Margin</th>
              <th class="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase whitespace-nowrap">Netto</th>
              <th class="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase whitespace-nowrap">Bruto</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-gray-200 bg-white">
            <tr v-for="item in items" :key="item._id ?? `${item.productGroup}-${item.sourceFile}-${item.rowIndex}`">
              <td class="px-3 py-2 text-gray-700 whitespace-nowrap">{{ item.productGroup ?? '–' }}</td>
              <td class="px-3 py-2 text-gray-700 whitespace-nowrap">{{ dataVal(item, typeKeys, 'type') }}</td>
              <td class="px-3 py-2 text-gray-900 font-medium whitespace-nowrap">{{ dataVal(item, titleKeys, 'title') }}</td>
              <td class="px-3 py-2 text-gray-700 whitespace-nowrap">{{ dataVal(item, alcoholKeys) }}</td>
              <td class="px-3 py-2 text-gray-600 max-w-[140px] truncate" :title="dataVal(item, descriptionKeys, fallbackByKey.description)">{{ dataVal(item, descriptionKeys, fallbackByKey.description) }}</td>
              <td class="px-3 py-2 text-right text-gray-700 whitespace-nowrap tabular-nums">{{ dataVal(item, costBatchKeys, fallbackByKey.costBatch) }}</td>
              <td class="px-3 py-2 text-right text-gray-700 whitespace-nowrap tabular-nums">{{ dataVal(item, costPerItemKeys, fallbackByKey.costPerItem) }}</td>
              <td class="px-3 py-2 text-right text-gray-700 whitespace-nowrap tabular-nums">{{ dataVal(item, wasteKeys, fallbackByKey.waste) }}</td>
              <td class="px-3 py-2 text-right text-gray-700 whitespace-nowrap tabular-nums">{{ dataVal(item, marginKeys, fallbackByKey.margin) }}</td>
              <td class="px-3 py-2 text-right text-gray-700 whitespace-nowrap tabular-nums">{{ dataVal(item, nettoKeys, fallbackByKey.netto) }}</td>
              <td class="px-3 py-2 text-right text-gray-700 whitespace-nowrap tabular-nums">{{ dataVal(item, brutoKeys, fallbackByKey.bruto) }}</td>
            </tr>
          </tbody>
        </table>
      </div>
      <div v-if="items.length === 0 && !pending" class="px-4 py-8 text-center text-sm text-gray-500">
        No products yet. Import CSV or Excel files from Daily Menu & Products (one file per product group).
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { MenuItem } from '~/types/menuItem'

definePageMeta({
  layout: 'default',
})

const { data: listData, pending, refresh } = useFetch<{ success: boolean; data: MenuItem[]; total: number }>(
  () => '/api/menu/items?limit=1000',
  {
    watch: false,
    server: true,
  }
)

const items = computed(() => listData.value?.data ?? [])
const total = computed(() => listData.value?.total ?? 0)

const typeKeys = ['Type', 'Type_2', 'type']
const titleKeys = ['Product Kinsbergen', 'Product', 'Name', 'name']
const alcoholKeys = ['%', 'alcohol', 'Alcohol']
const descriptionKeys = ['Omschrijving', 'description', 'Description']
const costBatchKeys = ['Eenheid Prijs', 'Inkoop Prijs', 'Inkoop', 'Inkoop prijs']
const costPerItemKeys = ['Per Stuk prijs', 'Kostprijs per stuk (waste %)', 'Kostprijs per stuk']
const wasteKeys = ['Kostprijs per stuk (waste %)', 'waste %', 'Waste']
const marginKeys = ['Netto Marge', 'Marge Fictief', 'margin', 'Margin']
const nettoKeys = ['Netto Kaartprijs', 'Netto Kaartprijs_2', 'Netto Calculatie Prijs', 'priceExVat']
const brutoKeys = ['Bruto Kaartprijs', 'Bruto Kaartprijs Klein', 'Bruto Calculatie Prijs', 'priceIncVat']

const fallbackByKey = {
  costBatch: { keyContains: ['inkoop', 'eenheid'] },
  costPerItem: { keyContains: ['per stuk', 'kostprijs'] },
  waste: { keyContains: ['waste'] },
  margin: { keyContains: ['marge'] },
  netto: { keyContains: ['netto'] },
  bruto: { keyContains: ['bruto'] },
  alcohol: { keyContains: ['%'] },
  description: { keyContains: ['omschrijving'] },
}

/** Values that are header labels, not data – skip when showing in table */
const HEADER_LABELS = new Set([
  'inkoop prijs', 'waste %', 'netto marge', 'bruto kaartprijs', 'netto kaartprijs',
  'eenheid prijs', 'per stuk prijs', 'kostprijs per stuk (waste %)', 'status', 'leverancier',
  'marge fictief', 'calculatie kaartprijs', 'verkoop prijs oude kaart',
])

function isHeaderLabel(s: string): boolean {
  return HEADER_LABELS.has(String(s).trim().toLowerCase())
}

function dataVal(
  item: MenuItem,
  keys: string[],
  fallback?: 'title' | 'type' | { keyContains: string[] }
): string {
  const d = item.data
  if (!d || typeof d !== 'object') return '–'
  for (const k of keys) {
    const v = d[k]
    if (v !== undefined && v !== null) {
      const s = String(v).trim()
      if (s !== '' && !isHeaderLabel(s)) return s
    }
  }
  if (fallback === 'title') {
    const v = firstValueLikeName(d)
    if (v) return v
  }
  if (fallback === 'type') {
    const v = firstValueLikeType(d)
    if (v) return v
  }
  if (fallback?.keyContains?.length) {
    const v = valueByKeyContains(d, fallback.keyContains)
    if (v !== null) return v
  }
  return '–'
}

function valueByKeyContains(d: Record<string, unknown>, substrings: string[]): string | null {
  const lower = (s: string) => s.toLowerCase()
  for (const [k, v] of Object.entries(d)) {
    const kk = lower(k)
    if (!substrings.some((sub) => kk.includes(lower(sub)))) continue
    const s = String(v ?? '').trim()
    if (s === '' || isHeaderLabel(s)) continue
    return s
  }
  return null
}

function looksLikePrice(s: string): boolean {
  return /^€?\s*[\d,.\s]+%?\s*$/.test(String(s).trim()) || /^[\d,.]+\s*%?\s*$/.test(String(s).trim())
}

function firstValueLikeName(d: Record<string, unknown>): string | null {
  for (const v of Object.values(d)) {
    const s = String(v ?? '').trim()
    if (s.length < 2) continue
    if (isHeaderLabel(s) || looksLikePrice(s)) continue
    if (/^\d+$/.test(s)) continue
    return s
  }
  return null
}

function firstValueLikeType(d: Record<string, unknown>): string | null {
  const short = ['fles', 'glas', 'vat', 'krat', 'doos', 'single', 'double', 'shot']
  for (const v of Object.values(d)) {
    const s = String(v ?? '').trim().toLowerCase()
    if (s.length < 2 || s.length > 30) continue
    if (isHeaderLabel(s) || looksLikePrice(s)) continue
    if (short.includes(s) || /^(witte|rode|rose|dunkel|weizen|vodka|rum)$/i.test(s)) return String(v).trim()
  }
  return null
}

</script>
