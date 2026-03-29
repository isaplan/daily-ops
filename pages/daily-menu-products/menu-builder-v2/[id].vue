<!--
  Menu Builder V2 – single menu. Sections/subsections, add products, subsection table (Show on Printed Menu, reorder, edit), calculation mode, export.
  Uses: menus/[id].get, menus/[id].patch, menus/[id]/products/bulk, items.get (search/productType), useMenuRowCalculation.
-->
<template>
  <div class="w-full max-w-full space-y-6">
    <div class="flex items-center justify-between gap-4">
      <NuxtLink to="/daily-menu-products/menu-builder-v2" class="text-sm font-medium text-gray-600 hover:text-gray-900">
        ← Menu Builder V2
      </NuxtLink>
    </div>

    <div v-if="menu" class="space-y-6">
      <div class="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
        <div class="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 class="text-2xl font-bold text-gray-900">{{ menu.name }}</h1>
            <div v-if="menu.startDate || menu.location" class="mt-1 flex flex-wrap gap-x-4 text-sm text-gray-600">
              <span v-if="menu.startDate">Start: {{ formatDate(menu.startDate) }}</span>
              <span v-if="menu.location">{{ menu.location }}</span>
            </div>
            <div v-if="menu.copiedFromMenuId" class="mt-1 text-xs text-gray-500">Copied from menu: {{ menu.copiedFromMenuId }}</div>
          </div>
          <div class="flex flex-wrap gap-2">
            <UButton size="sm" variant="outline" icon="i-lucide-file-spreadsheet" @click="exportExcel(false)">
              Export Excel (full)
            </UButton>
            <UButton size="sm" variant="outline" icon="i-lucide-file-output" @click="exportExcel(true)">
              Printed menu only
            </UButton>
            <UButton size="sm" variant="outline" @click="showEditMenu = true">Edit menu details</UButton>
            <UButton
              size="sm"
              variant="outline"
              icon="i-lucide-calculator"
              @click="openBulkCalculation"
            >
              Bulk Calculation
            </UButton>
          </div>
        </div>
      </div>

      <div class="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
        <div class="flex flex-wrap items-center justify-between gap-4 mb-4">
          <div>
            <h2 class="text-sm font-semibold text-gray-900">Sections & subsections</h2>
            <p class="text-xs text-gray-500 mt-0.5">
              Add sections (e.g. Beers), then subsections. Set section-level defaults for waste %, margin, VAT. Save to persist.
            </p>
          </div>
          <UButton size="sm" icon="i-lucide-plus" @click="openAddSection">Add section</UButton>
        </div>
        <div v-if="normalizedSections.length === 0" class="text-sm text-gray-500 py-4">
          No sections yet. Add a section to get started.
        </div>
        <div v-else class="space-y-4">
          <div
            v-for="sec in normalizedSections"
            :key="sec.id"
            class="rounded border border-gray-200 p-4 bg-gray-50/50"
          >
            <div class="flex flex-wrap items-center justify-between gap-2">
              <span class="font-medium text-gray-900">{{ sec.name }}</span>
              <UButton size="xs" variant="ghost" icon="i-lucide-plus" @click="openAddSubsection(sec.id)">
                Add subsection
              </UButton>
            </div>
            <div v-if="sec.subsections?.length" class="mt-3 pl-2 border-l-2 border-gray-200 space-y-2">
              <div
                v-for="sub in sec.subsections"
                :key="sub.id"
                class="flex items-center justify-between text-sm text-gray-700"
              >
                <span>{{ sub.name }} ({{ sub.productIds?.length ?? 0 }} products)</span>
                <div class="flex items-center gap-2">
                  <UButton size="xs" variant="ghost" @click="openAddProducts(sec.id, sub.id)">
                    Add products
                  </UButton>
                  <UButton
                    size="xs"
                    variant="ghost"
                    class="text-primary-600"
                    @click="openSubsectionModal(sec.id, sub.id)"
                  >
                    Open
                  </UButton>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <div v-else-if="pending" class="rounded-lg border border-gray-200 bg-white p-6 text-center text-gray-500">
      Loading menu…
    </div>
    <div v-else class="rounded-lg border border-gray-200 bg-white p-6 text-center text-gray-500">
      Menu not found
    </div>

    <UModal :open="showEditMenu" :ui="{ width: 'sm:max-w-md' }" @update:open="showEditMenu = $event">
      <template #content>
        <div class="p-4 space-y-4">
          <h2 class="text-lg font-semibold text-gray-900">Edit menu details</h2>
          <UFormField label="Name"><UInput v-model="editForm.name" /></UFormField>
          <UFormField label="Start date"><UInput v-model="editForm.startDate" type="date" /></UFormField>
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
            <UButton :loading="saving" @click="saveEditMenu">Save</UButton>
          </div>
        </div>
      </template>
    </UModal>

    <UModal :open="showNewSection" :ui="{ width: 'sm:max-w-sm' }" @update:open="showNewSection = $event">
      <template #content>
        <div class="p-4 space-y-4">
          <h2 class="text-lg font-semibold text-gray-900">New section</h2>
          <UFormField label="Section name">
            <UInput v-model="newSectionName" placeholder="e.g. Beers" @keydown.enter.prevent="addSection" />
          </UFormField>
          <div class="flex justify-end gap-2">
            <UButton color="neutral" variant="ghost" @click="showNewSection = false">Cancel</UButton>
            <UButton :disabled="!newSectionName.trim()" :loading="saving" @click="addSection">Add</UButton>
          </div>
        </div>
      </template>
    </UModal>

    <UModal :open="showNewSubsection" :ui="{ width: 'sm:max-w-sm' }" @update:open="showNewSubsection = $event">
      <template #content>
        <div class="p-4 space-y-4">
          <h2 class="text-lg font-semibold text-gray-900">New subsection</h2>
          <UFormField label="Subsection name">
            <UInput v-model="newSubsectionName" placeholder="e.g. Draft Beers" @keydown.enter.prevent="addSubsection" />
          </UFormField>
          <div class="flex justify-end gap-2">
            <UButton color="neutral" variant="ghost" @click="showNewSubsection = false">Cancel</UButton>
            <UButton :disabled="!newSubsectionName.trim()" :loading="saving" @click="addSubsection">Add</UButton>
          </div>
        </div>
      </template>
    </UModal>

    <UModal :open="showSectionDefaultsModal" :ui="{ width: 'sm:max-w-md' }" @update:open="showSectionDefaultsModal = $event">
      <template #content>
        <div class="p-4 space-y-4">
          <h2 class="text-lg font-semibold text-gray-900">Section defaults</h2>
          <UFormField label="Waste %"><UInput v-model.number="sectionDefaultsForm.wastePercent" type="number" min="0" max="100" step="0.5" /></UFormField>
          <UFormField label="Margin (multiplier)"><UInput v-model.number="sectionDefaultsForm.marginMultiplier" type="number" min="1" step="0.1" /></UFormField>
          <UFormField label="VAT">
            <select v-model.number="sectionDefaultsForm.vatRate" class="w-full rounded border border-gray-300 px-3 py-2 text-sm">
              <option :value="9">9%</option>
              <option :value="21">21%</option>
            </select>
          </UFormField>
          <div class="flex justify-end gap-2">
            <UButton color="neutral" variant="ghost" @click="showSectionDefaultsModal = false">Cancel</UButton>
            <UButton :loading="saving" @click="saveSectionDefaults">Save</UButton>
          </div>
        </div>
      </template>
    </UModal>

    <UModal :open="showAddProducts" :ui="{ width: 'sm:max-w-lg' }" @update:open="showAddProducts = $event">
      <template #content>
        <div class="p-4 space-y-4">
          <h2 class="text-lg font-semibold text-gray-900">Add products</h2>
          <p class="text-xs text-gray-500">Search and filter, then select products to add to this subsection.</p>
          <div class="flex flex-wrap gap-2">
            <UInput
              v-model="addProductsSearch"
              placeholder="Search by name"
              class="min-w-[180px]"
              @input="debounceSearch"
            />
            <UInput
              v-model="addProductsType"
              placeholder="Product type (e.g. IPA)"
              class="min-w-[120px]"
            />
          </div>
          <div class="max-h-64 overflow-y-auto border rounded p-2 space-y-1">
            <label
              v-for="item in addProductsItemsFiltered"
              :key="item._id"
              class="flex items-center gap-2 py-1 cursor-pointer hover:bg-gray-50 rounded px-2"
            >
              <input
                v-model="addProductsSelected"
                type="checkbox"
                :value="item._id"
                class="rounded border-gray-300"
              >
              <span class="text-sm">{{ productDisplayName(item) }}</span>
            </label>
            <p v-if="addProductsItemsFiltered.length === 0" class="text-sm text-gray-500 py-2">No products to add. Import CSV/Excel first, change search, or all matching products are already in this subsection.</p>
          </div>
          <div class="flex justify-end gap-2">
            <UButton color="neutral" variant="ghost" @click="showAddProducts = false">Cancel</UButton>
            <UButton :disabled="addProductsSelectedAddable.length === 0" :loading="saving" @click="bulkAddProducts">
              Add {{ addProductsSelectedAddable.length }} product(s)
            </UButton>
          </div>
        </div>
      </template>
    </UModal>

    <div v-if="menu && selectedSubsection && !openSubsection" class="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
      <div class="flex flex-wrap items-center justify-between gap-4 mb-4">
        <h2 class="text-sm font-semibold text-gray-900">
          {{ activeSubsection?.sectionName }} – {{ activeSubsection?.subsection.name }}
        </h2>
        <NuxtLink :to="`/daily-menu-products/menu-builder-v2/${menuId}`" class="text-sm text-gray-600 hover:text-gray-900">
          Close subsection
        </NuxtLink>
      </div>

      <nav class="flex border-b border-gray-200 mb-4" aria-label="Subsection tabs">
        <NuxtLink
          :to="`/daily-menu-products/menu-builder-v2/${menuId}?subsection=${activeSubsection?.subsection.id}`"
          class="px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors"
          :class="!subsectionTabIsCalc ? 'border-primary-600 text-primary-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'"
        >
          Order / Hide
        </NuxtLink>
        <NuxtLink
          :to="`/daily-menu-products/menu-builder-v2/${menuId}?subsection=${activeSubsection?.subsection.id}&mode=calc`"
          class="px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors"
          :class="subsectionTabIsCalc ? 'border-primary-600 text-primary-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'"
        >
          Calculation
        </NuxtLink>
      </nav>

      <div v-if="!subsectionTabIsCalc" class="space-y-3">
        <p class="text-xs text-gray-500">
          Toggle “Show on Printed Menu” for items that go to the designer/print. Reorder with arrows. Edit names/descriptions in edit mode.
        </p>
        <div class="overflow-x-auto">
          <table class="min-w-full text-sm">
            <thead class="bg-gray-50">
              <tr>
                <th class="px-2 py-2 text-left font-medium text-gray-700 w-8">Order</th>
                <th class="px-2 py-2 text-left font-medium text-gray-700">Product</th>
                <th class="px-2 py-2 text-left font-medium text-gray-700">Show on Printed Menu</th>
                <th class="px-2 py-2 w-9" aria-label="Remove" />
              </tr>
            </thead>
            <tbody class="divide-y divide-gray-200">
              <tr v-for="(pid, idx) in (activeSubsection?.subsection.productIds ?? [])" :key="pid" class="align-middle">
                <td class="px-2 py-1.5">
                  <div class="flex items-center gap-0.5">
                    <button
                      type="button"
                      class="p-0.5 rounded hover:bg-gray-200 disabled:opacity-40"
                      :disabled="idx === 0"
                      @click="activeSubsection && moveProduct(activeSubsection.sectionId, activeSubsection.subsection.id, pid, -1)"
                    >
                      <UIcon name="i-lucide-chevron-up" class="size-4" />
                    </button>
                    <button
                      type="button"
                      class="p-0.5 rounded hover:bg-gray-200 disabled:opacity-40"
                      :disabled="idx === (activeSubsection?.subsection.productIds?.length ?? 0) - 1"
                      @click="activeSubsection && moveProduct(activeSubsection.sectionId, activeSubsection.subsection.id, pid, 1)"
                    >
                      <UIcon name="i-lucide-chevron-down" class="size-4" />
                    </button>
                  </div>
                </td>
                <td class="px-2 py-1.5 text-gray-900">{{ productNameForId(pid) }}</td>
                <td class="px-2 py-1.5">
                  <input
                    type="checkbox"
                    :checked="showOnPrintedFor(pid)"
                    class="rounded border-gray-300"
                    @change="onShowOnPrintedChange(pid, $event)"
                  >
                </td>
                <td class="px-2 py-1.5">
                  <button
                    type="button"
                    class="p-1 rounded text-gray-400 hover:bg-red-50 hover:text-red-600"
                    :aria-label="`Remove ${productNameForId(pid)}`"
                    @click="activeSubsection && removeProductFromSubsection(activeSubsection.sectionId, activeSubsection.subsection.id, pid)"
                  >
                    <UIcon name="i-lucide-trash-2" class="size-4" />
                  </button>
                </td>
              </tr>
              <tr v-if="!(activeSubsection?.subsection.productIds?.length)">
                <td colspan="4" class="px-2 py-4 text-center text-gray-500">No products. Use “Add products” from the section list.</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <div v-else class="space-y-3">
        <div
          v-if="activeSubsection"
          class="flex flex-wrap items-center gap-4 rounded border border-gray-200 bg-gray-50/50 px-3 py-2 text-xs text-gray-600"
        >
          <span>Waste: {{ sectionDefaults(activeSubsection.sectionId)?.defaultWastePercent ?? '–' }}%</span>
          <span>Margin: {{ sectionDefaults(activeSubsection.sectionId)?.defaultMarginMultiplier ?? '–' }}×</span>
          <span>VAT: {{ sectionDefaults(activeSubsection.sectionId)?.defaultVatRate ?? '–' }}%</span>
          <UButton size="xs" variant="ghost" @click="openSectionDefaults(activeSubsection.sectionId)">Edit defaults</UButton>
        </div>
        <p class="text-xs text-gray-500">
          Cost and margin from product data. Save to persist; Save version to create a snapshot for retrace.
        </p>
        <div class="flex gap-2">
          <UButton size="sm" :loading="saving" @click="saveMenuForSubsection">Save menu</UButton>
          <UButton size="sm" variant="outline" :loading="savingVersion" @click="saveVersion">Save version</UButton>
        </div>
        <div class="overflow-x-auto">
          <table class="min-w-full text-sm">
            <thead class="bg-gray-50">
              <tr>
                <th class="px-2 py-2 text-left font-medium text-gray-700">Product</th>
                <th class="px-2 py-2 text-right font-medium text-gray-700 whitespace-nowrap">Batch Price</th>
                <th class="px-2 py-2 text-right font-medium text-gray-700 whitespace-nowrap">Batch Size</th>
                <th class="px-2 py-2 text-right font-medium text-gray-700 whitespace-nowrap">Product Size (cl)</th>
                <template v-if="inlineTableServingSizes?.length">
                  <th class="px-2 py-2 text-right font-medium text-gray-700 whitespace-nowrap">Cost per 1cl</th>
                  <th class="px-2 py-2 text-right font-medium text-gray-700 whitespace-nowrap">Cost + waste</th>
                  <th v-for="label in inlineTableSizeLabels" :key="'nett-' + label" class="px-2 py-2 text-right font-medium text-gray-700 whitespace-nowrap">Nett ({{ label }})</th>
                  <th class="px-2 py-2 text-right font-medium text-gray-700">Margin</th>
                  <template v-for="(label, idx) in inlineTableSizeLabels" :key="'menu-' + label">
                    <th v-if="idx > 0" class="px-2 py-2 text-right font-medium text-gray-700 whitespace-nowrap">Ratio</th>
                    <th class="px-2 py-2 text-right font-medium text-gray-700 whitespace-nowrap">Menu ({{ label }})</th>
                  </template>
                </template>
                <template v-else>
                  <th v-if="activeSubsection?.subsection.defaultBatchType === 'bag'" class="px-2 py-2 text-right font-medium text-gray-700 whitespace-nowrap">Serve (gr)</th>
                  <th v-else class="px-2 py-2 text-right font-medium text-gray-700 whitespace-nowrap">Product Size (cl)</th>
                  <th class="px-2 py-2 text-right font-medium text-gray-700 whitespace-nowrap">{{ activeSubsection?.subsection.defaultBatchType === 'bag' ? 'Cost per serve' : 'Cost per item' }}</th>
                  <th class="px-2 py-2 text-right font-medium text-gray-700 whitespace-nowrap">Cost + waste</th>
                  <th class="px-2 py-2 text-right font-medium text-gray-700 whitespace-nowrap">Nett</th>
                  <th class="px-2 py-2 text-right font-medium text-gray-700">Margin</th>
                  <th class="px-2 py-2 text-right font-medium text-gray-700 whitespace-nowrap">Menu</th>
                  <template v-if="activeSubsection?.subsection.defaultBatchType !== 'crate' && activeSubsection?.subsection.defaultBatchType !== 'box' && activeSubsection?.subsection.defaultBatchType !== 'bag'">
                    <th class="px-2 py-2 text-right font-medium text-gray-700 whitespace-nowrap">Nett (50cl)</th>
                    <th class="px-2 py-2 text-right font-medium text-gray-700 whitespace-nowrap">Ratio</th>
                    <th class="px-2 py-2 text-right font-medium text-gray-700 whitespace-nowrap">Menu (50cl)</th>
                  </template>
                </template>
                <th class="px-2 py-2 text-left font-medium text-gray-700">Supplier</th>
                <th class="px-2 py-2 w-9" aria-label="Remove" />
              </tr>
            </thead>
            <tbody class="divide-y divide-gray-200">
              <tr v-for="pid in (activeSubsection?.subsection.productIds ?? [])" :key="pid" class="text-gray-700">
                <td class="px-2 py-1.5 text-left font-medium">{{ productNameForId(pid) }}</td>
                <td class="px-2 py-1 w-24">
                  <input type="text" inputmode="decimal" :value="editableCellValue(pid, 'batch')" class="w-full rounded border border-gray-300 px-1.5 py-0.5 text-right text-sm tabular-nums" @blur="(e) => onEditableBlur(pid, 'batch', getInputValue(e))">
                </td>
                <td class="px-2 py-1 w-20">
                  <input type="text" inputmode="numeric" :value="editableCellValue(pid, 'items')" class="w-full rounded border border-gray-300 px-1.5 py-0.5 text-right text-sm tabular-nums" @blur="(e) => onEditableBlur(pid, 'items', getInputValue(e))">
                </td>
                <td v-if="subsectionCalcRows[pid]?.servingSizesCl?.length" class="px-2 py-1 w-20">
                  <input type="text" inputmode="numeric" :value="editableCellValue(pid, 'productSizeCl')" class="w-full rounded border border-gray-300 px-1.5 py-0.5 text-right text-sm tabular-nums" placeholder="25" @blur="(e) => onEditableBlur(pid, 'productSizeCl', getInputValue(e))">
                </td>
                <template v-if="subsectionCalcRows[pid]?.servingSizesCl?.length">
                  <td class="px-2 py-1.5 text-right tabular-nums">{{ calcRowForProduct(pid)?.costPer1Cl ?? '–' }}</td>
                  <td class="px-2 py-1.5 text-right tabular-nums">{{ calcRowForProduct(pid)?.costPlusWaste ?? '–' }}</td>
                  <td v-for="(nett, i) in (calcRowForProduct(pid)?.nettPerSize ?? [])" :key="pid + '-n-' + i" class="px-2 py-1.5 text-right tabular-nums">€ {{ nett ?? '–' }}</td>
                  <td class="px-2 py-1.5 text-right tabular-nums">{{ calcRowForProduct(pid)?.marginFinal ?? '–' }}×</td>
                  <template v-for="(_, i) in (subsectionCalcRows[pid]?.menuPricePerSize ?? [])" :key="pid + '-m-' + i">
                    <td v-if="i > 0" class="px-2 py-1 w-20">
                      <input type="text" inputmode="decimal" :value="i === 1 ? editableCellValue(pid, 'ratio1to2') : editableCellValue(pid, 'ratio2to3')" class="w-full rounded border border-gray-300 px-1.5 py-0.5 text-right text-sm tabular-nums" @blur="(e) => onEditableBlur(pid, i === 1 ? 'ratio1to2' : 'ratio2to3', getInputValue(e))">
                    </td>
                    <td class="px-2 py-1 w-24">
                      <input type="text" inputmode="decimal" :value="editableCellValue(pid, i === 0 ? 'menuPrice1' : i === 1 ? 'menuPrice2' : 'menuPrice3')" class="w-full rounded border border-gray-300 px-1.5 py-0.5 text-right text-sm tabular-nums" @blur="(e) => onEditableBlur(pid, i === 0 ? 'menuPrice1' : i === 1 ? 'menuPrice2' : 'menuPrice3', getInputValue(e))">
                    </td>
                  </template>
                </template>
                <template v-else>
                  <template v-if="activeSubsection?.subsection.defaultBatchType === 'bag'">
                    <td class="px-2 py-1 w-20">
                      <input type="text" inputmode="numeric" :value="editableCellValue(pid, 'productSizeCl')" class="w-full rounded border border-gray-300 px-1.5 py-0.5 text-right text-sm tabular-nums" placeholder="8" @blur="(e) => onEditableBlur(pid, 'productSizeCl', getInputValue(e))">
                    </td>
                  </template>
                  <td v-else class="px-2 py-1 w-20">
                    <input type="text" inputmode="numeric" :value="editableCellValue(pid, 'productSizeCl')" class="w-full rounded border border-gray-300 px-1.5 py-0.5 text-right text-sm tabular-nums" placeholder="25" @blur="(e) => onEditableBlur(pid, 'productSizeCl', getInputValue(e))">
                  </td>
                  <td class="px-2 py-1.5 text-right tabular-nums">{{ calcRowForProduct(pid)?.costPerItem ?? '–' }}</td>
                  <td class="px-2 py-1.5 text-right tabular-nums">{{ calcRowForProduct(pid)?.costPlusWaste ?? '–' }}</td>
                  <td class="px-2 py-1.5 text-right tabular-nums">€ {{ calcRowForProduct(pid)?.nettSmall ?? calcRowForProduct(pid)?.nett ?? '–' }}</td>
                  <td class="px-2 py-1.5 text-right tabular-nums">{{ calcRowForProduct(pid)?.marginFinal ?? '–' }}×</td>
                  <td class="px-2 py-1 w-24">
                    <input type="text" inputmode="decimal" :value="editableCellValue(pid, 'menuPriceFinal')" class="w-full rounded border border-gray-300 px-1.5 py-0.5 text-right text-sm tabular-nums" @blur="(e) => onEditableBlur(pid, 'menuPriceFinal', getInputValue(e))">
                  </td>
                  <template v-if="activeSubsection?.subsection.defaultBatchType !== 'crate' && activeSubsection?.subsection.defaultBatchType !== 'box' && activeSubsection?.subsection.defaultBatchType !== 'bag'">
                    <td class="px-2 py-1.5 text-right tabular-nums">€ {{ calcRowForProduct(pid)?.nettLarge ?? '–' }}</td>
                    <td class="px-2 py-1 w-20">
                      <input type="text" inputmode="decimal" :value="editableCellValue(pid, 'ratio')" class="w-full rounded border border-gray-300 px-1.5 py-0.5 text-right text-sm tabular-nums" placeholder="–" @blur="(e) => onEditableBlur(pid, 'ratio', getInputValue(e))">
                    </td>
                    <td class="px-2 py-1 w-24">
                      <input type="text" inputmode="decimal" :value="editableCellValue(pid, 'menuPriceFinalLarge')" class="w-full rounded border border-gray-300 px-1.5 py-0.5 text-right text-sm tabular-nums" @blur="(e) => onEditableBlur(pid, 'menuPriceFinalLarge', getInputValue(e))">
                    </td>
                  </template>
                </template>
                <td class="px-2 py-1 min-w-[100px]">
                  <input type="text" :value="editableCellValue(pid, 'supplier')" class="w-full rounded border border-gray-300 px-1.5 py-0.5 text-left text-sm" @blur="(e) => onEditableBlur(pid, 'supplier', getInputValue(e))">
                </td>
                <td class="px-2 py-1.5">
                  <button type="button" class="p-1 rounded text-gray-400 hover:bg-red-50 hover:text-red-600" :aria-label="`Remove ${productNameForId(pid)}`" @click="activeSubsection && removeProductFromSubsection(activeSubsection.sectionId, activeSubsection.subsection.id, pid)">
                    <UIcon name="i-lucide-trash-2" class="size-4" />
                  </button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <p v-if="!(activeSubsection?.subsection.productIds?.length)" class="text-sm text-gray-500 text-center py-4">
          Add sections and products to see calculations.
        </p>
      </div>
    </div>

    <Teleport to="body">
      <div
        v-if="showBulkCalc"
        class="fixed inset-0 z-50 flex flex-col bg-white overflow-auto"
      >
        <div class="sticky top-0 z-10 flex items-center justify-between gap-4 border-b border-gray-200 bg-white px-6 py-4 shadow-sm">
          <h2 class="text-lg font-semibold text-gray-900">Bulk Calculation</h2>
          <UButton variant="outline" @click="closeBulkCalculation">Close</UButton>
        </div>
        <p class="px-6 py-2 text-xs text-gray-500">
          Changes are saved as you edit. Closing syncs the latest state.
        </p>
        <div class="flex-1 overflow-auto px-6 pb-8 space-y-6">
          <div
            v-for="item in bulkSubsectionsFlat"
            :key="item.subsectionId"
            class="rounded-lg border border-gray-200 bg-white p-4 shadow-sm"
          >
            <h3 class="text-base font-semibold text-gray-900 mb-3">
              {{ item.sectionName }} – {{ item.subsectionName }}
            </h3>
            <div class="flex flex-wrap items-center gap-4 mb-4">
              <label class="flex items-center gap-2 text-sm text-gray-600">
                <span>Waste %</span>
                <input
                  type="text"
                  inputmode="decimal"
                  :value="subsectionWaste(item.sectionId, item.subsection)"
                  class="w-20 rounded border border-gray-300 px-2 py-1.5 text-right text-sm tabular-nums"
                  @blur="(e) => onSubsectionWasteBlur(item.sectionId, item.subsectionId, item.subsection, getInputValue(e))"
                >
              </label>
              <label class="flex items-center gap-2 text-sm text-gray-600">
                <span>Margin</span>
                <input
                  type="text"
                  inputmode="decimal"
                  :value="subsectionMargin(item.sectionId, item.subsection)"
                  class="w-20 rounded border border-gray-300 px-2 py-1.5 text-right text-sm tabular-nums"
                  @blur="(e) => onSubsectionMarginBlur(item.sectionId, item.subsectionId, item.subsection, getInputValue(e))"
                >
              </label>
              <label class="flex items-center gap-2 text-sm text-gray-600">
                <span>Batch type</span>
                <select
                  :value="item.subsection.defaultBatchType ?? ''"
                  class="rounded border border-gray-300 px-2 py-1.5 text-sm bg-white min-w-[6rem]"
                  @change="(e) => onSubsectionDefaultBatchTypeChange(item.sectionId, item.subsectionId, (e.target as HTMLSelectElement).value)"
                >
                  <option v-for="opt in BATCH_TYPE_DEFAULT_OPTIONS" :key="opt.value" :value="opt.value">{{ opt.label }}</option>
                </select>
              </label>
              <template v-if="item.subsection.defaultBatchType === 'fust'">
                <label class="flex items-center gap-2 text-sm text-gray-600">
                  <span>Sizes</span>
                  <select
                    :value="subsectionServingLabelStyle(item.subsection)"
                    class="rounded border border-gray-300 px-2 py-1.5 text-sm bg-white"
                    @change="(e) => onSubsectionServingLabelStyleChange(item.sectionId, item.subsectionId, (e.target as HTMLSelectElement).value as ServingSizeLabelStyle)"
                  >
                    <option v-for="opt in SERVING_LABEL_OPTIONS" :key="opt.value" :value="opt.value">{{ opt.label }}</option>
                  </select>
                </label>
                <label class="flex items-center gap-1 text-sm text-gray-600">
                  <span>1 (cl)</span>
                  <input type="text" inputmode="numeric" :value="item.subsection.servingSize1Cl != null ? String(item.subsection.servingSize1Cl) : ''" class="w-14 rounded border border-gray-300 px-2 py-1.5 text-right text-sm tabular-nums" placeholder="–" @blur="(e) => onSubsectionServingSizeBlur(item.sectionId, item.subsectionId, item.subsection, 1, getInputValue(e))">
                </label>
                <label class="flex items-center gap-1 text-sm text-gray-600">
                  <span>2 (cl)</span>
                  <input type="text" inputmode="numeric" :value="item.subsection.servingSize2Cl != null ? String(item.subsection.servingSize2Cl) : ''" class="w-14 rounded border border-gray-300 px-2 py-1.5 text-right text-sm tabular-nums" placeholder="–" @blur="(e) => onSubsectionServingSizeBlur(item.sectionId, item.subsectionId, item.subsection, 2, getInputValue(e))">
                </label>
                <label class="flex items-center gap-1 text-sm text-gray-600">
                  <span>3 (cl)</span>
                  <input type="text" inputmode="numeric" :value="item.subsection.servingSize3Cl != null ? String(item.subsection.servingSize3Cl) : ''" class="w-14 rounded border border-gray-300 px-2 py-1.5 text-right text-sm tabular-nums" placeholder="–" @blur="(e) => onSubsectionServingSizeBlur(item.sectionId, item.subsectionId, item.subsection, 3, getInputValue(e))">
                </label>
              </template>
              <label v-else-if="item.subsection.defaultBatchType === 'bag'" class="flex items-center gap-2 text-sm text-gray-600">
                <span>Default serve (gr)</span>
                <input type="text" inputmode="numeric" :value="item.subsection.defaultServeGr != null ? String(item.subsection.defaultServeGr) : ''" class="w-14 rounded border border-gray-300 px-2 py-1.5 text-right text-sm tabular-nums" placeholder="8" @blur="(e) => onSubsectionDefaultServeGrBlur(item.sectionId, item.subsectionId, getInputValue(e))">
              </label>
              <template v-else-if="item.subsection.defaultBatchType === 'bottle'">
                <label class="flex items-center gap-1 text-sm text-gray-600">
                  <span>S (cl)</span>
                  <input type="text" inputmode="numeric" :value="item.subsection.servingSize1Cl != null ? String(item.subsection.servingSize1Cl) : ''" class="w-14 rounded border border-gray-300 px-2 py-1.5 text-right text-sm tabular-nums" placeholder="–" @blur="(e) => onSubsectionServingSizeBlur(item.sectionId, item.subsectionId, item.subsection, 1, getInputValue(e))">
                </label>
                <label class="flex items-center gap-1 text-sm text-gray-600">
                  <span>L (cl)</span>
                  <input type="text" inputmode="numeric" :value="item.subsection.servingSize2Cl != null ? String(item.subsection.servingSize2Cl) : ''" class="w-14 rounded border border-gray-300 px-2 py-1.5 text-right text-sm tabular-nums" placeholder="50" @blur="(e) => onSubsectionServingSizeBlur(item.sectionId, item.subsectionId, item.subsection, 2, getInputValue(e))">
                </label>
              </template>
            </div>
            <div class="overflow-x-auto">
              <table class="min-w-full text-sm">
                <thead class="bg-gray-50">
                  <tr class="border-b border-gray-200">
                    <th class="px-2 py-1.5 text-left font-medium text-gray-600 align-bottom">Product</th>
                    <th v-if="bulkColumnGroups.batch" colspan="3" class="px-2 py-1.5 text-left align-bottom">
                      <button type="button" class="flex items-center gap-1 rounded px-2 py-0.5 text-xs font-medium text-gray-700 hover:bg-gray-200" @click="toggleBulkColumnGroup('batch')" title="Hide group">
                        Batch & Product Sizes
                        <UIcon name="i-lucide-chevron-up" class="size-3.5" />
                      </button>
                    </th>
                    <th v-else class="px-2 py-1.5 text-left align-bottom">
                      <button type="button" class="rounded px-2 py-0.5 text-xs text-gray-500 hover:bg-gray-200 hover:text-gray-700" @click="toggleBulkColumnGroup('batch')">
                        + Batch & Product Sizes
                      </button>
                    </th>
                    <th v-if="bulkColumnGroups.cost" :colspan="subsectionUsesDraftTable(item.subsection) ? 2 + (getSubsectionServingSizes(item.subsection)?.length ?? 0) : 4" class="px-2 py-1.5 text-left align-bottom">
                      <button type="button" class="flex items-center gap-1 rounded px-2 py-0.5 text-xs font-medium text-gray-700 hover:bg-gray-200" @click="toggleBulkColumnGroup('cost')" title="Hide group">
                        Cost of Sales (Inkoop)
                        <UIcon name="i-lucide-chevron-up" class="size-3.5" />
                      </button>
                    </th>
                    <th v-else class="px-2 py-1.5 text-left align-bottom">
                      <button type="button" class="rounded px-2 py-0.5 text-xs text-gray-500 hover:bg-gray-200 hover:text-gray-700" @click="toggleBulkColumnGroup('cost')">
                        + Cost of Sales
                      </button>
                    </th>
                    <th v-if="bulkColumnGroups.menu" :colspan="subsectionUsesDraftTable(item.subsection) ? 1 + 2 * (getSubsectionServingSizes(item.subsection)?.length ?? 0) : 4" class="px-2 py-1.5 text-left align-bottom">
                      <button type="button" class="flex items-center gap-1 rounded px-2 py-0.5 text-xs font-medium text-gray-700 hover:bg-gray-200" @click="toggleBulkColumnGroup('menu')" title="Hide group">
                        Menu Pricing
                        <UIcon name="i-lucide-chevron-up" class="size-3.5" />
                      </button>
                    </th>
                    <th v-else class="px-2 py-1.5 text-left align-bottom">
                      <button type="button" class="rounded px-2 py-0.5 text-xs text-gray-500 hover:bg-gray-200 hover:text-gray-700" @click="toggleBulkColumnGroup('menu')">
                        + Menu Pricing
                      </button>
                    </th>
                    <th class="px-2 py-1.5 text-left font-medium text-gray-600 align-bottom">Supplier</th>
                    <th class="px-2 py-1.5 w-9 align-bottom" aria-label="Remove" />
                  </tr>
                  <tr class="bg-gray-50/80">
                    <th class="px-2 py-2 text-left font-medium text-gray-700">Product</th>
                    <template v-if="bulkColumnGroups.batch">
                      <th class="px-2 py-2 text-right font-medium text-gray-700 whitespace-nowrap">Batch Price</th>
                      <th class="px-2 py-2 text-right font-medium text-gray-700 whitespace-nowrap">Batch Size</th>
                      <th v-if="item.subsection.defaultBatchType === 'bag'" class="px-2 py-2 text-right font-medium text-gray-700 whitespace-nowrap">Serve (gr)</th>
                      <th v-else class="px-2 py-2 text-right font-medium text-gray-700 whitespace-nowrap">Product Size (cl)</th>
                    </template>
                    <th v-else class="px-2 py-2 w-0" />
                    <template v-if="bulkColumnGroups.cost">
                      <template v-if="subsectionUsesDraftTable(item.subsection)">
                        <th class="px-2 py-2 text-right font-medium text-gray-700 whitespace-nowrap">Cost per 1cl</th>
                        <th class="px-2 py-2 text-right font-medium text-gray-700 whitespace-nowrap">Cost + waste</th>
                        <th v-for="label in getServingSizeHeaderLabels(item.subsection)" :key="'bulk-n-' + label" class="px-2 py-2 text-right font-medium text-gray-700 whitespace-nowrap">Nett ({{ label }})</th>
                      </template>
                      <template v-else>
                        <th class="px-2 py-2 text-right font-medium text-gray-700 whitespace-nowrap">{{ item.subsection.defaultBatchType === 'bag' ? 'Cost per serve' : 'Cost per item' }}</th>
                        <th class="px-2 py-2 text-right font-medium text-gray-700 whitespace-nowrap">Cost + waste</th>
                        <th class="px-2 py-2 text-right font-medium text-gray-700 whitespace-nowrap">Nett</th>
                        <th v-if="item.subsection.defaultBatchType !== 'crate' && item.subsection.defaultBatchType !== 'box' && item.subsection.defaultBatchType !== 'bag'" class="px-2 py-2 text-right font-medium text-gray-700 whitespace-nowrap">Nett (50cl)</th>
                      </template>
                    </template>
                    <th v-else class="px-2 py-2 w-0" />
                    <template v-if="bulkColumnGroups.menu">
                      <th class="px-2 py-2 text-right font-medium text-gray-700">Margin</th>
                      <template v-if="subsectionUsesDraftTable(item.subsection)">
                        <template v-for="(label, idx) in getServingSizeHeaderLabels(item.subsection)" :key="'bulk-m-' + label">
                          <th v-if="idx > 0" class="px-2 py-2 text-right font-medium text-gray-700 whitespace-nowrap">Ratio</th>
                          <th class="px-2 py-2 text-right font-medium text-gray-700 whitespace-nowrap">Menu ({{ label }})</th>
                        </template>
                      </template>
                      <template v-else>
                        <th class="px-2 py-2 text-right font-medium text-gray-700 whitespace-nowrap">Menu</th>
                        <template v-if="item.subsection.defaultBatchType !== 'crate' && item.subsection.defaultBatchType !== 'box' && item.subsection.defaultBatchType !== 'bag'">
                          <th class="px-2 py-2 text-right font-medium text-gray-700 whitespace-nowrap">Ratio</th>
                          <th class="px-2 py-2 text-right font-medium text-gray-700 whitespace-nowrap">Menu (50cl)</th>
                        </template>
                      </template>
                    </template>
                    <th v-else class="px-2 py-2 w-0" />
                    <th class="px-2 py-2 text-left font-medium text-gray-700">Supplier</th>
                    <th class="px-2 py-2 w-9" aria-label="Remove" />
                  </tr>
                </thead>
                <tbody class="divide-y divide-gray-200">
                  <tr
                    v-for="r in item.products"
                    :key="r.rowKey"
                    class="text-gray-700"
                  >
                    <td class="px-2 py-1.5 font-medium">{{ productDisplayNameForRow(r.productId, r.subsection) }}</td>
                    <template v-if="bulkColumnGroups.batch">
                      <td class="px-2 py-1 w-24">
                        <input type="text" inputmode="decimal" :value="bulkEditableCellValue(r.rowKey, 'batch')" class="w-full rounded border border-gray-300 px-1.5 py-0.5 text-right text-sm tabular-nums" @blur="(e) => onBulkEditableBlur(r.sectionId, r.subsectionId, r.productId, 'batch', getInputValue(e))">
                      </td>
                      <td class="px-2 py-1 w-20">
                        <input type="text" inputmode="numeric" :value="bulkEditableCellValue(r.rowKey, 'items')" class="w-full rounded border border-gray-300 px-1.5 py-0.5 text-right text-sm tabular-nums" @blur="(e) => onBulkEditableBlur(r.sectionId, r.subsectionId, r.productId, 'items', getInputValue(e))">
                      </td>
                      <td v-if="item.subsection.defaultBatchType === 'bag'" class="px-2 py-1 w-20">
                        <input type="text" inputmode="numeric" :value="bulkEditableCellValue(r.rowKey, 'productSizeCl')" class="w-full rounded border border-gray-300 px-1.5 py-0.5 text-right text-sm tabular-nums" placeholder="8" @blur="(e) => onBulkEditableBlur(r.sectionId, r.subsectionId, r.productId, 'productSizeCl', getInputValue(e))">
                      </td>
                      <td v-else class="px-2 py-1 w-20">
                        <input type="text" inputmode="numeric" :value="bulkEditableCellValue(r.rowKey, 'productSizeCl')" class="w-full rounded border border-gray-300 px-1.5 py-0.5 text-right text-sm tabular-nums" placeholder="25" @blur="(e) => onBulkEditableBlur(r.sectionId, r.subsectionId, r.productId, 'productSizeCl', getInputValue(e))">
                      </td>
                    </template>
                    <td v-else class="px-0 py-1 w-0" />
                    <template v-if="bulkColumnGroups.cost">
                      <template v-if="bulkCalcRows[r.rowKey]?.servingSizesCl?.length">
                        <td class="px-2 py-1.5 text-right tabular-nums">{{ bulkCalcRowFormatted(r.rowKey)?.costPer1Cl ?? '–' }}</td>
                        <td class="px-2 py-1.5 text-right tabular-nums">{{ bulkCalcRowFormatted(r.rowKey)?.costPlusWaste ?? '–' }}</td>
                        <td v-for="(nett, i) in (bulkCalcRowFormatted(r.rowKey)?.nettPerSize ?? [])" :key="r.rowKey + '-bn-' + i" class="px-2 py-1.5 text-right tabular-nums">€ {{ nett ?? '–' }}</td>
                      </template>
                      <template v-else>
                        <td class="px-2 py-1.5 text-right tabular-nums">{{ bulkCalcRowFormatted(r.rowKey)?.costPerItem ?? '–' }}</td>
                        <td class="px-2 py-1.5 text-right tabular-nums">{{ bulkCalcRowFormatted(r.rowKey)?.costPlusWaste ?? '–' }}</td>
                        <td class="px-2 py-1.5 text-right tabular-nums">{{ bulkCalcRowFormatted(r.rowKey)?.nettSmall ?? bulkCalcRowFormatted(r.rowKey)?.nett ?? '–' }}</td>
                        <td v-if="item.subsection.defaultBatchType !== 'crate' && item.subsection.defaultBatchType !== 'box' && item.subsection.defaultBatchType !== 'bag'" class="px-2 py-1.5 text-right tabular-nums">{{ bulkCalcRowFormatted(r.rowKey)?.nettLarge ?? '–' }}</td>
                      </template>
                    </template>
                    <td v-else class="px-0 py-1 w-0" />
                    <template v-if="bulkColumnGroups.menu">
                      <td class="px-2 py-1.5 text-right tabular-nums">{{ bulkCalcRowFormatted(r.rowKey)?.marginFinal ?? '–' }}</td>
                      <template v-if="bulkCalcRows[r.rowKey]?.servingSizesCl?.length">
                        <template v-for="(_, i) in (bulkCalcRows[r.rowKey]?.menuPricePerSize ?? [])" :key="r.rowKey + '-bm-' + i">
                          <td v-if="i > 0" class="px-2 py-1 w-20">
                            <input type="text" inputmode="decimal" :value="i === 1 ? bulkEditableCellValue(r.rowKey, 'ratio1to2') : bulkEditableCellValue(r.rowKey, 'ratio2to3')" class="w-full rounded border border-gray-300 px-1.5 py-0.5 text-right text-sm tabular-nums" @blur="(e) => onBulkEditableBlur(r.sectionId, r.subsectionId, r.productId, i === 1 ? 'ratio1to2' : 'ratio2to3', getInputValue(e))">
                          </td>
                          <td class="px-2 py-1 w-24">
                            <input type="text" inputmode="decimal" :value="bulkEditableCellValue(r.rowKey, i === 0 ? 'menuPrice1' : i === 1 ? 'menuPrice2' : 'menuPrice3')" class="w-full rounded border border-gray-300 px-1.5 py-0.5 text-right text-sm tabular-nums" @blur="(e) => onBulkEditableBlur(r.sectionId, r.subsectionId, r.productId, i === 0 ? 'menuPrice1' : i === 1 ? 'menuPrice2' : 'menuPrice3', getInputValue(e))">
                          </td>
                        </template>
                      </template>
                      <template v-else>
                        <td class="px-2 py-1 w-24">
                          <input type="text" inputmode="decimal" :value="bulkEditableCellValue(r.rowKey, 'menuPriceFinal')" class="w-full rounded border border-gray-300 px-1.5 py-0.5 text-right text-sm tabular-nums" @blur="(e) => onBulkEditableBlur(r.sectionId, r.subsectionId, r.productId, 'menuPriceFinal', getInputValue(e))">
                        </td>
                        <template v-if="item.subsection.defaultBatchType !== 'crate' && item.subsection.defaultBatchType !== 'box' && item.subsection.defaultBatchType !== 'bag'">
                          <td class="px-2 py-1 w-20">
                            <input type="text" inputmode="decimal" :value="bulkEditableCellValue(r.rowKey, 'ratio')" class="w-full rounded border border-gray-300 px-1.5 py-0.5 text-right text-sm tabular-nums" placeholder="–" @blur="(e) => onBulkEditableBlur(r.sectionId, r.subsectionId, r.productId, 'ratio', getInputValue(e))">
                          </td>
                          <td class="px-2 py-1 w-24">
                            <input type="text" inputmode="decimal" :value="bulkEditableCellValue(r.rowKey, 'menuPriceFinalLarge')" class="w-full rounded border border-gray-300 px-1.5 py-0.5 text-right text-sm tabular-nums" @blur="(e) => onBulkEditableBlur(r.sectionId, r.subsectionId, r.productId, 'menuPriceFinalLarge', getInputValue(e))">
                          </td>
                        </template>
                      </template>
                    </template>
                    <td v-else class="px-0 py-1 w-0" />
                    <td class="px-2 py-1 min-w-[100px]">
                      <input type="text" :value="bulkEditableCellValue(r.rowKey, 'supplier')" class="w-full rounded border border-gray-300 px-1.5 py-0.5 text-left text-sm" @blur="(e) => onBulkEditableBlur(r.sectionId, r.subsectionId, r.productId, 'supplier', getInputValue(e))">
                    </td>
                    <td class="px-2 py-1.5">
                      <button type="button" class="p-1 rounded text-gray-400 hover:bg-red-50 hover:text-red-600" :aria-label="`Remove ${productDisplayNameForRow(r.productId, r.subsection)}`" @click="removeProductFromSubsection(r.sectionId, r.subsectionId, r.productId)">
                        <UIcon name="i-lucide-trash-2" class="size-4" />
                      </button>
                    </td>
                  </tr>
                  <tr v-if="bulkSubsectionAveragesMap[item.sectionId + '-' + item.subsectionId]" class="bg-gray-100 font-medium text-gray-800">
                    <td class="px-2 py-2">Average</td>
                    <template v-if="bulkColumnGroups.batch"><td colspan="3" class="px-2 py-2" /></template>
                    <td v-else class="px-0 py-2 w-0" />
                    <template v-if="bulkColumnGroups.cost">
                      <template v-if="subsectionUsesDraftTable(item.subsection)">
                        <td :colspan="2 + (getSubsectionServingSizes(item.subsection)?.length ?? 0)" class="px-2 py-2 text-right tabular-nums">{{ bulkSubsectionAveragesMap[item.sectionId + '-' + item.subsectionId].costPlusWaste }}</td>
                      </template>
                      <template v-else>
                        <td class="px-2 py-2 text-right tabular-nums">{{ bulkSubsectionAveragesMap[item.sectionId + '-' + item.subsectionId].costPerItem }}</td>
                        <td class="px-2 py-2 text-right tabular-nums">{{ bulkSubsectionAveragesMap[item.sectionId + '-' + item.subsectionId].costPlusWaste }}</td>
                        <td class="px-2 py-2 text-right tabular-nums">{{ bulkSubsectionAveragesMap[item.sectionId + '-' + item.subsectionId].nett }}</td>
                        <td class="px-2 py-2 text-right tabular-nums">{{ bulkSubsectionAveragesMap[item.sectionId + '-' + item.subsectionId].nett }}</td>
                      </template>
                    </template>
                    <td v-else class="px-0 py-2 w-0" />
                    <template v-if="bulkColumnGroups.menu"><td :colspan="subsectionUsesDraftTable(item.subsection) ? 1 + 2 * (getSubsectionServingSizes(item.subsection)?.length ?? 0) : 4" class="px-2 py-2" /></template>
                    <td v-else class="px-0 py-2 w-0" />
                    <td colspan="2" class="px-2 py-2" />
                  </tr>
                  <tr v-else-if="!item.products.length" class="text-gray-500">
                    <td :colspan="bulkVisibleColumnCount" class="px-2 py-4 text-center">No products in this subsection.</td>
                  </tr>
                </tbody>
              </table>
            </div>
            <div class="mt-2 flex flex-wrap items-center gap-2 text-xs text-gray-500">
              <span>Show columns:</span>
              <button
                type="button"
                class="rounded px-2 py-0.5 font-medium"
                :class="bulkColumnGroups.batch ? 'bg-gray-200 text-gray-800' : 'bg-gray-100 text-gray-500 hover:bg-gray-150'"
                @click="toggleBulkColumnGroup('batch')"
              >
                {{ bulkColumnGroups.batch ? '✓' : '' }} Batch & Product Sizes
              </button>
              <button
                type="button"
                class="rounded px-2 py-0.5 font-medium"
                :class="bulkColumnGroups.cost ? 'bg-gray-200 text-gray-800' : 'bg-gray-100 text-gray-500 hover:bg-gray-150'"
                @click="toggleBulkColumnGroup('cost')"
              >
                {{ bulkColumnGroups.cost ? '✓' : '' }} Cost of Sales
              </button>
              <button
                type="button"
                class="rounded px-2 py-0.5 font-medium"
                :class="bulkColumnGroups.menu ? 'bg-gray-200 text-gray-800' : 'bg-gray-100 text-gray-500 hover:bg-gray-150'"
                @click="toggleBulkColumnGroup('menu')"
              >
                {{ bulkColumnGroups.menu ? '✓' : '' }} Menu Pricing
              </button>
            </div>
          </div>
          <p v-if="!bulkSubsectionsFlat.length" class="text-sm text-gray-500 text-center py-8">No sections or subsections yet.</p>
        </div>
      </div>
    </Teleport>

    <Teleport to="body">
      <div
        v-if="openSubsection && activeSubsection"
        class="fixed inset-0 z-50 flex flex-col bg-white overflow-auto"
      >
        <div class="sticky top-0 z-10 flex items-center justify-between gap-4 border-b border-gray-200 bg-white px-6 py-4 shadow-sm">
          <h2 class="text-lg font-semibold text-gray-900">{{ activeSubsection.sectionName }} – {{ activeSubsection.subsection.name }}</h2>
          <UButton variant="outline" @click="closeSubsectionModal">Close</UButton>
        </div>
        <div class="flex-1 overflow-auto px-6 py-4 space-y-4">
          <nav class="flex border-b border-gray-200 -mx-6 px-6" aria-label="Subsection tabs">
            <button
              type="button"
              class="px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors"
              :class="subsectionModalTab === 'order' ? 'border-primary-600 text-primary-600' : 'border-transparent text-gray-500 hover:text-gray-700'"
              @click="subsectionModalTab = 'order'"
            >
              Order / Hide
            </button>
            <button
              type="button"
              class="px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors"
              :class="subsectionModalTab === 'calc' ? 'border-primary-600 text-primary-600' : 'border-transparent text-gray-500 hover:text-gray-700'"
              @click="subsectionModalTab = 'calc'"
            >
              Calculation
            </button>
          </nav>
          <div v-if="subsectionModalTab === 'order'" class="space-y-3">
            <p class="text-xs text-gray-500">Toggle “Show on Printed Menu”, reorder with arrows.</p>
            <div class="overflow-x-auto">
              <table class="min-w-full text-sm">
                <thead class="bg-gray-50"><tr><th class="px-2 py-2 text-left font-medium text-gray-700 w-8">Order</th><th class="px-2 py-2 text-left font-medium text-gray-700">Product</th><th class="px-2 py-2 text-left font-medium text-gray-700">Show on Printed</th><th class="px-2 py-2 w-9" aria-label="Remove" /></tr></thead>
                <tbody class="divide-y divide-gray-200">
                  <tr v-for="(pid, idx) in (activeSubsection.subsection.productIds ?? [])" :key="pid" class="align-middle">
                    <td class="px-2 py-1.5">
                      <div class="flex items-center gap-0.5">
                        <button type="button" class="p-0.5 rounded hover:bg-gray-200 disabled:opacity-40" :disabled="idx === 0" @click="activeSubsection && moveProduct(activeSubsection.sectionId, activeSubsection.subsection.id, pid, -1)"><UIcon name="i-lucide-chevron-up" class="size-4" /></button>
                        <button type="button" class="p-0.5 rounded hover:bg-gray-200 disabled:opacity-40" :disabled="idx === (activeSubsection?.subsection.productIds?.length ?? 0) - 1" @click="activeSubsection && moveProduct(activeSubsection.sectionId, activeSubsection.subsection.id, pid, 1)"><UIcon name="i-lucide-chevron-down" class="size-4" /></button>
                      </div>
                    </td>
                    <td class="px-2 py-1.5">{{ productNameForId(pid) }}</td>
                    <td class="px-2 py-1.5"><input type="checkbox" :checked="showOnPrintedFor(pid)" class="rounded border-gray-300" @change="onShowOnPrintedChange(pid, $event)"></td>
                    <td class="px-2 py-1.5"><button type="button" class="p-1 rounded text-gray-400 hover:bg-red-50 hover:text-red-600" @click="activeSubsection && removeProductFromSubsection(activeSubsection.sectionId, activeSubsection.subsection.id, pid)"><UIcon name="i-lucide-trash-2" class="size-4" /></button></td>
                  </tr>
                  <tr v-if="!(activeSubsection?.subsection.productIds?.length)"><td colspan="4" class="px-2 py-4 text-center text-gray-500">No products.</td></tr>
                </tbody>
              </table>
            </div>
          </div>
          <div v-else class="space-y-3">
            <div class="flex flex-wrap items-center gap-4 rounded border border-gray-200 bg-gray-50/50 px-3 py-2 text-xs text-gray-600">
              <span>Waste: {{ sectionDefaults(activeSubsection.sectionId)?.defaultWastePercent ?? '–' }}%</span>
              <span>Margin: {{ sectionDefaults(activeSubsection.sectionId)?.defaultMarginMultiplier ?? '–' }}×</span>
              <span>VAT: {{ sectionDefaults(activeSubsection.sectionId)?.defaultVatRate ?? '–' }}%</span>
              <UButton size="xs" variant="ghost" @click="openSectionDefaults(activeSubsection.sectionId)">Edit defaults</UButton>
            </div>
            <div class="flex flex-wrap items-center gap-4 text-sm text-gray-600">
              <label class="flex items-center gap-2">
                <span>Batch type</span>
                <select
                  :value="activeSubsection.subsection.defaultBatchType ?? ''"
                  class="rounded border border-gray-300 px-2 py-1.5 text-sm bg-white min-w-[6rem]"
                  @change="(e) => onSubsectionDefaultBatchTypeChange(activeSubsection.sectionId, activeSubsection.subsection.id, (e.target as HTMLSelectElement).value)"
                >
                  <option v-for="opt in BATCH_TYPE_DEFAULT_OPTIONS" :key="opt.value" :value="opt.value">{{ opt.label }}</option>
                </select>
              </label>
              <template v-if="activeSubsection.subsection.defaultBatchType === 'fust'">
                <label class="flex items-center gap-2">
                  <span>Sizes</span>
                  <select
                    :value="subsectionServingLabelStyle(activeSubsection.subsection)"
                    class="rounded border border-gray-300 px-2 py-1.5 text-sm bg-white"
                    @change="(e) => onSubsectionServingLabelStyleChange(activeSubsection.sectionId, activeSubsection.subsection.id, (e.target as HTMLSelectElement).value as ServingSizeLabelStyle)"
                  >
                    <option v-for="opt in SERVING_LABEL_OPTIONS" :key="opt.value" :value="opt.value">{{ opt.label }}</option>
                  </select>
                </label>
                <label class="flex items-center gap-1">
                  <span>1 (cl)</span>
                  <input type="text" inputmode="numeric" :value="activeSubsection.subsection.servingSize1Cl != null ? String(activeSubsection.subsection.servingSize1Cl) : ''" class="w-14 rounded border border-gray-300 px-2 py-1.5 text-right text-sm tabular-nums" placeholder="–" @blur="(e) => onSubsectionServingSizeBlur(activeSubsection.sectionId, activeSubsection.subsection.id, activeSubsection.subsection, 1, getInputValue(e))">
                </label>
                <label class="flex items-center gap-1">
                  <span>2 (cl)</span>
                  <input type="text" inputmode="numeric" :value="activeSubsection.subsection.servingSize2Cl != null ? String(activeSubsection.subsection.servingSize2Cl) : ''" class="w-14 rounded border border-gray-300 px-2 py-1.5 text-right text-sm tabular-nums" placeholder="–" @blur="(e) => onSubsectionServingSizeBlur(activeSubsection.sectionId, activeSubsection.subsection.id, activeSubsection.subsection, 2, getInputValue(e))">
                </label>
                <label class="flex items-center gap-1">
                  <span>3 (cl)</span>
                  <input type="text" inputmode="numeric" :value="activeSubsection.subsection.servingSize3Cl != null ? String(activeSubsection.subsection.servingSize3Cl) : ''" class="w-14 rounded border border-gray-300 px-2 py-1.5 text-right text-sm tabular-nums" placeholder="–" @blur="(e) => onSubsectionServingSizeBlur(activeSubsection.sectionId, activeSubsection.subsection.id, activeSubsection.subsection, 3, getInputValue(e))">
                </label>
              </template>
              <label v-else-if="activeSubsection.subsection.defaultBatchType === 'bag'" class="flex items-center gap-2">
                <span>Default serve (gr)</span>
                <input type="text" inputmode="numeric" :value="activeSubsection.subsection.defaultServeGr != null ? String(activeSubsection.subsection.defaultServeGr) : ''" class="w-14 rounded border border-gray-300 px-2 py-1.5 text-right text-sm tabular-nums" placeholder="8" @blur="(e) => onSubsectionDefaultServeGrBlur(activeSubsection.sectionId, activeSubsection.subsection.id, getInputValue(e))">
              </label>
              <template v-else-if="activeSubsection.subsection.defaultBatchType === 'bottle'">
                <label class="flex items-center gap-1">
                  <span>S (cl)</span>
                  <input type="text" inputmode="numeric" :value="activeSubsection.subsection.servingSize1Cl != null ? String(activeSubsection.subsection.servingSize1Cl) : ''" class="w-14 rounded border border-gray-300 px-2 py-1.5 text-right text-sm tabular-nums" placeholder="–" @blur="(e) => onSubsectionServingSizeBlur(activeSubsection.sectionId, activeSubsection.subsection.id, activeSubsection.subsection, 1, getInputValue(e))">
                </label>
                <label class="flex items-center gap-1">
                  <span>L (cl)</span>
                  <input type="text" inputmode="numeric" :value="activeSubsection.subsection.servingSize2Cl != null ? String(activeSubsection.subsection.servingSize2Cl) : ''" class="w-14 rounded border border-gray-300 px-2 py-1.5 text-right text-sm tabular-nums" placeholder="50" @blur="(e) => onSubsectionServingSizeBlur(activeSubsection.sectionId, activeSubsection.subsection.id, activeSubsection.subsection, 2, getInputValue(e))">
                </label>
              </template>
            </div>
            <div class="flex gap-2">
              <UButton size="sm" :loading="saving" @click="saveMenuForSubsection">Save menu</UButton>
              <UButton size="sm" variant="outline" :loading="savingVersion" @click="saveVersion">Save version</UButton>
            </div>
            <div class="overflow-x-auto">
              <table class="min-w-full text-sm">
                <thead class="bg-gray-50">
                  <tr>
                    <th class="px-2 py-2 text-left font-medium text-gray-700">Product</th>
                    <th class="px-2 py-2 text-right font-medium text-gray-700 whitespace-nowrap">Batch Price</th>
                    <th class="px-2 py-2 text-right font-medium text-gray-700 whitespace-nowrap">Batch Size</th>
                    <th class="px-2 py-2 text-right font-medium text-gray-700 whitespace-nowrap">Product Size (cl)</th>
                    <template v-if="inlineTableServingSizes?.length">
                      <th class="px-2 py-2 text-right font-medium text-gray-700 whitespace-nowrap">Cost per 1cl</th>
                      <th class="px-2 py-2 text-right font-medium text-gray-700 whitespace-nowrap">Cost + waste</th>
                      <th v-for="label in inlineTableSizeLabels" :key="'mod-nett-' + label" class="px-2 py-2 text-right font-medium text-gray-700 whitespace-nowrap">Nett ({{ label }})</th>
                      <th class="px-2 py-2 text-right font-medium text-gray-700">Margin</th>
                      <template v-for="(label, idx) in inlineTableSizeLabels" :key="'mod-menu-' + label">
                        <th v-if="idx > 0" class="px-2 py-2 text-right font-medium text-gray-700 whitespace-nowrap">Ratio</th>
                        <th class="px-2 py-2 text-right font-medium text-gray-700 whitespace-nowrap">Menu ({{ label }})</th>
                      </template>
                    </template>
                    <template v-else>
                      <th v-if="activeSubsection.subsection.defaultBatchType === 'bag'" class="px-2 py-2 text-right font-medium text-gray-700 whitespace-nowrap">Serve (gr)</th>
                      <th v-else class="px-2 py-2 text-right font-medium text-gray-700 whitespace-nowrap">Product Size (cl)</th>
                      <th class="px-2 py-2 text-right font-medium text-gray-700 whitespace-nowrap">{{ activeSubsection.subsection.defaultBatchType === 'bag' ? 'Cost per serve' : 'Cost per item' }}</th>
                      <th class="px-2 py-2 text-right font-medium text-gray-700 whitespace-nowrap">Cost + waste</th>
                      <th class="px-2 py-2 text-right font-medium text-gray-700 whitespace-nowrap">Nett</th>
                      <th class="px-2 py-2 text-right font-medium text-gray-700">Margin</th>
                      <th class="px-2 py-2 text-right font-medium text-gray-700 whitespace-nowrap">Menu</th>
                      <template v-if="activeSubsection.subsection.defaultBatchType !== 'crate' && activeSubsection.subsection.defaultBatchType !== 'box' && activeSubsection.subsection.defaultBatchType !== 'bag'">
                        <th class="px-2 py-2 text-right font-medium text-gray-700 whitespace-nowrap">Nett (50cl)</th>
                        <th class="px-2 py-2 text-right font-medium text-gray-700 whitespace-nowrap">Ratio</th>
                        <th class="px-2 py-2 text-right font-medium text-gray-700 whitespace-nowrap">Menu (50cl)</th>
                      </template>
                    </template>
                    <th class="px-2 py-2 text-left font-medium text-gray-700">Supplier</th>
                    <th class="px-2 py-2 w-9" aria-label="Remove" />
                  </tr>
                </thead>
                <tbody class="divide-y divide-gray-200">
                  <tr v-for="pid in (activeSubsection.subsection.productIds ?? [])" :key="pid" class="text-gray-700">
                    <td class="px-2 py-1.5 font-medium">{{ productNameForId(pid) }}</td>
                    <td class="px-2 py-1 w-24"><input type="text" inputmode="decimal" :value="editableCellValue(pid, 'batch')" class="w-full rounded border border-gray-300 px-1.5 py-0.5 text-right text-sm tabular-nums" @blur="(e) => onEditableBlur(pid, 'batch', getInputValue(e))"></td>
                    <td class="px-2 py-1 w-20"><input type="text" inputmode="numeric" :value="editableCellValue(pid, 'items')" class="w-full rounded border border-gray-300 px-1.5 py-0.5 text-right text-sm tabular-nums" @blur="(e) => onEditableBlur(pid, 'items', getInputValue(e))"></td>
                    <td v-if="subsectionCalcRows[pid]?.servingSizesCl?.length" class="px-2 py-1 w-20"><input type="text" inputmode="numeric" :value="editableCellValue(pid, 'productSizeCl')" class="w-full rounded border border-gray-300 px-1.5 py-0.5 text-right text-sm tabular-nums" placeholder="25" @blur="(e) => onEditableBlur(pid, 'productSizeCl', getInputValue(e))"></td>
                    <template v-if="subsectionCalcRows[pid]?.servingSizesCl?.length">
                      <td class="px-2 py-1.5 text-right tabular-nums">{{ calcRowForProduct(pid)?.costPer1Cl ?? '–' }}</td>
                      <td class="px-2 py-1.5 text-right tabular-nums">{{ calcRowForProduct(pid)?.costPlusWaste ?? '–' }}</td>
                      <td v-for="(nett, i) in (calcRowForProduct(pid)?.nettPerSize ?? [])" :key="pid + '-mod-n-' + i" class="px-2 py-1.5 text-right tabular-nums">€ {{ nett ?? '–' }}</td>
                      <td class="px-2 py-1.5 text-right tabular-nums">{{ calcRowForProduct(pid)?.marginFinal ?? '–' }}×</td>
                      <template v-for="(_, i) in (subsectionCalcRows[pid]?.menuPricePerSize ?? [])" :key="pid + '-mod-m-' + i">
                        <td v-if="i > 0" class="px-2 py-1 w-20"><input type="text" inputmode="decimal" :value="i === 1 ? editableCellValue(pid, 'ratio1to2') : editableCellValue(pid, 'ratio2to3')" class="w-full rounded border border-gray-300 px-1.5 py-0.5 text-right text-sm tabular-nums" @blur="(e) => onEditableBlur(pid, i === 1 ? 'ratio1to2' : 'ratio2to3', getInputValue(e))"></td>
                        <td class="px-2 py-1 w-24"><input type="text" inputmode="decimal" :value="editableCellValue(pid, i === 0 ? 'menuPrice1' : i === 1 ? 'menuPrice2' : 'menuPrice3')" class="w-full rounded border border-gray-300 px-1.5 py-0.5 text-right text-sm tabular-nums" @blur="(e) => onEditableBlur(pid, i === 0 ? 'menuPrice1' : i === 1 ? 'menuPrice2' : 'menuPrice3', getInputValue(e))"></td>
                      </template>
                    </template>
                    <template v-else>
                      <template v-if="activeSubsection.subsection.defaultBatchType === 'bag'">
                        <td class="px-2 py-1 w-20"><input type="text" inputmode="numeric" :value="editableCellValue(pid, 'productSizeCl')" class="w-full rounded border border-gray-300 px-1.5 py-0.5 text-right text-sm tabular-nums" placeholder="8" @blur="(e) => onEditableBlur(pid, 'productSizeCl', getInputValue(e))"></td>
                      </template>
                      <td v-else class="px-2 py-1 w-20"><input type="text" inputmode="numeric" :value="editableCellValue(pid, 'productSizeCl')" class="w-full rounded border border-gray-300 px-1.5 py-0.5 text-right text-sm tabular-nums" placeholder="25" @blur="(e) => onEditableBlur(pid, 'productSizeCl', getInputValue(e))"></td>
                      <td class="px-2 py-1.5 text-right tabular-nums">{{ calcRowForProduct(pid)?.costPerItem ?? '–' }}</td>
                      <td class="px-2 py-1.5 text-right tabular-nums">{{ calcRowForProduct(pid)?.costPlusWaste ?? '–' }}</td>
                      <td class="px-2 py-1.5 text-right tabular-nums">€ {{ calcRowForProduct(pid)?.nettSmall ?? calcRowForProduct(pid)?.nett ?? '–' }}</td>
                      <td class="px-2 py-1.5 text-right tabular-nums">{{ calcRowForProduct(pid)?.marginFinal ?? '–' }}×</td>
                      <td class="px-2 py-1 w-24"><input type="text" inputmode="decimal" :value="editableCellValue(pid, 'menuPriceFinal')" class="w-full rounded border border-gray-300 px-1.5 py-0.5 text-right text-sm tabular-nums" @blur="(e) => onEditableBlur(pid, 'menuPriceFinal', getInputValue(e))"></td>
                      <template v-if="activeSubsection.subsection.defaultBatchType !== 'crate' && activeSubsection.subsection.defaultBatchType !== 'box' && activeSubsection.subsection.defaultBatchType !== 'bag'">
                        <td class="px-2 py-1.5 text-right tabular-nums">€ {{ calcRowForProduct(pid)?.nettLarge ?? '–' }}</td>
                        <td class="px-2 py-1 w-20"><input type="text" inputmode="decimal" :value="editableCellValue(pid, 'ratio')" class="w-full rounded border border-gray-300 px-1.5 py-0.5 text-right text-sm tabular-nums" placeholder="–" @blur="(e) => onEditableBlur(pid, 'ratio', getInputValue(e))"></td>
                        <td class="px-2 py-1 w-24"><input type="text" inputmode="decimal" :value="editableCellValue(pid, 'menuPriceFinalLarge')" class="w-full rounded border border-gray-300 px-1.5 py-0.5 text-right text-sm tabular-nums" @blur="(e) => onEditableBlur(pid, 'menuPriceFinalLarge', getInputValue(e))"></td>
                      </template>
                    </template>
                    <td class="px-2 py-1 min-w-[100px]"><input type="text" :value="editableCellValue(pid, 'supplier')" class="w-full rounded border border-gray-300 px-1.5 py-0.5 text-left text-sm" @blur="(e) => onEditableBlur(pid, 'supplier', getInputValue(e))"></td>
                    <td class="px-2 py-1.5"><button type="button" class="p-1 rounded text-gray-400 hover:bg-red-50 hover:text-red-600" @click="activeSubsection && removeProductFromSubsection(activeSubsection.sectionId, activeSubsection.subsection.id, pid)"><UIcon name="i-lucide-trash-2" class="size-4" /></button></td>
                  </tr>
                </tbody>
              </table>
            </div>
            <p class="text-xs text-gray-500">Changes save as you edit. Close syncs the latest state.</p>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<script setup lang="ts">
