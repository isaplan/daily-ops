<template>
  <div class="space-y-6 p-8 max-w-7xl mx-auto">
    <div class="flex items-center justify-between">
      <div>
        <h1 class="text-4xl font-bold mb-2 text-gray-900">Dashboard</h1>
        <p class="text-gray-700">Most recent notes</p>
      </div>
      <div class="flex gap-2">
        <UButton to="/notes/new" variant="solid">
          <UIcon name="i-lucide-plus" class="size-4 mr-2" />
          Create Note
        </UButton>
        <UButton to="/notes/new?template=weekly" variant="outline">
          <UIcon name="i-lucide-calendar-range" class="size-4 mr-2" />
          Create Weekly
        </UButton>
      </div>
    </div>

    <div v-if="pending" class="grid gap-4 md:grid-cols-3">
      <div v-for="i in 3" :key="i" class="h-40 rounded-lg border border-gray-200 bg-gray-100 animate-pulse" />
    </div>
    <UAlert v-else-if="error" color="error" :title="String(error)" />
    <div v-else-if="!recentNotes.length" class="rounded-lg border border-gray-200 bg-white p-8 text-center text-gray-500">
      No notes yet. <NuxtLink to="/notes/new" class="text-blue-600 hover:underline">Create one</NuxtLink> or go to <NuxtLink to="/notes/all" class="text-blue-600 hover:underline">All Notes</NuxtLink>.
    </div>
    <template v-else>
      <div class="flex items-center justify-between mb-4">
        <h2 class="text-xl font-semibold text-gray-900">Recent Notes</h2>
        <NuxtLink to="/notes/all" class="text-sm text-blue-600 hover:underline focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1 rounded">View all</NuxtLink>
      </div>
      <div class="grid gap-4 md:grid-cols-3">
        <NuxtLink
          v-for="note in recentNotes"
          :key="note._id"
          :to="`/notes/${note.slug || note._id}`"
          class="block"
        >
          <UCard class="bg-white border border-gray-200 rounded-lg shadow-sm hover:shadow-md transition-shadow cursor-pointer h-full">
            <template #header>
              <div class="flex items-start justify-between gap-2">
                <h3 class="text-base font-semibold line-clamp-2 text-gray-900 flex-1 min-w-0">{{ note.title }}</h3>
                <UBadge v-if="note.is_pinned" variant="outline" class="text-yellow-600 border-yellow-400 text-xs shrink-0">📌</UBadge>
              </div>
            </template>
            <p class="text-sm text-gray-600 line-clamp-2 mb-2">{{ notePreview(note) }}</p>
            <div class="flex items-center justify-between text-xs text-gray-500">
              <span>{{ formatDate(note.created_at) }}</span>
              <UBadge v-if="hasConnection(note)" variant="outline" class="text-xs text-gray-600 border-gray-300">Public</UBadge>
              <UBadge v-else variant="outline" class="text-xs text-gray-600 border-gray-300">Private</UBadge>
            </div>
          </UCard>
        </NuxtLink>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import type { NotesListResponse, Note } from '~/types/note'
import { isBlockNoteContent, parseBlockNoteContent } from '~/types/noteBlock'

const { data, pending, error } = await useFetch<NotesListResponse>('/api/notes?limit=10')

const recentNotes = computed(() => {
  const list = data.value?.data ?? []
  return [...list].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()).slice(0, 3)
})

function formatDate(value: string): string {
  try { return new Date(value).toLocaleDateString() } catch { return '' }
}

function hasConnection(note: Note): boolean {
  return !!(note.connected_to?.team_id || note.connected_to?.location_id)
}

function notePreview(note: Note): string {
  if (!note.content) return ''
  if (isBlockNoteContent(note.content)) {
    const blocks = parseBlockNoteContent(note.content)
    const first = blocks?.[0]
    return first?.title ? `Weekly: ${first.title}` : 'Weekly note'
  }
  const text = note.content.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
  return text.slice(0, 120) + (text.length > 120 ? '…' : '')
}
</script>
