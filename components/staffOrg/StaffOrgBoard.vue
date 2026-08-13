<template>
  <div class="space-y-4">
    <div class="flex justify-end">
      <UButton
        size="sm"
        variant="outline"
        color="neutral"
        icon="i-lucide-file-down"
        :loading="printingPdf"
        :disabled="printingPdf"
        @click="exportPdf"
      >
        Download PDF
      </UButton>
    </div>

    <div class="grid gap-4 lg:grid-cols-[minmax(0,1fr)_240px]">
      <div
        ref="pdfRoot"
        class="min-w-0 space-y-4"
      >
        <div class="staff-org-print-metrics">
          <StaffOrgMetricsBar
            :open-hours="summary.openHours"
            :assigned-hours="summary.assignedHours"
            :labor-cost="summary.laborCost"
            :headcount="summary.headcount"
            :under-min-count="summary.underMinCount"
            :over-max-count="summary.overMaxCount"
            :productivity="productivity"
          />
        </div>

        <div class="staff-org-print-board overflow-x-auto rounded-lg border border-gray-200 bg-white">
          <table class="min-w-full border-collapse text-sm">
            <thead>
              <tr class="border-b border-gray-200 bg-gray-50 text-left text-xs uppercase tracking-wide text-gray-500">
                <th class="px-3 py-2 font-medium">
                  Team
                </th>
                <th
                  v-for="d in dayLabels"
                  :key="d"
                  class="px-2 py-2 font-medium"
                >
                  {{ d }}
                </th>
              </tr>
              <tr class="border-b border-gray-100 bg-gray-50/80 text-[10px] text-gray-600">
                <th class="px-3 py-1.5 font-medium text-gray-500">
                  Day plan
                </th>
                <th
                  v-for="weekday in weekdays"
                  :key="`plan-${weekday}`"
                  class="px-1.5 py-1.5 align-top"
                >
                  <div class="space-y-0.5 tabular-nums">
                    <p>
                      Est €{{ formatEur(dayPlan(weekday).estRevenue) }}
                      <span class="text-gray-400">({{ (dayPlan(weekday).share * 100).toFixed(0) }}%)</span>
                    </p>
                    <p>FT {{ dayPlan(weekday).ftHours.toFixed(1) }}u</p>
                    <p :class="dayPlan(weekday).leftoverHours > 0.2 ? 'text-amber-700' : 'text-gray-500'">
                      PT/ZZP {{ dayPlan(weekday).leftoverHours.toFixed(1) }}u
                    </p>
                  </div>
                </th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="teamRow in boardTeams"
                :key="teamRow.id"
                class="border-b border-gray-100 align-top"
              >
                <td class="px-3 py-2 text-xs font-semibold text-gray-700">
                  {{ teamRow.label }}
                </td>
                <td
                  v-for="weekday in weekdays"
                  :key="`${teamRow.id}-${weekday}`"
                  class="px-1.5 py-1.5"
                >
                  <StaffOrgSlotCell
                    :location-id="locationId"
                    :team="teamRow.id"
                    :weekday="weekday"
                    :slot="defaultSlotFor(teamRow.id, weekday)"
                    :members="membersInCell(teamRow.id, weekday)"
                    :open-hours="cellMeta(teamRow.id, weekday).openHours"
                    :headcount="cellMeta(teamRow.id, weekday).headcount"
                    :min-staff="cellMeta(teamRow.id, weekday).minStaff"
                    :max-staff="cellMeta(teamRow.id, weekday).maxStaff"
                    :under-min="cellMeta(teamRow.id, weekday).underMin"
                    :over-max="cellMeta(teamRow.id, weekday).overMax"
                    @drop="(payload) => onDrop(payload, teamRow.id, weekday)"
                  />
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <aside class="space-y-3">
        <div class="rounded-lg border border-gray-200 bg-white p-3">
          <h3 class="mb-1 text-xs font-semibold uppercase tracking-wide text-gray-500">
            Active roster
          </h3>
          <div class="mb-2 flex gap-0.5 rounded-md bg-gray-100 p-0.5">
            <button
              v-for="tab in rosterTabs"
              :key="tab.id"
              type="button"
              class="flex-1 rounded px-1.5 py-1 text-[10px] font-semibold uppercase tracking-wide"
              :class="rosterTab === tab.id
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-500 hover:text-gray-700'"
              @click="rosterTab = tab.id"
            >
              {{ tab.label }}
              <span class="tabular-nums text-gray-400">({{ tab.count }})</span>
            </button>
          </div>
          <p class="mb-2 text-[10px] text-gray-500">
            {{ rosterTabHint }}
          </p>
          <label
            v-if="rosterTab === 'ft'"
            class="mb-2 flex items-center gap-2 text-xs text-gray-600"
          >
            <input
              v-model="hideFullyScheduled"
              type="checkbox"
              class="rounded border-gray-300"
            >
            Hide fully scheduled
          </label>

          <div
            class="flex max-h-[20rem] flex-col gap-2 overflow-y-auto rounded-md border border-dashed border-gray-300 p-2"
            @dragover.prevent
            @drop.prevent="onDropUnassign"
          >
            <template v-if="rosterTab === 'zzp'">
              <StaffOrgStaffCard
                :member="needMember('zzp')"
                compact
                placeholder
                hide-wage
              />
              <div
                v-if="zzpRoster.length"
                class="flex flex-col gap-1.5"
              >
                <StaffOrgStaffCard
                  v-for="m in zzpRoster"
                  :key="`z-${m.memberId}`"
                  :member="m"
                  compact
                  editable-desired-days
                  :placed-days="daysPlaced(m.memberId)"
                  @update:desired-days="onDesiredDays"
                />
              </div>
              <p
                v-else
                class="text-[10px] text-gray-400"
              >
                No named ZZP — use Need ZZP (TBD) above.
              </p>
            </template>

            <template v-else-if="rosterTab === 'pt'">
              <StaffOrgStaffCard
                :member="needMember('pt')"
                compact
                placeholder
                hide-wage
              />
              <div
                v-if="ptFlexRoster.length"
                class="flex flex-col gap-1.5"
              >
                <StaffOrgStaffCard
                  v-for="m in ptFlexRoster"
                  :key="`pt-${m.memberId}`"
                  :member="m"
                  compact
                  editable-desired-days
                  editable-desired-hours
                  :placed-days="daysPlaced(m.memberId)"
                  @update:desired-days="onDesiredDays"
                  @update:desired-hours="onDesiredHours"
                />
              </div>
              <p
                v-else
                class="text-[10px] text-gray-400"
              >
                No named PT — use Need PT (TBD) above.
              </p>
            </template>

            <template v-else>
              <StaffOrgStaffCard
                :member="needMember('ft')"
                compact
                placeholder
                hide-wage
              />
              <div v-if="unassignedRoster.length">
                <p class="mb-1 text-[10px] font-semibold uppercase tracking-wide text-amber-800">
                  Not on board ({{ unassignedRoster.length }})
                </p>
                <div class="flex flex-col gap-1.5">
                  <StaffOrgStaffCard
                    v-for="m in unassignedRoster"
                    :key="`u-${m.memberId}`"
                    :member="m"
                    compact
                    editable-desired-days
                    :placed-days="0"
                    @update:desired-days="onDesiredDays"
                  />
                </div>
              </div>
              <div v-if="partialRoster.length">
                <p class="mb-1 text-[10px] font-semibold uppercase tracking-wide text-gray-500">
                  On board — add days ({{ partialRoster.length }})
                </p>
                <div class="flex flex-col gap-1.5">
                  <StaffOrgStaffCard
                    v-for="m in partialRoster"
                    :key="`p-${m.memberId}`"
                    :member="m"
                    compact
                    editable-desired-days
                    :placed-days="daysPlaced(m.memberId)"
                    @update:desired-days="onDesiredDays"
                  />
                </div>
              </div>
              <div v-if="fullRoster.length && !hideFullyScheduled">
                <p class="mb-1 text-[10px] font-semibold uppercase tracking-wide text-gray-400">
                  Fully scheduled ({{ fullRoster.length }})
                </p>
                <div class="flex flex-col gap-1.5 opacity-60">
                  <StaffOrgStaffCard
                    v-for="m in fullRoster"
                    :key="`f-${m.memberId}`"
                    :member="m"
                    compact
                    editable-desired-days
                    :placed-days="daysPlaced(m.memberId)"
                    @update:desired-days="onDesiredDays"
                  />
                </div>
              </div>
              <p
                v-if="!unassignedRoster.length && !partialRoster.length && (!fullRoster.length || hideFullyScheduled)"
                class="text-[10px] text-gray-400"
              >
                No named FT — use Need FT (TBD) above.
              </p>
            </template>
          </div>
        </div>
      </aside>
    </div>

    <div
      class="rounded-lg border border-dashed border-red-200 bg-red-50/40 p-3"
      @dragover.prevent="onInactiveDragOver"
      @drop.prevent="onDropInactive"
    >
      <h3 class="mb-1 text-xs font-semibold uppercase tracking-wide text-red-800">
        Not active ({{ inactiveMembers.length }})
      </h3>
      <p class="mb-2 text-[10px] text-red-700/80">
        Leaving / long sick — cleared from board. Hide = never show again in this scenario.
      </p>
      <div class="grid max-h-56 grid-cols-1 gap-1.5 overflow-y-auto sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        <div
          v-for="m in inactiveMembers"
          :key="`i-${m.memberId}`"
          class="flex items-center gap-1 rounded border border-red-100 bg-white/80 px-1.5 py-1"
        >
          <StaffOrgStaffCard
            :member="m"
            compact
            class="min-w-0 flex-1"
          />
          <button
            type="button"
            class="shrink-0 rounded px-1.5 py-1 text-[10px] font-medium text-red-800 hover:bg-red-100"
            title="Back to active roster"
            @click="reactivateMember(m.memberId)"
          >
            Restore
          </button>
          <button
            type="button"
            class="shrink-0 rounded px-1.5 py-1 text-[10px] font-medium text-gray-600 hover:bg-gray-100"
            title="Hide permanently — will never work here again"
            @click="hideMember(m.memberId)"
          >
            Hide
          </button>
        </div>
        <p
          v-if="!inactiveMembers.length"
          class="col-span-full text-[10px] text-red-600/70"
        >
          Drop staff here to deactivate.
        </p>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
