<template>
  <div v-if="report" class="flex h-full min-h-0 flex-col">
    <header class="flex shrink-0 items-center justify-between border-b border-gray-200 px-4 py-3">
      <h1 class="truncate text-base font-semibold">{{ report.name }}</h1>
      <UButton
        color="neutral"
        variant="outline"
        size="sm"
        icon="i-lucide-x"
        label="Close"
        @click="closeViewer"
      />
    </header>
    <iframe
      :src="report.url"
      class="min-h-0 flex-1 w-full border-0"
      :title="`${report.name} — Bork Datalab`"
      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen"
    />
  </div>
</template>

<script setup lang="ts">
import { findDatalabReportById } from '~/utils/datalabReports'

definePageMeta({
  layout: 'datalab-viewer',
})

const route = useRoute()
const router = useRouter()

const reportId = computed(() => String(route.query.id ?? ''))
const report = computed(() => findDatalabReportById(reportId.value))

watchEffect(() => {
  if (report.value) return
  router.replace('/daily-ops/datalab')
})

function closeViewer(): void {
  router.push('/daily-ops/datalab')
}
</script>
