<script setup lang="ts">
import type { DailyOpsLaborMetricsDto } from '~/types/daily-ops-dashboard'
import DashboardDayHoursShare from '~/components/daily-ops/DashboardDayHoursShare.vue'
import { laborByDayMetricDefs } from '~/composables/useDailyOpsLaborTables'

const props = defineProps<{
  labor: DailyOpsLaborMetricsDto
}>()

const laborRef = computed(() => props.labor)
const { formatEur } = useDashboardEurFormat()
const {
  laborPctThresholdLow,
  laborPctThresholdHigh,
  teamsWorkersViewMode,
  teamsWorkersTableMetric,
  laborDayTotalSharePctLabel,
  laborPctClass,
  formatLaborPctLabel,
  laborDailyColumnMeta,
  locationRollupShareCell,
  teamHoursShareCell,
  contractHoursShareCell,
  formatLaborDayCell,
  locationLaborPct,
  teamLaborPct,
  laborByDayContractTypesSorted,
  laborTeamsByLocation,
  formatLaborChartSegPct,
  laborStackedChartColumns,
  laborStackedChartLegend,
  laborByDayLocationSegments,
  isLaborLocationExpanded,
  toggleLaborLocationExpanded,
  laborTeamsVisibleForLocation,
  formatLocationRollupWorkersLine,
  workersTeamPivotRows,
  formatTeamDayCell,
  formatTeamNameBelowHours,
  formatContractBelowHoursLine,
} = useDailyOpsLaborTables(laborRef)
</script>

