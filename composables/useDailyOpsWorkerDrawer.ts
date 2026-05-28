/**
 * @created: 2026-05-28T00:00:00.000Z
 * @last-modified: 2026-05-28T00:00:00.000Z
 * @description: Worker details drawer state + filtered staff rows for productivity view.
 * @last-fix: [2026-05-28] Extracted from DailyOpsHomeDashboard.vue
 *
 * @exports-to:
 * ✓ components/daily-ops/DailyOpsHomeDashboard.vue
 */

import type { Ref } from 'vue'
import type {
  DailyOpsLaborMetricsDto,
  DailyOpsWorkerStaffDetailResponseDto,
} from '~/types/daily-ops-dashboard'

type DrawerWorkerRow = {
  date: string
  locationId: string
  locationName: string
  teamName: string
  staffName: string
  totalHours: number
  totalCost: number
  laborCostPctOfRevenue: number | null
  locationDayRevenue: number | null
}

export function useDailyOpsWorkerDrawer(
  labor: Ref<DailyOpsLaborMetricsDto | null>,
  dashboardQuery: Ref<Record<string, string | undefined>>,
) {
  const selectedTeam = ref<string | null>(null)
  const selectedContract = ref<string | null>(null)
  const isDrawerOpen = computed(() => selectedTeam.value !== null || selectedContract.value !== null)

  const drawerStaffCacheKey = computed(
    () =>
      `daily-ops-drawer-staff-${dashboardQuery.value.period}-${dashboardQuery.value.location ?? 'all'}-${dashboardQuery.value.anchor ?? ''}`,
  )

  const {
    data: drawerStaffRes,
    pending: drawerStaffPending,
    execute: loadDrawerStaff,
  } = useAsyncData(
    drawerStaffCacheKey,
    async (): Promise<DailyOpsWorkerStaffDetailResponseDto> => {
      const q = { ...dashboardQuery.value }
      return await $fetch<DailyOpsWorkerStaffDetailResponseDto>(
        '/api/daily-ops/metrics/worker-staff-detail',
        { query: q },
      )
    },
    { immediate: false },
  )

  watch(isDrawerOpen, (open) => {
    if (open) void loadDrawerStaff()
  })

  const revenueByLocationDayLookup = computed(() => {
    const m = new Map<string, number>()
    for (const r of labor.value?.revenueByLocationDay ?? []) {
      m.set(`${r.date}|${r.locationId}`, r.revenue)
    }
    return m
  })

  const filteredWorkers = computed((): DrawerWorkerRow[] => {
    const raw = drawerStaffRes.value?.workerStaffDetail ?? []
    const revLookup = revenueByLocationDayLookup.value

    const sortRows = (rows: DrawerWorkerRow[]) =>
      rows.sort((a, b) => {
        const dateCmp = a.date.localeCompare(b.date)
        if (dateCmp !== 0) return dateCmp
        const locTeam = `${a.locationName}${a.teamName}`.localeCompare(`${b.locationName}${b.teamName}`)
        if (locTeam !== 0) return locTeam
        return a.staffName.localeCompare(b.staffName)
      })

    if (selectedTeam.value) {
      return sortRows(
        raw
          .filter((r) => r.teamName === selectedTeam.value)
          .map((r) => ({
            date: r.date,
            locationId: r.locationId,
            locationName: r.locationName,
            teamName: r.teamName,
            staffName: r.staffName,
            totalHours: r.totalHours,
            totalCost: r.totalCost,
            laborCostPctOfRevenue: r.laborCostPctOfRevenue,
            locationDayRevenue: revLookup.get(`${r.date}|${r.locationId}`) ?? null,
          })),
      )
    }

    if (selectedContract.value) {
      const targetContract = selectedContract.value === 'None' ? '' : selectedContract.value
      return sortRows(
        raw
          .filter((r) => (r.contractType || '') === targetContract)
          .map((r) => ({
            date: r.date,
            locationId: r.locationId,
            locationName: r.locationName,
            teamName: r.teamName,
            staffName: r.staffName,
            totalHours: r.totalHours,
            totalCost: r.totalCost,
            laborCostPctOfRevenue: r.laborCostPctOfRevenue,
            locationDayRevenue: revLookup.get(`${r.date}|${r.locationId}`) ?? null,
          })),
      )
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

  return {
    selectedTeam,
    selectedContract,
    isDrawerOpen,
    drawerStaffPending,
    filteredWorkers,
    selectTeam,
    selectContract,
    closeDrawer,
  }
}
