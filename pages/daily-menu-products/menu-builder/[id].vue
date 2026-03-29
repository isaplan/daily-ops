<!--
/**
 * @registry-id: MenuBuilderId
 * @created: 2026-03-02T00:00:00.000Z
 * @last-modified: 2026-03-02T00:00:00.000Z
 * @description: Menu builder detail page - edit/manage individual menu with sections and items
 * @last-fix: [2026-03-02] Restructured from single file to index + [id] routes
 * @exports-to:
 * ✓ nuxt-app/server/api/menu/menus/[id].get.ts => Fetches menu details
 * ✓ nuxt-app/server/api/menu/menus/[id].patch.ts => Updates menu
 * ✓ nuxt-app/server/api/menu/menus/[id]/export/excel.get.ts => Exports menu to Excel
 */
-->
<template>
  <div class="w-full max-w-full space-y-6">
    <div class="flex items-center justify-between gap-4">
      <NuxtLink
        to="/daily-menu-products/menu-builder"
        class="text-sm font-medium text-gray-600 hover:text-gray-900"
      >
        ← Menu Builder
      </NuxtLink>
    </div>

    <div v-if="menu" class="space-y-6">
      <!-- Menu details (create/edit options) -->
      <div class="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
        <div class="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 class="text-2xl font-bold text-gray-900">{{ menu.name }}</h1>
            <div v-if="menu.startDate || menu.location" class="mt-1 flex flex-wrap gap-x-4 text-sm text-gray-600">
              <span v-if="menu.startDate">Start: {{ formatDate(menu.startDate) }}</span>
              <span v-if="menu.location">{{ menu.location }}</span>
            </div>
            <p class="mt-2 text-xs text-gray-500">
              Name, start date and location are your “create menu” options. Edit them below.
            </p>
          </div>
          <div class="flex flex-wrap items-center gap-2">
            <div class="flex rounded-lg border border-gray-200 p-0.5 bg-gray-50">
              <button
                type="button"
                class="px-3 py-1.5 text-sm font-medium rounded-md transition-colors"
                :class="viewMode === 'build' ? 'bg-white text-gray-900 shadow' : 'text-gray-600 hover:text-gray-900'"
                @click="viewMode = 'build'"
              >
                Build
              </button>
              <button
                type="button"
                class="px-3 py-1.5 text-sm font-medium rounded-md transition-colors"
                :class="viewMode === 'preview' ? 'bg-white text-gray-900 shadow' : 'text-gray-600 hover:text-gray-900'"
                @click="viewMode = 'preview'"
              >
                Preview
              </button>
            </div>
            <UButton size="sm" color="neutral" variant="outline" @click="openEditMenuModal">
              Edit menu details
            </UButton>
            <UButton size="sm" color="neutral" variant="outline" icon="i-lucide-file-spreadsheet" @click="exportExcel">
              Export Excel
            </UButton>
            <UButton size="sm" color="neutral" variant="outline" icon="i-lucide-file-text" @click="exportWord">
              Export Word
            </UButton>
            <UButton size="sm" color="neutral" variant="outline" icon="i-lucide-file-down" @click="exportPdf">
              Export PDF
            </UButton>
          </div>
        </div>
      </div>

      <!-- Preview tab -->
      <div v-if="viewMode === 'preview'" class="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
        <div class="flex items-center justify-between mb-4">
          <h2 class="text-sm font-semibold text-gray-900">Menu preview</h2>
          <UButton size="sm" variant="outline" @click="viewMode = 'build'">
            Edit
          </UButton>
        </div>
        <div class="overflow-x-auto">
          <table class="min-w-full text-sm">
            <thead class="bg-gray-50">
              <tr>
                <th class="px-3 py-2 text-left font-medium text-gray-700">Product name</th>
                <th class="px-3 py-2 text-left font-medium text-gray-700">Brand</th>
                <th class="px-3 py-2 text-left font-medium text-gray-700">Product type</th>
                <th class="px-3 py-2 text-left font-medium text-gray-700 max-w-[180px]">Description</th>
                <th class="px-3 py-2 text-right font-medium text-gray-700">Batch (cost)</th>
                <th class="px-3 py-2 text-right font-medium text-gray-700">Items</th>
                <th class="px-3 py-2 text-right font-medium text-gray-700">Margin %</th>
                <th class="px-3 py-2 text-right font-medium text-gray-700">Menu Price Calculated</th>
                <th class="px-3 py-2 text-right font-medium text-gray-700">Margin Final</th>
                <th class="px-3 py-2 text-right font-medium text-gray-700">Menu Price Final</th>
                <th class="px-3 py-2 text-left font-medium text-gray-700">Supplier</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-gray-200">
              <tr
                v-for="row in calculationRows"
                :key="`${row.sectionId}-${row.productId}`"
                class="text-gray-700"
              >
                <td class="px-3 py-2 font-medium text-gray-900">{{ row.override.displayName ?? productDisplayName(row.product) }}</td>
                <td class="px-3 py-2">{{ (row.override.brand ?? productBrandFromData(row.product)) || '–' }}</td>
                <td class="px-3 py-2">{{ row.override.productType ?? productCategoryType(row.product) }}</td>
                <td class="px-3 py-2 text-gray-600 max-w-[180px] truncate" :title="(row.override.description ?? row.product?.description ?? productDescriptionFromData(row.product) ?? '')">{{ (row.override.description ?? row.product?.description ?? productDescriptionFromData(row.product)) ?? '–' }}</td>
                <td class="px-3 py-2 text-right tabular-nums">{{ row.override.batchCost != null ? formatNum(row.override.batchCost) : productBatchFromData(row.product) }}</td>
                <td class="px-3 py-2 text-right tabular-nums">{{ row.override.itemsPerBatch ?? productItemsPerBatchFromData(row.product) }}</td>
                <td class="px-3 py-2 text-right tabular-nums">{{ formatNum(row.calc.marginPercent) }}%</td>
                <td class="px-3 py-2 text-right tabular-nums">€ {{ formatNum(row.calc.menuPriceIncVat) }}</td>
                <td class="px-3 py-2 text-right tabular-nums">{{ formatNum(marginFinalMultiplier(row)) }}</td>
                <td class="px-3 py-2 text-right tabular-nums font-medium">€ {{ formatNum((row.override.menuPriceIncVat != null ? row.override.menuPriceIncVat : row.calc.menuPriceIncVat) ?? 0) }}</td>
                <td class="px-3 py-2">{{ (row.override.supplier ?? productSupplierFromData(row.product)) || '–' }}</td>
              </tr>
              <tr v-if="calculationRows.length === 0">
                <td colspan="11" class="px-3 py-4 text-center text-gray-500">Add sections and products, then Save Menu.</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <!-- Build: sections + calculations -->
      <template v-if="viewMode === 'build'">
      <!-- Global defaults -->
      <div class="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
        <h2 class="text-sm font-semibold text-gray-900 mb-3">Global defaults</h2>
        <p class="text-xs text-gray-500 mb-3">Apply to all rows unless overridden in the table.</p>
          <div class="flex flex-wrap items-end gap-4">
          <UFormField label="Waste %" class="w-24">
            <UInput v-model.number="globalWastePercent" type="number" min="0" max="100" step="0.5" />
          </UFormField>
          <UFormField label="Margin (multiplier)" class="w-28">
            <UInput v-model.number="globalMarginMultiplier" type="number" min="1" step="0.1" />
          </UFormField>
          <UFormField label="BTW" class="w-32">
            <select
              v-model.number="globalVatRate"
              class="w-full rounded border border-gray-300 bg-white px-3 py-2 text-sm"
            >
              <option :value="9">9%</option>
              <option :value="21">21%</option>
            </select>
          </UFormField>
        </div>
      </div>

      <!-- Your sections (custom names) -->
      <div class="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
        <h2 class="text-sm font-semibold text-gray-900 mb-2">Your sections</h2>
        <p class="text-xs text-gray-500 mb-4">
          Add sections with your own names (e.g. Wijnen, Bieren, Cocktails). Then add products from the product list.
        </p>
        <div class="mb-4">
          <UButton icon="i-lucide-plus" size="sm" @click="openAddSection">
            Add section
          </UButton>
        </div>
        <div class="space-y-4">
          <div
            v-for="sec in normalizedSections"
            :key="sec.id"
            class="rounded-lg border border-gray-200 bg-gray-50/50 p-4"
          >
            <div class="flex items-center justify-between gap-2 mb-2">
              <h3 class="text-sm font-medium text-gray-800">
                {{ sec.name }}
              </h3>
              <div class="flex gap-1">
                <UButton size="xs" color="neutral" variant="ghost" @click="startRenameSection(sec)">
                  Rename
                </UButton>
                <UButton size="xs" color="error" variant="ghost" @click="removeSection(sec.id)">
                  Remove section
                </UButton>
              </div>
            </div>
            <ul v-if="sec.productIds.length" class="space-y-1">
              <li
                v-for="id in sec.productIds"
                :key="id"
                class="flex items-center justify-between gap-2 rounded px-2 py-1 text-sm hover:bg-gray-100"
              >
                <span>{{ productName(id) }}</span>
                <UButton size="xs" color="error" variant="ghost" icon="i-lucide-x" @click="removeFromSection(sec.id, id)" />
              </li>
            </ul>
            <p v-else class="text-xs text-gray-500">No products yet</p>
            <UButton size="xs" class="mt-2" @click="openAddProducts(sec.id)">
              Add products to this section
            </UButton>
          </div>
        </div>
        <div class="mt-4">
          <UButton icon="i-lucide-plus" @click="showAddProducts = true">
            Add products from product list
          </UButton>
        </div>
      </div>

      <!-- Calculations: live edit per row -->
      <div class="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
        <div class="flex items-center justify-between mb-4">
          <div>
            <h2 class="text-sm font-semibold text-gray-900">Calculations</h2>
            <p class="text-xs text-gray-500 mt-0.5">
              Menu Price Calculated = formula (cost, waste, margin, BTW). Menu Price Final = price on the menu; edit it to see Margin Final. Save Menu to persist.
            </p>
          </div>
          <UButton :loading="savingMenu" @click="saveMenu">
            Save Menu
          </UButton>
        </div>
        <div class="overflow-x-auto">
          <table class="min-w-full text-sm">
            <thead class="bg-gray-50">
              <tr>
                <th class="px-2 py-2 text-left font-medium text-gray-700">Product</th>
                <th class="px-2 py-2 text-left font-medium text-gray-700">Brand</th>
                <th class="px-2 py-2 text-left font-medium text-gray-700">Product type</th>
                <th class="px-2 py-2 text-left font-medium text-gray-700 max-w-[120px]">Description</th>
                <th class="px-2 py-2 text-right font-medium text-gray-700">Batch</th>
                <th class="px-2 py-2 text-right font-medium text-gray-700">Items</th>
                <th class="px-2 py-2 text-right font-medium text-gray-700">Cost/item</th>
                <th class="px-2 py-2 text-right font-medium text-gray-700">Cost + waste</th>
                <th class="px-2 py-2 text-right font-medium text-gray-700 w-20">Waste %</th>
                <th class="px-2 py-2 text-right font-medium text-gray-700 w-24">Margin</th>
                <th class="px-2 py-2 text-right font-medium text-gray-700 w-20">BTW</th>
                <th class="px-2 py-2 text-right font-medium text-gray-700">Nett</th>
                <th class="px-2 py-2 text-right font-medium text-gray-700 w-28">Menu Price Calculated</th>
                <th class="px-2 py-2 text-right font-medium text-gray-700 w-24">Margin Final</th>
                <th class="px-2 py-2 text-right font-medium text-gray-700 w-28">Menu Price Final</th>
                <th class="px-2 py-2 text-left font-medium text-gray-700">Supplier</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-gray-200">
              <tr
                v-for="row in calculationRows"
                :key="`${row.sectionId}-${row.productId}`"
                class="align-baseline"
              >
                <td class="px-2 py-1 min-w-[140px]">
                  <input
                    :value="row.override.displayName ?? productDisplayName(row.product)"
                    type="text"
                    class="w-full rounded border border-gray-300 px-1.5 py-0.5 text-sm text-gray-900"
                    placeholder="Product name"
                    @input="setRowOverride(row.sectionId, row.productId, 'displayName', ($event.target as HTMLInputElement).value)"
                  >
                </td>
                <td class="px-2 py-1 min-w-[90px]">
                  <input
                    :value="row.override.brand ?? productBrandFromData(row.product)"
                    type="text"
                    class="w-full rounded border border-gray-300 px-1.5 py-0.5 text-sm text-gray-600"
                    placeholder="Brand"
                    @input="setRowOverride(row.sectionId, row.productId, 'brand', ($event.target as HTMLInputElement).value)"
                  >
                </td>
                <td class="px-2 py-1 min-w-[80px]">
                  <input
                    :value="row.override.productType ?? productCategoryType(row.product)"
                    type="text"
                    class="w-full rounded border border-gray-300 px-1.5 py-0.5 text-sm text-gray-600"
                    placeholder="Type"
                    @input="setRowOverride(row.sectionId, row.productId, 'productType', ($event.target as HTMLInputElement).value)"
                  >
                </td>
                <td class="px-2 py-1 max-w-[140px]">
                  <input
                    :value="row.override.description ?? row.product?.description ?? productDescriptionFromData(row.product) ?? ''"
                    type="text"
                    class="w-full rounded border border-gray-300 px-1.5 py-0.5 text-sm text-gray-600"
                    placeholder="Description"
                    @input="setRowOverride(row.sectionId, row.productId, 'description', ($event.target as HTMLInputElement).value)"
                  >
                </td>
                <td class="px-2 py-1 w-24">
                  <input
                    :value="row.override.batchCost ?? batchCostNumericFromProduct(row.product) ?? ''"
                    type="number"
                    min="0"
                    step="0.01"
                    class="w-full rounded border border-gray-300 px-1 py-0.5 text-right text-sm tabular-nums"
                    placeholder="Batch"
                    @input="setRowOverride(row.sectionId, row.productId, 'batchCost', parseNum(($event.target as HTMLInputElement).value))"
                  >
                </td>
                <td class="px-2 py-1 w-20">
                  <input
                    :value="row.override.itemsPerBatch ?? itemsPerBatchNumericFromProduct(row.product) ?? ''"
                    type="number"
                    min="1"
                    step="1"
                    class="w-full rounded border border-gray-300 px-1 py-0.5 text-right text-sm tabular-nums"
                    placeholder="Items"
                    @input="setRowOverride(row.sectionId, row.productId, 'itemsPerBatch', parseNum(($event.target as HTMLInputElement).value))"
                  >
                </td>
                <td class="px-2 py-1 w-24">
                  <input
                    :value="(row.override.costPerItem != null ? row.override.costPerItem : row.calc.costPerItem) ?? ''"
                    type="number"
                    min="0"
                    step="0.01"
                    class="w-full rounded border border-gray-300 px-1 py-0.5 text-right text-sm tabular-nums"
                    placeholder="Cost"
                    @input="setRowOverride(row.sectionId, row.productId, 'costPerItem', parseNum(($event.target as HTMLInputElement).value))"
                  >
                </td>
                <td class="px-2 py-1.5 text-right tabular-nums text-gray-700">€ {{ formatNum(row.calc.costPlusWaste) }}</td>
                <td class="px-2 py-1 w-20">
                  <input
                    :value="row.override.wastePercent"
                    type="number"
                    min="0"
                    max="100"
                    step="0.5"
                    class="w-full rounded border border-gray-300 px-1 py-0.5 text-right text-sm"
                    @input="onWasteInput(row, $event)"
                  >
                </td>
                <td class="px-2 py-1 w-24">
                  <input
                    :value="row.override.marginMultiplier"
                    type="number"
                    min="1"
                    step="0.1"
                    class="w-full rounded border border-gray-300 px-1 py-0.5 text-right text-sm"
                    @input="onMarginInput(row, $event)"
                  >
                </td>
                <td class="px-2 py-1 w-20">
                  <select
                    :value="row.override.vatRate"
                    class="w-full rounded border border-gray-300 px-1 py-0.5 text-sm"
                    @change="onVatChange(row, $event)"
                  >
                    <option :value="9">9%</option>
                    <option :value="21">21%</option>
                  </select>
                </td>
                <td class="px-2 py-1.5 text-right tabular-nums text-gray-700">€ {{ formatNum(row.calc.nettPrice) }}</td>
                <td class="px-2 py-1.5 text-right tabular-nums text-gray-700">€ {{ formatNum(row.calc.menuPriceIncVat) }}</td>
                <td class="px-2 py-1.5 text-right tabular-nums text-gray-700">{{ formatNum(marginFinalMultiplier(row)) }}</td>
                <td class="px-2 py-1 w-28">
                  <input
                    :value="(row.override.menuPriceIncVat != null ? row.override.menuPriceIncVat : row.calc.menuPriceIncVat) ?? ''"
                    type="number"
                    min="0"
                    step="0.01"
                    class="w-full rounded border border-gray-300 px-1 py-0.5 text-right text-sm tabular-nums"
                    placeholder="Price"
                    @input="onMenuPriceInput(row, $event)"
                  >
                </td>
                <td class="px-2 py-1 min-w-[100px]">
                  <input
                    :value="row.override.supplier ?? productSupplierFromData(row.product)"
                    type="text"
                    class="w-full rounded border border-gray-300 px-1.5 py-0.5 text-sm text-gray-600"
                    placeholder="Supplier"
                    @input="setRowOverride(row.sectionId, row.productId, 'supplier', ($event.target as HTMLInputElement).value)"
                  >
                </td>
              </tr>
              <tr v-if="calculationRows.length === 0">
                <td colspan="15" class="px-3 py-4 text-center text-gray-500">
                  Add sections and products to see calculations.
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
      </template>
    </div>

    <div v-else-if="pending" class="rounded-lg border border-gray-200 bg-white p-6 text-center text-gray-500">
      Loading menu…
    </div>
    <div v-else class="rounded-lg border border-gray-200 bg-white p-6 text-center text-gray-500">
      Menu not found
    </div>

    <!-- Edit menu details modal -->
    <UModal :open="showEditMenu" :ui="{ width: 'sm:max-w-md' }" @update:open="showEditMenu = $event">
      <template #content>
        <div class="p-4 space-y-4">
          <h2 class="text-lg font-semibold text-gray-900">Edit menu details</h2>
          <UFormField label="Menu name">
            <UInput v-model="editForm.name" />
          </UFormField>
          <UFormField label="Start date">
            <UInput v-model="editForm.startDate" type="date" />
          </UFormField>
          <UFormField label="Location">
            <select v-model="editForm.location" class="w-full rounded border border-gray-300 px-3 py-2 text-sm">
              <option value="">Select location</option>
              <option value="Kinsbergen">Kinsbergen</option>
              <option value="Barbea">Barbea</option>
              <option value="l'Amour Toujours">l'Amour Toujours</option>
            </select>
          </UFormField>
          <div class="flex justify-end gap-2">
            <UButton color="neutral" variant="ghost" @click="showEditMenu = false">Cancel</UButton>
            <UButton @click="saveEditMenu">Save</UButton>
          </div>
        </div>
      </template>
    </UModal>

    <!-- Add section modal -->
    <UModal :open="showNewSectionName" :ui="{ width: 'sm:max-w-sm' }" @update:open="showNewSectionName = $event">
      <template #content>
        <div class="p-4 space-y-4">
          <h2 class="text-lg font-semibold text-gray-900">New section</h2>
          <UFormField label="Section name">
            <UInput v-model="newSectionName" placeholder="e.g. Wijnen" @keydown.enter.prevent="addSection" />
          </UFormField>
          <div class="flex justify-end gap-2">
            <UButton color="neutral" variant="ghost" @click="showNewSectionName = false">Cancel</UButton>
            <UButton :disabled="!newSectionName.trim()" @click="addSection">Add</UButton>
          </div>
        </div>
      </template>
    </UModal>

    <!-- Rename section -->
    <UModal :open="showRenameSection" :ui="{ width: 'sm:max-w-sm' }" @update:open="showRenameSection = $event">
      <template #content>
        <div class="p-4 space-y-4">
          <h2 class="text-lg font-semibold text-gray-900">Rename section</h2>
          <UFormField label="Section name">
            <UInput v-model="renameSectionName" @keydown.enter.prevent="saveRenameSection" />
          </UFormField>
          <div class="flex justify-end gap-2">
            <UButton color="neutral" variant="ghost" @click="showRenameSection = false">Cancel</UButton>
            <UButton :disabled="!renameSectionName.trim()" @click="saveRenameSection">Save</UButton>
          </div>
        </div>
      </template>
    </UModal>

    <!-- Add products modal -->
    <UModal :open="showAddProducts" :ui="{ width: 'sm:max-w-lg' }" @update:open="showAddProducts = $event">
      <template #content>
        <div class="p-4 space-y-4">
          <h2 class="text-lg font-semibold text-gray-900">Add products</h2>
          <UFormField label="Add to section">
            <select v-model="addToSectionId" class="w-full rounded border border-gray-300 px-3 py-2 text-sm">
              <option v-for="s in normalizedSections" :key="s.id" :value="s.id">
                {{ s.name }}
              </option>
              <option v-if="normalizedSections.length === 0" value="" disabled>
                Add a section first
              </option>
            </select>
          </UFormField>
          <div class="max-h-64 overflow-y-auto space-y-1 border border-gray-200 rounded p-2">
            <label
              v-for="item in products"
              :key="item._id"
              class="flex items-center gap-2 rounded px-2 py-1.5 hover:bg-gray-100 cursor-pointer"
            >
              <input v-model="selectedProductIds" type="checkbox" :value="item._id" class="rounded border-gray-300">
              <span class="text-sm">{{ productDisplayName(item) }}</span>
            </label>
            <p v-if="!products.length" class="text-xs text-gray-500 py-2">No products. Import CSV/Excel first.</p>
          </div>
          <div class="flex justify-end gap-2">
            <UButton color="neutral" variant="ghost" @click="showAddProducts = false">Cancel</UButton>
            <UButton :disabled="selectedProductIds.length === 0 || !addToSectionId" @click="addSelectedToSection">
              Add to section
            </UButton>
          </div>
        </div>
      </template>
    </UModal>

    <div ref="exportRef" class="hidden p-6 bg-white text-gray-900">
      <div v-if="menu" id="menu-export-content">
        <h1 class="text-2xl font-bold mb-2">{{ menu.name }}</h1>
        <p v-if="menu.location" class="text-sm text-gray-600 mb-4">{{ menu.location }}</p>
        <div v-for="sec in normalizedSections" :key="sec.id" class="mb-4">
          <h2 class="text-lg font-semibold border-b pb-1 mb-2">{{ sec.name }}</h2>
          <ul class="list-disc list-inside text-sm">
            <li v-for="id in sec.productIds" :key="id">{{ productName(id) }}</li>
          </ul>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { Menu, MenuSection, MenuProductOverride } from '~/types/menuItem'
