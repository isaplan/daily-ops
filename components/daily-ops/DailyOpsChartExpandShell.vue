<template>
  <div>
    <slot name="header">
      <div v-if="title" class="mb-3">
        <h3 class="text-sm font-semibold text-gray-900">{{ title }}</h3>
        <p v-if="subtitle" class="mt-1 text-xs text-gray-500">{{ subtitle }}</p>
      </div>
    </slot>

    <button
      ref="chartWrapEl"
      type="button"
      class="min-w-0 w-full cursor-pointer rounded-md text-left ring-offset-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-900"
      :aria-label="expandAriaLabel"
      @click="expandedOpen = true"
    >
      <template v-if="!expandedOpen">
        <slot
          :width="containerWidth"
          :height="containerHeight"
          :expanded="false"
        />
        <p class="mt-2 flex items-center justify-center gap-1.5 text-xs font-medium text-gray-500">
          <UIcon name="i-lucide-maximize-2" class="size-3.5" aria-hidden="true" />
          <span class="md:hidden">Tap to expand</span>
          <span class="hidden md:inline">Click to expand</span>
        </p>
      </template>
      <div v-else class="min-h-[11rem]" aria-hidden="true" />
    </button>

    <slot name="below" />

    <Teleport to="body">
      <Transition name="chart-expand">
        <div
          v-if="expandedOpen"
          class="fixed inset-0 z-[100] flex flex-col p-2 md:p-6 lg:p-8"
          role="dialog"
          aria-modal="true"
          :aria-label="modalAriaLabel"
        >
          <button
            type="button"
            class="absolute inset-0 bg-black/90"
            aria-label="Close chart"
            @click="expandedOpen = false"
          />

          <div
            class="relative flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg border border-gray-200 bg-white p-4 shadow-xl pt-[max(1rem,env(safe-area-inset-top))] pb-[max(1rem,env(safe-area-inset-bottom))]"
          >
            <div class="mb-3 flex shrink-0 items-start justify-between gap-3">
              <div class="min-w-0 flex-1">
                <slot name="header">
                  <h2 class="text-base font-semibold text-gray-900">{{ title }}</h2>
                  <p v-if="subtitle" class="mt-1 text-xs text-gray-500">{{ subtitle }}</p>
                </slot>
              </div>
              <UButton
                size="sm"
                icon="i-lucide-x"
                aria-label="Close chart"
                class="shrink-0 bg-gray-900! text-white!"
                @click="expandedOpen = false"
              />
            </div>

            <div ref="expandedWrapEl" class="min-h-0 flex-1">
              <slot
                :width="expandedWidth"
                :height="expandedHeight"
                :expanded="true"
              />
            </div>

            <div v-if="$slots.below" class="mt-3 shrink-0">
              <slot name="below" />
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>
  </div>
</template>

<script setup lang="ts">
const props = withDefaults(
  defineProps<{
    title?: string
    subtitle?: string
    expandAriaLabel?: string
    modalAriaLabel?: string
    defaultWidth?: number
    defaultHeight?: number
  }>(),
  {
    defaultWidth: 720,
    defaultHeight: 400,
  },
)

const {
  expandedOpen,
  chartWrapEl,
  expandedWrapEl,
  containerWidth,
  expandedWidth,
  expandedHeight,
} = useChartExpand(props.defaultWidth, props.defaultHeight)

const containerHeight = computed(() =>
  Math.max(200, Math.round(containerWidth.value * 0.42)),
)

const expandAriaLabel = computed(
  () => props.expandAriaLabel ?? `Expand ${props.title ?? 'chart'}`,
)
const modalAriaLabel = computed(
  () => props.modalAriaLabel ?? `${props.title ?? 'Chart'} expanded`,
)
</script>

<style scoped>
.chart-expand-enter-active,
.chart-expand-leave-active {
  transition: opacity 0.2s ease;
}

.chart-expand-enter-from,
.chart-expand-leave-to {
  opacity: 0;
}
</style>
