<template>
  <DailyOpsDashboardShell>
    <div class="min-w-0 space-y-8">
      <header class="space-y-2">
        <h1 class="text-[38px] font-extrabold leading-tight tracking-[-0.02em] text-gray-900">
          Daily Ops / {{ locationTitle }} / {{ pageHeadingSuffix }}
        </h1>
        <p class="text-xl font-medium text-gray-700">
          {{ contextHeadline }}
        </p>
        <p v-if="summary?.vatDisclaimer" class="text-base italic text-gray-500">
          {{ summary.vatDisclaimer }}
        </p>
      </header>

      <UAlert v-if="error" color="error" variant="soft" title="Could not load dashboard" :description="String(error)" />

      <div v-if="pending" class="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <USkeleton v-for="i in 4" :key="i" class="h-28 w-full rounded-lg" />
      </div>

      <template v-else-if="summary && revenue && labor">
        <div class="grid min-w-0 gap-4 md:grid-cols-2 lg:grid-cols-4">
          <UCard class="border-2 border-gray-900 !bg-white ring-0 shadow-none">
            <p class="text-sm font-medium text-gray-500">Total Revenue</p>
            <p class="mt-2 text-2xl font-semibold text-gray-900">{{ formatEur(summary.summary.totalRevenue) }}</p>
          </UCard>
          <UCard class="border-2 border-gray-900 !bg-white ring-0 shadow-none">
            <p class="text-sm font-medium text-gray-500">Total Labor Cost</p>
            <p class="mt-2 text-2xl font-semibold text-gray-900">{{ formatEur(summary.summary.totalLaborCost) }}</p>
            <p v-if="summary.summary.laborCostPctOfRevenue != null" class="mt-1 text-xs text-gray-500">
              {{ summary.summary.laborCostPctOfRevenue.toFixed(1) }}% of revenue
            </p>
          </UCard>
          <UCard class="border-2 border-gray-900 !bg-white ring-0 shadow-none">
            <p class="text-sm font-medium text-gray-500">Labor Percentage</p>
            <p class="mt-2 text-2xl font-semibold text-gray-900">{{ summary.summary.laborCostPctOfRevenue?.toFixed(1) ?? '—' }}%</p>
            <p class="mt-1 text-xs text-gray-500">of revenue</p>
          </UCard>
          <UCard class="border-2 border-gray-900 !bg-white ring-0 shadow-none">
            <p class="text-sm font-medium text-gray-500">Labor Productivity</p>
            <p class="mt-2 text-2xl font-semibold text-gray-900">{{ summary.summary.revenuePerLaborHour != null ? formatEur(summary.summary.revenuePerLaborHour) : '—' }}</p>
            <p class="mt-1 text-xs text-gray-500">per labor hour</p>
          </UCard>
        </div>

        <!-- Teams Summary -->
        <div class="min-w-0">
          <h3 class="mb-3 text-sm font-semibold text-gray-700">Teams</h3>
          <div class="grid min-w-0 gap-4 md:grid-cols-2 lg:grid-cols-4">
            <button
              v-for="team in teamsSummary"
              :key="team.teamName"
              type="button"
              class="border-2 border-gray-900 !bg-white ring-0 shadow-none rounded-lg p-4 text-left transition-all hover:bg-gray-50 hover:shadow-md active:scale-95"
              @click="selectTeam(team.teamName)"
            >
              <p class="text-sm font-medium text-gray-500">{{ team.teamName }}</p>
              <p class="mt-2 text-2xl font-semibold text-gray-900">{{ team.workerCount }}</p>
              <div class="mt-3 space-y-1 border-t border-gray-100 pt-3">
                <div class="flex justify-between text-xs">
                  <span class="text-gray-600">Hours</span>
                  <span class="font-semibold text-gray-900">{{ team.totalHours.toFixed(1) }}</span>
                </div>
                <div class="flex justify-between text-xs">
                  <span class="text-gray-600">Cost</span>
                  <span class="font-semibold text-gray-900">{{ formatEur(team.totalCost) }}</span>
                </div>
                <div class="flex justify-between text-xs">
                  <span class="text-gray-600">% of Labor Hours</span>
                  <span class="font-semibold text-gray-900">{{ team.pctOfTotalHours.toFixed(1) }}%</span>
                </div>
              </div>
            </button>
          </div>
        </div>

        <!-- Contracts Summary -->
        <div class="min-w-0">
          <h3 class="mb-3 text-sm font-semibold text-gray-700">Contracts</h3>
          <div class="grid min-w-0 gap-4 md:grid-cols-2 lg:grid-cols-4">
            <button
              v-for="contract in contractsSummary"
              :key="contract.contractType"
              type="button"
              class="border-2 border-gray-900 !bg-white ring-0 shadow-none rounded-lg p-4 text-left transition-all hover:bg-gray-50 hover:shadow-md active:scale-95"
              @click="selectContract(contract.contractType)"
            >
              <p class="text-sm font-medium text-gray-500">{{ contract.contractType || 'None' }}</p>
              <p class="mt-2 text-2xl font-semibold text-gray-900">{{ contract.workerCount }}</p>
              <div class="mt-3 space-y-1 border-t border-gray-100 pt-3">
                <div class="flex justify-between text-xs">
                  <span class="text-gray-600">Hours</span>
                  <span class="font-semibold text-gray-900">{{ contract.totalHours.toFixed(1) }}</span>
                </div>
                <div class="flex justify-between text-xs">
                  <span class="text-gray-600">Cost</span>
                  <span class="font-semibold text-gray-900">{{ formatEur(contract.totalCost) }}</span>
                </div>
                <div class="flex justify-between text-xs">
                  <span class="text-gray-600">% of Labor Hours</span>
                  <span class="font-semibold text-gray-900">{{ contract.pctOfTotalHours.toFixed(1) }}%</span>
                </div>
              </div>
            </button>
          </div>
        </div>

        <div class="grid min-w-0 gap-6 lg:grid-cols-2">
          <div class="min-w-0">
            <h3 class="mb-4 text-lg font-semibold text-gray-900">Revenue by Category</h3>
            <p class="mb-3 text-xs text-gray-500">Drinks vs food uses product-name keywords on Bork lines (see data notes below).</p>
            <D3PieChartV2
              :data="revenue.revenueByCategory && revenue.revenueByCategory.length > 0 ? revenue.revenueByCategory.map(r => ({ label: r.label, value: r.amount })) : undefined"
              :width="400"
              :height="300"
              :colors="categoryChartColors"
              :selected-period="pageHeadingSuffix"
            />
          </div>

          <div class="min-w-0">
            <h3 class="mb-4 text-lg font-semibold text-gray-900">Revenue by Time Period</h3>
            <D3PieChartV2
              :data="revenue.revenueByTimePeriod && revenue.revenueByTimePeriod.length > 0 ? revenue.revenueByTimePeriod.map(r => ({ label: r.label, value: r.amount })) : undefined"
              :width="400"
              :height="300"
              :colors="timePeriodChartColors"
              :selected-period="pageHeadingSuffix"
            />
          </div>
        </div>

        <UCard class="border-2 border-gray-900 !bg-white ring-0 shadow-none">
          <template #header>
            <h2 class="text-lg font-semibold text-gray-900">Most Profitable Hour</h2>
          </template>
          <p class="mb-4 text-xs text-gray-500">Labor cost for the hour is estimated by splitting each day’s total labor across hours by revenue share.</p>
          <div class="grid gap-4 sm:grid-cols-4">
            <div>
              <p class="text-xs font-medium uppercase tracking-wide text-gray-500">Hour</p>
              <p class="mt-1 text-lg font-semibold text-gray-900">{{ revenue.mostProfitableHour.hourLabel }}</p>
            </div>
            <div>
              <p class="text-xs font-medium uppercase tracking-wide text-gray-500">Revenue</p>
              <p class="mt-1 text-lg font-semibold text-gray-900">{{ formatEur(revenue.mostProfitableHour.revenue) }}</p>
            </div>
            <div>
              <p class="text-xs font-medium uppercase tracking-wide text-gray-500">Labor Cost (est.)</p>
              <p class="mt-1 text-lg font-semibold text-gray-900">{{ formatEur(revenue.mostProfitableHour.laborCost) }}</p>
            </div>
            <div>
              <p class="text-xs font-medium uppercase tracking-wide text-gray-500">Profit</p>
              <p class="mt-1 text-lg font-semibold text-gray-900">{{ formatEur(revenue.mostProfitableHour.profit) }}</p>
            </div>
          </div>
        </UCard>

        <UCard class="border-2 border-gray-900 !bg-white ring-0 shadow-none">
          <template #header>
            <h2 class="text-lg font-semibold text-gray-900">Labor — Period Rollup</h2>
          </template>
          <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <p class="text-xs font-medium text-gray-500">Revenue (range)</p>
              <p class="mt-1 text-lg font-semibold">{{ formatEur(labor.periodRollup.revenue) }}</p>
            </div>
            <div>
              <p class="text-xs font-medium text-gray-500">Labor cost</p>
              <p class="mt-1 text-lg font-semibold">{{ formatEur(labor.periodRollup.laborCost) }}</p>
            </div>
            <div>
              <p class="text-xs font-medium text-gray-500">Hours worked</p>
              <p class="mt-1 text-lg font-semibold">{{ labor.periodRollup.hours.toFixed(1) }} h</p>
            </div>
            <div>
              <p class="text-xs font-medium text-gray-500">€ / labor hour</p>
              <p class="mt-1 text-lg font-semibold">
                {{ labor.periodRollup.revenuePerLaborHour != null ? formatEur(labor.periodRollup.revenuePerLaborHour) : '—' }}
              </p>
            </div>
          </div>
        </UCard>

        <div class="min-w-0 space-y-6">
          <UCard class="border-2 border-gray-900 !bg-white ring-0 shadow-none">
            <template #header>
              <div class="flex flex-wrap items-center justify-between gap-3">
                <h2 class="text-lg font-semibold text-gray-900">Teams &amp; Workers</h2>
                <div
                  class="inline-flex shrink-0 flex-wrap items-center gap-1 rounded-md border-2 border-gray-900 bg-gray-100 p-0.5"
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
        </div>

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
                <span class="tabular-nums text-gray-600">{{ row.totalHours.toFixed(1) }} h · {{ formatEur(row.totalCost) }}</span>
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

        <UCard v-if="(labor.inventory?.notes?.length ?? 0) > 0" class="border-2 border-amber-800 bg-amber-50/90">
          <template #header>
            <h2 class="text-lg font-semibold text-gray-900">Data Coverage &amp; Method Notes</h2>
          </template>
          <ul class="list-inside list-disc space-y-1 text-sm text-gray-700">
            <li v-for="(note, i) in labor.inventory?.notes ?? []" :key="i">{{ note }}</li>
          </ul>
          <p class="mt-3 text-xs text-gray-500">
            Flags: bork_sales_by_cron {{ labor.inventory?.hasBorkCronData ? 'yes' : 'no' }}, bork_sales_by_hour
            {{ labor.inventory?.hasBorkHourData ? 'yes' : 'no' }}, eitje_time_registration_aggregation
            {{ labor.inventory?.hasEitjeAggData ? 'yes' : 'no' }}.
          </p>
        </UCard>

        <p class="text-xs text-gray-400">
          Range: {{ summary.range.startDate }} → {{ summary.range.endDate }} ({{ summary.range.period }}) · Dashboard metrics
          load together for consistent charts and tables.
        </p>
      </template>

      <div
        v-else-if="!pending"
        class="rounded-lg border border-gray-200 bg-white px-4 py-6 text-sm text-gray-700 shadow-sm"
      >
        <p class="font-semibold text-gray-900">Metrics did not load</p>
        <p class="mt-1 text-gray-600">
          Try a hard refresh. If the problem continues, check the browser network tab for failed requests to
          <span class="font-mono text-xs">/api/daily-ops/metrics/bundle</span>.
        </p>
        <UButton type="button" class="mt-4" color="neutral" variant="outline" @click="() => void refreshMetrics()">
          Retry
        </UButton>
      </div>
    </div>

    <!-- Worker Details Drawer -->
    <WorkerDetailsDrawer
      :is-open="isDrawerOpen"
      :selected-team="selectedTeam"
      :selected-contract="selectedContract"
      :workers-data="filteredWorkers"
      @close="closeDrawer"
    />
  </DailyOpsDashboardShell>