import type { MenuItem } from '~/types/menuItem'
import {
  useMenuRowCalculation,
  getCostPerItemFromProduct,
  parseProductNumber,
} from '~/composables/useMenuRowCalculation'

definePageMeta({ layout: 'default' })

const route = useRoute()
const menuId = computed(() => String(route.params?.id ?? ''))

const { data: menuData, pending, refresh: refreshMenu } = await useAsyncData(
  () => `menu-${menuId.value}`,
  () => {
    const id = menuId.value
    if (!id || id === 'undefined') return Promise.resolve({ success: true, data: null })
    return $fetch<{ success: boolean; data: Menu }>(`/api/menu/menus/${id}`)
  },
  { watch: [menuId] }
)
const menu = computed(() => menuData.value?.data ?? null)

const { data: productsData } = await useFetch<{ success: boolean; data: MenuItem[] }>('/api/menu/items?limit=500')
const products = computed(() => productsData.value?.data ?? [])

// Normalize: use menuSections or convert legacy sections to array
const normalizedSections = computed((): MenuSection[] => {
  const m = menu.value
  if (m?.menuSections?.length) return m.menuSections
  const leg = m?.sections as Record<string, string[]> | undefined
  if (!leg) return []
  const labels: Record<string, string> = {
    drinks: 'Drinks',
    diner: 'Diner',
    snacks: 'Snacks',
    dessert: 'Dessert',
    coursesMenu: 'Courses',
  }
  return Object.entries(labels).map(([key, name]) => ({
    id: key,
    name,
    productIds: leg[key] ?? [],
  }))
})

