<template>
  <div class="max-w-4xl space-y-6">
    <div class="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
      <h1 class="text-2xl font-bold text-gray-900 mb-1">Product Uploader</h1>
      <p class="text-gray-600 text-sm mb-6">
        Import menu products from CSV, Excel, or PDF files. Supports multiple file uploads.
      </p>

      <!-- Upload -->
      <div class="space-y-3">
        <h2 class="text-sm font-semibold text-gray-900">Upload Files</h2>

        <!-- Drop zone -->
        <div
          class="rounded-lg border-2 border-dashed transition-colors min-h-[120px] flex flex-col items-center justify-center gap-2 p-4"
          :class="isDragging ? 'border-primary-500 bg-primary-50' : 'border-gray-300 bg-gray-50/50 hover:border-gray-400'"
          @dragover.prevent="isDragging = true"
          @dragleave.prevent="isDragging = false"
          @drop.prevent="onDrop"
        >
          <UIcon name="i-lucide-upload-cloud" class="size-8 text-gray-400" />
          <p class="text-sm text-gray-600 font-medium">Drop files here to upload</p>
          <p class="text-xs text-gray-500">or</p>
          <input
            ref="fileInputRef"
            type="file"
            accept=".csv,.xlsx,.xls,.pdf"
            multiple
            class="block w-full max-w-xs text-sm text-gray-500 file:mr-4 file:rounded-md file:border-0 file:bg-gray-100 file:px-4 file:py-2 file:text-sm file:font-medium file:text-gray-700 hover:file:bg-gray-200"
            @change="onFileChange"
          />
          <p class="text-xs text-gray-400 mt-2">Supported: CSV, Excel (.xlsx, .xls), PDF</p>
        </div>

        <!-- Selected files -->
        <div v-if="selectedFiles.length" class="rounded-lg bg-blue-50 border border-blue-200 p-4">
          <div class="flex items-center justify-between mb-3">
            <span class="text-sm font-medium text-gray-900">
              {{ selectedFiles.length }} file(s) ready to upload
            </span>
            <UButton size="xs" color="neutral" variant="ghost" @click="clearFiles">
              Clear all
            </UButton>
          </div>
          <div class="space-y-2">
            <div
              v-for="(file, i) in selectedFiles"
              :key="i"
              class="flex items-center justify-between rounded bg-white p-2.5 border border-blue-100"
            >
              <div class="flex items-center gap-2 flex-1 min-w-0">
                <UIcon name="i-lucide-file" class="size-4 text-gray-400 shrink-0" />
                <span class="text-sm text-gray-700 truncate">{{ file.name }}</span>
                <span class="text-xs text-gray-500 shrink-0">({{ formatFileSize(file.size) }})</span>
              </div>
              <UButton
                size="xs"
                color="red"
                variant="ghost"
                icon="i-lucide-x"
                @click="removeFile(i)"
              />
            </div>
          </div>
        </div>

        <!-- Import button & results -->
        <form @submit.prevent="submitImport" class="flex flex-wrap items-end gap-3">
          <UButton
            type="submit"
            :loading="importLoading"
            :disabled="selectedFiles.length === 0"
            icon="i-lucide-upload"
          >
            {{ importLoading ? 'Uploading...' : 'Upload & Import' }}
          </UButton>
          <span v-if="!importLoading && importResult" class="text-xs text-gray-500">
            Last upload: {{ formatTime(lastUploadTime) }}
          </span>
        </form>

        <!-- Results -->
        <transition name="fade">
          <div v-if="importResult" class="space-y-3">
            <div
              class="rounded-lg p-4 border"
              :class="importResult.success ? 'bg-green-50 border-green-200' : 'bg-amber-50 border-amber-200'"
            >
              <div class="flex items-start gap-3">
                <UIcon
                  :name="importResult.success ? 'i-lucide-check-circle-2' : 'i-lucide-alert-circle'"
                  class="size-5 shrink-0 mt-0.5"
                  :class="importResult.success ? 'text-green-600' : 'text-amber-600'"
                />
                <div class="flex-1 min-w-0">
                  <p
                    class="text-sm font-medium"
                    :class="importResult.success ? 'text-green-900' : 'text-amber-900'"
                  >
                    {{ importResult.imported }} imported, {{ importResult.updated }} updated
                    <span v-if="importResult.failed">, {{ importResult.failed }} errors</span>
                  </p>
                  <ul
                    v-if="importResult.errors?.length"
                    class="mt-2 space-y-1 text-xs"
                    :class="importResult.success ? 'text-green-700' : 'text-amber-700'"
                  >
                    <li v-for="(err, i) in importResult.errors.slice(0, 5)" :key="i">
                      <span class="font-medium">Row {{ err.row }}:</span> {{ err.error }}
                    </li>
                    <li v-if="importResult.errors.length > 5" class="font-medium">
                      … and {{ importResult.errors.length - 5 }} more errors
                    </li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        </transition>
      </div>

      <!-- Footer links -->
      <div class="mt-8 pt-6 border-t border-gray-200 space-y-2">
        <NuxtLink
          to="/daily-menu-products/products"
          class="inline-flex items-center gap-1 text-sm font-medium text-primary-600 hover:text-primary-700"
        >
          <UIcon name="i-lucide-list" class="size-4" />
          View all products
        </NuxtLink>
        <div class="flex gap-4 text-xs text-gray-500">
          <span>Max file size: 10 MB</span>
          <span>•</span>
          <span>Supports CSV, Excel, PDF formats</span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { MenuImportResult } from '~/types/menuItem'

definePageMeta({
  layout: 'default',
})

const ACCEPT_EXT = ['.csv', '.xlsx', '.xls', '.pdf']

const fileInputRef = ref<HTMLInputElement | null>(null)
const selectedFiles = ref<File[]>([])
const isDragging = ref(false)
const importLoading = ref(false)
const importResult = ref<MenuImportResult | null>(null)
const lastUploadTime = ref<Date | null>(null)

function acceptFile(file: File): boolean {
  const name = file.name.toLowerCase()
  return ACCEPT_EXT.some((ext) => name.endsWith(ext))
}

function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return `${Math.round((bytes / Math.pow(k, i)) * 10) / 10} ${sizes[i]}`
}

function formatTime(date: Date | null): string {
  if (!date) return ''
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date)
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

function removeFile(index: number) {
  selectedFiles.value.splice(index, 1)
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
    lastUploadTime.value = new Date()
    if (res.imported > 0 || res.updated > 0) {
      clearFiles()
      setTimeout(() => {
        navigateTo('/daily-menu-products/products')
      }, 1500)
    }
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

<style scoped>
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.2s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
