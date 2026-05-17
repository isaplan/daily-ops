<template>
  <Teleport to="body">
    <Transition name="drawer">
      <div v-if="isOpen" class="fixed inset-0 z-40 overflow-hidden">
        <div
          class="absolute inset-0 bg-black/50"
          @click="emit('close')"
        />
        <div class="pointer-events-none absolute inset-x-0 bottom-0 flex max-h-[90vh] flex-col">
          <div
            class="pointer-events-auto flex w-full max-w-full flex-col overflow-hidden rounded-t-2xl border-t-2 border-gray-900 bg-white shadow-2xl"
            :style="{ maxHeight: 'min(90vh, calc(100vh - 2rem))' }"
          >
            <div class="flex shrink-0 items-center justify-between border-b border-gray-100 px-4 py-4 md:px-16">
              <h2 class="text-lg font-semibold text-gray-900">{{ title }}</h2>
              <button
                type="button"
                class="rounded-md p-1 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600"
                aria-label="Close drawer"
                @click="emit('close')"
              >
                <UIcon name="i-lucide-x" class="size-5" />
              </button>
            </div>
            <div class="min-w-0 flex-1 overflow-y-auto overflow-x-auto px-4 py-4 md:px-16">
              <p v-if="intro" class="mb-4 text-sm text-gray-600">{{ intro }}</p>
              <dl v-if="summaryRows.length" class="mb-6 space-y-2 text-sm">
                <div
                  v-for="row in summaryRows"
                  :key="row.label"
                  class="flex justify-between gap-4 border-b border-gray-50 pb-2"
                >
                  <dt class="text-gray-600">{{ row.label }}</dt>
                  <dd class="shrink-0 text-right font-medium tabular-nums text-gray-900">{{ row.value }}</dd>
                </div>
              </dl>
              <div v-if="venueRows.length">
                <p class="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">By venue</p>
                <table class="w-full min-w-[320px] text-left text-sm">
                  <thead>
                    <tr class="border-b border-gray-200 text-xs uppercase text-gray-500">
                      <th class="py-2 pr-3 font-medium">Venue</th>
                      <th
                        v-for="col in venueColumns"
                        :key="col"
                        class="py-2 pr-3 text-right font-medium"
                      >
                        {{ col }}
                      </th>
                    </tr>
                  </thead>
                  <tbody class="divide-y divide-gray-100">
                    <tr v-for="v in venueRows" :key="v.locationName">
                      <td class="py-2 pr-3 font-medium text-gray-900">{{ v.locationName }}</td>
                      <td
                        v-for="(cell, idx) in v.cells"
                        :key="idx"
                        class="py-2 pr-3 text-right tabular-nums text-gray-900"
                      >
                        {{ cell }}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
export type KpiDrawerSummaryRow = { label: string; value: string }
export type KpiDrawerVenueRow = { locationName: string; cells: string[] }

withDefaults(
  defineProps<{
    isOpen: boolean
    title: string
    intro?: string
    summaryRows?: KpiDrawerSummaryRow[]
    venueColumns?: string[]
    venueRows?: KpiDrawerVenueRow[]
  }>(),
  {
    intro: '',
    summaryRows: () => [],
    venueColumns: () => [],
    venueRows: () => [],
  }
)

const emit = defineEmits<{ close: [] }>()
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