</template>

<script setup lang="ts">
import type {
  DailyOpsLaborDayDto,
  DailyOpsLaborMetricsDto,
  DailyOpsRevenueBreakdownDto,
  DailyOpsSummaryDto,
  DailyOpsWorkersTeamLocationDayDto,
} from '~/types/daily-ops-dashboard'
import { formatDayHoursSharePlain, getDayHoursShareParts } from '~/utils/dailyOpsHoursShare'
import D3PieChart from '~/components/charts/D3PieChart.vue'
import D3PieChartV2 from '~/components/charts/D3PieChartV2.vue'
import DashboardDayHoursShare from '~/components/daily-ops/DashboardDayHoursShare.vue'
import WorkerDetailsDrawer from '~/components/daily-ops/WorkerDetailsDrawer.vue'

const categoryChartColors = ['#0a0a0a', '#242424', '#3d3d3d', '#575757', '#737373', '#b8b8b8']
const timePeriodChartColors = ['#1a1a1a', '#2a2a2a', '#3a3a3a', '#4a4a4a']

withDefaults(
  defineProps<{
    /** Last segment of the H1, e.g. Dashboard, Revenue, Productivity */
    pageHeadingSuffix?: string
  }>(),
  { pageHeadingSuffix: 'Dashboard' }
)