/**
 * @registry-id: StaffOrgBoard
 * @created: 2026-07-22T18:00:00.000Z
 * @last-modified: 2026-08-13T15:05:00.000Z
 * @description: Team × Mon–Sun board — Keuken/Bar/Bediening rows (day+evening combined)
 * @last-fix: [2026-08-13] PDF: full Sunday column + hide overflow scrollbars
 * @adr-ref: ADR-016
 */

import type {
  StaffOrgAssignment,
  StaffOrgCellMetrics,
  StaffOrgLocationTargets,
  StaffOrgPlacement,
  StaffOrgRosterMember,
  StaffOrgSlot,
  StaffOrgSlotHours,
  StaffOrgTeam,
  StaffOrgWeekday,
} from '~/types/staff-org'
import { applyPlannerDayNameDefaults, rebalanceContractHours, suggestedDaysForMember } from '~/utils/staffOrg/contractHours'
import { buildProductivityView, weeklyRevenueFromMonthly } from '~/utils/staffOrg/productivity'
import { classifyStaffContractType } from '~/utils/dailyOpsStaffContractBuckets'
import {
  createNeedInstanceId,
  isNeedInstanceId,
  isNeedMemberId,
  isNeedTemplateId,
  needBucketFromMemberId,
  needTemplateId,
  syntheticNeedMember,
  type StaffOrgNeedBucket,
} from '~/utils/staffOrg/rosterPlaceholders'

