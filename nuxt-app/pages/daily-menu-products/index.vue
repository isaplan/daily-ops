<template>
  <div class="max-w-6xl space-y-6">
    <!-- Header -->
    <div class="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
      <h1 class="text-3xl font-bold text-gray-900 mb-2">Daily Menu & Products</h1>
      <p class="text-gray-600 text-base">
        Manage your menu items, import products, and organize your pricing structure in one place.
      </p>
    </div>

    <!-- Quick Actions Grid -->
    <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
      <!-- Product Uploader Card -->
      <NuxtLink
        to="/daily-menu-products/product-uploader"
        class="group rounded-lg border border-gray-200 bg-white p-6 shadow-sm hover:shadow-md hover:border-primary-300 transition-all"
      >
        <div class="flex items-start justify-between mb-4">
          <div
            class="inline-flex items-center justify-center size-12 rounded-lg bg-blue-100 text-blue-600 group-hover:bg-blue-200 transition-colors"
          >
            <UIcon name="i-lucide-upload-cloud" class="size-6" />
          </div>
          <UIcon name="i-lucide-arrow-right" class="size-5 text-gray-400 group-hover:text-primary-600 transition-colors" />
        </div>
        <h2 class="text-lg font-semibold text-gray-900 mb-1">Product Uploader</h2>
        <p class="text-sm text-gray-600 mb-4">
          Import menu products from CSV, Excel, or PDF files. Supports batch uploads with automatic deduplication.
        </p>
        <div class="text-xs text-gray-500 space-y-1">
          <div class="flex items-center gap-2">
            <UIcon name="i-lucide-check" class="size-3" />
            <span>Supports CSV, Excel, PDF</span>
          </div>
          <div class="flex items-center gap-2">
            <UIcon name="i-lucide-check" class="size-3" />
            <span>Drag & drop or select files</span>
          </div>
          <div class="flex items-center gap-2">
            <UIcon name="i-lucide-check" class="size-3" />
            <span>Max 10 MB per file</span>
          </div>
        </div>
      </NuxtLink>

      <!-- Products List Card -->
      <NuxtLink
        to="/daily-menu-products/products"
        class="group rounded-lg border border-gray-200 bg-white p-6 shadow-sm hover:shadow-md hover:border-primary-300 transition-all"
      >
        <div class="flex items-start justify-between mb-4">
          <div
            class="inline-flex items-center justify-center size-12 rounded-lg bg-green-100 text-green-600 group-hover:bg-green-200 transition-colors"
          >
            <UIcon name="i-lucide-list" class="size-6" />
          </div>
          <UIcon name="i-lucide-arrow-right" class="size-5 text-gray-400 group-hover:text-primary-600 transition-colors" />
        </div>
        <h2 class="text-lg font-semibold text-gray-900 mb-1">Products List</h2>
        <p class="text-sm text-gray-600 mb-4">
          Browse, edit, and manage all imported products. View pricing, categories, and product details.
        </p>
        <div class="text-xs text-gray-500 space-y-1">
          <div class="flex items-center gap-2">
            <UIcon name="i-lucide-check" class="size-3" />
            <span>Search and filter</span>
          </div>
          <div class="flex items-center gap-2">
            <UIcon name="i-lucide-check" class="size-3" />
            <span>Inline editing</span>
          </div>
          <div class="flex items-center gap-2">
            <UIcon name="i-lucide-check" class="size-3" />
            <span>Bulk operations</span>
          </div>
        </div>
      </NuxtLink>

      <!-- Menu Builder Card -->
      <NuxtLink
        to="/daily-menu-products/menu-builder"
        class="group rounded-lg border border-gray-200 bg-white p-6 shadow-sm hover:shadow-md hover:border-primary-300 transition-all"
      >
        <div class="flex items-start justify-between mb-4">
          <div
            class="inline-flex items-center justify-center size-12 rounded-lg bg-purple-100 text-purple-600 group-hover:bg-purple-200 transition-colors"
          >
            <UIcon name="i-lucide-clipboard-list" class="size-6" />
          </div>
          <UIcon name="i-lucide-arrow-right" class="size-5 text-gray-400 group-hover:text-primary-600 transition-colors" />
        </div>
        <h2 class="text-lg font-semibold text-gray-900 mb-1">Menu Builder</h2>
        <p class="text-sm text-gray-600 mb-4">
          Create and organize menus by grouping products into categories and sections.
        </p>
        <div class="text-xs text-gray-500 space-y-1">
          <div class="flex items-center gap-2">
            <UIcon name="i-lucide-check" class="size-3" />
            <span>Drag & drop organization</span>
          </div>
          <div class="flex items-center gap-2">
            <UIcon name="i-lucide-check" class="size-3" />
            <span>Multiple menus</span>
          </div>
          <div class="flex items-center gap-2">
            <UIcon name="i-lucide-check" class="size-3" />
            <span>Custom pricing per menu</span>
          </div>
        </div>
      </NuxtLink>
    </div>

    <!-- Info Cards -->
    <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
      <div class="rounded-lg border border-blue-200 bg-blue-50 p-4">
        <div class="flex items-start gap-3">
          <UIcon name="i-lucide-info" class="size-5 text-blue-600 shrink-0 mt-0.5" />
          <div class="text-sm">
            <p class="font-medium text-blue-900">PDF Support</p>
            <p class="text-blue-700 text-xs mt-1">
              Upload menu PDFs with table structures. Our parser extracts and organizes the data automatically.
            </p>
          </div>
        </div>
      </div>

      <div class="rounded-lg border border-green-200 bg-green-50 p-4">
        <div class="flex items-start gap-3">
          <UIcon name="i-lucide-info" class="size-5 text-green-600 shrink-0 mt-0.5" />
          <div class="text-sm">
            <p class="font-medium text-green-900">Format Flexibility</p>
            <p class="text-green-700 text-xs mt-1">
              Import from CSV, Excel, or PDF. Each format is automatically detected and parsed correctly.
            </p>
          </div>
        </div>
      </div>

      <div class="rounded-lg border border-amber-200 bg-amber-50 p-4">
        <div class="flex items-start gap-3">
          <UIcon name="i-lucide-info" class="size-5 text-amber-600 shrink-0 mt-0.5" />
          <div class="text-sm">
            <p class="font-medium text-amber-900">Smart Deduplication</p>
            <p class="text-amber-700 text-xs mt-1">
              Import the same products multiple times without creating duplicates. Automatically merged.
            </p>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
definePageMeta({
  layout: 'default',
})
</script>