type LocationRow = { _id: string; name: string; abbreviation?: string }

const TEAM_DAY_KEY_SEP = ':::'

type LaborDayMetricKey = 'revenue' | 'laborCost' | 'hours' | 'laborPct' | 'eurPerH'
type TeamDayMetricKey = 'staff' | 'hours' | 'cost'

const laborByDayMetricDefs: { key: LaborDayMetricKey; label: string }[] = [
  { key: 'revenue', label: 'Revenue' },
  { key: 'laborCost', label: 'Labor' },
  { key: 'hours', label: 'Hours' },
  { key: 'laborPct', label: 'Labor % rev.' },
  { key: 'eurPerH', label: '€ / h' },
]

const { dashboardQuery, contextHeadline, locationId } = useDailyOpsDashboardRoute()
const { formatEur } = useDashboardEurFormat()

const { data: locationsRes } = useFetch<{ success: boolean; data: LocationRow[] }>('/api/daily-ops/locations')

const locationTitle = computed(() => {
  if (!locationId.value) return 'All Locations'
  const rows = locationsRes.value?.data ?? []
  const hit = rows.find((row) => row._id === locationId.value)
  return hit?.name ?? 'Selected Location'
})

type MetricsBundle = {
  summary: DailyOpsSummaryDto
  revenue: DailyOpsRevenueBreakdownDto
  labor: DailyOpsLaborMetricsDto
}

const metricsCacheKey = computed(
  () =>
    `daily-ops-dashboard-metrics-${dashboardQuery.value.period}-${dashboardQuery.value.location ?? 'all'}-${dashboardQuery.value.anchor ?? ''}`
)

const {
  data: metricsBundle,
  pending,
  error,
  refresh: refreshMetrics,
} = await useAsyncData(
  metricsCacheKey,
  async (): Promise<MetricsBundle> => {
    const q = { ...dashboardQuery.value }
    return await $fetch<MetricsBundle>('/api/daily-ops/metrics/bundle', { query: q })
  },
  { watch: [metricsCacheKey] }
)

const summary = computed(() => metricsBundle.value?.summary ?? null)
const revenue = computed(() => metricsBundle.value?.revenue ?? null)
const labor = computed(() => metricsBundle.value?.labor ?? null)

/** Bands for labor-cost % of revenue (Teams & Workers card only). */
const laborPctThresholdLow = ref(30)
const laborPctThresholdHigh = ref(35)

/** Table vs stacked bar chart (Teams & Workers card). */
const teamsWorkersViewMode = ref<'table' | 'chart'>('table')

/** Which values the Teams & Workers table columns emphasize (default: labor / revenue % only). */
type TeamsWorkersTableMetric = 'all' | 'workers' | 'hours' | 'percentage'

const teamsWorkersTableMetric = ref<TeamsWorkersTableMetric>('percentage')

const laborDayTotalSharePctLabel = (day: DailyOpsLaborDayDto): string => {
  const p = getDayHoursShareParts(day.hours, day)
  return p.pct ?? '—'
}

const laborBandBounds = computed(() => {
  const a = Number(laborPctThresholdLow.value)
  const b = Number(laborPctThresholdHigh.value)
  const low = Number.isFinite(a) ? a : 30
  const high = Number.isFinite(b) ? b : 35
  return { lo: Math.min(low, high), hi: Math.max(low, high) }
})