export type StaffOrgWeekdayShareRow = {
  weekday: StaffOrgWeekday
  share: number
}

const props = defineProps<{
  locationId: string
  roster: StaffOrgRosterMember[]
  /** Full scenario roster for FT productivity (board roster is filtered). */
  fullRoster?: StaffOrgRosterMember[]
  orgAssignments?: StaffOrgAssignment[]
  placements: StaffOrgPlacement[]
  metrics: StaffOrgCellMetrics[]
  slotHours: StaffOrgSlotHours[]
  locationTargets: StaffOrgLocationTargets[]
  inactiveMemberIds: string[]
  /** Permanently hidden — excluded from Not active list. */
  hiddenMemberIds?: string[]
  weekdayShares?: StaffOrgWeekdayShareRow[]
  /** PDF header — scenario name */
  printTitle?: string
  /** PDF header — venue short label */
  locationLabel?: string
}>()

const pdfRoot = ref<HTMLElement | null>(null)
const printingPdf = ref(false)
const toast = useToast()

/** Min width so Ma–Zo columns fit without horizontal scroll. */
const PDF_EXPORT_MIN_WIDTH_PX = 1500

const pdfHeading = computed(() => {
  const parts = [props.printTitle?.trim(), props.locationLabel?.trim()].filter(Boolean)
  return parts.length ? parts.join(' · ') : 'Staff Org roster'
})