import type { Menu, MenuSectionV2, MenuSubsectionV2, ServingSizeLabelStyle } from '~/types/menuItem'
import type { MenuProductOverride } from '~/types/menuItem'
import {
  useMenuRowCalculation,
  getCostPerItemFromProduct,
  getCostPerItemByBatchType,
  getCostPer1Cl,
  getBatchFromProduct,
  getItemsFromProduct,
  getSupplierFromProduct,
  parseProductNumber,
} from '~/composables/useMenuRowCalculation'

definePageMeta({ layout: 'default' })

const route = useRoute()
const menuId = computed(() => String(route.params?.id ?? ''))

const { data: menuData, pending, refresh } = await useAsyncData(
  () => `menu-v2-${menuId.value}`,
  () => {
    const id = menuId.value
    if (!id || id === 'undefined') return Promise.resolve({ success: true, data: null })
    return $fetch<{ success: boolean; data: Menu | null }>(`/api/menu/menus/${id}`)
  },
  { watch: [menuId] }
)
const menu = computed(() => menuData.value?.data ?? null)

const { data: itemsData } = await useFetch<{ success: boolean; data: Array<{ _id: string; data?: Record<string, unknown>; name?: string }> }>(
  () => '/api/menu/items?limit=2000'
)
const productsById = computed(() => {
  const map: Record<string, { _id: string; data?: Record<string, unknown>; name?: string }> = {}
  for (const p of itemsData.value?.data ?? []) {
    if (p._id) map[p._id] = p
  }
  return map
})

