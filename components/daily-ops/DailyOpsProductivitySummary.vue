<template>
  <div class="min-w-0 space-y-8">
    <div class="min-w-0">
      <h3 class="mb-3 text-sm font-semibold text-gray-700">Teams</h3>
      <div class="grid min-w-0 gap-4 md:grid-cols-2 lg:grid-cols-4">
        <button
          v-for="team in teamsSummary"
          :key="team.teamName"
          type="button"
          class="rounded-lg border-2 border-gray-900 !bg-white p-4 text-left shadow-none ring-0 transition-all hover:bg-gray-50 hover:shadow-md active:scale-95"
          @click="emit('select-team', team.teamName)"
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

    <div class="min-w-0">
      <h3 class="mb-3 text-sm font-semibold text-gray-700">Contracts</h3>
      <div class="grid min-w-0 gap-4 md:grid-cols-2 lg:grid-cols-4">
        <button
          v-for="contract in contractsSummary"
          :key="contract.contractType"
          type="button"
          class="rounded-lg border-2 border-gray-900 !bg-white p-4 text-left shadow-none ring-0 transition-all hover:bg-gray-50 hover:shadow-md active:scale-95"
          @click="emit('select-contract', contract.contractType)"
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
  </div>
</template>

<script setup lang="ts">
const emit = defineEmits<{
  'select-team': [teamName: string]
  'select-contract': [contractType: string]
}>()

const { labor } = useDailyOpsLaborMetrics()
const { formatEur } = useDashboardEurFormat()

const teamsSummary = computed(() => {
  const teams = labor.value?.workersByTeamLocation ?? []
  const byTeam = new Map<string, { workerCount: number; totalCost: number; totalHours: number }>()
  for (const team of teams) {
    const key = team.teamName
    if (!byTeam.has(key)) byTeam.set(key, { workerCount: 0, totalCost: 0, totalHours: 0 })
    const agg = byTeam.get(key)!
    agg.workerCount = Math.max(agg.workerCount, team.workerCount)
    agg.totalCost += team.totalCost
    agg.totalHours += team.totalHours
  }
  const aggregated = [...byTeam.entries()].map(([teamName, data]) => ({
    teamName,
    workerCount: data.workerCount,
    totalCost: data.totalCost,
    totalHours: data.totalHours,
  }))
  const totalHours = aggregated.reduce((sum, t) => sum + t.totalHours, 0)
  return aggregated
    .map((team) => ({
      teamName: team.teamName,
      workerCount: team.workerCount,
      totalCost: team.totalCost,
      totalHours: team.totalHours,
      pctOfTotalHours: totalHours > 0 ? (team.totalHours / totalHours) * 100 : 0,
    }))
    .sort((a, b) => a.teamName.localeCompare(b.teamName))
})

const contractsSummary = computed(() => {
  const contracts = labor.value?.contractTypeByDay ?? []
  const byContract = new Map<string | null, { workerCount: number; totalCost: number; totalHours: number }>()
  for (const contract of contracts) {
    const key = contract.contractType ?? null
    if (!byContract.has(key)) byContract.set(key, { workerCount: 0, totalCost: 0, totalHours: 0 })
    const agg = byContract.get(key)!
    agg.workerCount = Math.max(agg.workerCount, contract.workerCount ?? 0)
    agg.totalCost += contract.totalCost ?? 0
    agg.totalHours += contract.totalHours ?? 0
  }
  const aggregated = [...byContract.entries()].map(([contractType, data]) => ({
    contractType: contractType ?? '',
    workerCount: data.workerCount,
    totalCost: data.totalCost,
    totalHours: data.totalHours,
  }))
  const totalHours = aggregated.reduce((sum, c) => sum + c.totalHours, 0)
  return aggregated
    .map((contract) => ({
      contractType: contract.contractType,
      workerCount: contract.workerCount,
      totalCost: contract.totalCost,
      totalHours: contract.totalHours,
      pctOfTotalHours: totalHours > 0 ? (contract.totalHours / totalHours) * 100 : 0,
    }))
    .sort((a, b) => (a.contractType || 'ZZZ').localeCompare(b.contractType || 'ZZZ'))
})
</script>
