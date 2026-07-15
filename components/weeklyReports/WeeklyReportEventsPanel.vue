<template>
  <section class="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
    <h2 class="mb-3 text-sm font-semibold uppercase text-gray-500">Events &amp; holidays</h2>
    <form v-if="!isFrozen" class="space-y-2 border-b border-gray-100 pb-3" @submit.prevent="submit">
      <input
        v-model="title"
        type="text"
        placeholder="Custom event title"
        class="w-full rounded border border-gray-300 px-2 py-1 text-sm"
      />
      <div class="flex gap-2">
        <input v-model="startDate" type="date" class="rounded border border-gray-300 px-2 py-1 text-sm" />
        <input v-model="endDate" type="date" class="rounded border border-gray-300 px-2 py-1 text-sm" />
      </div>
      <UButton type="submit" size="xs" variant="outline">Add event</UButton>
    </form>

    <ul v-if="events.length" class="mt-3 space-y-2 text-sm">
      <li v-for="ev in events" :key="ev.id" class="flex flex-col border-b border-gray-50 pb-2 last:border-0 last:pb-0">
        <span class="font-medium">
          {{ ev.title }}
          <span
            v-for="label in ev.labels"
            :key="label"
            class="ml-1 rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-800"
          >
            {{ label }}
          </span>
        </span>
        <span class="text-xs text-gray-500">{{ ev.startDate }}{{ ev.endDate !== ev.startDate ? ` → ${ev.endDate}` : '' }} · {{ ev.type }}</span>
      </li>
    </ul>
    <p v-else class="mt-3 text-sm text-gray-500">No events this week.</p>
  </section>
</template>

<script setup lang="ts">
import type { CalendarEvent } from '~/types/calendarEvent'

defineProps<{
  events: CalendarEvent[]
  isFrozen: boolean
}>()

const emit = defineEmits<{
  addEvent: [payload: { title: string; startDate: string; endDate: string; note?: string }]
}>()

const title = ref('')
const startDate = ref('')
const endDate = ref('')

function submit() {
  if (!title.value.trim() || !startDate.value) return
  emit('addEvent', {
    title: title.value.trim(),
    startDate: startDate.value,
    endDate: endDate.value || startDate.value,
  })
  title.value = ''
  startDate.value = ''
  endDate.value = ''
}
</script>