const subsectionQuery = computed(() => String(route.query?.subsection ?? ''))
const selectedSubsection = computed(() => {
  const q = subsectionQuery.value
  if (!q) return null
  for (const sec of normalizedSections.value) {
    const sub = sec.subsections?.find((s) => s.id === q)
    if (sub) return { sectionId: sec.id, sectionName: sec.name, subsection: sub }
  }
  return null
})

const showEditMenu = ref(false)
const showNewSection = ref(false)
const showNewSubsection = ref(false)
const showSectionDefaultsModal = ref(false)
const showAddProducts = ref(false)
const newSectionName = ref('')
const newSubsectionName = ref('')
const addSubsectionSectionId = ref('')
const editingSectionId = ref('')
const saving = ref(false)
const addProductsTarget = ref<{ sectionId: string; subsectionId: string } | null>(null)
const addProductsSearch = ref('')
const addProductsType = ref('')
const addProductsSelected = ref<string[]>([])
const addProductsItems = ref<Array<{ _id: string; data?: Record<string, unknown>; name?: string }>>([])
const showBulkCalc = ref(false)
const openSubsection = ref<{ sectionId: string; subsectionId: string } | null>(null)
const subsectionModalTab = ref<'order' | 'calc'>('order')

const bulkColumnGroups = ref({
  batch: true,
  cost: true,
  menu: true,
})
function toggleBulkColumnGroup(key: 'batch' | 'cost' | 'menu') {
  bulkColumnGroups.value[key] = !bulkColumnGroups.value[key]
}
const bulkVisibleColumnCount = computed(() => {
  let n = 1
  n += bulkColumnGroups.value.batch ? 3 : 1
  n += bulkColumnGroups.value.cost ? 4 : 1
  n += bulkColumnGroups.value.menu ? 4 : 1
  n += 2
  return n
})