const laborPctClass = (pct: number | null): string => {
  if (pct == null || !Number.isFinite(pct)) return 'text-gray-400 font-normal'
  const { lo, hi } = laborBandBounds.value
  if (pct < lo) return 'text-emerald-600 font-semibold'
  if (pct <= hi) return 'text-blue-600 font-semibold'
  return 'text-red-600 font-semibold'
}

const formatLaborPctLabel = (pct: number | null): string => {
  if (pct == null || !Number.isFinite(pct)) return '—'
  return `${pct}% / rev.`
}

const teamsSummary = computed(() => {
  // API handles filtering: locationId set = specific location, undefined = ALL aggregated
  // Just display the combined/filtered data as single card per team
  const teams = labor.value?.workersByTeamLocation ?? []
  
  // Aggregate by team name (same team across dates = one card)
  const byTeam = new Map<string, { workerCount: number; totalCost: number; totalHours: number }>()
  for (const team of teams) {
    const key = team.teamName
    if (!byTeam.has(key)) byTeam.set(key, { workerCount: 0, totalCost: 0, totalHours: 0 })
    const agg = byTeam.get(key)!
    agg.workerCount = Math.max(agg.workerCount, team.workerCount)
    agg.totalCost += team.totalCost
    agg.totalHours += team.totalHours
  }
  
  const aggregated = Array.from(byTeam.entries()).map(([teamName, data]) => ({
    teamName,
    workerCount: data.workerCount,
    totalCost: data.totalCost,
    totalHours: data.totalHours,
  }))
  
  const totalCost = aggregated.reduce((sum, t) => sum + t.totalCost, 0)
  const totalHours = aggregated.reduce((sum, t) => sum + t.totalHours, 0)
  return aggregated
    .map((team) => ({
      teamName: team.teamName,
      workerCount: team.workerCount,
      totalCost: team.totalCost,
      totalHours: team.totalHours,
      pctOfTotalCost: totalCost > 0 ? (team.totalCost / totalCost) * 100 : 0,
      pctOfTotalHours: totalHours > 0 ? (team.totalHours / totalHours) * 100 : 0,
    }))
    .sort((a, b) => a.teamName.localeCompare(b.teamName))
})

const contractsSummary = computed(() => {
  const contracts = labor.value?.contractTypeByDay ?? []
  
  // When locationId is set, API already filters. When undefined, API returns combined.
  // Just display as-is, deduplicating by contractType for cleaner presentation
  const byContract = new Map<string | null, { workerCount: number; totalCost: number; totalHours: number }>()
  for (const contract of contracts) {
    const key = contract.contractType ?? null
    if (!byContract.has(key)) byContract.set(key, { workerCount: 0, totalCost: 0, totalHours: 0 })
    const agg = byContract.get(key)!
    agg.workerCount = Math.max(agg.workerCount, contract.workerCount ?? 0)
    agg.totalCost += contract.totalCost ?? 0
    agg.totalHours += contract.totalHours ?? 0
  }
  
  const aggregated = Array.from(byContract.entries()).map(([contractType, data]) => ({
    contractType: contractType ?? '',
    workerCount: data.workerCount,
    cost: data.totalCost,
    hours: data.totalHours,
  }))
  
  const totalCost = aggregated.reduce((sum, c) => sum + c.cost, 0)
  const totalHours = aggregated.reduce((sum, c) => sum + c.hours, 0)
  return aggregated
    .map((contract) => ({
      contractType: contract.contractType,
      workerCount: contract.workerCount,
      totalCost: contract.cost,
      totalHours: contract.hours,
      pctOfTotalCost: totalCost > 0 ? (contract.cost / totalCost) * 100 : 0,
      pctOfTotalHours: totalHours > 0 ? (contract.hours / totalHours) * 100 : 0,
    }))
    .sort((a, b) => (a.contractType || 'ZZZ').localeCompare(b.contractType || 'ZZZ'))
})

const laborDailyColumnMeta = computed(() => {
  const daily = labor.value?.daily ?? []
  const weekdayFmt = new Intl.DateTimeFormat('en-GB', { weekday: 'short', timeZone: 'UTC' })
  const dayMonthFmt = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' })
  return daily.map((row) => {
    const d = new Date(`${row.date}T12:00:00.000Z`)
    return {
      date: row.date,
      weekday: weekdayFmt.format(d),
      dayMonth: dayMonthFmt.format(d),
    }
  })
})

/** Pre-aggregated venue × day hours/workers (avoids O(n) scans per table cell). */
const locationDayRollupMap = computed(() => {
  const m = new Map<string, { hours: number; workers: number }>()
  for (const r of labor.value?.workersByTeamLocationByDay ?? []) {
    const k = `${String(r.locationId)}:::${r.date}`
    let row = m.get(k)
    if (!row) {
      row = { hours: 0, workers: 0 }
      m.set(k, row)
    }
    row.hours += r.totalHours
    row.workers += r.workerCount
  }
  for (const row of m.values()) {
    row.hours = Math.round(row.hours * 10) / 10
  }
  return m
})

const getLocationDayRollup = (locationId: string, date: string): { hours: number; workers: number } =>
  locationDayRollupMap.value.get(`${String(locationId)}:::${date}`) ?? { hours: 0, workers: 0 }

const locationRollupShareCell = (locationId: string, day: DailyOpsLaborDayDto): { amount: number; showDash: boolean } => {
  const r = getLocationDayRollup(locationId, day.date)
  return {
    amount: r.hours,
    showDash: r.hours === 0 && r.workers === 0,
  }
}

