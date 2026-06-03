<template>
  <div class="flex h-full flex-col gap-6 p-6">
    <div>
      <h1 class="text-3xl font-bold">Bork Datalab Reports</h1>
      <p class="text-sm text-gray-600">Real-time sales & operations data from Bork API</p>
    </div>

    <!-- Button Grid -->
    <div class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <button
        v-for="report in DATALAB_REPORTS"
        :key="report.url"
        @click="openModal(report)"
        class="rounded-lg border-2 border-purple-200 bg-gradient-to-br from-purple-50 to-purple-100 px-6 py-8 text-center font-semibold text-purple-900 transition-all hover:border-purple-500 hover:shadow-lg active:scale-95"
      >
        {{ report.name }}
      </button>
    </div>

    <!-- Modal -->
    <UModal v-model="isOpen" :ui="{ width: 'w-full sm:max-w-6xl' }">
      <UCard
        class="flex h-screen flex-col bg-white"
        :ui="{ body: { padding: 'p-0' }, header: { padding: 'px-6 py-4' } }"
      >
        <template #header>
          <div class="flex items-center justify-between">
            <h2 class="text-xl font-bold">{{ selectedReport?.name }}</h2>
            <button @click="isOpen = false" class="text-gray-400 hover:text-gray-600">
              <svg class="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </template>

        <!-- Iframe Container -->
        <div class="flex-1 overflow-hidden bg-gray-50">
          <iframe
            v-if="selectedReport"
            :src="selectedReport.url"
            class="h-full w-full border-0"
            title="Bork Datalab Report"
            allow="fullscreen; accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          />
        </div>
      </UCard>
    </UModal>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { DATALAB_REPORTS, type DatalabReport } from '~/utils/datalabReports'

const isOpen = ref(false)
const selectedReport = ref<DatalabReport | null>(null)

const openModal = (report: DatalabReport) => {
  selectedReport.value = report
  isOpen.value = true
}

definePageMeta({
  layout: 'default',
})
</script>