const allMenuProductIds = computed(() => {
  const ids: string[] = []
  for (const s of normalizedSections.value) {
    ids.push(...(s.productIds || []))
  }
  return ids
})

const viewMode = ref<'build' | 'preview'>('build')
const globalWastePercent = ref(5)
const globalMarginMultiplier = ref(4)
const globalVatRate = ref<9 | 21>(21)
const localSectionOverrides = ref<Record<string, Record<string, MenuProductOverride>>>({})
const calculationVersion = ref(0)
const savingMenu = ref(false)

watch(
  menu,
  (m) => {
    if (m?.defaultWastePercent != null) globalWastePercent.value = m.defaultWastePercent
    if (m?.defaultMarginMultiplier != null) globalMarginMultiplier.value = m.defaultMarginMultiplier
    else globalMarginMultiplier.value = 4
    if (m?.defaultVatRate != null) globalVatRate.value = m.defaultVatRate
    const next: Record<string, Record<string, MenuProductOverride>> = {}
    for (const sec of normalizedSections.value) {
      next[sec.id] = {}
      for (const pid of sec.productIds || []) {
        next[sec.id][pid] = { ...(sec.productOverrides?.[pid] ?? {}) }
      }
    }
    localSectionOverrides.value = next
  },
  { immediate: true }
)