const teamHoursShareCell = (teamKey: string, day: DailyOpsLaborDayDto): { amount: number; showDash: boolean } => {
  const row = workersTeamDayMap.value.get(`${teamKey}${TEAM_DAY_KEY_SEP}${day.date}`)
  if (!row) return { amount: 0, showDash: true }
  return { amount: row.totalHours, showDash: false }
}

const contractHoursShareCell = (contractType: string, day: DailyOpsLaborDayDto): { amount: number; showDash: boolean } => {
  const row = contractTypeDayMap.value.get(`${contractType}${TEAM_DAY_KEY_SEP}${day.date}`)
  if (!row) return { amount: 0, showDash: true }
  if (row.workerCount === 0 && row.totalHours === 0 && row.totalCost === 0) return { amount: 0, showDash: true }
  return { amount: row.totalHours, showDash: false }
}

const formatLaborDayCell = (row: DailyOpsLaborDayDto, key: LaborDayMetricKey): string => {
  switch (key) {
    case 'revenue':
      return formatEur(row.revenue)
    case 'laborCost':
      return formatEur(row.laborCost)
    case 'hours':
      return formatDayHoursSharePlain(row.hours, row)
    case 'laborPct':
      return row.laborCostPctOfRevenue != null ? `${row.laborCostPctOfRevenue.toFixed(1)}%` : '—'
    case 'eurPerH':
      return row.revenuePerLaborHour != null ? formatEur(row.revenuePerLaborHour) : '—'
  }
}

const workersTeamDayMap = computed(() => {
  const flat = labor.value?.workersByTeamLocationByDay ?? []
  const m = new Map<string, DailyOpsWorkersTeamLocationDayDto>()
  for (const r of flat) {
    m.set(`${r.locationId}${TEAM_DAY_KEY_SEP}${r.teamId}${TEAM_DAY_KEY_SEP}${r.date}`, r)
  }
  return m
})

const locationLaborPctLookup = computed(() => {
  const m = new Map<string, number | null>()
  for (const r of labor.value?.locationLaborPctByDay ?? []) {
    m.set(`${r.date}|${r.locationId}`, r.laborCostPctOfRevenue ?? null)
  }
  return m
})

const locationLaborPct = (locId: string, day: DailyOpsLaborDayDto): number | null =>
  locationLaborPctLookup.value.get(`${day.date}|${String(locId)}`) ?? null

const teamLaborPct = (teamKey: string, day: DailyOpsLaborDayDto): number | null => {
  const row = workersTeamDayMap.value.get(`${teamKey}${TEAM_DAY_KEY_SEP}${day.date}`)
  return row?.laborCostPctOfRevenue ?? null
}

const contractTypeDayMap = computed(() => {
  const flat = labor.value?.contractTypeByDay ?? []
  const m = new Map<string, { workerCount: number; totalHours: number; totalCost: number }>()
  for (const r of flat) {
    m.set(`${r.contractType}${TEAM_DAY_KEY_SEP}${r.date}`, r)
  }
  return m
})

/** Preferred row order in Labor — By Day (then any other types A–Z, then “none” / `-`). */
const LABOR_CONTRACT_TYPE_ROW_ORDER = ['nul uren', 'uren contract', 'zzp'] as const

const laborByDayContractTypesSorted = computed(() => {
  const s = new Set<string>()
  for (const r of labor.value?.contractTypeByDay ?? []) s.add(r.contractType)
  const all = [...s]
  const used = new Set<string>()
  const primary: string[] = []
  for (const want of LABOR_CONTRACT_TYPE_ROW_ORDER) {
    const hit = all.find((t) => t.toLowerCase() === want.toLowerCase())
    if (hit != null && !used.has(hit)) {
      primary.push(hit)
      used.add(hit)
    }
  }
  const rest = all
    .filter((t) => t !== '-' && !used.has(t))
    .sort((a, b) => a.localeCompare(b))
  const none = all.includes('-') ? (['-'] as const) : []
  return [...primary, ...rest, ...none]
})

const workersTeamKeysSorted = computed(() => {
  const flat = labor.value?.workersByTeamLocationByDay ?? []
  const seen = new Map<string, { locationName: string; teamName: string }>()
  for (const r of flat) {
    const k = `${r.locationId}${TEAM_DAY_KEY_SEP}${r.teamId}`
    if (!seen.has(k)) seen.set(k, { locationName: r.locationName, teamName: r.teamName })
  }
  return [...seen.entries()].sort((a, b) => {
    const la = `${a[1].locationName} ${a[1].teamName}`
    const lb = `${b[1].locationName} ${b[1].teamName}`
    return la.localeCompare(lb)
  })
})

type LaborTeamEntry = {
  teamKey: string
  meta: { locationName: string; teamName: string }
}

type LaborLocationGroup = {
  locationId: string
  locationName: string
  teams: LaborTeamEntry[]
}

const laborTeamsByLocation = computed((): LaborLocationGroup[] => {
  const byLoc = new Map<string, { locationName: string; teams: LaborTeamEntry[] }>()
  for (const [teamKey, meta] of workersTeamKeysSorted.value) {
    const locationId = String(teamKey.split(TEAM_DAY_KEY_SEP)[0] ?? '')
    if (!byLoc.has(locationId)) {
      byLoc.set(locationId, { locationName: meta.locationName, teams: [] })
    }
    byLoc.get(locationId)!.teams.push({ teamKey, meta })
  }
  return [...byLoc.entries()]
    .map(([locationId, v]) => ({
      locationId,
      locationName: v.locationName,
      teams: [...v.teams].sort((a, b) => a.meta.teamName.localeCompare(b.meta.teamName)),
    }))
    .sort((a, b) => a.locationName.localeCompare(b.locationName))
})

type LaborChartSegmentStyle = { bg: string; fg: string; labelShadow: boolean }

