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

  <!-- Full Page Drawer -->
  <USlideover v-model="isDrawerOpen" :ui="{ width: 'w-screen' }">
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
        />
      </div>
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
</script>
