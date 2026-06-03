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
        @click="openModal(report)"
        size="lg"
        color="violet"
        variant="soft"
        class="h-20"
      >
        {{ report.name }}
      </UButton>
    </div>
  </div>

  <!-- Modal Portal -->
  <USlideover v-model="isOpen" side="right" :ui="{ width: 'w-screen' }">
    <UCard
      class="flex h-full flex-col"
      :ui="{ body: { padding: 'p-0' }, header: { padding: 'px-4 py-3' } }"
    >
      <template #header>
        <div class="flex items-center justify-between">
          <h2 class="text-lg font-bold">{{ selectedReport?.name }}</h2>
          <UButton
            color="gray"
            variant="ghost"
            size="sm"
            icon="i-heroicons-x-mark-20-solid"
            @click="isOpen = false"
          />
        </div>
      </template>

      <!-- Iframe Container -->
      <div class="flex-1 overflow-hidden">
        <iframe
          v-if="selectedReport && isOpen"
          :src="selectedReport.url"
          class="h-full w-full border-0"
          title="Bork Datalab Report"
          allow="fullscreen; accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
        />
      </div>
    </UCard>
  </USlideover>
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