const selectedSubsectionFromOpen = computed(() => {
  const o = openSubsection.value
  if (!o) return null
  const sec = normalizedSections.value.find((s) => s.id === o.sectionId)
  const sub = sec?.subsections?.find((s) => s.id === o.subsectionId)
  if (!sec || !sub) return null
  return { sectionId: sec.id, sectionName: sec.name, subsection: sub }
})
const activeSubsection = computed(() =>
  openSubsection.value ? selectedSubsectionFromOpen.value : selectedSubsection.value
)
const subsectionTabIsCalc = computed(() =>
  openSubsection.value ? subsectionModalTab.value === 'calc' : route.query.mode === 'calc'
)

const addProductsItemsFiltered = computed(() => {
  const target = addProductsTarget.value
  if (!target) return addProductsItems.value
  const section = normalizedSections.value.find((s) => s.id === target.sectionId)
  const sub = section?.subsections?.find((s) => s.id === target.subsectionId)
  const existingIds = new Set(sub?.productIds ?? [])
  return addProductsItems.value.filter((item) => !existingIds.has(item._id))
})

const addProductsSelectedAddable = computed(() =>
  addProductsSelected.value.filter((id) => addProductsItemsFiltered.value.some((item) => item._id === id))
)
let addProductsDebounce: ReturnType<typeof setTimeout> | null = null
const savingVersion = ref(false)

