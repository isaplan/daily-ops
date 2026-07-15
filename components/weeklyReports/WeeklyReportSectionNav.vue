<template>
  <nav
    class="sticky top-0 z-20 -mx-4 flex gap-1 overflow-x-auto border-b border-gray-200 bg-[hsl(45,15%,95%)]/95 px-4 py-2 backdrop-blur-sm md:-mx-6"
    aria-label="Weekly report sections"
  >
    <button
      v-for="item in items"
      :key="item.id"
      type="button"
      class="shrink-0 rounded-md px-3 py-1.5 text-sm font-medium transition-colors"
      :class="activeId === item.id
        ? 'bg-gray-900 text-white'
        : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'"
      @click="scrollTo(item.id)"
    >
      {{ item.label }}
    </button>
  </nav>
</template>

<script setup lang="ts">
import type { WeeklyReportNavItem } from '~/utils/weeklyReportNav'

const props = defineProps<{
  items: WeeklyReportNavItem[]
}>()

const activeId = ref(props.items[0]?.id ?? '')

function scrollTo(id: string) {
  activeId.value = id
  document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
}

let sectionObserver: IntersectionObserver | null = null

onMounted(() => {
  if (!props.items.length) return
  sectionObserver = new IntersectionObserver(
    (entries) => {
      const visible = entries
        .filter((e) => e.isIntersecting)
        .sort((a, b) => b.intersectionRatio - a.intersectionRatio)
      const top = visible[0]?.target.id
      if (top) activeId.value = top
    },
    { rootMargin: '-20% 0px -60% 0px', threshold: [0, 0.25, 0.5] },
  )
  for (const item of props.items) {
    const el = document.getElementById(item.id)
    if (el) sectionObserver.observe(el)
  }
})

onUnmounted(() => {
  sectionObserver?.disconnect()
})
</script>
