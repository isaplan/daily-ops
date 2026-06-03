<template>
  <!-- Page: Only Buttons -->
  <div class="flex h-full flex-col items-center justify-center gap-8 p-6">
    <div class="text-center">
      <h1 class="text-4xl font-bold">Bork Datalab Reports</h1>
      <p class="text-gray-600">Click a button to view report</p>
    </div>

    <!-- Button Grid Only -->
    <div class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <UButton
        v-for="report in DATALAB_REPORTS"
        :key="report.url"
        @click="openDrawer(report)"
        size="xl"
        color="violet"
        class="h-24 text-base"
      >
        {{ report.name }}
      </UButton>
    </div>
  </div>

  <!-- Drawer: Full Screen Overlay from Bottom -->
  <USlideover v-model="isDrawerOpen" side="bottom" :ui="{ width: 'w-full' }">
    <!-- Header -->
    <div class="flex items-center justify-between border-b border-gray-200 bg-white px-6 py-4">
      <h2 class="text-xl font-bold">{{ selectedReport?.name }}</h2>
      <UButton
        color="gray"
        variant="ghost"
        size="md"
        icon="i-heroicons-x-mark-20-solid"
        @click="isDrawerOpen = false"
      />
    </div>

    <!-- Iframe -->
    <div class="flex-1 overflow-hidden bg-white">
      <iframe
        v-if="selectedReport && isDrawerOpen"
        :src="selectedReport.url"
        class="h-full w-full border-0"
        title="Bork Datalab Report"
        allow="fullscreen; accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
      />
    </div>
  </USlideover>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { DATALAB_REPORTS, type DatalabReport } from '~/utils/datalabReports'

const isDrawerOpen = ref(false)
const selectedReport = ref<DatalabReport | null>(null)

const openDrawer = (report: DatalabReport) => {
  selectedReport.value = report
  isDrawerOpen.value = true
}

definePageMeta({
  layout: 'default',
})
</script>