const editForm = ref({ name: '', startDate: '', location: '' })
const sectionDefaultsForm = ref({ wastePercent: 5, marginMultiplier: 4, vatRate: 21 as 9 | 21 })

watch(menu, (m) => {
  if (m) {
    editForm.value = { name: m.name ?? '', startDate: m.startDate ?? '', location: m.location ?? '' }
  }
}, { immediate: true })

function sectionDefaults(secId: string): MenuSectionV2 | undefined {
  return menu.value?.menuSectionsV2?.find((s) => s.id === secId)
}

function subsectionWaste(sectionId: string, subsection: MenuSubsectionV2): number {
  const section = sectionDefaults(sectionId)
  return subsection.defaultWastePercent ?? section?.defaultWastePercent ?? menu.value?.defaultWastePercent ?? 5
}
function subsectionMargin(sectionId: string, subsection: MenuSubsectionV2): number {
  const section = sectionDefaults(sectionId)
  return subsection.defaultMarginMultiplier ?? section?.defaultMarginMultiplier ?? menu.value?.defaultMarginMultiplier ?? 4
}

type SubsectionDefaultsUpdates = {
  defaultWastePercent?: number
  defaultMarginMultiplier?: number
  defaultBatchType?: MenuSubsectionV2['defaultBatchType']
  servingSizeLabelStyle?: ServingSizeLabelStyle
  servingSize1Cl?: number
  servingSize2Cl?: number
  servingSize3Cl?: number
  defaultServeGr?: number
}

async function patchSubsectionDefaults(
  sectionId: string,
  subsectionId: string,
  updates: SubsectionDefaultsUpdates
) {
  if (!menuId.value) return
  const current = currentSectionsV2()
  const next = current.map((s) => {
    if (s.id !== sectionId) return s
    const subs = (s.subsections ?? []).map((sub) => {
      if (sub.id !== subsectionId) return sub
      const out: Partial<MenuSubsectionV2> = { ...sub }
      if (updates.defaultWastePercent !== undefined) out.defaultWastePercent = updates.defaultWastePercent
      if (updates.defaultMarginMultiplier !== undefined) out.defaultMarginMultiplier = updates.defaultMarginMultiplier
      if (updates.defaultBatchType !== undefined) out.defaultBatchType = updates.defaultBatchType
      if (updates.servingSizeLabelStyle !== undefined) out.servingSizeLabelStyle = updates.servingSizeLabelStyle
      if (updates.servingSize1Cl !== undefined) out.servingSize1Cl = updates.servingSize1Cl
      if (updates.servingSize2Cl !== undefined) out.servingSize2Cl = updates.servingSize2Cl
      if (updates.servingSize3Cl !== undefined) out.servingSize3Cl = updates.servingSize3Cl
      if (updates.defaultServeGr !== undefined) out.defaultServeGr = updates.defaultServeGr
      if (updates.defaultBatchType !== undefined) {
        const newBatchType = updates.defaultBatchType
        const overrides = { ...(sub.productOverrides ?? {}) }
        for (const pid of sub.productIds ?? []) {
          const existing = overrides[pid] ?? {}
          overrides[pid] = { ...existing, batchType: newBatchType }
        }
        out.productOverrides = overrides
      }
      return out as MenuSubsectionV2
    })
    return { ...s, subsections: subs }
  })
  saving.value = true
  try {
    await patchSections(next)
  } finally {
    saving.value = false
  }
}

function onSubsectionWasteBlur(sectionId: string, subsectionId: string, subsection: MenuSubsectionV2, value: string) {
  const section = sectionDefaults(sectionId)
  const fallback = subsection.defaultWastePercent ?? section?.defaultWastePercent ?? menu.value?.defaultWastePercent ?? 5
  const n = parseProductNumber(value.trim())
  const num = Number.isNaN(n) ? undefined : Math.max(0, Math.min(100, n))
  if (num === undefined || num === fallback) return
  patchSubsectionDefaults(sectionId, subsectionId, { defaultWastePercent: num })
}
function onSubsectionMarginBlur(sectionId: string, subsectionId: string, subsection: MenuSubsectionV2, value: string) {
  const section = sectionDefaults(sectionId)
  const fallback = subsection.defaultMarginMultiplier ?? section?.defaultMarginMultiplier ?? menu.value?.defaultMarginMultiplier ?? 4
  const n = parseProductNumber(value.trim())
  const num = Number.isNaN(n) ? undefined : (n > 0 ? n : undefined)
  if (num === undefined || num === fallback) return
  patchSubsectionDefaults(sectionId, subsectionId, { defaultMarginMultiplier: num })
}

const SERVING_LABEL_OPTIONS: { value: ServingSizeLabelStyle; label: string }[] = [
  { value: 'smallMediumLarge', label: 'S / M / L' },
  { value: 'serving1_2_3', label: 'Serving 1 / 2 / 3' },
]

function subsectionServingLabelStyle(subsection: MenuSubsectionV2): ServingSizeLabelStyle {
  return subsection.servingSizeLabelStyle ?? 'smallMediumLarge'
}

function onSubsectionDefaultBatchTypeChange(sectionId: string, subsectionId: string, value: string) {
  const v = value.trim()
  const batchType: MenuSubsectionV2['defaultBatchType'] =
    v === 'crate' || v === 'box' || v === 'fust' || v === 'bottle' || v === 'bag' ? v : undefined
  patchSubsectionDefaults(sectionId, subsectionId, { defaultBatchType: batchType })
}

function onSubsectionServingLabelStyleChange(sectionId: string, subsectionId: string, value: ServingSizeLabelStyle) {
  patchSubsectionDefaults(sectionId, subsectionId, { servingSizeLabelStyle: value })
}

function onSubsectionServingSizeBlur(
  sectionId: string,
  subsectionId: string,
  _subsection: MenuSubsectionV2,
  index: 1 | 2 | 3,
  value: string
) {
  const trimmed = value.trim()
  const n = parseProductNumber(trimmed)
  const num = trimmed === '' ? undefined : (Number.isNaN(n) || n < 1 ? undefined : Math.round(n))
  const key = index === 1 ? 'servingSize1Cl' : index === 2 ? 'servingSize2Cl' : 'servingSize3Cl'
  patchSubsectionDefaults(sectionId, subsectionId, { [key]: num } as SubsectionDefaultsUpdates)
}

function onSubsectionDefaultServeGrBlur(sectionId: string, subsectionId: string, value: string) {
  const trimmed = value.trim()
  const n = parseProductNumber(trimmed)
  const num = trimmed === '' ? undefined : (Number.isNaN(n) || n < 1 ? undefined : Math.round(n))
  patchSubsectionDefaults(sectionId, subsectionId, { defaultServeGr: num })
}

/** Labels for 1–3 serving size columns: show cl values e.g. ['19cl','25cl','50cl']. */
function getServingSizeHeaderLabels(subsection: MenuSubsectionV2): string[] {
  const sizes = getSubsectionServingSizes(subsection)
  return sizes ? sizes.map((cl) => `${cl}cl`) : []
}

/** Draft table (cost per 1cl, 1–3 Nett/Menu) only when subsection default batch type is Fust and sizes configured. */
const inlineTableServingSizes = computed(() => {
  const sub = activeSubsection.value?.subsection
  return sub && subsectionUsesDraftTable(sub) ? getSubsectionServingSizes(sub) : null
})
const inlineTableSizeLabels = computed(() =>
  activeSubsection.value ? getServingSizeHeaderLabels(activeSubsection.value.subsection) : []
)

type FlatSection = { id: string; name: string; subsections: MenuSubsectionV2[] }
const normalizedSections = computed((): FlatSection[] => {
  const m = menu.value
  if (m?.menuSectionsV2?.length) {
    return m.menuSectionsV2.map((s: MenuSectionV2) => ({
      id: s.id,
      name: s.name,
      subsections: s.subsections ?? [],
    }))
  }
  if (m?.menuSections?.length) {
    return m.menuSections.map((s) => ({
      id: s.id,
      name: s.name,
      subsections: [{ id: s.id, name: s.name, productIds: s.productIds ?? [] }] as MenuSubsectionV2[],
    }))
  }
  return []
})

function openBulkCalculation() {
  showBulkCalc.value = true
}
async function closeBulkCalculation() {
  await refresh()
  showBulkCalc.value = false
}
function openSubsectionModal(sectionId: string, subsectionId: string) {
  openSubsection.value = { sectionId, subsectionId }
  subsectionModalTab.value = 'calc'
}
async function closeSubsectionModal() {
  await refresh()
  openSubsection.value = null
}

function openAddSection() {
  newSectionName.value = ''
  showNewSection.value = true
}

function openAddSubsection(secId: string) {
  addSubsectionSectionId.value = secId
  newSubsectionName.value = ''
  showNewSubsection.value = true
}

function openSectionDefaults(secId: string) {
  const sec = sectionDefaults(secId)
  editingSectionId.value = secId
  sectionDefaultsForm.value = {
    wastePercent: sec?.defaultWastePercent ?? 5,
    marginMultiplier: sec?.defaultMarginMultiplier ?? 4,
    vatRate: (sec?.defaultVatRate ?? 21) as 9 | 21,
  }
  showSectionDefaultsModal.value = true
}

