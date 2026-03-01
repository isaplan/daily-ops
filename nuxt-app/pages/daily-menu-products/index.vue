<template>
  <div class="max-w-4xl space-y-6">
    <div class="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
      <h1 class="text-2xl font-bold text-gray-900 mb-1">Daily Menu & Products</h1>
      <p class="text-gray-600 text-sm mb-6">
        Import drinks (wijnkaart CSV/Excel) or view the product list.
      </p>

      <!-- Upload -->
      <div class="space-y-3">
        <h2 class="text-sm font-semibold text-gray-900">Import CSV, Excel, or PDF</h2>

        <!-- Drop zone -->
        <div
          class="rounded-lg border-2 border-dashed transition-colors min-h-[120px] flex flex-col items-center justify-center gap-2 p-4"
          :class="isDragging ? 'border-primary-500 bg-primary-50' : 'border-gray-300 bg-gray-50/50 hover:border-gray-400'"
          @dragover.prevent="isDragging = true"
          @dragleave.prevent="isDragging = false"
          @drop.prevent="onDrop"
        >
          <p class="text-sm text-gray-600">Drop CSV, Excel, or PDF files here</p>
          <p class="text-xs text-gray-500">or</p>
          <input
            ref="fileInputRef"
            type="file"
            accept=".csv,.xlsx,.xls,.pdf"
            multiple
            class="block w-full max-w-xs text-sm text-gray-500 file:mr-4 file:rounded-md file:border-0 file:bg-gray-100 file:px-4 file:py-2 file:text-sm file:font-medium file:text-gray-700 hover:file:bg-gray-200"
            @change="onFileChange"
          />
        </div>

        <div v-if="selectedFiles.length" class="flex flex-wrap items-center gap-2">
          <span class="text-sm text-gray-600">{{ selectedFiles.length }} file(s):</span>
          <span
            v-for="(f, i) in selectedFiles"
            :key="i"
            class="inline-flex items-center gap-1 rounded bg-gray-200 px-2 py-0.5 text-xs text-gray-700"
          >
            {{ f.name }}
          </span>
          <UButton size="xs" color="neutral" variant="ghost" @click="clearFiles">Clear</UButton>
        </div>

        <form @submit.prevent="submitImport" class="flex flex-wrap items-end gap-3">
          <UButton
            type="submit"
            :loading="importLoading"
            :disabled="selectedFiles.length === 0"
          >
            Import
          </UButton>
        </form>
        <p v-if="importResult" class="text-sm" :class="importResult.success ? 'text-green-700' : 'text-amber-700'">
          {{ importResult.imported }} imported, {{ importResult.updated }} updated
          <span v-if="importResult.failed">, {{ importResult.failed }} errors</span>.
        </p>
        <ul v-if="importResult?.errors?.length" class="list-disc list-inside text-sm text-red-700">
          <li v-for="(err, i) in importResult.errors.slice(0, 10)" :key="i">
            Row {{ err.row }}: {{ err.error }}
          </li>
          <li v-if="importResult.errors.length > 10">
            … and {{ importResult.errors.length - 10 }} more
          </li>
        </ul>
      </div>

      <div class="mt-6 pt-6 border-t border-gray-200">
        <NuxtLink
          to="/daily-menu-products/products"
          class="text-sm font-medium text-primary-600 hover:text-primary-700"
        >
          View products list →
        </NuxtLink>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { MenuImportResult } from '~/types/menuItem'

const ACCEPT_EXT = ['.csv', '.xlsx', '.xls', '.pdf']

const fileInputRef = ref<HTMLInputElement | null>(null)
const selectedFiles = ref<File[]>([])
const isDragging = ref(false)
const importLoading = ref(false)
const importResult = ref<MenuImportResult | null>(null)

function acceptFile(file: File): boolean {
  const name = file.name.toLowerCase()
  return ACCEPT_EXT.some((ext) => name.endsWith(ext))
}

function onFileChange(e: Event) {
  const target = e.target as HTMLInputElement
  const list = target.files
  selectedFiles.value = list ? Array.from(list).filter(acceptFile) : []
}

function onDrop(e: DragEvent) {
  isDragging.value = false
  const list = e.dataTransfer?.files
  if (!list) return
  selectedFiles.value = Array.from(list).filter(acceptFile)
  if (fileInputRef.value) fileInputRef.value.value = ''
}

function clearFiles() {
  selectedFiles.value = []
  if (fileInputRef.value) fileInputRef.value.value = ''
}

async function submitImport() {
  if (selectedFiles.value.length === 0) return
  importLoading.value = true
  importResult.value = null
  try {
    const form = new FormData()
    for (const file of selectedFiles.value) {
      form.append('file', file)
    }
    const res = await $fetch<MenuImportResult>('/api/menu/import', {
      method: 'POST',
      body: form,
    })
    importResult.value = res
    if (res.imported > 0 || res.updated > 0) {
      await navigateTo('/daily-menu-products/products')
    }
    clearFiles()
  } catch (e) {
    importResult.value = {
      success: false,
      imported: 0,
      updated: 0,
      failed: 1,
      errors: [{ row: 0, error: e instanceof Error ? e.message : 'Import failed' }],
    }
  } finally {
    importLoading.value = false
  }
}
</script>
