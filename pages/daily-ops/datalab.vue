<template>
  <div class="flex h-full flex-col gap-6 p-6">
    <div>
      <h1 class="text-3xl font-bold">Bork Datalab Reports</h1>
      <p class="text-sm text-gray-600">Real-time sales & operations data from Bork API</p>
    </div>

    <!-- Button Grid -->
    <div class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <UButton
        v-for="report in DATALAB_REPORTS"
        :key="report.url"
        @click="openDrawer(report)"
        size="lg"
        color="violet"
        variant="soft"
        class="h-20"
      >
        {{ report.name }}
      </UButton>
    </div>
  </div>

  <!-- Full Page Drawer from Bottom -->
  <USlideover v-model="isDrawerOpen" side="bottom">
    <div class="flex h-full flex-col bg-white">
      <!-- Header with Close Button -->
      <div class="flex items-center justify-between border-b border-gray-200 px-6 py-4">
        <h2 class="text-lg font-bold">{{ selectedReport?.name }}</h2>
        <UButton
          color="gray"
          variant="ghost"
          size="sm"
          icon="i-heroicons-x-mark-20-solid"
          @click="isDrawerOpen = false"
        />
      </div>

      <!-- Iframe Full Screen -->
      <div class="flex-1 overflow-hidden">
        <iframe
          v-if="selectedReport && isDrawerOpen"
          :src="selectedReport.url"
          class="h-full w-full border-0"
          title="Bork Datalab Report"
          allow="fullscreen; accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          @error="onIframeError"
        />
        <!-- Fallback if iframe fails -->
        <div v-if="iframeError" class="flex h-full flex-col items-center justify-center gap-4 bg-gray-50 p-6">
          <p class="text-gray-700">Unable to load report in page</p>
          <UButton
            @click="openInNewTab"
            color="violet"
            variant="solid"
          >
            Open in New Tab
          </UButton>
        </div>
      </div>
    </div>
  </USlideover>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { DATALAB_REPORTS, type DatalabReport } from '~/utils/datalabReports'

const isDrawerOpen = ref(false)
const selectedReport = ref<DatalabReport | null>(null)
const iframeError = ref(false)

const openDrawer = (report: DatalabReport) => {
  selectedReport.value = report
  isDrawerOpen.value = true
  iframeError.value = false
}

const onIframeError = () => {
  iframeError.value = true
}

const openInNewTab = () => {
  if (selectedReport.value) {
    window.open(selectedReport.value.url, '_blank')
  }
}

definePageMeta({
  layout: 'default',
})
</script>