function setRowOverride(
  sectionId: string,
  productId: string,
  key: keyof MenuProductOverride,
  value: number | string | undefined
) {
  const sec = localSectionOverrides.value[sectionId] ?? {}
  const cur = sec[productId] ?? {}
  const normalized =
    value === '' || value === undefined || value === null
      ? undefined
      : typeof value === 'number' && Number.isNaN(value)
        ? undefined
        : value
  const next = { ...cur, [key]: normalized }
  if (normalized === undefined) delete next[key]
  localSectionOverrides.value = {
    ...localSectionOverrides.value,
    [sectionId]: { ...sec, [productId]: Object.keys(next).length ? next : {} },
  }
  calculationVersion.value += 1
}

const productsById = computed(() => {
  const map: Record<string, MenuItem> = {}
  for (const p of products.value) {
    if (p._id) map[p._id] = p
  }
  return map
})

type CalculationRow = {
  sectionId: string
  sectionName: string
  productId: string
  product: MenuItem | undefined
  override: MenuProductOverride & { wastePercent: number; marginMultiplier: number; vatRate: 9 | 21 }
  calc: ReturnType<typeof useMenuRowCalculation>
}

const calculationRows = computed((): CalculationRow[] => {
  void calculationVersion.value
  const rows: CalculationRow[] = []
  const waste = globalWastePercent.value
  const margin = globalMarginMultiplier.value
  const vat = globalVatRate.value
  const overrides = localSectionOverrides.value
  for (const sec of normalizedSections.value) {
    for (const productId of sec.productIds || []) {
      const product = productsById.value[productId]
      const data = product?.data as Record<string, unknown> | undefined
      const ov = overrides[sec.id]?.[productId]
      const o = {
        displayName: ov?.displayName,
        brand: ov?.brand,
        productType: ov?.productType,
        description: ov?.description,
        supplier: ov?.supplier,
        batchCost: ov?.batchCost,
        itemsPerBatch: ov?.itemsPerBatch,
        costPerItem: ov?.costPerItem,
        wastePercent: ov?.wastePercent ?? waste,
        marginMultiplier: ov?.marginMultiplier ?? margin,
        vatRate: (ov?.vatRate ?? vat) as 9 | 21,
        menuPriceIncVat: ov?.menuPriceIncVat,
      }
      let costPerItem: number
      if (o.costPerItem != null && o.costPerItem >= 0) {
        costPerItem = o.costPerItem
      } else if (
        o.batchCost != null &&
        o.itemsPerBatch != null &&
        o.itemsPerBatch > 0
      ) {
        costPerItem = o.batchCost / o.itemsPerBatch
      } else {
        costPerItem =
          getCostPerItemFromProduct(
            data,
            o.batchCost ?? undefined,
            o.itemsPerBatch ?? undefined,
            product?.costPricePerItem
          ) || 0
      }
      // Always use formula for "Menu Price Calculated"; Menu Price Final is independent (override or copy of calculated).
      const calc = useMenuRowCalculation({
        costPerItem,
        wastePercent: o.wastePercent,
        marginMultiplier: o.marginMultiplier,
        vatRate: o.vatRate,
        menuPriceIncVat: undefined,
      })
      rows.push({
        sectionId: sec.id,
        sectionName: sec.name,
        productId,
        product,
        override: o,
        calc,
      })
    }
  }
  return rows
})

