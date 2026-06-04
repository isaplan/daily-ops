<template>
  <div class="flex h-full flex-col items-center justify-center gap-8 p-6">
    <div class="text-center">
      <h1 class="text-4xl font-bold">Bork Datalab Reports</h1>
      <p class="text-gray-600">Click a button to view report</p>
    </div>

    <div class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <!-- Mobile / tablet PWA: full-page in-app viewer -->
      <template v-if="useMobilePwaFlow">
        <UButton
          v-for="report in DATALAB_REPORTS"
          :key="report.id"
          size="xl"
          color="violet"
          class="h-24 text-base"
          @click="openMobileViewer(report.id)"
        >
          {{ report.name }}
        </UButton>
      </template>

      <!-- Desktop / laptop: drawer with iframe -->
      <template v-else>
        <UDrawer
          v-for="report in DATALAB_REPORTS"
          :key="report.id"
          :title="report.name"
          direction="bottom"
        >
          <UButton size="xl" color="violet" class="h-24 text-base">
            {{ report.name }}
          </UButton>

          <template #body>
            <div class="h-[85vh] w-full overflow-hidden bg-white">
              <iframe
                :src="report.url"
                class="h-full w-full border-0"
                :title="`${report.name} — Bork Datalab`"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen"
              />
            </div>
          </template>
        </UDrawer>
      </template>
    </div>
  </div>
</template>

<script setup lang="ts">
import { DATALAB_REPORTS } from '~/utils/datalabReports'

definePageMeta({
  layout: 'default',
})

const router = useRouter()
const { useMobilePwaFlow } = usePwaMobileTablet()

function openMobileViewer(reportId: string): void {
  router.push({ path: '/daily-ops/datalab/view', query: { id: reportId } })
}
</script>
