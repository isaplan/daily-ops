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
      <div class="flex flex-wrap items-center gap-3">
        <select
          :value="locationId"
          class="rounded-md border border-gray-300 px-3 py-1.5 text-sm"
          @change="onLocationChange"
        >
          <option v-for="v in venueOptions" :key="v.locationId" :value="v.locationId">
            {{ v.locationName }}
          </option>
        </select>
        <UiTabRail
          v-if="asideRailOptions.length"
          :model-value="asideTab"
          :options="asideRailOptions"
          @update:model-value="onAsideRailSelect"
        />
      </div>

      <WeeklyReportsWeeklyReportSectionNav :items="navItems" />

      <div class="flex flex-col gap-6 md:flex-row">
        <div class="min-w-0 flex-1">
          <div class="grid gap-4 lg:grid-cols-2">
            <WeeklyReportsWeeklyReportWeatherPanel
              :weather="doc.weather"
              :previous-week-weather="doc.previousWeekWeather"
              :week-key="doc.weekKey"
            />
            <WeeklyReportsWeeklyReportEventsPanel
              :events="doc.events"
              :is-frozen="isFrozen"
              @add-event="onAddEvent"
            />
          </div>

          <hr class="my-8 border-gray-200">

          <WeeklyReportsWeeklyReportSection
            title="KPI"
            anchor-id="kpi"
            section-key="kpi"
            show-findings
            :content="doc.sections.kpi"
            :is-frozen="isFrozen"
            :on-save="(text, todos, agrees) => saveSection('kpi', text, todos, agrees)"
          >
            <DailyOpsAnalyticsWeeklyOverviewTab
              v-if="digestDto"
              :digest="digestDto"
              hide-staff-plusmin
              :status-badge-class="statusBadgeClass"
              :status-label="statusLabel"
            />
          </WeeklyReportsWeeklyReportSection>

          <WeeklyReportsWeeklyReportSection
            title="Staff"
            anchor-id="staff-general"
            section-key="staff"
            show-findings
            :content="doc.sections.staff"
            :is-frozen="isFrozen"
            :on-save="(text, todos, agrees) => saveSection('staff', text, todos, agrees)"
          >
            <WeeklyReportsWeeklyReportStaffGeneralPanel v-if="digestDto" :digest="digestDto" />
          </WeeklyReportsWeeklyReportSection>

          <WeeklyReportsWeeklyReportSection
            title="Labor"
            anchor-id="labor"
            section-key="labor"
            show-findings
            :content="doc.sections.labor"
            :is-frozen="isFrozen"
            :on-save="(text, todos, agrees) => saveSection('labor', text, todos, agrees)"
          >
            <DailyOpsAnalyticsWeeklyLaborTab v-if="digestDto" :digest="digestDto" />
          </WeeklyReportsWeeklyReportSection>

          <WeeklyReportsWeeklyReportSection
            title="Revenue & PnL"
            anchor-id="revenue-pnl"
            section-key="revenuePnl"
            show-findings
            :content="doc.sections.revenuePnl"
            :is-frozen="isFrozen"
            :on-save="(text, todos, agrees) => saveSection('revenuePnl', text, todos, agrees)"
          >
            <div v-if="digestDto" class="space-y-6">
              <DailyOpsAnalyticsWeeklyRevenueTab :digest="digestDto" />
              <DailyOpsAnalyticsWeeklyLossTab :digest="digestDto" hide-tables />
            </div>
          </WeeklyReportsWeeklyReportSection>

          <WeeklyReportsWeeklyReportSection anchor-id="tables" title="Tables">
            <WeeklyReportsWeeklyReportTablesPanel v-if="digestDto" :digest="digestDto" />
          </WeeklyReportsWeeklyReportSection>

          <WeeklyReportsWeeklyReportSection anchor-id="spaces" title="Spaces" :show-divider="false">
            <WeeklyReportsWeeklyReportSpacesPanel v-if="digestDto" :digest="digestDto" />
          </WeeklyReportsWeeklyReportSection>
        </div>

        <WeeklyReportsWeeklyReportAsidePanel
          v-if="asideTab"
          :tab="asideTab"
          :todos="reportTodos"
          :agrees="reportAgrees"
          :mention-slugs="mentionSlugs"
          :tags="reportTags"
        />
      </div>
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
 * @last-modified: 2026-07-15T00:50:00.000Z
 * @description: Weekly report document detail — data + comments/todos/agreements
 * @last-fix: [2026-07-15] Document-style section headers + hr dividers
 * @adr-ref: ADR-015
 */

import type { BlockAgree, BlockTodo } from '~/types/noteBlock'
import type { WeeklyReportSectionKey } from '~/types/weeklyReportDocument'
import { WEEKLY_REPORT_NAV_ITEMS } from '~/utils/weeklyReportNav'
import {
  aggregateWeeklyReportAgrees,
  aggregateWeeklyReportTodos,
  collectMentionSlugsFromWeeklyReport,
  collectTagsFromWeeklyReport,
} from '~/utils/weeklyReportContentMeta'
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

const navItems = WEEKLY_REPORT_NAV_ITEMS

type AsideTab = 'members' | 'todos' | 'agreed'
const asideTab = ref<AsideTab | null>(null)

const reportTodos = computed(() => (doc.value ? aggregateWeeklyReportTodos(doc.value) : []))
const reportAgrees = computed(() => (doc.value ? aggregateWeeklyReportAgrees(doc.value) : []))
const mentionSlugs = computed(() => (doc.value ? collectMentionSlugsFromWeeklyReport(doc.value) : []))
const reportTags = computed(() => (doc.value ? collectTagsFromWeeklyReport(doc.value) : []))

const hasTodos = computed(() => reportTodos.value.length > 0)
const hasAgrees = computed(() => reportAgrees.value.length > 0)

const asideRailOptions = computed(() => {
  const o: { value: AsideTab; label: string }[] = [{ value: 'members', label: 'Members' }]
  if (hasTodos.value) o.push({ value: 'todos', label: 'Todo' })
  if (hasAgrees.value) o.push({ value: 'agreed', label: 'Agreed' })
  return o
})

function onAsideRailSelect(tab: AsideTab) {
  asideTab.value = asideTab.value === tab ? null : tab
}

function onLocationChange(e: Event) {
  setLocation((e.target as HTMLSelectElement).value)
}

async function saveSection(
  key: WeeklyReportSectionKey,
  text: string,
  todos?: BlockTodo[],
  agrees?: BlockAgree[],
) {
  await persistSection(key, text, todos, agrees)
}

async function onAddEvent(payload: { title: string; startDate: string; endDate: string; note?: string }) {
  await addCustomEvent(payload.title, payload.startDate, payload.endDate, payload.note)
}

function generatePdf() {
  if (!doc.value) return
  try {
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