/** Package type (Fles, Tap, Krat) – used to detect and skip so we don't show it as "product type". */
const PACKAGE_TYPE_VALUES = ['Fles', 'Flesje', 'Tap', 'Krat', 'Doos', 'Blik', 'Bottle', 'Can', 'Draft']

/** Display style (radler, kriek, IPA, Dubbel) – not package. Prefer Type_2 / Soort / Style; never show package type; fallback from name. */
function productCategoryType(item: MenuItem | undefined): string {
  if (!item) return '–'
  const sub = item.subType ?? item.type
  if (sub && !PACKAGE_TYPE_VALUES.includes(String(sub))) return String(sub)
  const d = item.data as Record<string, unknown> | undefined
  if (!d || typeof d !== 'object') return '–'
  const styleKeys = ['Type_2', 'Soort', 'Style', 'style']
  for (const k of styleKeys) {
    const v = d[k]
    const s = v != null ? String(v).trim() : ''
    if (s && !PACKAGE_TYPE_VALUES.includes(s)) return s
  }
  const name = productDisplayName(item)
  if (!name || name === '–') return '–'
  const styleWords = ['Kriek', 'Radler', 'Dubbel', 'Tripel', 'Classic', 'Blond', 'Amber', 'Weizen', 'IPA', 'Pils', 'Hazy']
  for (const word of styleWords) {
    if (name.includes(word)) return word
  }
  return '–'
}

