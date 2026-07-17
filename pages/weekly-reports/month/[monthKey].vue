<template>
  <div class="space-y-6 p-4 md:p-6">
    <WeeklyReportsMonthlyReportHeader
      v-if="doc"
      :doc="doc"
      :is-locked="isLocked"
      :lock-pending="lockPending"
      @print="generatePdf"
      @unlock="unlock"
      @save-lock="saveAndLock"
    />

    <div v-if="pending" class="text-sm text-gray-500">Loading monthly report…</div>

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
              :previous-week-weather="doc.previousMonthWeather"
              :week-key="doc.monthKey"
            />
            <WeeklyReportsWeeklyReportEventsPanel
              :events="doc.events"
              :is-locked="isLocked"
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
            :is-locked="isLocked"
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
            :is-locked="isLocked"
            :on-save="(text, todos, agrees) => saveSection('staff', text, todos, agrees)"
          >
            <WeeklyReportsWeeklyReportStaffGeneralPanel v-if="digestDto" :digest="digestDto" />
          </WeeklyReportsWeeklyReportSection>

          <WeeklyReportsWeeklyReportSection
            title="Product Sales"
            anchor-id="product-sales"
            section-key="productSales"
            show-findings
            :content="doc.sections.productSales"
            :is-locked="isLocked"
            :on-save="(text, todos, agrees) => saveSection('productSales', text, todos, agrees)"
          >
            <WeeklyReportsProductSalesPanel v-if="digestDto" :digest="digestDto" />
          </WeeklyReportsWeeklyReportSection>

          <WeeklyReportsWeeklyReportSection
            title="Labor"
            anchor-id="labor"
            section-key="labor"
            show-findings
            :content="doc.sections.labor"
            :is-locked="isLocked"
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
            :is-locked="isLocked"
            :on-save="(text, todos, agrees) => saveSection('revenuePnl', text, todos, agrees)"
          >
            <div v-if="digestDto" class="space-y-6">
              <WeeklyReportsMonthlyReportPnlPanel
                :accounting-pnl="doc.accountingPnl"
                :period-label="doc.digest.label"
              />
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
      Could not load monthly report for this month and venue.
    </div>
  </div>
</template>

<script setup lang="ts">
/**
 * @registry-id: monthlyReportsDetailPage
 * @created: 2026-07-17T00:00:00.000Z
 * @last-modified: 2026-07-17T00:35:00.000Z
 * @description: Monthly report document detail — data + comments/todos/agreements + accounting P&L
 * @last-fix: [2026-07-17] Wire Product Sales section + findings editor
 * @adr-ref: ADR-015
 */

import type { BlockAgree, BlockTodo } from '~/types/noteBlock'
import type { MonthlyReportSectionKey } from '~/types/monthlyReportDocument'
import { MONTHLY_REPORT_NAV_ITEMS } from '~/utils/monthlyReportNav'
import {
  aggregateMonthlyReportAgrees,
  aggregateMonthlyReportTodos,
  collectMentionSlugsFromMonthlyReport,
  collectTagsFromMonthlyReport,
} from '~/utils/monthlyReportContentMeta'
import type { WeeklyReportAgreeItem, WeeklyReportTodoItem } from '~/utils/weeklyReportContentMeta'
import { useMonthlyReportDocument } from '~/composables/useMonthlyReportDocument'

definePageMeta({ keepalive: false })

const {
  doc,
  pending,
  isLocked,
  lockPending,
  unlock,
  saveAndLock,
  locationId,
  venueOptions,
  setLocation,
  saveSection: persistSection,
  addCustomEvent,
} = useMonthlyReportDocument()

const { statusBadgeClass, statusLabel } = useDailyOpsWeeklyReport()

const digestDto = computed(() => doc.value?.digest ?? null)

const navItems = MONTHLY_REPORT_NAV_ITEMS

type AsideTab = 'members' | 'todos' | 'agreed'
const asideTab = ref<AsideTab | null>(null)

const reportTodos = computed(() =>
  (doc.value ? aggregateMonthlyReportTodos(doc.value) : []) as unknown as WeeklyReportTodoItem[],
)
const reportAgrees = computed(() =>
  (doc.value ? aggregateMonthlyReportAgrees(doc.value) : []) as unknown as WeeklyReportAgreeItem[],
)
const mentionSlugs = computed(() => (doc.value ? collectMentionSlugsFromMonthlyReport(doc.value) : []))
const reportTags = computed(() => (doc.value ? collectTagsFromMonthlyReport(doc.value) : []))

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
  key: MonthlyReportSectionKey,
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
  window.print()
}
</script>
