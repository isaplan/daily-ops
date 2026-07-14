<template>
  <div class="space-y-6 p-4 md:p-6">
    <WeeklyReportsWeeklyReportHeader
      v-if="doc"
      :doc="doc"
      :is-frozen="isFrozen"
      @print="generatePdf"
    />

    <div v-if="pending" class="text-sm text-gray-500">Loading weekly report…</div>

    <template v-else-if="doc">
      <div class="flex flex-wrap gap-3">
        <select
          :value="locationId"
          class="rounded-md border border-gray-300 px-3 py-1.5 text-sm"
          @change="onLocationChange"
        >
          <option v-for="v in venueOptions" :key="v.locationId" :value="v.locationId">
            {{ v.locationName }}
          </option>
        </select>
      </div>

      <div class="grid gap-4 lg:grid-cols-2">
        <WeeklyReportsWeeklyReportWeatherPanel :weather="doc.weather" />
        <WeeklyReportsWeeklyReportEventsPanel
          :events="doc.events"
          :is-frozen="isFrozen"
          @add-event="onAddEvent"
        />
      </div>

      <WeeklyReportsWeeklyReportSection
        v-for="section in sections"
        :key="section.key"
        :title="section.title"
        :section-key="section.key"
        :content="doc.sections[section.key]"
        :is-frozen="isFrozen"
        :on-save="(text) => saveSection(section.key, text)"
      >
        <DailyOpsAnalyticsWeeklyOverviewTab
          v-if="section.key === 'kpi' && digestDto"
          :digest="digestDto"
          :status-badge-class="statusBadgeClass"
          :status-label="statusLabel"
        />
        <DailyOpsAnalyticsWeeklyStaffTab
          v-else-if="section.key === 'staff' && digestDto"
          :digest="digestDto"
        />
        <WeeklyReportsProductSalesPanel
          v-else-if="section.key === 'productSales' && digestDto"
          :digest="digestDto"
        />
        <DailyOpsAnalyticsWeeklyLaborTab
          v-else-if="section.key === 'labor' && digestDto"
          :digest="digestDto"
        />
        <div v-else-if="section.key === 'revenuePnl' && digestDto" class="space-y-6">
          <DailyOpsAnalyticsWeeklyRevenueTab :digest="digestDto" />
          <DailyOpsAnalyticsWeeklyLossTab :digest="digestDto" />
        </div>
      </WeeklyReportsWeeklyReportSection>
    </template>

    <div v-else class="rounded-lg border border-amber-200 bg-amber-50 p-6 text-sm text-amber-900">
      Could not load weekly report for this week and venue.
    </div>
  </div>
</template>

<script setup lang="ts">
/**
 * @registry-id: weeklyReportsDetailPage
 * @created: 2026-07-14T21:00:00.000Z
 * @last-modified: 2026-07-14T22:00:00.000Z
 * @description: Weekly report document detail — data + comments/todos/agreements
 * @adr-ref: ADR-015
 */

import type { WeeklyReportSectionKey } from '~/types/weeklyReportDocument'
import { buildWeeklyReportPdfDocumentForPrint } from '~/lib/pdf/weeklyReportPdfDocument'
import { useWeeklyReportDocument } from '~/composables/useWeeklyReportDocument'

definePageMeta({ keepalive: false })

const {
  doc,
  pending,
  isFrozen,
  locationId,
  venueOptions,
  setLocation,
  saveSection: persistSection,
  addCustomEvent,
} = useWeeklyReportDocument()

const { statusBadgeClass, statusLabel } = useDailyOpsWeeklyReport()

const digestDto = computed(() => doc.value?.digest ?? null)

const sections: { key: WeeklyReportSectionKey; title: string }[] = [
  { key: 'kpi', title: 'KPI' },
  { key: 'staff', title: 'Staff' },
  { key: 'productSales', title: 'Product Sales' },
  { key: 'labor', title: 'Labor Productivity' },
  { key: 'revenuePnl', title: 'Revenue + COGS + Results' },
]

function onLocationChange(e: Event) {
  setLocation((e.target as HTMLSelectElement).value)
}

async function saveSection(key: WeeklyReportSectionKey, text: string) {
  await persistSection(key, text)
}

async function onAddEvent(payload: { title: string; startDate: string; endDate: string; note?: string }) {
  await addCustomEvent(payload.title, payload.startDate, payload.endDate, payload.note)
}

function generatePdf() {
  if (!doc.value) return
  try {
    const title = `${doc.value.locationName} — ${doc.value.digest.label}`
    const html = buildWeeklyReportPdfDocumentForPrint(doc.value)
    const iframe = document.createElement('iframe')
    iframe.setAttribute('style', 'position:fixed;width:0;height:0;border:0;visibility:hidden')
    document.body.appendChild(iframe)
    iframe.srcdoc = html
    iframe.onload = () => {
      iframe.contentWindow?.print()
      setTimeout(() => iframe.remove(), 1000)
    }
  } catch {
    // silent fail
  }
}
</script>