function productDescriptionFromData(item: MenuItem | undefined): string {
  if (!item?.data || typeof item.data !== 'object') return ''
  const d = item.data as Record<string, unknown>
  const v = d['Omschrijving'] ?? d['Description'] ?? d['description']
  return v != null ? String(v).trim().slice(0, 120) : ''
}

function productBrandFromData(item: MenuItem | undefined): string {
  if (!item?.data || typeof item.data !== 'object') return ''
  const d = item.data as Record<string, unknown>
  const v = d['Brand'] ?? d['Merk'] ?? d['brand']
  return v != null ? String(v).trim() : ''
}

function productSupplierFromData(item: MenuItem | undefined): string {
  if (!item?.data || typeof item.data !== 'object') return ''
  const d = item.data as Record<string, unknown>
  const v = d['Leverancier'] ?? d['Supplier'] ?? d['supplier']
  return v != null ? String(v).trim() : ''
}

/** Batch cost (eenheid prijs, inkoop prijs) from product data */
function productBatchFromData(item: MenuItem | undefined): string {
  if (!item?.data || typeof item.data !== 'object') return '–'
  const d = item.data as Record<string, unknown>
  const keys = ['Eenheid Prijs', 'Inkoop Prijs', 'Inkoop prijs']
  for (const k of keys) {
    const v = d[k]
    if (v != null && String(v).trim()) return String(v).trim()
  }
  return '–'
}