/**
 * Greyscale only: bottom of stack (Afwas: near-black) to top (Ziek: light grey).
 * labelShadow = light text on dark fills for legible % labels.
 */
const LABOR_CHART_KNOWN_SEGMENT_STYLES: Record<string, LaborChartSegmentStyle> = {
  afwas: { bg: '#0a0a0a', fg: '#f5f5f5', labelShadow: true },
  keuken: { bg: '#242424', fg: '#f5f5f5', labelShadow: true },
  bediening: { bg: '#3d3d3d', fg: '#fafafa', labelShadow: true },
  management: { bg: '#575757', fg: '#fafafa', labelShadow: true },
  algemeen: { bg: '#737373', fg: '#ffffff', labelShadow: true },
  ziek: { bg: '#b8b8b8', fg: '#171717', labelShadow: false },
}

/** Ad-hoc teams stack above Ziek: progressively lighter greys, dark labels. */
const LABOR_CHART_OTHER_SEGMENT_STYLES: LaborChartSegmentStyle[] = [
  { bg: '#c9c9c9', fg: '#171717', labelShadow: false },
  { bg: '#d6d6d6', fg: '#171717', labelShadow: false },
  { bg: '#e2e2e2', fg: '#1a1a1a', labelShadow: false },
  { bg: '#ececec', fg: '#1a1a1a', labelShadow: false },
  { bg: '#f2f2f2', fg: '#1c1c1c', labelShadow: false },
  { bg: '#f7f7f7', fg: '#1c1c1c', labelShadow: false },
]

/** Raw name normalize (before aliases / stack mapping). */
const normalizeLaborChartTeamName = (name: string): string => name.trim().toLowerCase().replace(/\s+/g, ' ')

/** Bottom → top stack: Afwas … Ziek; then any other teams above Ziek. */
const LABOR_CHART_STACK_DEF = [
  { key: 'afwas', label: 'Afwas' },
  { key: 'keuken', label: 'Keuken' },
  { key: 'bediening', label: 'Bediening' },
  { key: 'management', label: 'Management' },
  { key: 'algemeen', label: 'Algemeen' },
  { key: 'ziek', label: 'Ziek' },
] as const

const LABOR_CHART_STACK_KEY_ORDER = new Map<string, number>(
  LABOR_CHART_STACK_DEF.map((d, i) => [d.key, i])
)

/** These names (normalized) roll up into Management in the chart. */
const LABOR_CHART_MANAGEMENT_ALIAS_NORMS = new Set(
  ['bestellen & stock', 'bestelling & stock', 'hk & hr management'].map((s) =>
    normalizeLaborChartTeamName(s)
  )
)

const laborChartCanonicalTeam = (
  rawName: string
): { stackKey: string; label: string } => {
  const n = normalizeLaborChartTeamName(rawName)
  if (!n) return { stackKey: '_empty', label: rawName.trim() || '—' }
  if (LABOR_CHART_MANAGEMENT_ALIAS_NORMS.has(n)) {
    return { stackKey: 'management', label: 'Management' }
  }
  const known = LABOR_CHART_STACK_DEF.find((d) => d.key === n)
  if (known) return { stackKey: known.key, label: known.label }
  return { stackKey: n, label: rawName.trim() }
}

/** Display label per stackKey (known rows + first seen spelling for ad-hoc teams). */
const laborChartStackKeyDisplayLabel = computed(() => {
  const m = new Map<string, string>()
  for (const d of LABOR_CHART_STACK_DEF) m.set(d.key, d.label)
  const flat = [...(labor.value?.workersByTeamLocationByDay ?? [])].sort((a, b) => {
    const cmp = normalizeLaborChartTeamName(a.teamName).localeCompare(normalizeLaborChartTeamName(b.teamName))
    if (cmp !== 0) return cmp
    return String(a.teamId).localeCompare(String(b.teamId))
  })
  for (const r of flat) {
    const { stackKey, label } = laborChartCanonicalTeam(r.teamName)
    if (stackKey === '_empty' || m.has(stackKey)) continue
    m.set(stackKey, label)
  }
  return m
})

/** Stack keys with hours in the bundle, ordered for palette + legend. */
const laborChartActiveStackKeysOrdered = computed(() => {
  const active = new Set<string>()
  for (const r of labor.value?.workersByTeamLocationByDay ?? []) {
    if (r.totalHours <= 0) continue
    const { stackKey } = laborChartCanonicalTeam(r.teamName)
    if (stackKey !== '_empty') active.add(stackKey)
  }
  const labels = laborChartStackKeyDisplayLabel.value
  const known = LABOR_CHART_STACK_DEF.map((d) => d.key).filter((k) => active.has(k))
  const unknown = [...active]
    .filter((k) => !LABOR_CHART_STACK_KEY_ORDER.has(k))
    .sort((a, b) => (labels.get(a) ?? a).localeCompare(labels.get(b) ?? b, 'nl', { sensitivity: 'base' }))
  return [...known, ...unknown]
})

const laborChartSegmentStylesByStackKey = computed(() => {
  const active = laborChartActiveStackKeysOrdered.value
  const unknowns = active.filter((k) => !LABOR_CHART_KNOWN_SEGMENT_STYLES[k])
  const unknownRank = new Map(unknowns.map((k, i) => [k, i]))
  const m = new Map<string, LaborChartSegmentStyle>()
  for (const k of active) {
    const fixed = LABOR_CHART_KNOWN_SEGMENT_STYLES[k]
    if (fixed) {
      m.set(k, fixed)
      continue
    }
    const r = unknownRank.get(k) ?? 0
    m.set(k, LABOR_CHART_OTHER_SEGMENT_STYLES[r % LABOR_CHART_OTHER_SEGMENT_STYLES.length]!)
  }
  return m
})

