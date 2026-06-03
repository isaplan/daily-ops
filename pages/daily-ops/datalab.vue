<template>
  <!-- Page: Buttons -->
  <div class="flex h-full flex-col items-center justify-center gap-8 p-6">
    <div class="text-center">
      <h1 class="text-4xl font-bold">Bork Datalab Reports</h1>
      <p class="text-gray-600">Click a button to view report</p>
    </div>

    <!-- Button Grid -->
    <div class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <UDrawer
        v-for="report in DATALAB_REPORTS"
        :key="report.url"
        :title="report.name"
        direction="bottom"
      >
        <UButton
          size="xl"
          color="violet"
          class="h-24 text-base"
        >
          {{ report.name }}
        </UButton>

        <template #body>
          <div class="h-screen w-full overflow-hidden">
            <iframe
              :src="report.url"
              class="h-full w-full border-0"
              title="Bork Datalab Report"
              allow="fullscreen; accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            />
          </div>
        </template>
      </UDrawer>
    </div>
  </div>
</template>

<script setup lang="ts">
import { DATALAB_REPORTS } from '~/utils/datalabReports'

definePageMeta({
  layout: 'default',
})
</script>