/** Number of items per batch/krat from product data */
function productItemsPerBatchFromData(item: MenuItem | undefined): string {
  if (!item?.data || typeof item.data !== 'object') return '–'
  const d = item.data as Record<string, unknown>
  const keys = ['aantal per Items ', 'aantal per Items', 'Items', 'items per krat', 'per krat']
  for (const k of keys) {
    const v = d[k]
    if (v != null && String(v).trim()) return String(v).trim()
  }
  return '–'
}

function batchCostNumericFromProduct(item: MenuItem | undefined): number | undefined {
  if (!item?.data || typeof item.data !== 'object') return undefined
  const d = item.data as Record<string, unknown>
  const v = d['Eenheid Prijs'] ?? d['Inkoop Prijs'] ?? d['Inkoop prijs']
  const n = parseProductNumber(v)
  return n > 0 ? n : undefined
}

function itemsPerBatchNumericFromProduct(item: MenuItem | undefined): number | undefined {
  if (!item?.data || typeof item.data !== 'object') return undefined
  const d = item.data as Record<string, unknown>
  const v = d['aantal per Items '] ?? d['aantal per Items'] ?? d['Items']
  const n = parseProductNumber(v)
  return n > 0 ? n : undefined
}

function formatNum(n: number): string {
  if (Number.isNaN(n) || n == null || typeof n !== 'number') return '0,00'
  return Number(n).toFixed(2).replace('.', ',')
}

/** Margin Final = ratio (multiplier) from Menu Price Final, same concept as Margin column. nettFinal / costPlusWaste. */
function marginFinalMultiplier(row: CalculationRow): number {
  const menuPriceFinal = row.override.menuPriceIncVat ?? row.calc.menuPriceIncVat
  const costPlusWaste = row.calc.costPlusWaste
  if (costPlusWaste <= 0) return 0
  const nettFinal = menuPriceFinal / (1 + row.override.vatRate / 100)
  return nettFinal / costPlusWaste
}

function parseNum(v: unknown): number | undefined {
  if (v == null || v === '') return undefined
  const n = Number(v)
  return Number.isNaN(n) ? undefined : n
}

function onWasteInput(row: CalculationRow, e: Event) {
  const v = (e.target as HTMLInputElement).value
  setRowOverride(row.sectionId, row.productId, 'wastePercent', parseNum(v))
}

function onMarginInput(row: CalculationRow, e: Event) {
  const v = (e.target as HTMLInputElement).value
  setRowOverride(row.sectionId, row.productId, 'marginMultiplier', parseNum(v))
}

function onVatChange(row: CalculationRow, e: Event) {
  setRowOverride(row.sectionId, row.productId, 'vatRate', Number((e.target as HTMLSelectElement).value) as 9 | 21)
}

function onMenuPriceInput(row: CalculationRow, e: Event) {
  const v = (e.target as HTMLInputElement).value
  setRowOverride(row.sectionId, row.productId, 'menuPriceIncVat', parseNum(v))
}

async function saveMenu() {
  if (!menuId.value || !menu.value) return
  savingMenu.value = true
  try {
    const sections: MenuSection[] = normalizedSections.value.map((sec) => ({
      id: sec.id,
      name: sec.name,
      productIds: sec.productIds,
      productOverrides: localSectionOverrides.value[sec.id] ?? undefined,
    }))
    await $fetch(`/api/menu/menus/${menuId.value}`, {
      method: 'PATCH',
      body: {
        menuSections: sections,
        defaultWastePercent: globalWastePercent.value,
        defaultMarginMultiplier: globalMarginMultiplier.value,
        defaultVatRate: globalVatRate.value,
      },
    })
    await refreshMenu()
  } finally {
    savingMenu.value = false
  }
}

const showEditMenu = ref(false)
const showNewSectionName = ref(false)
const showRenameSection = ref(false)
const showAddProducts = ref(false)
const newSectionName = ref('')
const renameSectionName = ref('')
const renameSectionId = ref<string | null>(null)
const addToSectionId = ref('')
const selectedProductIds = ref<string[]>([])
const exportRef = ref<HTMLElement | null>(null)

const editForm = ref({ name: '', startDate: '', location: '' })

const costKeys = ['Eenheid Prijs', 'Inkoop Prijs', 'Per Stuk prijs', 'Kostprijs per stuk (waste %)']
const marginKeys = ['Netto Marge', 'Marge Fictief']
const nettoKeys = ['Netto Kaartprijs', 'Netto Kaartprijs_2', 'Netto Calculatie Prijs']
const brutoKeys = ['Bruto Kaartprijs', 'Bruto Kaartprijs Klein', 'Bruto Calculatie Prijs']

function productName(id: string): string {
  return productDisplayName(productsById.value[id]) || id
}

function productDisplayName(item: MenuItem | undefined): string {
  if (!item) return '–'
  const d = item.data
  if (d && typeof d === 'object') {
    for (const k of ['Product Kinsbergen', 'Product', 'Name', 'name']) {
      const v = d[k]
      if (v != null && String(v).trim()) return String(v).trim()
    }
    const first = Object.values(d).find((v) => v != null && String(v).trim())
    if (first != null) return String(first).trim().slice(0, 60)
  }
  return item.name ?? '–'
}