const formatLaborChartSegPct = (pct: number): string => {
  const p = Math.round(pct * 10) / 10
  if (!Number.isFinite(p) || p <= 0) return '0%'
  if (Math.abs(p - Math.round(p)) < 0.05) return `${Math.round(p)}%`
  return `${p.toFixed(1)}%`
}

type LaborStackedChartSeg = {
  stackKey: string
  teamName: string
  hours: number
  color: string
  labelFg: string
  labelShadow: boolean
  pctOfBar: number
}

type LaborStackedChartBar = {
  locationId: string
  locationName: string
  totalHours: number
  barHeightPct: number
  segments: LaborStackedChartSeg[]
}

type LaborStackedChartCol = {
  date: string
  meta: { weekday: string; dayMonth: string }
  bars: LaborStackedChartBar[]
}

const laborStackedChartColumns = computed((): LaborStackedChartCol[] => {
  const daily = labor.value?.daily ?? []
  const locs = laborTeamsByLocation.value
  const stylesMap = laborChartSegmentStylesByStackKey.value
  const tmap = workersTeamDayMap.value
  const weekdayFmt = new Intl.DateTimeFormat('en-GB', { weekday: 'short', timeZone: 'UTC' })
  const dayMonthFmt = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' })

  return daily.map((day) => {
    const bars: LaborStackedChartBar[] = []
    for (const loc of locs) {
      const segAcc = new Map<string, { hours: number; label: string }>()
      for (const { teamKey, meta } of loc.teams) {
        const row = tmap.get(`${teamKey}${TEAM_DAY_KEY_SEP}${day.date}`)
        const h = row?.totalHours ?? 0
        if (h <= 0) continue
        const { stackKey, label } = laborChartCanonicalTeam(meta.teamName)
        if (stackKey === '_empty') continue
        const prev = segAcc.get(stackKey)
        if (prev) prev.hours += h
        else segAcc.set(stackKey, { hours: h, label })
      }
      const unknownKeys = [...segAcc.keys()]
        .filter((k) => !LABOR_CHART_STACK_KEY_ORDER.has(k))
        .sort((a, b) => a.localeCompare(b, 'nl'))
      const unknownIdx = new Map(unknownKeys.map((k, i) => [k, i]))
      const rawTotalH = [...segAcc.values()].reduce((s, v) => s + v.hours, 0)
      const segments: LaborStackedChartSeg[] = [...segAcc.entries()]
        .map(([stackKey, v]) => {
          const st = stylesMap.get(stackKey) ?? {
            bg: '#a3a3a3',
            fg: '#171717',
            labelShadow: false,
          }
          const pct = rawTotalH > 0 ? (v.hours / rawTotalH) * 100 : 0
          return {
            stackKey,
            teamName: v.label,
            hours: Math.round(v.hours * 10) / 10,
            color: st.bg,
            labelFg: st.fg,
            labelShadow: st.labelShadow,
            pctOfBar: Math.round(pct * 10) / 10,
          }
        })
        .sort((a, b) => {
          const ia = LABOR_CHART_STACK_KEY_ORDER.get(a.stackKey)
          const ib = LABOR_CHART_STACK_KEY_ORDER.get(b.stackKey)
          if (ia != null && ib != null) return ia - ib
          if (ia != null) return -1
          if (ib != null) return 1
          return (unknownIdx.get(a.stackKey) ?? 0) - (unknownIdx.get(b.stackKey) ?? 0)
        })
        /* flex-col + justify-end: last DOM node sits on the baseline = bottom of bar → darkest (Afwas) must be last */
        .reverse()
      const roundedTotal = Math.round(segments.reduce((s, x) => s + x.hours, 0) * 10) / 10
      bars.push({
        locationId: loc.locationId,
        locationName: loc.locationName,
        totalHours: roundedTotal,
        barHeightPct: 0,
        segments,
      })
    }
    const dayMax = Math.max(0, ...bars.map((b) => b.totalHours))
    for (const b of bars) {
      b.barHeightPct = dayMax > 0 ? (b.totalHours / dayMax) * 100 : 0
    }
    const d = new Date(`${day.date}T12:00:00.000Z`)
    return {
      date: day.date,
      meta: { weekday: weekdayFmt.format(d), dayMonth: dayMonthFmt.format(d) },
      bars,
    }
  })
})

const laborStackedChartLegend = computed(() => {
  const styles = laborChartSegmentStylesByStackKey.value
  const labels = laborChartStackKeyDisplayLabel.value
  const out: { normKey: string; label: string; color: string }[] = []
  for (const stackKey of laborChartActiveStackKeysOrdered.value) {
    const st = styles.get(stackKey) ?? { bg: '#a3a3a3', fg: '#171717', labelShadow: false }
    out.push({
      normKey: stackKey,
      label: labels.get(stackKey) ?? stackKey,
      color: st.bg,
    })
  }
  return out
})

type LaborByDayTableSegment =
  | { kind: 'location'; loc: LaborLocationGroup }
  | { kind: 'postKinsbergenTotalHours' }

const isVanKinsbergenVenue = (loc: LaborLocationGroup): boolean =>
  loc.locationName.toLowerCase().includes('kinsbergen')

/** Location tbodys plus an extra totals row immediately after Van Kinsbergen. */
const laborByDayLocationSegments = computed((): LaborByDayTableSegment[] => {
  const out: LaborByDayTableSegment[] = []
  for (const loc of laborTeamsByLocation.value) {
    out.push({ kind: 'location', loc })
    if (isVanKinsbergenVenue(loc)) {
      out.push({ kind: 'postKinsbergenTotalHours' })
    }
  }
  return out
})

