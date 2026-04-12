<template>
  <Teleport to="body">
    <Transition
      name="drawer"
      @enter="onEnter"
      @leave="onLeave"
    >
      <div v-if="isOpen" class="fixed inset-0 z-40 overflow-hidden">
        <!-- Backdrop -->
        <div
          class="absolute inset-0 bg-black/50 transition-opacity duration-300"
          @click="emit('close')"
        />

        <!-- Drawer Panel -->
        <div class="pointer-events-none absolute inset-x-0 bottom-0 flex max-h-[90vh] flex-col">
          <div
            class="pointer-events-auto flex flex-col overflow-hidden rounded-t-2xl border-t-2 border-gray-900 bg-white shadow-2xl"
            :style="{ maxHeight: 'min(90vh, calc(100vh - 2rem))' }"
          >
            <!-- Header -->
            <div class="flex shrink-0 items-center justify-between border-b border-gray-100 px-6 py-4">
              <h2 class="text-lg font-semibold text-gray-900">
                {{ title }}
              </h2>
              <button
                type="button"
                class="rounded-md p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors"
                @click="emit('close')"
                aria-label="Close drawer"
              >
                <UIcon name="i-lucide-x" class="size-5" />
              </button>
            </div>

            <!-- Content -->
            <div class="min-w-0 flex-1 overflow-y-auto">
              <div v-if="props.workersData.length === 0" class="px-6 py-8 text-center">
                <p class="text-sm text-gray-500">No workers found</p>
              </div>

              <div v-else class="overflow-x-auto">
                <table class="w-max min-w-full border-separate border-spacing-0 text-left text-sm">
                  <thead class="sticky top-0 bg-white">
                    <tr class="border-b border-gray-200">
                      <th class="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-gray-600">
                        Team
                      </th>
                      <th class="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-gray-600">
                        Location
                      </th>
                      <th class="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-gray-600">
                        Workers
                      </th>
                      <th class="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-gray-600">
                        Hours
                      </th>
                      <th class="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-gray-600">
                        Cost
                      </th>
                      <th class="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-gray-600">
                        % Rev.
                      </th>
                    </tr>
                  </thead>
                  <tbody class="divide-y divide-gray-100">
                    <tr
                      v-for="(row, idx) in props.workersData"
                      :key="`worker-${idx}`"
                      class="hover:bg-gray-50 transition-colors"
                    >
                      <td class="px-4 py-3 font-medium text-gray-900">
                        {{ row.teamName }}
                      </td>
                      <td class="px-4 py-3 text-gray-700">
                        {{ row.locationName }}
                      </td>
                      <td class="px-4 py-3 text-right text-gray-900">
                        {{ row.workerCount }}
                      </td>
                      <td class="px-4 py-3 text-right text-gray-900 tabular-nums">
                        {{ row.totalHours.toFixed(1) }} h
                      </td>
                      <td class="px-4 py-3 text-right text-gray-900 tabular-nums">
                        {{ formatEur(row.totalCost) }}
                      </td>
                      <td class="px-4 py-3 text-right text-gray-900 tabular-nums">
                        {{ formatLaborPct(row.laborCostPctOfRevenue) }}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            <!-- Footer Summary (optional) -->
            <div v-if="props.workersData.length > 0" class="shrink-0 border-t border-gray-100 bg-gray-50 px-6 py-4">
              <div class="grid grid-cols-4 gap-4 text-sm">
                <div>
                  <p class="text-xs font-medium uppercase tracking-wide text-gray-500">Total Workers</p>
                  <p class="mt-1 text-lg font-semibold text-gray-900">{{ totalWorkers }}</p>
                </div>
                <div>
                  <p class="text-xs font-medium uppercase tracking-wide text-gray-500">Total Hours</p>
                  <p class="mt-1 text-lg font-semibold text-gray-900">{{ totalHours.toFixed(1) }} h</p>
                </div>
                <div>
                  <p class="text-xs font-medium uppercase tracking-wide text-gray-500">Total Cost</p>
                  <p class="mt-1 text-lg font-semibold text-gray-900">{{ formatEur(totalCost) }}</p>
                </div>
                <div>
                  <p class="text-xs font-medium uppercase tracking-wide text-gray-500">Avg Cost/Hour</p>
                  <p class="mt-1 text-lg font-semibold text-gray-900">
                    {{ totalHours > 0 ? formatEur(totalCost / totalHours) : '—' }}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
type WorkerRow = {
  locationName: string
  teamName: string
  totalHours: number
  totalCost: number
  laborCostPctOfRevenue: number | null
  workerCount: number
}

type Props = {
  isOpen: boolean
  selectedTeam: string | null
  selectedContract: string | null
  workersData: WorkerRow[]
}

const props = defineProps<Props>()

const emit = defineEmits<{
  close: []
}>()

const { formatEur } = useDashboardEurFormat()

const title = computed(() => {
  if (props.selectedTeam) return `Team: ${props.selectedTeam}`
  if (props.selectedContract) return `Contract: ${props.selectedContract || 'None'}`
  return 'Workers'
})

const totalWorkers = computed(() => props.workersData.reduce((sum, row) => sum + row.workerCount, 0))
const totalHours = computed(() => props.workersData.reduce((sum, row) => sum + row.totalHours, 0))
const totalCost = computed(() => props.workersData.reduce((sum, row) => sum + row.totalCost, 0))

const formatLaborPct = (pct: number | null): string => {
  if (pct == null || !Number.isFinite(pct)) return '—'
  return `${pct.toFixed(1)}%`
}

const onEnter = (el: Element): void => {
  const elem = el as HTMLElement
  elem.style.opacity = '0'
  elem.style.transition = 'opacity 300ms ease-out'
  requestAnimationFrame(() => {
    elem.style.opacity = '1'
  })
}

const onLeave = (el: Element): void => {
  const elem = el as HTMLElement
  elem.style.opacity = '0'
  elem.style.transition = 'opacity 300ms ease-out'
}
</script>

<style scoped>
.drawer-enter-active,
.drawer-leave-active {
  transition: all 300ms ease-out;
}

.drawer-enter-from,
.drawer-leave-to {
  opacity: 0;
  transform: translateY(100%);
}

.drawer-enter-to,
.drawer-leave-from {
  opacity: 1;
  transform: translateY(0);
}
</style>