function productDataVal(productId: string, keys: string[]): string {
  const d = productsById.value[productId]?.data
  if (!d || typeof d !== 'object') return '–'
  for (const k of keys) {
    const v = d[k]
    if (v != null && String(v).trim()) return String(v).trim()
  }
  return '–'
}

function formatDate(d: Date | string | undefined): string {
  if (!d) return '–'
  return (typeof d === 'string' ? new Date(d) : d).toLocaleDateString(undefined, { dateStyle: 'short' })
}

function openEditMenuModal() {
  if (!menu.value) return
  editForm.value = {
    name: menu.value.name,
    startDate: menu.value.startDate ?? '',
    location: menu.value.location ?? '',
  }
  showEditMenu.value = true
}

async function saveEditMenu() {
  if (!menuId.value) return
  await $fetch(`/api/menu/menus/${menuId.value}`, {
    method: 'PATCH',
    body: {
      name: editForm.value.name.trim(),
      startDate: editForm.value.startDate || undefined,
      location: editForm.value.location || undefined,
    },
  })
  showEditMenu.value = false
  await refreshMenu()
}

function openAddSection() {
  newSectionName.value = ''
  showNewSectionName.value = true
}

function addSection() {
  const name = newSectionName.value.trim()
  if (!name || !menu.value) return
  const next = [
    ...normalizedSections.value,
    { id: `sec-${Date.now()}`, name, productIds: [] },
  ]
  $fetch(`/api/menu/menus/${menuId.value}`, { method: 'PATCH', body: { menuSections: next } }).then(() => {
    refreshMenu()
    showNewSectionName.value = false
  })
}

function startRenameSection(sec: MenuSection) {
  renameSectionId.value = sec.id
  renameSectionName.value = sec.name
  showRenameSection.value = true
}

function saveRenameSection() {
  const name = renameSectionName.value.trim()
  if (!name || renameSectionId.value == null) return
  const next = normalizedSections.value.map((s) =>
    s.id === renameSectionId.value ? { ...s, name } : s
  )
  $fetch(`/api/menu/menus/${menuId.value}`, { method: 'PATCH', body: { menuSections: next } }).then(() => {
    refreshMenu()
    showRenameSection.value = false
    renameSectionId.value = null
  })
}

function removeSection(sectionId: string) {
  if (!confirm('Remove this section and its products from the menu?')) return
  const next = normalizedSections.value.filter((s) => s.id !== sectionId)
  $fetch(`/api/menu/menus/${menuId.value}`, { method: 'PATCH', body: { menuSections: next } }).then(() => refreshMenu())
}

function openAddProducts(sectionId: string) {
  addToSectionId.value = sectionId
  selectedProductIds.value = []
  showAddProducts.value = true
}

async function addSelectedToSection() {
  if (!menu.value || selectedProductIds.value.length === 0 || !addToSectionId.value) return
  const next = normalizedSections.value.map((s) => {
    if (s.id !== addToSectionId.value) return s
    const set = new Set(s.productIds)
    selectedProductIds.value.forEach((id) => set.add(id))
    return { ...s, productIds: Array.from(set) }
  })
  await $fetch(`/api/menu/menus/${menuId.value}`, { method: 'PATCH', body: { menuSections: next } })
  await refreshMenu()
  selectedProductIds.value = []
  showAddProducts.value = false
}

function removeFromSection(sectionId: string, productId: string) {
  const next = normalizedSections.value.map((s) =>
    s.id === sectionId ? { ...s, productIds: s.productIds.filter((id) => id !== productId) } : s
  )
  $fetch(`/api/menu/menus/${menuId.value}`, { method: 'PATCH', body: { menuSections: next } }).then(() => refreshMenu())
}

async function exportExcel() {
  if (!menu.value) return
  const res = await $fetch<Blob>(`/api/menu/menus/${menuId.value}/export/excel`, { responseType: 'blob' })
  const url = URL.createObjectURL(res)
  const a = document.createElement('a')
  a.href = url
  a.download = `${menu.value.name.replace(/[^a-z0-9]/gi, '_')}.xlsx`
  a.click()
  URL.revokeObjectURL(url)
}

function exportWord() {
  if (!menu.value) return
  const parts = [
    '<html><head><meta charset="utf-8"/></head><body>',
    `<h1>${escapeHtml(menu.value.name)}</h1>`,
    menu.value.location ? `<p>${escapeHtml(menu.value.location)}</p>` : '',
  ]
  for (const sec of normalizedSections.value) {
    parts.push(`<h2>${escapeHtml(sec.name)}</h2><ul>`)
    for (const id of sec.productIds) {
      parts.push(`<li>${escapeHtml(productName(id))}</li>`)
    }
    parts.push('</ul>')
  }
  parts.push('</body></html>')
  const blob = new Blob(parts.join(''), { type: 'application/msword' })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = `${menu.value.name.replace(/[^a-z0-9]/gi, '_')}.doc`
  a.click()
  URL.revokeObjectURL(a.href)
}

async function exportPdf() {
  if (!menu.value || !exportRef.value) return
  const el = exportRef.value.querySelector('#menu-export-content')
  if (!el) return
  const html2pdf = (await import('html2pdf.js')).default
  await html2pdf().set({ filename: `${menu.value.name.replace(/[^a-z0-9]/gi, '_')}.pdf` }).from(el).save()
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}
</script>