function nextId(): string {
  return `id-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
}

async function patchSections(sections: MenuSectionV2[]) {
  if (!menuId.value) return
  saving.value = true
  try {
    await $fetch(`/api/menu/menus/${menuId.value}`, {
      method: 'PATCH',
      body: { menuSectionsV2: sections },
    })
    await refresh()
  } finally {
    saving.value = false
  }
}

function currentSectionsV2(): MenuSectionV2[] {
  const m = menu.value
  if (m?.menuSectionsV2?.length) return m.menuSectionsV2
  if (m?.menuSections?.length) {
    return m.menuSections.map((s) => ({
      id: s.id,
      name: s.name,
      subsections: [{ id: `${s.id}-sub`, name: s.name, productIds: s.productIds ?? [] }],
    }))
  }
  return []
}

async function addSection() {
  const name = newSectionName.value.trim()
  if (!name) return
  const current = currentSectionsV2()
  const next: MenuSectionV2[] = [
    ...current,
    { id: nextId(), name, defaultWastePercent: 5, defaultMarginMultiplier: 4, defaultVatRate: 21, subsections: [] },
  ]
  await patchSections(next)
  showNewSection.value = false
}

async function addSubsection() {
  const name = newSubsectionName.value.trim()
  const secId = addSubsectionSectionId.value
  if (!name || !secId) return
  const current = currentSectionsV2()
  const next = current.map((s) => {
    if (s.id !== secId) return s
    const subs = [...(s.subsections ?? []), { id: nextId(), name, productIds: [] }]
    return { ...s, subsections: subs }
  })
  await patchSections(next)
  showNewSubsection.value = false
}

async function saveSectionDefaults() {
  const secId = editingSectionId.value
  if (!secId) return
  const current = currentSectionsV2()
  const next = current.map((s) => {
    if (s.id !== secId) return s
    return {
      ...s,
      defaultWastePercent: sectionDefaultsForm.value.wastePercent,
      defaultMarginMultiplier: sectionDefaultsForm.value.marginMultiplier,
      defaultVatRate: sectionDefaultsForm.value.vatRate,
    }
  })
  await patchSections(next)
  showSectionDefaultsModal.value = false
}

async function saveEditMenu() {
  if (!menuId.value) return
  saving.value = true
  try {
    await $fetch(`/api/menu/menus/${menuId.value}`, {
      method: 'PATCH',
      body: {
        name: editForm.value.name.trim(),
        startDate: editForm.value.startDate || undefined,
        location: editForm.value.location || undefined,
      },
    })
    await refresh()
    showEditMenu.value = false
  } finally {
    saving.value = false
  }
}

function productDisplayName(item: { data?: Record<string, unknown>; name?: string }): string {
  if (!item) return '–'
  const d = item.data
  if (d && typeof d === 'object') {
    for (const k of ['Product Kinsbergen', 'Product', 'Name', 'name']) {
      const v = d[k]
      if (v != null && String(v).trim()) return String(v).trim()
    }
  }
  return item.name ?? '–'
}

function openAddProducts(sectionId: string, subsectionId: string) {
  addProductsTarget.value = { sectionId, subsectionId }
  addProductsSearch.value = ''
  addProductsType.value = ''
  addProductsSelected.value = []
  showAddProducts.value = true
  fetchAddProductsItems()
}

function debounceSearch() {
  if (addProductsDebounce) clearTimeout(addProductsDebounce)
  addProductsDebounce = setTimeout(() => fetchAddProductsItems(), 300)
}

async function fetchAddProductsItems() {
  const params: Record<string, string> = { limit: '100' }
  if (addProductsSearch.value.trim()) params.search = addProductsSearch.value.trim()
  if (addProductsType.value.trim()) params.productType = addProductsType.value.trim()
  const q = new URLSearchParams(params).toString()
  const res = await $fetch<{ success: boolean; data: Array<{ _id: string; data?: Record<string, unknown>; name?: string }> }>(
    `/api/menu/items?${q}`
  )
  addProductsItems.value = res?.data ?? []
}

watch([addProductsSearch, addProductsType], () => {
  if (showAddProducts.value) fetchAddProductsItems()
})

async function bulkAddProducts() {
  const target = addProductsTarget.value
  const toAdd = addProductsSelectedAddable.value
  if (!menuId.value || !target || toAdd.length === 0) return
  saving.value = true
  try {
    await $fetch(`/api/menu/menus/${menuId.value}/products/bulk`, {
      method: 'POST',
      body: { sectionId: target.sectionId, subsectionId: target.subsectionId, productIds: toAdd },
    })
    await refresh()
    showAddProducts.value = false
  } finally {
    saving.value = false
  }
}

/** Large size is always 50cl; regular size = product size (variable). */
const SIZE_LARGE_CL = 50

/** Returns 1–3 serving sizes in cl when subsection has them configured; otherwise null (use legacy). */
function getSubsectionServingSizes(subsection: MenuSubsectionV2): number[] | null {
  const s1 = subsection.servingSize1Cl
  if (s1 == null || s1 < 1) return null
  const out = [s1]
  if (subsection.servingSize2Cl != null && subsection.servingSize2Cl >= 1) out.push(subsection.servingSize2Cl)
  if (subsection.servingSize3Cl != null && subsection.servingSize3Cl >= 1) out.push(subsection.servingSize3Cl)
  return out
}

const BATCH_TYPE_OPTIONS: { value: '' | MenuProductOverride['batchType']; label: string }[] = [
  { value: '', label: '–' },
  { value: 'crate', label: 'Crate' },
  { value: 'box', label: 'Box' },
  { value: 'fust', label: 'Fust' },
  { value: 'bottle', label: 'Bottle' },
  { value: 'bag', label: 'Bag' },
]
/** Same options for subsection default batch type (drives table layout: Fust = draft table with 1–3 sizes). */
const BATCH_TYPE_DEFAULT_OPTIONS = BATCH_TYPE_OPTIONS

/** True when subsection uses draft table: default batch type Fust and at least one serving size configured. */
function subsectionUsesDraftTable(subsection: MenuSubsectionV2): boolean {
  return subsection.defaultBatchType === 'fust' && (getSubsectionServingSizes(subsection)?.length ?? 0) >= 1
}

type SubsectionCalcRow = {
  batch: number | null
  items: number | null
  productSizeCl: number | null
  costPerItem: number
  costPlusWaste: number
  wastePercent: number
  margin: number
  vatRate: number
  nett: number
  menuPriceCalculated: number
  menuPriceFinal: number
  marginFinal: number
  supplier: string
  /** When subsection has 1–3 serving sizes */
  costPer1Cl?: number
  servingSizesCl?: number[]
  costPerSize?: number[]
  nettPerSize?: number[]
  menuPricePerSize?: number[]
  ratios?: number[]
  /** Legacy: when productSizeCl set, regular = product size, large = 50cl */
  costPerItemSmall?: number
  costPerItemLarge?: number
  nettSmall?: number
  menuPriceSmall?: number
  nettLarge?: number
  menuPriceLarge?: number
  multiplier?: number
}

const subsectionCalcRows = computed(() => {
  const sel = activeSubsection.value
  if (!sel) return {} as Record<string, SubsectionCalcRow>
  const section = sectionDefaults(sel.sectionId)
  const waste = sel.subsection.defaultWastePercent ?? section?.defaultWastePercent ?? menu.value?.defaultWastePercent ?? 5
  const margin = sel.subsection.defaultMarginMultiplier ?? section?.defaultMarginMultiplier ?? menu.value?.defaultMarginMultiplier ?? 4
  const vat = (section?.defaultVatRate ?? menu.value?.defaultVatRate ?? 21) as 9 | 21
  const servingSizes = getSubsectionServingSizes(sel.subsection)
  const out: Record<string, SubsectionCalcRow> = {}
  for (const pid of sel.subsection.productIds ?? []) {
    const item = productsById.value[pid]
    const data = item?.data as Record<string, unknown> | undefined
    const ov = sel.subsection.productOverrides?.[pid]
    const effectiveBatchType = ov?.batchType ?? sel.subsection.defaultBatchType
    const batchPrice = ov?.batchCost ?? getBatchFromProduct(data, undefined) ?? 0
    const batchSize = ov?.itemsPerBatch ?? getItemsFromProduct(data, undefined) ?? 0
    const refSize = ov?.productSizeCl ?? null
    const wastePct = ov?.wastePercent ?? waste
    const vatRate = ov?.vatRate ?? vat
    const refSizeForCrate = refSize ?? servingSizes?.[0] ?? 0

    if (sel.subsection.defaultBatchType === 'fust' && servingSizes && servingSizes.length >= 1 && batchPrice > 0 && batchSize > 0) {
      // Per-product override: first column uses productSizeCl when set and ≠ subsection size 1 (e.g. 30cl instead of 25cl).
      const servingSizesForRow =
        refSize != null && refSize > 0 && servingSizes[0] !== refSize
          ? [refSize, ...servingSizes.slice(1)]
          : servingSizes
      const costPer1Cl = getCostPer1Cl(batchPrice, batchSize, effectiveBatchType, refSizeForCrate || undefined)
      const costPerSize = servingSizesForRow.map((sizeCl) =>
        getCostPerItemByBatchType(batchPrice, batchSize, refSizeForCrate, effectiveBatchType, sizeCl)
      )
      const menuPriceOverrides = [ov?.menuPrice1IncVat ?? ov?.menuPriceIncVat, ov?.menuPrice2IncVat ?? ov?.menuPriceLargeIncVat, ov?.menuPrice3IncVat]
      const menuPricePerSize: number[] = []
      for (let i = 0; i < servingSizesForRow.length; i++) {
        const calc = useMenuRowCalculation({
          costPerItem: costPerSize[i],
          wastePercent: wastePct,
          marginMultiplier: ov?.marginMultiplier ?? margin,
          vatRate,
          menuPriceIncVat: menuPriceOverrides[i],
        })
        menuPricePerSize.push(menuPriceOverrides[i] ?? calc.menuPriceIncVat)
      }
      const nettPerSize = menuPricePerSize.map((p) => p / (1 + vatRate / 100))
      const ratios: number[] = []
      for (let i = 0; i < menuPricePerSize.length - 1; i++) {
        ratios.push(menuPricePerSize[i] > 0 ? menuPricePerSize[i + 1] / menuPricePerSize[i] : 0)
      }
      const firstCostPlusWaste = costPerSize[0] * (1 + wastePct / 100)
      out[pid] = {
        batch: batchPrice,
        items: batchSize,
        productSizeCl: refSize,
        costPerItem: costPerSize[0],
        costPlusWaste: firstCostPlusWaste,
        wastePercent: wastePct,
        margin: ov?.marginMultiplier ?? margin,
        vatRate,
        nett: nettPerSize[0],
        menuPriceCalculated: menuPricePerSize[0] / (1 + vatRate / 100) * (1 + vatRate / 100),
        menuPriceFinal: menuPricePerSize[0],
        marginFinal: firstCostPlusWaste > 0 ? nettPerSize[0] / firstCostPlusWaste : margin,
        supplier: (ov?.supplier ?? getSupplierFromProduct(data)) || '–',
        costPer1Cl,
        servingSizesCl: servingSizes,
        costPerSize,
        nettPerSize,
        menuPricePerSize,
        ratios,
        nettSmall: nettPerSize[0],
        menuPriceSmall: menuPricePerSize[0],
        nettLarge: servingSizes.length > 1 ? nettPerSize[servingSizes.length - 1] : undefined,
        menuPriceLarge: servingSizes.length > 1 ? menuPricePerSize[servingSizes.length - 1] : undefined,
        multiplier: ratios[0],
      }
    } else if (refSize != null && refSize > 0 && batchPrice > 0 && batchSize > 0) {
      /** Regular = cost per one serving at product size (variable, e.g. 30cl). Large = always 50cl. */
      const costPerItemAtProductSize = getCostPerItemByBatchType(batchPrice, batchSize, refSize, effectiveBatchType, refSize)
      const costLarge = getCostPerItemByBatchType(batchPrice, batchSize, refSize, effectiveBatchType, SIZE_LARGE_CL)
      const calcSmall = useMenuRowCalculation({
        costPerItem: costPerItemAtProductSize,
        wastePercent: wastePct,
        marginMultiplier: ov?.marginMultiplier ?? margin,
        vatRate,
        menuPriceIncVat: ov?.menuPriceIncVat,
      })
      const calcLarge = useMenuRowCalculation({
        costPerItem: costLarge,
        wastePercent: wastePct,
        marginMultiplier: ov?.marginMultiplier ?? margin,
        vatRate,
        menuPriceIncVat: ov?.menuPriceLargeIncVat,
      })
      const menuPriceSmall = ov?.menuPriceIncVat ?? calcSmall.menuPriceIncVat
      const menuPriceLarge =
        ov?.priceRatio != null && ov.priceRatio > 0
          ? menuPriceSmall * ov.priceRatio
          : (ov?.menuPriceLargeIncVat ?? calcLarge.menuPriceIncVat)
      const nettSmall = menuPriceSmall / (1 + vatRate / 100)
      const nettLarge = menuPriceLarge / (1 + vatRate / 100)
      const ratio = ov?.priceRatio ?? (menuPriceSmall > 0 ? menuPriceLarge / menuPriceSmall : 0)
      out[pid] = {
        batch: batchPrice,
        items: batchSize,
        productSizeCl: refSize,
        costPerItem: costPerItemAtProductSize,
        costPlusWaste: calcSmall.costPlusWaste,
        wastePercent: wastePct,
        margin: calcSmall.marginMultiplier,
        vatRate,
        nett: nettSmall,
        menuPriceCalculated: calcSmall.menuPriceIncVat,
        menuPriceFinal: menuPriceSmall,
        marginFinal: calcSmall.costPlusWaste > 0 ? nettSmall / calcSmall.costPlusWaste : margin,
        supplier: (ov?.supplier ?? getSupplierFromProduct(data)) || '–',
        costPerItemSmall: costPerItemAtProductSize,
        costPerItemLarge: costLarge,
        nettSmall,
        menuPriceSmall,
        nettLarge,
        menuPriceLarge,
        multiplier: ratio,
      }
    } else if (sel.subsection.defaultBatchType === 'bag' && batchPrice > 0 && batchSize > 0) {
      const serveGr = sel.subsection.defaultServeGr ?? refSize ?? 0
      const costPerServe = serveGr > 0 ? getCostPerItemByBatchType(batchPrice, batchSize, serveGr, 'bag', serveGr) : batchPrice / batchSize
      const calc = useMenuRowCalculation({
        costPerItem: costPerServe,
        wastePercent: wastePct,
        marginMultiplier: ov?.marginMultiplier ?? margin,
        vatRate,
        menuPriceIncVat: ov?.menuPriceIncVat,
      })
      const menuPriceFinal = ov?.menuPriceIncVat ?? calc.menuPriceIncVat
      const nettFinal = menuPriceFinal / (1 + vatRate / 100)
      out[pid] = {
        batch: batchPrice,
        items: batchSize,
        productSizeCl: serveGr > 0 ? serveGr : null,
        costPerItem: costPerServe,
        costPlusWaste: calc.costPlusWaste,
        wastePercent: wastePct,
        margin: calc.marginMultiplier,
        vatRate,
        nett: nettFinal,
        menuPriceCalculated: calc.menuPriceIncVat,
        menuPriceFinal,
        marginFinal: calc.costPlusWaste > 0 ? nettFinal / calc.costPlusWaste : margin,
        supplier: (ov?.supplier ?? getSupplierFromProduct(data)) || '–',
      }
    } else {
      const costPerItem = ov?.costPerItem ?? (getCostPerItemFromProduct(data, ov?.batchCost, ov?.itemsPerBatch) ?? 0)
      const calc = useMenuRowCalculation({
        costPerItem,
        wastePercent: wastePct,
        marginMultiplier: ov?.marginMultiplier ?? margin,
        vatRate,
        menuPriceIncVat: ov?.menuPriceIncVat,
      })
      const menuPriceFinal = ov?.menuPriceIncVat ?? calc.menuPriceIncVat
      const nettFinal = menuPriceFinal / (1 + vatRate / 100)
      const marginFinal = calc.costPlusWaste > 0 ? nettFinal / calc.costPlusWaste : calc.marginMultiplier
      out[pid] = {
        batch: getBatchFromProduct(data, ov?.batchCost ?? undefined),
        items: getItemsFromProduct(data, ov?.itemsPerBatch ?? undefined),
        productSizeCl: null,
        costPerItem: calc.costPerItem,
        costPlusWaste: calc.costPlusWaste,
        wastePercent: wastePct,
        margin: calc.marginMultiplier,
        vatRate,
        nett: calc.nettPrice,
        menuPriceCalculated: calc.menuPriceIncVat,
        menuPriceFinal,
        marginFinal,
        supplier: (ov?.supplier ?? getSupplierFromProduct(data)) || '–',
      }
    }
  }
  return out
})

type BulkRow = {
  rowKey: string
  sectionId: string
  sectionName: string
  subsectionId: string
  subsectionName: string
  productId: string
  subsection: MenuSubsectionV2
}

const bulkRows = computed((): BulkRow[] => {
  const rows: BulkRow[] = []
  for (const sec of normalizedSections.value) {
    for (const sub of sec.subsections ?? []) {
      for (const pid of sub.productIds ?? []) {
        rows.push({
          rowKey: `${sec.id}-${sub.id}-${pid}`,
          sectionId: sec.id,
          sectionName: sec.name,
          subsectionId: sub.id,
          subsectionName: sub.name,
          productId: pid,
          subsection: sub,
        })
      }
    }
  }
  return rows
})

type BulkSubsectionGroup = {
  subsectionId: string
  subsectionName: string
  subsection: MenuSubsectionV2
  products: BulkRow[]
}
type BulkSectionGroup = {
  sectionId: string
  sectionName: string
  subsections: BulkSubsectionGroup[]
}

const bulkRowsGrouped = computed((): BulkSectionGroup[] => {
  const bySection = new Map<string, BulkSectionGroup>()
  for (const row of bulkRows.value) {
    let sec = bySection.get(row.sectionId)
    if (!sec) {
      sec = { sectionId: row.sectionId, sectionName: row.sectionName, subsections: [] }
      bySection.set(row.sectionId, sec)
    }
    let sub = sec.subsections.find((s) => s.subsectionId === row.subsectionId)
    if (!sub) {
      sub = {
        subsectionId: row.subsectionId,
        subsectionName: row.subsectionName,
        subsection: row.subsection,
        products: [],
      }
      sec.subsections.push(sub)
    }
    sub.products.push(row)
  }
  return Array.from(bySection.values())
})

type BulkSubsectionCard = {
  sectionId: string
  sectionName: string
  subsectionId: string
  subsectionName: string
  subsection: MenuSubsectionV2
  products: BulkRow[]
}
const bulkSubsectionsFlat = computed((): BulkSubsectionCard[] => {
  const out: BulkSubsectionCard[] = []
  for (const sec of bulkRowsGrouped.value) {
    for (const sub of sec.subsections) {
      out.push({
        sectionId: sec.sectionId,
        sectionName: sec.sectionName,
        subsectionId: sub.subsectionId,
        subsectionName: sub.subsectionName,
        subsection: sub.subsection,
        products: sub.products,
      })
    }
  }
  return out
})

const bulkCalcRows = computed(() => {
  const out: Record<string, SubsectionCalcRow> = {}
  const m = menu.value
  if (!m) return out
  for (const row of bulkRows.value) {
    const section = sectionDefaults(row.sectionId)
    const waste = row.subsection.defaultWastePercent ?? section?.defaultWastePercent ?? m.defaultWastePercent ?? 5
    const margin = row.subsection.defaultMarginMultiplier ?? section?.defaultMarginMultiplier ?? m.defaultMarginMultiplier ?? 4
    const vat = (section?.defaultVatRate ?? m.defaultVatRate ?? 21) as 9 | 21
    const item = productsById.value[row.productId]
    const data = item?.data as Record<string, unknown> | undefined
    const ov = row.subsection.productOverrides?.[row.productId]
    const effectiveBatchType = ov?.batchType ?? row.subsection.defaultBatchType
    const batchPrice = ov?.batchCost ?? getBatchFromProduct(data, undefined) ?? 0
    const batchSize = ov?.itemsPerBatch ?? getItemsFromProduct(data, undefined) ?? 0
    const refSize = ov?.productSizeCl ?? null
    const wastePct = ov?.wastePercent ?? waste
    const vatRate = ov?.vatRate ?? vat
    const servingSizes = getSubsectionServingSizes(row.subsection)
    const refSizeForCrate = refSize ?? servingSizes?.[0] ?? 0

    if (row.subsection.defaultBatchType === 'fust' && servingSizes && servingSizes.length >= 1 && batchPrice > 0 && batchSize > 0) {
      const servingSizesForRow =
        refSize != null && refSize > 0 && servingSizes[0] !== refSize
          ? [refSize, ...servingSizes.slice(1)]
          : servingSizes
      const costPer1Cl = getCostPer1Cl(batchPrice, batchSize, effectiveBatchType, refSizeForCrate || undefined)
      const costPerSize = servingSizesForRow.map((sizeCl) =>
        getCostPerItemByBatchType(batchPrice, batchSize, refSizeForCrate, effectiveBatchType, sizeCl)
      )
      const menuPriceOverrides = [ov?.menuPrice1IncVat ?? ov?.menuPriceIncVat, ov?.menuPrice2IncVat ?? ov?.menuPriceLargeIncVat, ov?.menuPrice3IncVat]
      const menuPricePerSize: number[] = []
      for (let i = 0; i < servingSizesForRow.length; i++) {
        const calc = useMenuRowCalculation({
          costPerItem: costPerSize[i],
          wastePercent: wastePct,
          marginMultiplier: ov?.marginMultiplier ?? margin,
          vatRate,
          menuPriceIncVat: menuPriceOverrides[i],
        })
        menuPricePerSize.push(menuPriceOverrides[i] ?? calc.menuPriceIncVat)
      }
      const nettPerSize = menuPricePerSize.map((p) => p / (1 + vatRate / 100))
      const ratios: number[] = []
      for (let i = 0; i < menuPricePerSize.length - 1; i++) {
        ratios.push(menuPricePerSize[i] > 0 ? menuPricePerSize[i + 1] / menuPricePerSize[i] : 0)
      }
      const firstCostPlusWaste = costPerSize[0] * (1 + wastePct / 100)
      out[row.rowKey] = {
        batch: batchPrice,
        items: batchSize,
        productSizeCl: refSize,
        costPerItem: costPerSize[0],
        costPlusWaste: firstCostPlusWaste,
        wastePercent: wastePct,
        margin: ov?.marginMultiplier ?? margin,
        vatRate,
        nett: nettPerSize[0],
        menuPriceCalculated: menuPricePerSize[0],
        menuPriceFinal: menuPricePerSize[0],
        marginFinal: firstCostPlusWaste > 0 ? nettPerSize[0] / firstCostPlusWaste : margin,
        supplier: (ov?.supplier ?? getSupplierFromProduct(data)) || '–',
        costPer1Cl,
        servingSizesCl: servingSizes,
        costPerSize,
        nettPerSize,
        menuPricePerSize,
        ratios,
        nettSmall: nettPerSize[0],
        menuPriceSmall: menuPricePerSize[0],
        nettLarge: servingSizes.length > 1 ? nettPerSize[servingSizes.length - 1] : undefined,
        menuPriceLarge: servingSizes.length > 1 ? menuPricePerSize[servingSizes.length - 1] : undefined,
        multiplier: ratios[0],
      }
    } else if (refSize != null && refSize > 0 && batchPrice > 0 && batchSize > 0) {
      const costPerItemAtProductSize = getCostPerItemByBatchType(batchPrice, batchSize, refSize, effectiveBatchType, refSize)
      const costLarge = getCostPerItemByBatchType(batchPrice, batchSize, refSize, effectiveBatchType, SIZE_LARGE_CL)
      const calcSmall = useMenuRowCalculation({
        costPerItem: costPerItemAtProductSize,
        wastePercent: wastePct,
        marginMultiplier: ov?.marginMultiplier ?? margin,
        vatRate,
        menuPriceIncVat: ov?.menuPriceIncVat,
      })
      const calcLarge = useMenuRowCalculation({
        costPerItem: costLarge,
        wastePercent: wastePct,
        marginMultiplier: ov?.marginMultiplier ?? margin,
        vatRate,
        menuPriceIncVat: ov?.menuPriceLargeIncVat,
      })
      const menuPriceSmall = ov?.menuPriceIncVat ?? calcSmall.menuPriceIncVat
      const menuPriceLarge =
        ov?.priceRatio != null && ov.priceRatio > 0
          ? menuPriceSmall * ov.priceRatio
          : (ov?.menuPriceLargeIncVat ?? calcLarge.menuPriceIncVat)
      const nettSmall = menuPriceSmall / (1 + vatRate / 100)
      const nettLarge = menuPriceLarge / (1 + vatRate / 100)
      const ratio = ov?.priceRatio ?? (menuPriceSmall > 0 ? menuPriceLarge / menuPriceSmall : 0)
      out[row.rowKey] = {
        batch: batchPrice,
        items: batchSize,
        productSizeCl: refSize,
        costPerItem: costPerItemAtProductSize,
        costPlusWaste: calcSmall.costPlusWaste,
        wastePercent: wastePct,
        margin: calcSmall.marginMultiplier,
        vatRate,
        nett: nettSmall,
        menuPriceCalculated: calcSmall.menuPriceIncVat,
        menuPriceFinal: menuPriceSmall,
        marginFinal: calcSmall.costPlusWaste > 0 ? nettSmall / calcSmall.costPlusWaste : margin,
        supplier: (ov?.supplier ?? getSupplierFromProduct(data)) || '–',
        costPerItemSmall: costPerItemAtProductSize,
        costPerItemLarge: costLarge,
        nettSmall,
        menuPriceSmall,
        nettLarge,
        menuPriceLarge,
        multiplier: ratio,
      }
    } else if (row.subsection.defaultBatchType === 'bag' && batchPrice > 0 && batchSize > 0) {
      const serveGr = row.subsection.defaultServeGr ?? refSize ?? 0
      const costPerServe = serveGr > 0 ? getCostPerItemByBatchType(batchPrice, batchSize, serveGr, 'bag', serveGr) : batchPrice / batchSize
      const calc = useMenuRowCalculation({
        costPerItem: costPerServe,
        wastePercent: wastePct,
        marginMultiplier: ov?.marginMultiplier ?? margin,
        vatRate,
        menuPriceIncVat: ov?.menuPriceIncVat,
      })
      const menuPriceFinal = ov?.menuPriceIncVat ?? calc.menuPriceIncVat
      const nettFinal = menuPriceFinal / (1 + vatRate / 100)
      out[row.rowKey] = {
        batch: batchPrice,
        items: batchSize,
        productSizeCl: serveGr > 0 ? serveGr : null,
        costPerItem: costPerServe,
        costPlusWaste: calc.costPlusWaste,
        wastePercent: wastePct,
        margin: calc.marginMultiplier,
        vatRate,
        nett: nettFinal,
        menuPriceCalculated: calc.menuPriceIncVat,
        menuPriceFinal,
        marginFinal: calc.costPlusWaste > 0 ? nettFinal / calc.costPlusWaste : margin,
        supplier: (ov?.supplier ?? getSupplierFromProduct(data)) || '–',
      }
    } else {
      const costPerItem = ov?.costPerItem ?? (getCostPerItemFromProduct(data, ov?.batchCost, ov?.itemsPerBatch) ?? 0)
      const calc = useMenuRowCalculation({
        costPerItem,
        wastePercent: wastePct,
        marginMultiplier: ov?.marginMultiplier ?? margin,
        vatRate,
        menuPriceIncVat: ov?.menuPriceIncVat,
      })
      const menuPriceFinal = ov?.menuPriceIncVat ?? calc.menuPriceIncVat
      const nettFinal = menuPriceFinal / (1 + vatRate / 100)
      const marginFinal = calc.costPlusWaste > 0 ? nettFinal / calc.costPlusWaste : calc.marginMultiplier
      out[row.rowKey] = {
        batch: getBatchFromProduct(data, ov?.batchCost ?? undefined),
        items: getItemsFromProduct(data, ov?.itemsPerBatch ?? undefined),
        productSizeCl: null,
        costPerItem: calc.costPerItem,
        costPlusWaste: calc.costPlusWaste,
        wastePercent: wastePct,
        margin: calc.marginMultiplier,
        vatRate,
        nett: calc.nettPrice,
        menuPriceCalculated: calc.menuPriceIncVat,
        menuPriceFinal,
        marginFinal,
        supplier: (ov?.supplier ?? getSupplierFromProduct(data)) || '–',
      }
    }
  }
  return out
})

function bulkCalcRowFormatted(rowKey: string) {
  const row = bulkCalcRows.value[rowKey]
  if (!row) return null
  const base = {
    costPerItem: fmt(row.costPerItem),
    costPlusWaste: fmt(row.costPlusWaste),
    nett: fmt(row.nett),
    menuPriceCalculated: fmt(row.menuPriceCalculated),
    marginFinal: fmt(row.marginFinal),
    menuPriceFinal: fmt(row.menuPriceFinal),
  }
  if (row.servingSizesCl?.length && row.nettPerSize?.length && row.menuPricePerSize?.length) {
    return {
      ...base,
      costPerItem: fmt(row.costPerItem),
      costPer1Cl: row.costPer1Cl != null ? fmt(row.costPer1Cl) : undefined,
      nettPerSize: row.nettPerSize?.map((n) => fmt(n)),
      menuPricePerSize: row.menuPricePerSize?.map((p) => fmt(p)),
      ratios: row.ratios?.map((r) => r.toFixed(2).replace('.', ',')),
      nettSmall: fmt(row.nettPerSize[0]),
      menuPriceSmall: fmt(row.menuPricePerSize[0]),
      nettLarge: row.nettPerSize.length > 1 ? fmt(row.nettPerSize[row.nettPerSize.length - 1]) : undefined,
      menuPriceLarge: row.menuPricePerSize.length > 1 ? fmt(row.menuPricePerSize[row.menuPricePerSize.length - 1]) : undefined,
      multiplier: row.ratios?.[0] != null ? row.ratios[0].toFixed(2).replace('.', ',') : undefined,
    }
  }
  if (row.productSizeCl != null && row.nettSmall != null && row.menuPriceSmall != null && row.nettLarge != null && row.menuPriceLarge != null && row.multiplier != null) {
    return {
      ...base,
      nettSmall: fmt(row.nettSmall),
      menuPriceSmall: fmt(row.menuPriceSmall),
      nettLarge: fmt(row.nettLarge),
      menuPriceLarge: fmt(row.menuPriceLarge),
      multiplier: row.multiplier.toFixed(2).replace('.', ','),
    }
  }
  return base
}

function bulkSubsectionAverages(products: BulkRow[]): {
  costPerItem: string
  costPlusWaste: string
  nett: string
  menuPriceCalculated: string
  marginFinal: string
  menuPriceFinal: string
} | null {
  if (!products.length) return null
  const rows = products.map((r) => bulkCalcRows.value[r.rowKey]).filter(Boolean)
  if (!rows.length) return null
  const n = rows.length
  const sum = (key: keyof SubsectionCalcRow) =>
    rows.reduce((acc, r) => acc + (Number((r as SubsectionCalcRow)[key]) || 0), 0)
  const costPerItem = sum('costPerItem') / n
  const costPlusWaste = sum('costPlusWaste') / n
  const nett = sum('nett') / n
  const menuPriceCalculated = sum('menuPriceCalculated') / n
  const marginFinal = sum('marginFinal') / n
  const menuPriceFinal = sum('menuPriceFinal') / n
  return {
    costPerItem: fmt(costPerItem),
    costPlusWaste: fmt(costPlusWaste),
    nett: fmt(nett),
    menuPriceCalculated: fmt(menuPriceCalculated),
    marginFinal: fmt(marginFinal),
    menuPriceFinal: fmt(menuPriceFinal),
  }
}

const bulkSubsectionAveragesMap = computed(() => {
  const map: Record<string, NonNullable<ReturnType<typeof bulkSubsectionAverages>>> = {}
  for (const sec of bulkRowsGrouped.value) {
    for (const sub of sec.subsections) {
      const avg = bulkSubsectionAverages(sub.products)
      if (avg) map[`${sec.sectionId}-${sub.subsectionId}`] = avg
    }
  }
  return map
})

function bulkEditableCellValue(rowKey: string, field: 'batch' | 'items' | 'productSizeCl' | 'batchType' | 'menuPriceFinal' | 'menuPriceFinalLarge' | 'ratio' | MenuPriceField | 'supplier'): string {
  const r = bulkRows.value.find((x) => x.rowKey === rowKey)
  const ov = r?.subsection.productOverrides?.[r?.productId ?? '']
  if (field === 'batchType') return ov?.batchType ?? ''
  if (field === 'ratio') return ov?.priceRatio != null ? fmt(ov.priceRatio) : (bulkCalcRows.value[rowKey]?.multiplier != null ? fmt(bulkCalcRows.value[rowKey].multiplier!) : '')
  if (field === 'menuPrice1') return ov?.menuPrice1IncVat != null ? fmt(ov.menuPrice1IncVat) : (ov?.menuPriceIncVat != null ? fmt(ov.menuPriceIncVat) : (bulkCalcRows.value[rowKey]?.menuPricePerSize?.[0] != null ? fmt(bulkCalcRows.value[rowKey].menuPricePerSize![0]) : ''))
  if (field === 'menuPrice2') return ov?.menuPrice2IncVat != null ? fmt(ov.menuPrice2IncVat) : (bulkCalcRows.value[rowKey]?.menuPricePerSize?.[1] != null ? fmt(bulkCalcRows.value[rowKey].menuPricePerSize![1]) : '')
  if (field === 'menuPrice3') return ov?.menuPrice3IncVat != null ? fmt(ov.menuPrice3IncVat) : (bulkCalcRows.value[rowKey]?.menuPricePerSize?.[2] != null ? fmt(bulkCalcRows.value[rowKey].menuPricePerSize![2]) : '')
  if (field === 'ratio1to2') return bulkCalcRows.value[rowKey]?.ratios?.[0] != null ? fmt(bulkCalcRows.value[rowKey].ratios![0]) : ''
  if (field === 'ratio2to3') return bulkCalcRows.value[rowKey]?.ratios?.[1] != null ? fmt(bulkCalcRows.value[rowKey].ratios![1]) : ''
  const row = bulkCalcRows.value[rowKey]
  if (!row) return ''
  if (field === 'batch') return row.batch != null ? fmt(row.batch) : ''
  if (field === 'items') return row.items != null ? String(row.items) : ''
  if (field === 'productSizeCl') return row.productSizeCl != null ? String(row.productSizeCl) : ''
  if (field === 'menuPriceFinal') return fmt(row.menuPriceFinal)
  if (field === 'menuPriceFinalLarge') return row.menuPriceLarge != null ? fmt(row.menuPriceLarge) : ''
  if (field === 'supplier') return row.supplier === '–' ? '' : row.supplier
  return ''
}

async function onBulkEditableBlur(
  sectionId: string,
  subsectionId: string,
  pid: string,
  field: 'batch' | 'items' | 'productSizeCl' | 'batchType' | 'menuPriceFinal' | 'menuPriceFinalLarge' | 'ratio' | MenuPriceField | 'supplier',
  value: string
) {
  if (!menuId.value) return
  const trimmed = value.trim()
  const updates: Partial<MenuProductOverride> = {}
  const r = bulkRows.value.find((x) => x.sectionId === sectionId && x.subsectionId === subsectionId && x.productId === pid)
  const rowKey = r?.rowKey
  if (field === 'batch') {
    if (trimmed === '') updates.batchCost = undefined
    else { const n = parseProductNumber(trimmed); updates.batchCost = Number.isNaN(n) ? undefined : n }
  } else if (field === 'items') {
    if (trimmed === '') updates.itemsPerBatch = undefined
    else { const n = parseProductNumber(trimmed); const num = Math.round(n); updates.itemsPerBatch = Number.isNaN(num) || num < 1 ? undefined : num }
  } else if (field === 'productSizeCl') {
    if (trimmed === '') updates.productSizeCl = undefined
    else { const n = parseProductNumber(trimmed); const num = Math.round(n); updates.productSizeCl = Number.isNaN(num) || num < 1 ? undefined : num }
  } else if (field === 'batchType') {
    updates.batchType = (trimmed === '' || !['crate', 'box', 'fust', 'bottle', 'bag'].includes(trimmed)) ? undefined : (trimmed as MenuProductOverride['batchType'])
  } else if (field === 'ratio') {
    if (trimmed === '') { updates.priceRatio = undefined; updates.menuPriceLargeIncVat = undefined }
    else {
      const n = parseProductNumber(trimmed)
      if (!Number.isNaN(n) && n > 0) {
        updates.priceRatio = n
        const regPrice = r?.subsection.productOverrides?.[pid]?.menuPriceIncVat ?? (rowKey ? bulkCalcRows.value[rowKey]?.menuPriceFinal : undefined) ?? 0
        updates.menuPriceLargeIncVat = regPrice > 0 ? regPrice * n : undefined
      }
    }
  } else if (field === 'menuPrice1') {
    if (trimmed === '') { updates.menuPrice1IncVat = undefined; updates.menuPriceIncVat = undefined }
    else { const n = parseProductNumber(trimmed); if (!Number.isNaN(n) && n >= 0) { updates.menuPrice1IncVat = n; updates.menuPriceIncVat = n } }
  } else if (field === 'menuPrice2') {
    if (trimmed === '') updates.menuPrice2IncVat = undefined
    else { const n = parseProductNumber(trimmed); if (!Number.isNaN(n) && n >= 0) updates.menuPrice2IncVat = n }
  } else if (field === 'menuPrice3') {
    if (trimmed === '') updates.menuPrice3IncVat = undefined
    else { const n = parseProductNumber(trimmed); if (!Number.isNaN(n) && n >= 0) updates.menuPrice3IncVat = n }
  } else if (field === 'ratio1to2') {
    const n = parseProductNumber(trimmed)
    if (!Number.isNaN(n) && n > 0) {
      const prev = r?.subsection.productOverrides?.[pid]?.menuPrice1IncVat ?? r?.subsection.productOverrides?.[pid]?.menuPriceIncVat ?? (rowKey ? bulkCalcRows.value[rowKey]?.menuPricePerSize?.[0] : undefined) ?? 0
      updates.menuPrice2IncVat = prev * n
    }
  } else if (field === 'ratio2to3') {
    const n = parseProductNumber(trimmed)
    if (!Number.isNaN(n) && n > 0) {
      const prev = r?.subsection.productOverrides?.[pid]?.menuPrice2IncVat ?? (rowKey ? bulkCalcRows.value[rowKey]?.menuPricePerSize?.[1] : undefined) ?? 0
      updates.menuPrice3IncVat = prev * n
    }
  } else if (field === 'menuPriceFinal') {
    if (trimmed === '') updates.menuPriceIncVat = undefined
    else { const n = parseProductNumber(trimmed); updates.menuPriceIncVat = Number.isNaN(n) || n < 0 ? undefined : n }
  } else if (field === 'menuPriceFinalLarge') {
    if (trimmed === '') updates.menuPriceLargeIncVat = undefined
    else { const n = parseProductNumber(trimmed); updates.menuPriceLargeIncVat = Number.isNaN(n) || n < 0 ? undefined : n }
  } else if (field === 'supplier') {
    updates.supplier = trimmed || undefined
  }
  if (Object.keys(updates).length === 0) return
  await updateProductOverrideForSubsection(sectionId, subsectionId, pid, updates)
}

async function updateProductOverrideForSubsection(
  sectionId: string,
  subsectionId: string,
  pid: string,
  updates: Partial<MenuProductOverride>
) {
  if (!menuId.value) return
  const current = currentSectionsV2()
  const next = current.map((s) => {
    if (s.id !== sectionId) return s
    const subs = (s.subsections ?? []).map((sub) => {
      if (sub.id !== subsectionId) return sub
      const existing = sub.productOverrides?.[pid] ?? {}
      const overrides = { ...(sub.productOverrides ?? {}), [pid]: { ...existing, ...updates } }
      return { ...sub, productOverrides: overrides }
    })
    return { ...s, subsections: subs }
  })
  saving.value = true
  try {
    await patchSections(next)
  } finally {
    saving.value = false
  }
}

function productDisplayNameForRow(pid: string, subsection: MenuSubsectionV2): string {
  const item = productsById.value[pid]
  const ov = subsection?.productOverrides?.[pid]
  if (ov?.displayName) return ov.displayName
  return productDisplayName(item)
}

function fmt(n: number): string {
  return n.toFixed(2).replace('.', ',')
}

function calcRowForProduct(pid: string): {
  batch: string
  items: string
  productSizeCl: string
  costPerItem: string
  costPlusWaste: string
  wastePercent: string
  margin: string
  btw: string
  nett: string
  menuPriceCalculated: string
  marginFinal: string
  menuPriceFinal: string
  supplier: string
  nettSmall?: string
  menuPriceSmall?: string
  nettLarge?: string
  menuPriceLarge?: string
  multiplier?: string
} | null {
  const row = subsectionCalcRows.value[pid]
  if (!row) return null
  const base = {
    batch: row.batch != null ? fmt(row.batch) : '–',
    items: row.items != null ? String(row.items) : '–',
    productSizeCl: row.productSizeCl != null ? String(row.productSizeCl) : '–',
    costPerItem: fmt(row.costPerItem),
    costPlusWaste: fmt(row.costPlusWaste),
    wastePercent: String(row.wastePercent),
    margin: fmt(row.margin),
    btw: String(row.vatRate),
    nett: fmt(row.nett),
    menuPriceCalculated: fmt(row.menuPriceCalculated),
    marginFinal: fmt(row.marginFinal),
    menuPriceFinal: fmt(row.menuPriceFinal),
    supplier: row.supplier,
  }
  if (row.nettSmall != null && row.menuPriceSmall != null && row.nettLarge != null && row.menuPriceLarge != null && row.multiplier != null) {
    return {
      ...base,
      nettSmall: fmt(row.nettSmall),
      menuPriceSmall: fmt(row.menuPriceSmall),
      nettLarge: fmt(row.nettLarge),
      menuPriceLarge: fmt(row.menuPriceLarge),
      multiplier: row.multiplier.toFixed(2).replace('.', ','),
    }
  }
  return base
}

type MenuPriceField = 'menuPrice1' | 'menuPrice2' | 'menuPrice3' | 'ratio1to2' | 'ratio2to3'
function editableCellValue(pid: string, field: 'batch' | 'items' | 'productSizeCl' | 'batchType' | 'menuPriceFinal' | 'menuPriceFinalLarge' | 'ratio' | MenuPriceField | 'supplier'): string {
  const sel = activeSubsection.value
  const ov = sel?.subsection.productOverrides?.[pid]
  if (field === 'batchType') return ov?.batchType ?? ''
  if (field === 'ratio') return ov?.priceRatio != null ? fmt(ov.priceRatio) : (subsectionCalcRows.value[pid]?.multiplier != null ? fmt(subsectionCalcRows.value[pid].multiplier!) : '')
  if (field === 'menuPrice1') return ov?.menuPrice1IncVat != null ? fmt(ov.menuPrice1IncVat) : (ov?.menuPriceIncVat != null ? fmt(ov.menuPriceIncVat) : (subsectionCalcRows.value[pid]?.menuPricePerSize?.[0] != null ? fmt(subsectionCalcRows.value[pid].menuPricePerSize![0]) : ''))
  if (field === 'menuPrice2') return ov?.menuPrice2IncVat != null ? fmt(ov.menuPrice2IncVat) : (subsectionCalcRows.value[pid]?.menuPricePerSize?.[1] != null ? fmt(subsectionCalcRows.value[pid].menuPricePerSize![1]) : '')
  if (field === 'menuPrice3') return ov?.menuPrice3IncVat != null ? fmt(ov.menuPrice3IncVat) : (subsectionCalcRows.value[pid]?.menuPricePerSize?.[2] != null ? fmt(subsectionCalcRows.value[pid].menuPricePerSize![2]) : '')
  if (field === 'ratio1to2') return subsectionCalcRows.value[pid]?.ratios?.[0] != null ? fmt(subsectionCalcRows.value[pid].ratios![0]) : ''
  if (field === 'ratio2to3') return subsectionCalcRows.value[pid]?.ratios?.[1] != null ? fmt(subsectionCalcRows.value[pid].ratios![1]) : ''
  const row = subsectionCalcRows.value[pid]
  if (!row) return ''
  if (field === 'batch') return row.batch != null ? fmt(row.batch) : ''
  if (field === 'items') return row.items != null ? String(row.items) : ''
  if (field === 'productSizeCl') return row.productSizeCl != null ? String(row.productSizeCl) : ''
  if (field === 'menuPriceFinal') return fmt(row.menuPriceFinal)
  if (field === 'menuPriceFinalLarge') return row.menuPriceLarge != null ? fmt(row.menuPriceLarge) : ''
  if (field === 'supplier') return row.supplier === '–' ? '' : row.supplier
  return ''
}

async function onEditableBlur(pid: string, field: 'batch' | 'items' | 'productSizeCl' | 'batchType' | 'menuPriceFinal' | 'menuPriceFinalLarge' | 'ratio' | MenuPriceField | 'supplier', value: string) {
  const sel = activeSubsection.value
  if (!sel || !menuId.value) return
  const trimmed = value.trim()
  const updates: Partial<MenuProductOverride> = {}
  if (field === 'batch') {
    if (trimmed === '') updates.batchCost = undefined
    else { const n = parseProductNumber(trimmed); updates.batchCost = Number.isNaN(n) ? undefined : n }
  } else if (field === 'items') {
    if (trimmed === '') updates.itemsPerBatch = undefined
    else { const n = parseProductNumber(trimmed); const num = Math.round(n); updates.itemsPerBatch = Number.isNaN(num) || num < 1 ? undefined : num }
  } else if (field === 'productSizeCl') {
    if (trimmed === '') updates.productSizeCl = undefined
    else { const n = parseProductNumber(trimmed); const num = Math.round(n); updates.productSizeCl = Number.isNaN(num) || num < 1 ? undefined : num }
  } else if (field === 'batchType') {
    updates.batchType = (trimmed === '' || !['crate', 'box', 'fust', 'bottle', 'bag'].includes(trimmed)) ? undefined : (trimmed as MenuProductOverride['batchType'])
  } else if (field === 'ratio') {
    if (trimmed === '') { updates.priceRatio = undefined; updates.menuPriceLargeIncVat = undefined }
    else {
      const n = parseProductNumber(trimmed)
      if (!Number.isNaN(n) && n > 0) {
        updates.priceRatio = n
        const regPrice = sel.subsection.productOverrides?.[pid]?.menuPriceIncVat ?? subsectionCalcRows.value[pid]?.menuPriceFinal ?? 0
        updates.menuPriceLargeIncVat = regPrice > 0 ? regPrice * n : undefined
      }
    }
  } else if (field === 'menuPrice1') {
    if (trimmed === '') { updates.menuPrice1IncVat = undefined; updates.menuPriceIncVat = undefined }
    else { const n = parseProductNumber(trimmed); if (!Number.isNaN(n) && n >= 0) { updates.menuPrice1IncVat = n; updates.menuPriceIncVat = n } }
  } else if (field === 'menuPrice2') {
    if (trimmed === '') updates.menuPrice2IncVat = undefined
    else { const n = parseProductNumber(trimmed); if (!Number.isNaN(n) && n >= 0) updates.menuPrice2IncVat = n }
  } else if (field === 'menuPrice3') {
    if (trimmed === '') updates.menuPrice3IncVat = undefined
    else { const n = parseProductNumber(trimmed); if (!Number.isNaN(n) && n >= 0) updates.menuPrice3IncVat = n }
  } else if (field === 'ratio1to2') {
    const n = parseProductNumber(trimmed)
    if (!Number.isNaN(n) && n > 0) {
      const prev = sel.subsection.productOverrides?.[pid]?.menuPrice1IncVat ?? sel.subsection.productOverrides?.[pid]?.menuPriceIncVat ?? subsectionCalcRows.value[pid]?.menuPricePerSize?.[0] ?? 0
      updates.menuPrice2IncVat = prev * n
    }
  } else if (field === 'ratio2to3') {
    const n = parseProductNumber(trimmed)
    if (!Number.isNaN(n) && n > 0) {
      const prev = sel.subsection.productOverrides?.[pid]?.menuPrice2IncVat ?? subsectionCalcRows.value[pid]?.menuPricePerSize?.[1] ?? 0
      updates.menuPrice3IncVat = prev * n
    }
  } else if (field === 'menuPriceFinal') {
    if (trimmed === '') updates.menuPriceIncVat = undefined
    else { const n = parseProductNumber(trimmed); updates.menuPriceIncVat = Number.isNaN(n) || n < 0 ? undefined : n }
  } else if (field === 'menuPriceFinalLarge') {
    if (trimmed === '') updates.menuPriceLargeIncVat = undefined
    else { const n = parseProductNumber(trimmed); updates.menuPriceLargeIncVat = Number.isNaN(n) || n < 0 ? undefined : n }
  } else if (field === 'supplier') {
    updates.supplier = trimmed || undefined
  }
  if (Object.keys(updates).length === 0) return
  await updateProductOverride(pid, updates)
}

async function updateProductOverride(pid: string, updates: Partial<MenuProductOverride>) {
  const sel = activeSubsection.value
  if (!sel || !menuId.value) return
  const current = currentSectionsV2()
  const next = current.map((s) => {
    if (s.id !== sel.sectionId) return s
    const subs = (s.subsections ?? []).map((sub) => {
      if (sub.id !== sel.subsection.id) return sub
      const existing = sub.productOverrides?.[pid] ?? {}
      const overrides = { ...(sub.productOverrides ?? {}), [pid]: { ...existing, ...updates } }
      return { ...sub, productOverrides: overrides }
    })
    return { ...s, subsections: subs }
  })
  saving.value = true
  try {
    await patchSections(next)
  } finally {
    saving.value = false
  }
}

async function removeProductFromSubsection(sectionId: string, subsectionId: string, pid: string) {
  const current = currentSectionsV2()
  const next = current.map((s) => {
    if (s.id !== sectionId) return s
    const subs = (s.subsections ?? []).map((sub) => {
      if (sub.id !== subsectionId) return sub
      const ids = (sub.productIds ?? []).filter((id) => id !== pid)
      const overrides = { ...(sub.productOverrides ?? {}) }
      delete overrides[pid]
      return { ...sub, productIds: ids, productOverrides: overrides }
    })
    return { ...s, subsections: subs }
  })
  saving.value = true
  try {
    await patchSections(next)
  } finally {
    saving.value = false
  }
}

async function saveMenuForSubsection() {
  await refresh()
}

async function saveVersion() {
  if (!menuId.value) return
  savingVersion.value = true
  try {
    await $fetch(`/api/menu/menus/${menuId.value}/versions`, { method: 'POST' })
    await refresh()
  } finally {
    savingVersion.value = false
  }
}

async function exportExcel(printedOnly: boolean) {
  if (!menuId.value) return
  const url = `/api/menu/menus/${menuId.value}/export/excel${printedOnly ? '?printedOnly=true' : ''}`
  const blob = await $fetch<Blob>(url, { responseType: 'blob' })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = `${menu?.name ?? 'menu'}${printedOnly ? '-printed' : ''}.xlsx`
  a.click()
  URL.revokeObjectURL(a.href)
}

function productNameForId(pid: string): string {
  const item = productsById.value[pid]
  if (!item) return pid
  const ov = activeSubsection.value?.subsection?.productOverrides?.[pid]
  if (ov?.displayName) return ov.displayName
  return productDisplayName(item)
}

function showOnPrintedFor(pid: string): boolean {
  const sub = activeSubsection.value?.subsection
  if (!sub?.productOverrides?.[pid]) return true
  return sub.productOverrides[pid].showOnPrintedMenu !== false
}

function onShowOnPrintedChange(pid: string, e: Event) {
  const el = e.target as HTMLInputElement
  toggleShowOnPrinted(pid, el?.checked ?? false)
}

async function toggleShowOnPrinted(pid: string, value: boolean) {
  const sel = activeSubsection.value
  if (!sel || !menuId.value) return
  const current = currentSectionsV2()
  const next = current.map((s) => {
    if (s.id !== sel.sectionId) return s
    const subs = (s.subsections ?? []).map((sub) => {
      if (sub.id !== sel.subsection.id) return sub
      const overrides = { ...(sub.productOverrides ?? {}), [pid]: { ...(sub.productOverrides?.[pid] ?? {}), showOnPrintedMenu: value } }
      return { ...sub, productOverrides: overrides }
    })
    return { ...s, subsections: subs }
  })
  saving.value = true
  try {
    await patchSections(next)
  } finally {
    saving.value = false
  }
}

async function moveProduct(sectionId: string, subsectionId: string, pid: string, delta: number) {
  const current = currentSectionsV2()
  const next = current.map((s) => {
    if (s.id !== sectionId) return s
    const subs = (s.subsections ?? []).map((sub) => {
      if (sub.id !== subsectionId) return sub
      const ids = [...(sub.productIds ?? [])]
      const idx = ids.indexOf(pid)
      if (idx === -1 || idx + delta < 0 || idx + delta >= ids.length) return sub
      ;[ids[idx], ids[idx + delta]] = [ids[idx + delta], ids[idx]]
      return { ...sub, productIds: ids }
    })
    return { ...s, subsections: subs }
  })
  saving.value = true
  try {
    await patchSections(next)
  } finally {
    saving.value = false
  }
}

function formatDate(d: string | undefined): string {
  if (!d) return '–'
  return new Date(d).toLocaleDateString(undefined, { dateStyle: 'short' })
}

function getInputValue(e: Event): string {
  const el = e?.target as HTMLInputElement | null
  return el?.value ?? ''
}
</script>