/** Expanded/collapsed per venue (Map + shallowRef so toggles always trigger updates). */
const laborLocationExpandedMap = shallowRef(new Map<string, boolean>())

const isLaborLocationExpanded = (locationId: string): boolean => {
  const id = String(locationId)
  const m = laborLocationExpandedMap.value
  if (!m.has(id)) return false
  return m.get(id) === true
}

const toggleLaborLocationExpanded = (locationId: string): void => {
  const id = String(locationId)
  const prev = laborLocationExpandedMap.value
  const nextMap = new Map(prev)
  const expanded = isLaborLocationExpanded(id)
  nextMap.set(id, !expanded)
  laborLocationExpandedMap.value = nextMap
}

const laborTeamsVisibleForLocation = (loc: LaborLocationGroup): LaborTeamEntry[] =>
  isLaborLocationExpanded(loc.locationId) ? loc.teams : []

const formatLocationRollupWorkersLine = (locationId: string, date: string): string => {
  const { hours, workers } = getLocationDayRollup(locationId, date)
  if (hours === 0 && workers === 0) return '—'
  return `${workers} workers`
}

const workersTeamPivotRows = computed(() => {
  const out: { teamKey: string; label: string; metric: TeamDayMetricKey }[] = []
  for (const [teamKey, meta] of workersTeamKeysSorted.value) {
    const base = `${meta.locationName} · ${meta.teamName}`
    out.push({ teamKey, label: `${base} · Staff`, metric: 'staff' })
    out.push({ teamKey, label: `${base} · Hours`, metric: 'hours' })
    out.push({ teamKey, label: `${base} · Cost`, metric: 'cost' })
  }
  return out
})

const formatTeamDayCell = (teamKey: string, date: string, metric: TeamDayMetricKey): string => {
  const row = workersTeamDayMap.value.get(`${teamKey}${TEAM_DAY_KEY_SEP}${date}`)
  if (!row) return '—'
  switch (metric) {
    case 'staff':
      return String(row.workerCount)
    case 'hours':
      return row.totalHours.toFixed(1)
    case 'cost':
      return formatEur(row.totalCost)
  }
}

const formatTeamNameBelowHours = (
  teamKey: string,
  date: string,
  meta: { locationName: string; teamName: string }
): string => {
  const row = workersTeamDayMap.value.get(`${teamKey}${TEAM_DAY_KEY_SEP}${date}`)
  if (!row) return '—'
  if (row.workerCount === 0 && row.totalHours === 0) return '—'
  return `${row.workerCount} · ${meta.teamName}`
}

const formatContractBelowHoursLine = (contractType: string, date: string): string => {
  const row = contractTypeDayMap.value.get(`${contractType}${TEAM_DAY_KEY_SEP}${date}`)
  if (!row) return '—'
  if (row.workerCount === 0 && row.totalHours === 0 && row.totalCost === 0) return '—'
  return `${row.workerCount} staff · ${formatEur(row.totalCost)}`
}

type DrawerWorkerRow = {
  date: string
  locationName: string
  teamName: string
  totalHours: number
  totalCost: number
  laborCostPctOfRevenue: number | null
  workerCount: number
}

const selectedTeam = ref<string | null>(null)
const selectedContract = ref<string | null>(null)

const isDrawerOpen = computed(() => selectedTeam.value !== null || selectedContract.value !== null)

const filteredWorkers = computed((): DrawerWorkerRow[] => {
  const raw = labor.value?.workersByTeamLocationByDay ?? []

  if (selectedTeam.value) {
    return raw
      .filter((r) => r.teamName === selectedTeam.value)
      .map((r) => ({
        date: r.date,
        locationName: r.locationName,
        teamName: r.teamName,
        totalHours: r.totalHours,
        totalCost: r.totalCost,
        laborCostPctOfRevenue: r.laborCostPctOfRevenue,
        workerCount: r.workerCount,
      }))
      .sort((a, b) => {
        const dateCmp = a.date.localeCompare(b.date)
        if (dateCmp !== 0) return dateCmp
        return `${a.locationName}${a.teamName}`.localeCompare(`${b.locationName}${b.teamName}`)
      })
  }

  if (selectedContract.value) {
    const contractRows = labor.value?.contractTypeByDay ?? []
    const targetContract = selectedContract.value === 'None' ? '' : selectedContract.value
    const filteredByContract = contractRows.filter((r) => (r.contractType || '') === targetContract)
    
    if (filteredByContract.length === 0) return []

    const aggregated = new Map<string, DrawerWorkerRow>()
    for (const row of raw) {
      const key = `${row.date}|${row.locationName}|${row.teamName}`
      if (!aggregated.has(key)) {
        aggregated.set(key, {
          date: row.date,
          locationName: row.locationName,
          teamName: row.teamName,
          totalHours: 0,
          totalCost: 0,
          laborCostPctOfRevenue: null,
          workerCount: 0,
        })
      }
      const agg = aggregated.get(key)!
      agg.totalHours += row.totalHours
      agg.totalCost += row.totalCost
      agg.workerCount += row.workerCount
    }
    
    return Array.from(aggregated.values()).sort((a, b) => {
      const dateCmp = a.date.localeCompare(b.date)
      if (dateCmp !== 0) return dateCmp
      return `${a.locationName}${a.teamName}`.localeCompare(`${b.locationName}${b.teamName}`)
    })
  }

  return []
})

const selectTeam = (teamName: string): void => {
  selectedTeam.value = teamName
  selectedContract.value = null
}

const selectContract = (contractType: string): void => {
  selectedContract.value = contractType
  selectedTeam.value = null
}

const closeDrawer = (): void => {
  selectedTeam.value = null
  selectedContract.value = null
}
</script>