<template>
        <div class="min-w-0 space-y-6">
          <UCard class="border-2 border-gray-900 !bg-white ring-0 shadow-none">
            <template #header>
              <div class="flex flex-wrap items-center justify-between gap-3">
                <h2 class="text-lg font-semibold text-gray-900">Teams &amp; Workers</h2>
                <div
                  class="relative z-0 inline-flex shrink-0 flex-wrap items-center gap-1 rounded-md border-2 border-gray-900 bg-gray-100 p-0.5"
                  role="group"
                  aria-label="Teams and workers view"
                >
                  <button
                    type="button"
                    class="inline-flex items-center justify-center rounded px-3 py-1.5 text-sm font-semibold transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gray-900"
                    :class="
                      teamsWorkersViewMode === 'table'
                        ? 'bg-gray-900 text-white'
                        : 'text-gray-700 hover:bg-gray-100'
                    "
                    :aria-pressed="teamsWorkersViewMode === 'table'"
                    title="Table"
                    @click="teamsWorkersViewMode = 'table'"
                  >
                    <UIcon name="i-lucide-table-2" class="size-4" aria-hidden="true" />
                    <span class="sr-only">Table</span>
                  </button>
                  <button
                    type="button"
                    class="inline-flex items-center justify-center rounded px-3 py-1.5 text-sm font-semibold transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gray-900"
                    :class="
                      teamsWorkersViewMode === 'chart'
                        ? 'bg-gray-900 text-white'
                        : 'text-gray-700 hover:bg-gray-100'
                    "
                    :aria-pressed="teamsWorkersViewMode === 'chart'"
                    title="Stacked chart"
                    @click="teamsWorkersViewMode = 'chart'"
                  >
                    <UIcon name="i-lucide-chart-column-stacked" class="size-4" aria-hidden="true" />
                    <span class="sr-only">Stacked chart</span>
                  </button>
                </div>
              </div>
            </template>
            <p v-if="teamsWorkersViewMode === 'table'" class="mb-3 text-xs text-gray-500">
              Each column is one day (UTC). With “All locations (combined)” in the filter, numbers sum every venue. Venues start collapsed (totals only); expand to see per-team lines. After Van Kinsbergen, <span class="font-medium text-gray-700">Total hours · all teams</span> shows the day total across venues. Use the icons under this text to show all metrics, workers only, hours only, or labor % of revenue only (default). Scroll horizontally when the range has many days.
            </p>
            <p v-else class="mb-3 text-xs text-gray-500">
              Each column is one day (UTC). Each <span class="font-medium text-gray-700">stacked bar is one venue</span>; the label under the bar is the location name. Segments are teams (hours), stacked bottom-to-top: Afwas, Keuken, Bediening, Management, Algemeen, Ziek, then others. Bestellen/Bestelling/Stock and HK &amp; HR Management roll up into Management. Bar height scales to the busiest venue that day. Hover segments for hours. Scroll horizontally when the range has many days.
            </p>
            <div v-show="teamsWorkersViewMode === 'chart'" class="mb-4 min-w-0 space-y-3">
              <div class="min-w-0 overflow-x-auto pb-1">
                <div class="flex w-max items-stretch gap-5 px-0.5">
                  <div
                    v-for="col in laborStackedChartColumns"
                    :key="`labor-stack-${col.date}`"
                    class="flex shrink-0 flex-col gap-1.5"
                    :style="{ minWidth: `max(10rem, ${Math.max(3, col.bars.length) * 2.75}rem)` }"
                  >
                    <div
                      class="flex h-56 items-end justify-center gap-0.5 border-b-2 border-gray-900 px-0.5"
                      :aria-label="`Labor hours by venue for ${col.date}`"
                    >
                      <div
                        v-for="bar in col.bars"
                        :key="`${col.date}-${bar.locationId}`"
                        class="flex h-full min-w-[18px] flex-1 flex-col justify-end"
                      >
                        <div
                          class="flex w-full flex-col justify-end"
                          :style="{ height: bar.totalHours > 0 ? `${bar.barHeightPct}%` : '2px' }"
                          :title="`${bar.locationName}: ${bar.totalHours.toFixed(1)} h`"
                        >
                          <div
                            v-if="bar.totalHours <= 0"
                            class="h-0.5 w-full rounded-t bg-gray-200"
                            :title="`${bar.locationName}: 0 h`"
                          />
                          <div
                            v-else
                            class="flex h-full w-full min-h-0 flex-col justify-end overflow-hidden rounded-t border border-gray-900/25"
                          >
                            <div
                              v-for="seg in bar.segments"
                              :key="`${bar.locationId}-${seg.stackKey}`"
                              class="relative flex w-full min-h-px flex-col items-stretch justify-center overflow-hidden"
                              :style="{
                                flex: `${seg.hours} 0 0`,
                                backgroundColor: seg.color,
                                color: seg.labelFg,
                              }"
                              :title="`${bar.locationName} · ${seg.teamName}: ${seg.hours.toFixed(1)} h (${formatLaborChartSegPct(seg.pctOfBar)} of venue day)`"
                            >
                              <span
                                class="pointer-events-none px-px text-center text-[7px] font-semibold leading-tight tabular-nums sm:text-[8px]"
                                :class="
                                  seg.labelShadow ? 'drop-shadow-[0_1px_1px_rgba(0,0,0,0.5)]' : ''
                                "
                              >{{ formatLaborChartSegPct(seg.pctOfBar) }}</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                    <div class="flex justify-center gap-0.5 px-0.5">
                      <div
                        v-for="bar in col.bars"
                        :key="`lbl-${col.date}-${bar.locationId}`"
                        class="min-w-[18px] flex-1 px-0.5 text-center"
                      >
                        <span
                          class="line-clamp-3 max-h-[3.6rem] text-[9px] font-medium leading-tight break-words text-gray-800"
                          :title="bar.locationName"
                        >{{ bar.locationName }}</span>
                      </div>
                    </div>
                    <div class="text-center text-[10px] leading-tight text-gray-600">
                      <div class="font-medium text-gray-900">{{ col.meta.weekday }}</div>
                      <div>{{ col.meta.dayMonth }}</div>
                      <div class="font-mono text-[9px] text-gray-400">{{ col.date }}</div>
                    </div>
                  </div>
                </div>
              </div>
              <div>
                <p class="mb-2 text-[10px] font-medium uppercase tracking-wide text-gray-500">Teams (grey scale, darker = lower in stack)</p>
                <div class="flex flex-wrap gap-x-3 gap-y-1.5 border-t border-gray-100 pt-3 text-[11px] text-gray-700">
                  <span
                    v-for="leg in laborStackedChartLegend"
                    :key="`leg-${leg.normKey}`"
                    class="inline-flex max-w-full items-center gap-1.5"
                  >
                    <span class="size-2.5 shrink-0 rounded-sm border border-gray-900/20" :style="{ backgroundColor: leg.color }" />
                    <span class="min-w-0 truncate" :title="leg.label">{{ leg.label }}</span>
                  </span>
                </div>
              </div>
            </div>
            <div v-show="teamsWorkersViewMode === 'table'" class="min-w-0">
              <div
                class="mb-3 inline-flex flex-wrap items-center gap-1 rounded-md border-2 border-gray-900 bg-gray-100 p-0.5"
                role="group"
                aria-label="Teams table metrics"
              >
                <button
                  type="button"
                  class="inline-flex items-center justify-center rounded px-3 py-1.5 text-sm font-semibold transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gray-900"
                  :class="
                    teamsWorkersTableMetric === 'all'
                      ? 'bg-gray-900 text-white'
                      : 'text-gray-700 hover:bg-gray-100'
                  "
                  :aria-pressed="teamsWorkersTableMetric === 'all'"
                  title="All metrics"
                  @click="teamsWorkersTableMetric = 'all'"
                >
                  <UIcon name="i-lucide-layout-grid" class="size-4" aria-hidden="true" />
                  <span class="sr-only">All metrics</span>
                </button>
                <button
                  type="button"
                  class="inline-flex items-center justify-center rounded px-3 py-1.5 text-sm font-semibold transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gray-900"
                  :class="
                    teamsWorkersTableMetric === 'workers'
                      ? 'bg-gray-900 text-white'
                      : 'text-gray-700 hover:bg-gray-100'
                  "
                  :aria-pressed="teamsWorkersTableMetric === 'workers'"
                  title="Workers only"
                  @click="teamsWorkersTableMetric = 'workers'"
                >
                  <UIcon name="i-lucide-users" class="size-4" aria-hidden="true" />
                  <span class="sr-only">Workers only</span>
                </button>
                <button
                  type="button"
                  class="inline-flex items-center justify-center rounded px-3 py-1.5 text-sm font-semibold transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gray-900"
                  :class="
                    teamsWorkersTableMetric === 'hours'
                      ? 'bg-gray-900 text-white'
                      : 'text-gray-700 hover:bg-gray-100'
                  "
                  :aria-pressed="teamsWorkersTableMetric === 'hours'"
                  title="Hours only"
                  @click="teamsWorkersTableMetric = 'hours'"
                >
                  <UIcon name="i-lucide-clock" class="size-4" aria-hidden="true" />
                  <span class="sr-only">Hours only</span>
                </button>
                <button
                  type="button"
                  class="inline-flex items-center justify-center rounded px-3 py-1.5 text-sm font-semibold transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gray-900"
                  :class="
                    teamsWorkersTableMetric === 'percentage'
                      ? 'bg-gray-900 text-white'
                      : 'text-gray-700 hover:bg-gray-100'
                  "
                  :aria-pressed="teamsWorkersTableMetric === 'percentage'"
                  title="Labor % of revenue only"
                  @click="teamsWorkersTableMetric = 'percentage'"
                >
                  <UIcon name="i-lucide-percent" class="size-4" aria-hidden="true" />
                  <span class="sr-only">Labor percent only</span>
                </button>
              </div>
              <div class="overflow-x-auto">
                <table class="w-max min-w-full border-separate border-spacing-0 text-left text-sm">
                  <thead>
                    <tr class="border-b border-gray-200 text-gray-600">
                      <th
                        class="sticky left-0 z-20 border-b border-gray-200 bg-white py-2 pr-4 text-xs font-semibold uppercase tracking-wide text-gray-500 shadow-[4px_0_8px_-4px_rgba(0,0,0,0.12)]"
                      >
                        Metric
                      </th>
                      <th
                        v-for="col in laborDailyColumnMeta"
                        :key="`teams-workers-${col.date}`"
                        class="border-b border-gray-200 px-2 py-2 text-center text-xs font-semibold leading-tight"
                      >
                        <div class="flex flex-col items-center gap-0.5 whitespace-nowrap">
                          <span class="text-gray-900">{{ col.weekday }}</span>
                          <span class="font-normal text-gray-500">{{ col.dayMonth }}</span>
                          <span class="font-mono text-[10px] font-normal text-gray-400">{{ col.date }}</span>
                        </div>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    <template
                      v-for="(seg, segIdx) in laborByDayLocationSegments"
                      :key="seg.kind === 'location' ? 'loc-' + String(seg.loc.locationId) : 'post-kins-total-' + String(segIdx)"
                    >
                    <template v-if="seg.kind === 'location'">
                      <tr class="border-b border-gray-100 bg-white">
                        <th
                          class="sticky left-0 z-10 border-b border-gray-100 bg-white py-2 pr-4 text-left shadow-[4px_0_8px_-4px_rgba(0,0,0,0.08)]"
                        >
                          <button
                            type="button"
                            class="relative z-20 flex w-full max-w-md items-start gap-2 rounded-md py-0.5 text-left text-gray-900 hover:bg-gray-50"
                            :aria-expanded="isLaborLocationExpanded(seg.loc.locationId)"
                            @click.stop.prevent="toggleLaborLocationExpanded(seg.loc.locationId)"
                          >
                            <UIcon
                              :name="isLaborLocationExpanded(seg.loc.locationId) ? 'i-lucide-chevron-down' : 'i-lucide-chevron-right'"
                              class="mt-0.5 size-4 shrink-0 text-gray-700"
                              aria-hidden="true"
                            />
                            <span class="min-w-0 flex-1 leading-snug">
                              <span class="text-xs font-semibold uppercase tracking-wide text-gray-700">{{ seg.loc.locationName }}</span>
                              <span class="mt-0.5 block text-[11px] font-normal normal-case text-gray-600">
                                {{ seg.loc.teams.length }} team{{ seg.loc.teams.length === 1 ? '' : 's' }}
                                · {{ isLaborLocationExpanded(seg.loc.locationId) ? 'Hide team breakdown' : 'Show team breakdown' }}
                              </span>
                            </span>
                          </button>
                        </th>
                        <td
                          v-for="day in labor.daily"
                          :key="`loc-roll-${seg.loc.locationId}-${day.date}`"
                          class="border-b border-gray-100 px-2 py-2 text-center text-gray-900"
                        >
                          <div class="flex flex-col items-center gap-0.5 leading-tight">
                            <DashboardDayHoursShare
                              v-show="teamsWorkersTableMetric === 'all' || teamsWorkersTableMetric === 'hours'"
                              v-bind="locationRollupShareCell(seg.loc.locationId, day)"
                              :day="day"
                              :show-share-of-day="teamsWorkersTableMetric === 'all'"
                            />
                            <span
                              v-show="teamsWorkersTableMetric === 'all' || teamsWorkersTableMetric === 'workers'"
                              class="text-[11px] font-normal text-gray-600 tabular-nums"
                            >{{ formatLocationRollupWorkersLine(seg.loc.locationId, day.date) }}</span>
                            <span
                              v-show="teamsWorkersTableMetric === 'all' || teamsWorkersTableMetric === 'percentage'"
                              :class="['text-[10px] tabular-nums', laborPctClass(locationLaborPct(seg.loc.locationId, day))]"
                            >{{ formatLaborPctLabel(locationLaborPct(seg.loc.locationId, day)) }}</span>
                          </div>
                        </td>
                      </tr>
                      <tr
                        v-for="{ teamKey, meta } in laborTeamsVisibleForLocation(seg.loc)"
                        :key="`loc-${seg.loc.locationId}-team-${teamKey}`"
                        class="border-b border-gray-100 bg-white"
                      >
                        <th
                          class="sticky left-0 z-10 border-b border-gray-100 bg-white py-2 pr-4 pl-10 text-left text-xs font-semibold uppercase tracking-wide text-gray-600 shadow-[4px_0_8px_-4px_rgba(0,0,0,0.08)]"
                        >
                          {{ meta.teamName }} · h / team
                        </th>
                        <td
                          v-for="day in labor.daily"
                          :key="`team-top-${teamKey}-${day.date}`"
                          class="border-b border-gray-100 px-2 py-2 text-center text-gray-900"
                        >
                          <div class="flex flex-col items-center gap-0.5 leading-tight">
                            <DashboardDayHoursShare
                              v-show="teamsWorkersTableMetric === 'all' || teamsWorkersTableMetric === 'hours'"
                              v-bind="teamHoursShareCell(teamKey, day)"
                              :day="day"
                              :show-share-of-day="teamsWorkersTableMetric === 'all'"
                            />
                            <span
                              v-show="teamsWorkersTableMetric === 'all' || teamsWorkersTableMetric === 'workers'"
                              class="max-w-34 text-[11px] font-normal leading-snug text-gray-600 wrap-break-word"
                            >{{ formatTeamNameBelowHours(teamKey, day.date, meta) }}</span>
                            <span
                              v-show="teamsWorkersTableMetric === 'all' || teamsWorkersTableMetric === 'percentage'"
                              :class="['text-[10px] tabular-nums', laborPctClass(teamLaborPct(teamKey, day))]"
                            >{{ formatLaborPctLabel(teamLaborPct(teamKey, day)) }}</span>
                          </div>
                        </td>
                      </tr>
                    </template>
                    <template v-else>
                      <tr class="border-b border-gray-100 border-t-2 border-t-gray-300 bg-white">
                        <th
                          class="sticky left-0 z-10 border-b border-gray-100 bg-white py-2 pr-4 text-left text-xs font-semibold uppercase tracking-wide text-gray-700 shadow-[4px_0_8px_-4px_rgba(0,0,0,0.08)]"
                        >
                          Total hours · all teams
                        </th>
                        <td
                          v-for="day in labor.daily"
                          :key="`post-kins-total-h-${day.date}`"
                          class="border-b border-gray-100 px-2 py-2 text-center text-gray-900"
                        >
                          <DashboardDayHoursShare
                            v-if="teamsWorkersTableMetric === 'all' || teamsWorkersTableMetric === 'hours'"
                            :day="day"
                            :amount="day.hours"
                            hours-class="tabular-nums font-semibold text-gray-900"
                            :show-share-of-day="teamsWorkersTableMetric === 'all'"
                          />
                          <span
                            v-else-if="teamsWorkersTableMetric === 'percentage'"
                            class="tabular-nums text-[10px] font-semibold text-gray-900"
                          >{{ laborDayTotalSharePctLabel(day) }}</span>
                          <span v-else class="text-gray-400">—</span>
                        </td>
                      </tr>
                    </template>
                    </template>
                  </tbody>
                </table>
              </div>
              <div
                class="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-gray-100 pt-3 text-xs"
              >
                <span class="font-medium text-gray-700">Labor / revenue % (this card):</span>
                <label class="inline-flex items-center gap-1.5 text-gray-600">
                  <span>Green below</span>
                  <input
                    v-model.number="laborPctThresholdLow"
                    type="number"
                    min="0"
                    max="100"
                    step="0.5"
                    class="w-14 rounded border border-gray-300 bg-white px-1.5 py-1 text-right tabular-nums text-gray-900"
                  />
                  <span>%</span>
                </label>
                <label class="inline-flex items-center gap-1.5 text-gray-600">
                  <span>Red above</span>
                  <input
                    v-model.number="laborPctThresholdHigh"
                    type="number"
                    min="0"
                    max="100"
                    step="0.5"
                    class="w-14 rounded border border-gray-300 bg-white px-1.5 py-1 text-right tabular-nums text-gray-900"
                  />
                  <span>%</span>
                </label>
                <span class="max-w-md text-gray-400">Blue between the two. Venue row: labor vs Bork revenue. Team row: labor vs share of venue revenue (by hours).</span>
              </div>
            </div>
          </UCard>

          <UCard class="border-2 border-gray-900 !bg-white ring-0 shadow-none">
            <template #header>
              <h2 class="text-lg font-semibold text-gray-900">Contracts</h2>
            </template>
            <p class="mb-3 text-xs text-gray-500">
              Hours and cost by member contract type per day. <span class="font-medium text-gray-700">None</span> means no contract type on the member (see <span class="font-mono">contract_type</span>).
            </p>
            <div class="min-w-0 overflow-x-auto">
              <table class="w-max min-w-full border-separate border-spacing-0 text-left text-sm">
                <thead>
                  <tr class="border-b border-gray-200 text-gray-600">
                    <th
                      class="sticky left-0 z-20 border-b border-gray-200 bg-white py-2 pr-4 text-xs font-semibold uppercase tracking-wide text-gray-500 shadow-[4px_0_8px_-4px_rgba(0,0,0,0.12)]"
                    >
                      Metric
                    </th>
                    <th
                      v-for="col in laborDailyColumnMeta"
                      :key="`contracts-${col.date}`"
                      class="border-b border-gray-200 px-2 py-2 text-center text-xs font-semibold leading-tight"
                    >
                      <div class="flex flex-col items-center gap-0.5 whitespace-nowrap">
                        <span class="text-gray-900">{{ col.weekday }}</span>
                        <span class="font-normal text-gray-500">{{ col.dayMonth }}</span>
                        <span class="font-mono text-[10px] font-normal text-gray-400">{{ col.date }}</span>
                      </div>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="ct in laborByDayContractTypesSorted" :key="`labor-ct-${ct}`" class="border-b border-gray-100 bg-white">
                    <th
                      class="sticky left-0 z-10 border-b border-gray-100 bg-white py-2 pr-4 text-left text-xs font-semibold uppercase tracking-wide text-gray-600 shadow-[4px_0_8px_-4px_rgba(0,0,0,0.08)]"
                    >
                      {{ ct === '-' ? 'Contract type · none' : `Contract type · ${ct}` }}
                    </th>
                    <td
                      v-for="day in labor.daily"
                      :key="`ct-${ct}-${day.date}`"
                      class="border-b border-gray-100 px-2 py-2 text-center text-gray-900"
                    >
                      <div class="flex flex-col items-center gap-0.5 leading-tight">
                        <DashboardDayHoursShare v-bind="contractHoursShareCell(ct, day)" :day="day" />
                        <span class="text-[11px] font-normal text-gray-600 tabular-nums">{{ formatContractBelowHoursLine(ct, day.date) }}</span>
                      </div>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </UCard>

          <UCard class="border-2 border-gray-900 !bg-white ring-0 shadow-none">
            <template #header>
              <h2 class="text-lg font-semibold text-gray-900">Revenue, labor &amp; productivity</h2>
            </template>
            <p class="mb-3 text-xs text-gray-500">
              Daily revenue, labor cost, worked hours, labor as a percent of revenue, and revenue per worked hour (€/h). Each column is one day (UTC).
            </p>
            <div class="min-w-0 overflow-x-auto">
              <table class="w-max min-w-full border-separate border-spacing-0 text-left text-sm">
                <thead>
                  <tr class="border-b border-gray-200 text-gray-600">
                    <th
                      class="sticky left-0 z-20 border-b border-gray-200 bg-white py-2 pr-4 text-xs font-semibold uppercase tracking-wide text-gray-500 shadow-[4px_0_8px_-4px_rgba(0,0,0,0.12)]"
                    >
                      Metric
                    </th>
                    <th
                      v-for="col in laborDailyColumnMeta"
                      :key="`fin-${col.date}`"
                      class="border-b border-gray-200 px-2 py-2 text-center text-xs font-semibold leading-tight"
                    >
                      <div class="flex flex-col items-center gap-0.5 whitespace-nowrap">
                        <span class="text-gray-900">{{ col.weekday }}</span>
                        <span class="font-normal text-gray-500">{{ col.dayMonth }}</span>
                        <span class="font-mono text-[10px] font-normal text-gray-400">{{ col.date }}</span>
                      </div>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  <tr
                    v-for="metric in laborByDayMetricDefs"
                    :key="metric.key"
                    class="border-b border-gray-100"
                  >
                    <th
                      class="sticky left-0 z-10 border-b border-gray-100 bg-white py-2 pr-4 text-left text-xs font-semibold uppercase tracking-wide text-gray-600 shadow-[4px_0_8px_-4px_rgba(0,0,0,0.08)]"
                    >
                      {{ metric.label }}
                    </th>
                    <td
                      v-for="day in labor.daily"
                      :key="`${metric.key}-${day.date}`"
                      class="border-b border-gray-100 px-2 py-2 text-center tabular-nums text-gray-900"
                    >
                      {{ formatLaborDayCell(day, metric.key) }}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </UCard>

        <div class="grid min-w-0 gap-6 lg:grid-cols-2">
          <UCard class="border-2 border-gray-900 !bg-white ring-0 shadow-none lg:col-span-2">
            <template #header>
              <h2 class="text-lg font-semibold text-gray-900">Workers by Team &amp; Location — By Day</h2>
            </template>
            <p class="mb-3 text-xs text-gray-500">
              Each location · team has three rows (staff count, hours, cost) per UTC day. Scroll horizontally for long ranges; scroll vertically for many teams.
            </p>
            <div class="max-h-[min(70vh,36rem)] min-w-0 overflow-auto">
              <table class="w-max min-w-full border-separate border-spacing-0 text-left text-sm">
                <thead>
                  <tr class="border-b border-gray-200 text-gray-600">
                    <th
                      class="sticky left-0 top-0 z-20 border-b border-gray-200 bg-white py-2 pr-4 text-xs font-semibold uppercase tracking-wide text-gray-500 shadow-[4px_0_8px_-4px_rgba(0,0,0,0.12)]"
                    >
                      Location · Team · Metric
                    </th>
                    <th
                      v-for="col in laborDailyColumnMeta"
                      :key="`team-${col.date}`"
                      class="sticky top-0 z-10 border-b border-gray-200 bg-white px-2 py-2 text-center text-xs font-semibold leading-tight"
                    >
                      <div class="flex flex-col items-center gap-0.5 whitespace-nowrap">
                        <span class="text-gray-900">{{ col.weekday }}</span>
                        <span class="font-normal text-gray-500">{{ col.dayMonth }}</span>
                        <span class="font-mono text-[10px] font-normal text-gray-400">{{ col.date }}</span>
                      </div>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  <tr
                    v-for="row in workersTeamPivotRows"
                    :key="row.label"
                    class="border-b border-gray-100"
                  >
                    <th
                      class="sticky left-0 z-10 border-b border-gray-100 bg-white py-2 pr-4 text-left text-xs font-medium text-gray-800 shadow-[4px_0_8px_-4px_rgba(0,0,0,0.08)]"
                    >
                      {{ row.label }}
                    </th>
                    <td
                      v-for="day in labor.daily"
                      :key="`${row.label}-${day.date}`"
                      class="border-b border-gray-100 px-2 py-2 text-center tabular-nums text-gray-900"
                    >
                      {{ formatTeamDayCell(row.teamKey, day.date, row.metric) }}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </UCard>

          <UCard class="border-2 border-gray-900 !bg-white ring-0 shadow-none">
            <template #header>
              <h2 class="text-lg font-semibold text-gray-900">Hours &amp; Cost by Contract Type</h2>
            </template>
            <p class="mb-3 text-xs text-gray-500">Contract type is resolved from the members collection via Eitje user id.</p>
            <ul class="divide-y divide-gray-100">
              <li
                v-for="row in labor.hoursCostByContractType"
                :key="row.contractType"
                class="flex flex-wrap items-center justify-between gap-2 py-3 text-sm"
              >
                <span class="font-medium text-gray-700">{{ row.contractType || '—' }}</span>
                <span class="tabular-nums text-gray-600">{{ Math.round(row.totalHours) }} h · {{ formatEur(row.totalCost) }}</span>
              </li>
            </ul>
          </UCard>
        </div>

        <UCard class="border-2 border-gray-900 !bg-white ring-0 shadow-none">
          <template #header>
            <h2 class="text-lg font-semibold text-gray-900">Labor Productivity — Best &amp; Worst Day (per Location)</h2>
          </template>
          <p class="mb-4 text-xs text-gray-500">Revenue per worked hour (€/h) for days with both Bork revenue and Eitje hours for that location.</p>
          <div class="min-w-0 overflow-x-auto">
            <table class="w-full min-w-[720px] text-left text-sm">
              <thead>
                <tr class="border-b border-gray-200 text-xs uppercase text-gray-500">
                  <th class="pb-2 pr-4 font-medium">Location</th>
                  <th class="pb-2 pr-4 font-medium">Highest €/h</th>
                  <th class="pb-2 pr-4 font-medium">Date</th>
                  <th class="pb-2 pr-4 font-medium">Lowest €/h</th>
                  <th class="pb-2 font-medium">Date</th>
                </tr>
              </thead>
              <tbody>
                <tr
                  v-for="row in labor.productivityByLocationDay"
                  :key="row.locationId"
                  class="border-b border-gray-100"
                >
                  <td class="py-2 pr-4 font-medium">{{ row.locationName }}</td>
                  <td class="py-2 pr-4 tabular-nums">
                    {{ row.highest ? formatEur(row.highest.revenuePerLaborHour) : '—' }}
                  </td>
                  <td class="py-2 pr-4 text-gray-600">{{ row.highest?.date ?? '—' }}</td>
                  <td class="py-2 pr-4 tabular-nums">
                    {{ row.lowest ? formatEur(row.lowest.revenuePerLaborHour) : '—' }}
                  </td>
                  <td class="py-2 text-gray-600">{{ row.lowest?.date ?? '—' }}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </UCard>
        </div>
</template>