function safePdfFilename (label: string): string {
  const base = label.replace(/[^a-z0-9]+/gi, '_').replace(/^_|_$/g, '') || 'staff_org'
  return `${base}_roster`
}

async function exportPdf (): Promise<void> {
  if (!pdfRoot.value || printingPdf.value || !import.meta.client) return
  toast.add({
    title: 'Creating your PDF.',
    icon: 'i-lucide-file-down',
    color: 'primary',
    duration: 4000,
  })
  printingPdf.value = true

  const root = pdfRoot.value
  const heading = document.createElement('h1')
  heading.dataset.pdfTempHeading = '1'
  heading.style.cssText = 'margin:0 0 12px;font-size:20px;font-weight:700;color:#111827;font-family:system-ui,sans-serif'
  heading.textContent = pdfHeading.value
  root.insertBefore(heading, root.firstChild)

  const prevWidth = root.style.width
  const prevMinWidth = root.style.minWidth
  const prevMaxWidth = root.style.maxWidth
  const prevOverflow = root.style.overflow

  // Kill scrollbars / clipping so Sunday + full cells are in the shot
  const expandBackups: Array<{
    el: HTMLElement
    maxHeight: string
    overflow: string
    overflowX: string
    overflowY: string
  }> = []
  for (const el of [root, ...root.querySelectorAll<HTMLElement>('*')]) {
    const cs = getComputedStyle(el)
    const needsExpand =
      cs.maxHeight !== 'none'
      || cs.overflow !== 'visible'
      || cs.overflowX !== 'visible'
      || cs.overflowY !== 'visible'
    if (!needsExpand) continue
    expandBackups.push({
      el,
      maxHeight: el.style.maxHeight,
      overflow: el.style.overflow,
      overflowX: el.style.overflowX,
      overflowY: el.style.overflowY,
    })
    el.style.maxHeight = 'none'
    el.style.overflow = 'visible'
    el.style.overflowX = 'visible'
    el.style.overflowY = 'visible'
  }

  // Wide enough for full week table (measure after overflow expand)
  root.style.minWidth = `${PDF_EXPORT_MIN_WIDTH_PX}px`
  root.style.maxWidth = 'none'
  root.style.width = `${PDF_EXPORT_MIN_WIDTH_PX}px`
  root.style.overflow = 'visible'

  await nextTick()
  await new Promise<void>((r) => requestAnimationFrame(() => r()))

  const board = root.querySelector<HTMLElement>('.staff-org-print-board')
  const table = root.querySelector<HTMLElement>('.staff-org-print-board table')
  const widthPx = Math.ceil(Math.max(
    PDF_EXPORT_MIN_WIDTH_PX,
    root.scrollWidth,
    board?.scrollWidth ?? 0,
    table?.scrollWidth ?? 0,
  )) + 8
  root.style.width = `${widthPx}px`
  root.style.minWidth = `${widthPx}px`

  await nextTick()
  await new Promise<void>((r) => requestAnimationFrame(() => r()))

  try {
    const { toJpeg } = await import('html-to-image')
    const { jsPDF } = await import('jspdf')

    const heightPx = Math.ceil(Math.max(root.scrollHeight, root.offsetHeight))
    if (heightPx < 40) {
      throw new Error('PDF content height is empty — wait for the page to finish loading.')
    }

    const dataUrl = await toJpeg(root, {
      quality: 0.98,
      pixelRatio: 2,
      backgroundColor: '#ffffff',
      cacheBust: true,
      width: widthPx,
      height: heightPx,
      style: {
        transform: 'none',
        margin: '0',
        width: `${widthPx}px`,
        maxWidth: `${widthPx}px`,
        overflow: 'visible',
      },
    })

    const marginMm = 8
    const pxToMm = (px: number) => (px * 25.4) / 96
    const contentW = pxToMm(widthPx)
    const contentH = pxToMm(heightPx)
    const pageW = contentW + marginMm * 2
    const pageH = contentH + marginMm * 2

    const pdf = new jsPDF({
      orientation: pageW >= pageH ? 'landscape' : 'portrait',
      unit: 'mm',
      format: [pageW, pageH],
      compress: true,
    })
    pdf.addImage(dataUrl, 'JPEG', marginMm, marginMm, contentW, contentH)
    pdf.save(`${safePdfFilename(pdfHeading.value)}.pdf`)

    toast.add({
      title: 'PDF downloaded.',
      icon: 'i-lucide-check',
      color: 'success',
      duration: 3000,
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error'
    toast.add({
      title: 'PDF failed.',
      description: msg,
      icon: 'i-lucide-alert-circle',
      color: 'error',
      duration: 8000,
    })
  } finally {
    for (const b of expandBackups) {
      b.el.style.maxHeight = b.maxHeight
      b.el.style.overflow = b.overflow
      b.el.style.overflowX = b.overflowX
      b.el.style.overflowY = b.overflowY
    }
    root.querySelectorAll('[data-pdf-temp-heading]').forEach((el) => el.remove())
    root.style.width = prevWidth
    root.style.minWidth = prevMinWidth
    root.style.maxWidth = prevMaxWidth
    root.style.overflow = prevOverflow
    printingPdf.value = false
  }
}

const emit = defineEmits<{
  'update:placements': [placements: StaffOrgPlacement[]]
  'update:inactive': [inactiveMemberIds: string[]]
  'update:hidden': [hiddenMemberIds: string[]]
  'update:desiredDays': [memberId: string, days: number | null]
  'update:desiredHours': [memberId: string, hours: number | null]
}>()

const dayLabels = ['Ma', 'Di', 'Wo', 'Do', 'Vr', 'Za', 'Zo']
const weekdays = [0, 1, 2, 3, 4, 5, 6] as StaffOrgWeekday[]
const boardTeams: Array<{ id: StaffOrgTeam; label: string }> = [
  { id: 'keuken', label: 'Keuken' },
  { id: 'bar', label: 'Bar' },
  { id: 'bediening', label: 'Bediening' },
]
const hideFullyScheduled = ref(true)
type RosterTabId = 'ft' | 'pt' | 'zzp'
const rosterTab = ref<RosterTabId>('zzp')

const enrichedRoster = computed(() => applyPlannerDayNameDefaults(props.roster))
const rosterById = computed(() => new Map(enrichedRoster.value.map((m) => [m.memberId, m])))

const inactiveSet = computed(() => new Set(props.inactiveMemberIds))
const hiddenSet = computed(() => new Set(props.hiddenMemberIds ?? []))

const boardPlacements = computed(() =>
  props.placements.filter(
    (p) => p.locationId === props.locationId && !inactiveSet.value.has(p.memberId),
  ),
)

const daysPlacedByMember = computed(() => {
  const map = new Map<string, Set<number>>()
  for (const p of props.placements) {
    if (inactiveSet.value.has(p.memberId)) continue
    const set = map.get(p.memberId) ?? new Set()
    set.add(p.weekday)
    map.set(p.memberId, set)
  }
  return map
})

function daysPlaced (memberId: string): number {
  return daysPlacedByMember.value.get(memberId)?.size ?? 0
}

const activeRoster = computed(() =>
  [...enrichedRoster.value]
    .filter((m) => !inactiveSet.value.has(m.memberId) && !hiddenSet.value.has(m.memberId))
    .sort((a, b) => a.name.localeCompare(b.name, 'nl')),
)

const inactiveMembers = computed(() =>
  enrichedRoster.value
    .filter((m) => inactiveSet.value.has(m.memberId) && !hiddenSet.value.has(m.memberId))
    .sort((a, b) => a.name.localeCompare(b.name, 'nl')),
)

const zzpRoster = computed(() =>
  activeRoster.value
    .filter((m) => classifyStaffContractType(m.contractType) === 'zzp')
    .sort((a, b) => a.name.localeCompare(b.name, 'nl')),
)

/** PT flex — always listed; drop onto many days to fill gaps (like ZZP). */
const ptFlexRoster = computed(() =>
  activeRoster.value
    .filter((m) => isPtFlexMember(m.memberId))
    .sort((a, b) => a.name.localeCompare(b.name, 'nl')),
)

const fixedRoster = computed(() =>
  activeRoster.value.filter(
    (m) =>
      classifyStaffContractType(m.contractType) !== 'zzp'
      && !isPtFlexMember(m.memberId),
  ),
)

const unassignedRoster = computed(() =>
  fixedRoster.value.filter((m) => daysPlaced(m.memberId) === 0),
)

const partialRoster = computed(() =>
  fixedRoster.value.filter((m) => {
    const d = daysPlaced(m.memberId)
    if (d <= 0) return false
    const suggested = suggestedDaysForMember(m) ?? 5
    return d < suggested
  }),
)

const fullRoster = computed(() =>
  fixedRoster.value.filter((m) => {
    const d = daysPlaced(m.memberId)
    if (d <= 0) return false
    const suggested = suggestedDaysForMember(m) ?? 5
    return d >= suggested
  }),
)

const rosterTabs = computed(() => [
  { id: 'ft' as const, label: 'FT', count: fixedRoster.value.length },
  { id: 'pt' as const, label: 'PT', count: ptFlexRoster.value.length },
  { id: 'zzp' as const, label: 'ZZP', count: zzpRoster.value.length },
])

const rosterTabHint = computed(() => {
  if (rosterTab.value === 'zzp') {
    return 'Need ZZP (TBD) = unknown person. Named ZZP stay in list — drop onto each day.'
  }
  if (rosterTab.value === 'pt') {
    return 'Need PT (TBD) = unknown person. Named PT stay in list — drop onto many days.'
  }
  return 'Need FT (TBD) = unknown person. Named FT move onto days when placed.'
})

function slotHoursFor (team: StaffOrgTeam, weekday: StaffOrgWeekday, slot: StaffOrgSlot) {
  return props.slotHours.find(
    (x) =>
      x.locationId === props.locationId
      && x.team === team
      && x.weekday === weekday
      && x.slot === slot,
  )
}

/** Prefer day when open; otherwise evening. */
function defaultSlotFor (team: StaffOrgTeam, weekday: StaffOrgWeekday): StaffOrgSlot {
  const dayH = slotHoursFor(team, weekday, 'day')?.openHours
  if (dayH != null && dayH > 0) return 'day'
  const eveH = slotHoursFor(team, weekday, 'evening')?.openHours
  if (eveH != null && eveH > 0) return 'evening'
  return 'day'
}

function needMember (bucket: StaffOrgNeedBucket) {
  return syntheticNeedMember(needTemplateId(bucket))!
}

function resolveMember (memberId: string) {
  return rosterById.value.get(memberId) ?? syntheticNeedMember(memberId)
}

function hasDayLocationConflict (memberId: string, weekday: StaffOrgWeekday): boolean {
  if (isNeedMemberId(memberId)) return false
  return props.placements.some(
    (p) =>
      p.memberId === memberId
      && p.weekday === weekday
      && p.locationId !== props.locationId,
  )
}

function membersInCell (team: StaffOrgTeam, weekday: StaffOrgWeekday) {
  const seen = new Set<string>()
  const out: Array<{
    member: StaffOrgRosterMember
    hours?: number
    placedDays: number
    slot: StaffOrgSlot
    dayConflict: boolean
    placeholder: boolean
  }> = []
  for (const p of boardPlacements.value) {
    if (p.team !== team || p.weekday !== weekday) continue
    if (seen.has(p.memberId)) continue
    seen.add(p.memberId)
    const member = resolveMember(p.memberId)
    if (!member) continue
    out.push({
      member,
      hours: p.hours,
      placedDays: daysPlaced(p.memberId),
      slot: p.slot,
      dayConflict: hasDayLocationConflict(p.memberId, weekday),
      placeholder: isNeedMemberId(p.memberId),
    })
  }
  return out
}

function cellMeta (team: StaffOrgTeam, weekday: StaffOrgWeekday) {
  const dayM = props.metrics.find(
    (x) =>
      x.locationId === props.locationId
      && x.team === team
      && x.weekday === weekday
      && x.slot === 'day',
  )
  const eveM = props.metrics.find(
    (x) =>
      x.locationId === props.locationId
      && x.team === team
      && x.weekday === weekday
      && x.slot === 'evening',
  )
  const dayH = dayM?.openHours ?? slotHoursFor(team, weekday, 'day')?.openHours ?? null
  const eveH = eveM?.openHours ?? slotHoursFor(team, weekday, 'evening')?.openHours ?? null
  const openParts = [dayH, eveH].filter((h): h is number => h != null)
  const openHours = openParts.length ? openParts.reduce((a, b) => a + b, 0) : null
  const headcount = membersInCell(team, weekday).length
  const minStaff = (dayM?.minStaff ?? 0) + (eveM?.minStaff ?? 0)
  const maxStaff = (dayM?.maxStaff ?? 0) + (eveM?.maxStaff ?? 0) || 8
  const underMin = openHours != null && headcount < minStaff
  const overMax = headcount > maxStaff
  return {
    openHours,
    headcount,
    minStaff,
    maxStaff,
    underMin,
    overMax,
  }
}

const summary = computed(() => {
  const cells = props.metrics.filter((m) => m.locationId === props.locationId)
  return {
    openHours: cells.reduce((s, c) => s + (c.openHours ?? 0), 0),
    assignedHours: cells.reduce((s, c) => s + c.assignedHours, 0),
    laborCost: cells.reduce((s, c) => s + c.laborCost, 0),
    headcount: boardPlacements.value.length,
    underMinCount: cells.filter((c) => c.underMin && c.openHours != null).length,
    overMaxCount: cells.filter((c) => c.overMax).length,
  }
})

const productivity = computed(() =>
  buildProductivityView({
    locationId: props.locationId,
    targets: props.locationTargets,
    placements: props.placements,
    roster: props.fullRoster ?? props.roster,
    orgAssignments: props.orgAssignments,
  }),
)

const weeklyRevenue = computed(() => {
  const t = props.locationTargets.find((x) => x.locationId === props.locationId)
  return weeklyRevenueFromMonthly(t?.estimatedMonthlyRevenue ?? 0)
})

const shareByWeekday = computed(() => {
  const map = new Map<number, number>()
  for (const s of props.weekdayShares ?? []) map.set(s.weekday, s.share)
  return map
})

function dayPlan (weekday: StaffOrgWeekday) {
  const share = shareByWeekday.value.get(weekday) ?? 0
  const estRevenue = weeklyRevenue.value * share
  const open = props.slotHours
    .filter(
      (s) =>
        s.locationId === props.locationId
        && s.weekday === weekday
        && s.openHours != null,
    )
    .reduce((sum, s) => sum + (s.openHours ?? 0), 0)
  const ftHours = boardPlacements.value
    .filter((p) => p.weekday === weekday)
    .reduce((sum, p) => sum + (p.hours ?? 0), 0)
  const leftoverHours = Math.max(0, Math.round((open - ftHours) * 10) / 10)
  return {
    share,
    estRevenue: Math.round(estRevenue),
    openHours: open,
    ftHours: Math.round(ftHours * 10) / 10,
    leftoverHours,
  }
}

function formatEur (n: number): string {
  return Math.round(n).toLocaleString('nl-NL')
}

function isZzpMember (memberId: string): boolean {
  if (needBucketFromMemberId(memberId) === 'zzp') return true
  const m = resolveMember(memberId)
  return classifyStaffContractType(m?.contractType ?? '') === 'zzp'
}

/** Nul-uren / org role PT — flex hours to fill gaps; stay copyable. */
function isPtFlexMember (memberId: string): boolean {
  if (isZzpMember(memberId)) return false
  if (needBucketFromMemberId(memberId) === 'pt') return true
  const m = resolveMember(memberId)
  if (classifyStaffContractType(m?.contractType ?? '') === 'pt') return true
  return (props.orgAssignments ?? []).some(
    (a) =>
      a.memberId === memberId
      && a.locationId === props.locationId
      && (a.role === 'pt' || a.role === 'pt_sr'),
  )
}

function isFlexCopyMember (memberId: string): boolean {
  if (isNeedTemplateId(memberId) || isNeedInstanceId(memberId)) {
    const b = needBucketFromMemberId(memberId)
    return b === 'pt' || b === 'zzp'
  }
  return isZzpMember(memberId) || isPtFlexMember(memberId)
}

function emitPlacements (next: StaffOrgPlacement[], memberId: string) {
  emit('update:placements', rebalanceContractHours(next, props.roster, [memberId]))
}

function onDrop (
  payload: {
    memberId: string
    sourceWeekday?: StaffOrgWeekday
    sourceSlot?: StaffOrgSlot
    sourceTeam?: StaffOrgTeam
    copy?: boolean
  },
  team: StaffOrgTeam,
  weekday: StaffOrgWeekday,
) {
  let { memberId, sourceWeekday, sourceSlot, sourceTeam, copy } = payload
  const slot = defaultSlotFor(team, weekday)

  if (isNeedTemplateId(memberId)) {
    const bucket = needBucketFromMemberId(memberId)
    if (!bucket) return
    memberId = createNeedInstanceId(bucket)
    sourceWeekday = undefined
    sourceSlot = undefined
    sourceTeam = undefined
    copy = true
  }

  if (isNeedMemberId(memberId) === false && inactiveSet.value.has(memberId)) {
    emit(
      'update:inactive',
      props.inactiveMemberIds.filter((id) => id !== memberId),
    )
  }

  let next = [...props.placements]

  // ZZP + PT flex: copy onto days (fill gaps); FT moves unless Alt/⌥
  const shouldCopy = Boolean(copy) || isFlexCopyMember(memberId)
  if (!shouldCopy && sourceWeekday != null && sourceSlot && sourceTeam) {
    next = next.filter(
      (p) => !(
        p.memberId === memberId
        && p.locationId === props.locationId
        && p.team === sourceTeam
        && p.weekday === sourceWeekday
        && p.slot === sourceSlot
      ),
    )
  }

  const already = next.some(
    (p) =>
      p.memberId === memberId
      && p.locationId === props.locationId
      && p.team === team
      && p.weekday === weekday
      && p.slot === slot,
  )
  if (!already) {
    // FT: one cell per weekday×team. PT/ZZP: still one per weekday×team×slot, but keep other days.
    if (!isFlexCopyMember(memberId)) {
      next = next.filter(
        (p) => !(
          p.memberId === memberId
          && p.locationId === props.locationId
          && p.team === team
          && p.weekday === weekday
        ),
      )
    }
    next.push({
      memberId,
      locationId: props.locationId,
      team,
      weekday,
      slot,
    })
  }

  emitPlacements(next, memberId)
}

function onDropUnassign (e: DragEvent) {
  const memberId = e.dataTransfer?.getData('application/x-staff-org-member')
  if (!memberId) return
  const raw = e.dataTransfer?.getData('application/x-staff-org-source')
  if (raw) {
    try {
      const parsed = JSON.parse(raw) as { weekday?: number; slot?: string; team?: string }
      if (
        typeof parsed.weekday === 'number'
        && (parsed.slot === 'day' || parsed.slot === 'evening')
        && (parsed.team === 'keuken' || parsed.team === 'bediening' || parsed.team === 'bar')
      ) {
        const next = props.placements.filter(
          (p) => !(
            p.memberId === memberId
            && p.locationId === props.locationId
            && p.team === parsed.team
            && p.weekday === parsed.weekday
            && p.slot === parsed.slot
          ),
        )
        emitPlacements(next, memberId)
        return
      }
    } catch {
      // fall through
    }
  }
  emitPlacements(
    props.placements.filter((p) => p.memberId !== memberId),
    memberId,
  )
}

function onInactiveDragOver (e: DragEvent) {
  if (e.dataTransfer) e.dataTransfer.dropEffect = 'move'
}

function onDropInactive (e: DragEvent) {
  const memberId = e.dataTransfer?.getData('application/x-staff-org-member')
  if (!memberId || isNeedMemberId(memberId)) return
  emit('update:inactive', [...new Set([...props.inactiveMemberIds, memberId])])
}

function reactivateMember (memberId: string) {
  emit(
    'update:inactive',
    props.inactiveMemberIds.filter((id) => id !== memberId),
  )
}

function hideMember (memberId: string) {
  const nextHidden = [...new Set([...(props.hiddenMemberIds ?? []), memberId])]
  emit('update:hidden', nextHidden)
  if (!props.inactiveMemberIds.includes(memberId)) {
    emit('update:inactive', [...props.inactiveMemberIds, memberId])
  }
}

function onDesiredDays (memberId: string, days: number | null) {
  emit('update:desiredDays', memberId, days)
}

function onDesiredHours (memberId: string, hours: number | null) {
  emit('update:desiredHours', memberId, hours)
}
</script>
