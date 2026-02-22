<template>
  <div class="space-y-6">
    <div class="flex items-center justify-between">
      <div>
        <h1 class="text-4xl font-bold mb-2 text-gray-900">Dashboard</h1>
        <p class="text-gray-700">Most recent notes</p>
      </div>
      <div class="flex gap-2">
        <UButton to="/notes/new" variant="solid" class="!bg-gray-900 !text-white hover:!bg-gray-800">
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

      <div v-if="recentTodos.length" class="mt-8">
        <div class="flex items-center justify-between mb-4">
          <h2 class="text-xl font-semibold text-gray-900">Recent Todo's</h2>
          <NuxtLink to="/notes/todos" class="text-sm text-blue-600 hover:underline focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1 rounded">View all</NuxtLink>
        </div>
        <ul class="space-y-2">
          <li v-for="item in recentTodos" :key="item.id">
            <UCard :class="['rounded-lg border border-gray-200 shadow-sm hover:shadow-md transition-shadow', item.checked ? 'bg-gray-50' : 'bg-white']">
              <div class="flex items-center gap-3">
                <UCheckbox
                  :model-value="item.checked"
                  class="shrink-0"
                  :disabled="togglingTodoId === item.id"
                  @update:model-value="(v: boolean) => setTodoDone(item, v)"
                />
                <div class="min-w-0 flex-1">
              <span :class="['text-sm', item.checked && 'text-gray-500 line-through']">
                <template v-for="(seg, segIdx) in todoTextSegments(item.text)" :key="`${item.id}-${segIdx}`">
                  <template v-if="seg.type === 'mention'">
                    <NuxtLink :to="'/notes/todos'" class="text-blue-600 hover:underline font-medium">
                      @{{ seg.slug }}
                    </NuxtLink>
                  </template>
                  <span v-else>{{ seg.value }}</span>
                </template>
              </span>
              <p v-if="item.checked && (item.doneBy || item.doneAt)" class="text-xs text-gray-400 mt-1">
                Done by {{ item.doneBy || 'Unknown' }} on {{ formatDoneAt(item.doneAt) }}
              </p>
                </div>
                <NuxtLink :to="`/notes/${item.noteSlug || item.noteId}`" class="text-sm text-blue-600 hover:underline shrink-0">
                  {{ item.noteTitle }}
                </NuxtLink>
              </div>
            </UCard>
          </li>
        </ul>
      </div>

      <div v-if="recentAgrees.length" class="mt-8">
        <div class="flex items-center justify-between mb-4">
          <h2 class="text-xl font-semibold text-gray-900">Recent Agreed</h2>
          <NuxtLink to="/notes/agreed" class="text-sm text-blue-600 hover:underline focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1 rounded">View all</NuxtLink>
        </div>
        <ul class="space-y-2">
          <li v-for="item in recentAgrees" :key="item.id">
            <UCard class="bg-white border border-gray-200 rounded-lg shadow-sm hover:shadow-md transition-shadow">
              <div class="flex items-center gap-3">
                <UIcon name="i-lucide-handshake" class="size-4 shrink-0 text-gray-500" />
                <span class="text-sm flex-1 min-w-0 line-clamp-2">{{ item.text }}</span>
                <NuxtLink :to="`/notes/${item.noteSlug || item.noteId}`" class="text-sm text-blue-600 hover:underline shrink-0">
                  {{ item.noteTitle }}
                </NuxtLink>
              </div>
            </UCard>
          </li>
        </ul>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import type { NotesListResponse, Note } from '~/types/note'
import type { BlockTodo, BlockAgree } from '~/types/noteBlock'
import { isBlockNoteContent, parseBlockNoteContent } from '~/types/noteBlock'

const { data, pending, error, refresh } = await useFetch<NotesListResponse>('/api/notes?limit=50')

const recentNotes = computed(() => {
  const list = data.value?.data ?? []
  return [...list].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()).slice(0, 3)
})

type TodoWithNote = BlockTodo & { noteId: string; noteSlug?: string; noteTitle: string; noteUpdatedAt: string }
const recentTodos = computed<TodoWithNote[]>(() => {
  const notes = data.value?.data ?? []
  const out: TodoWithNote[] = []
  for (const note of notes) {
    if (!note.content) continue
    const blocks = parseBlockNoteContent(note.content)
    if (!blocks?.length) continue
    const noteTitle = note.title || 'Untitled'
    const noteId = note._id
    const noteSlug = note.slug
    const noteUpdatedAt = note.updated_at ?? note.created_at ?? ''
    for (const block of blocks) {
      for (const t of block.todos ?? []) {
        out.push({ ...t, noteId, noteSlug, noteTitle, noteUpdatedAt })
      }
    }
  }
  return out
    .sort((a, b) => new Date(b.noteUpdatedAt).getTime() - new Date(a.noteUpdatedAt).getTime())
    .slice(0, 8)
})

type AgreeWithNote = BlockAgree & { noteId: string; noteSlug?: string; noteTitle: string; noteUpdatedAt: string }
const recentAgrees = computed<AgreeWithNote[]>(() => {
  const notes = data.value?.data ?? []
  const out: AgreeWithNote[] = []
  for (const note of notes) {
    if (!note.content) continue
    const blocks = parseBlockNoteContent(note.content)
    if (!blocks?.length) continue
    const noteTitle = note.title || 'Untitled'
    const noteId = note._id
    const noteSlug = note.slug
    const noteUpdatedAt = note.updated_at ?? note.created_at ?? ''
    for (const block of blocks) {
      for (const a of block.agrees ?? []) {
        out.push({ ...a, noteId, noteSlug, noteTitle, noteUpdatedAt })
      }
    }
  }
  return out
    .sort((a, b) => new Date(b.noteUpdatedAt).getTime() - new Date(a.noteUpdatedAt).getTime())
    .slice(0, 8)
})

const togglingTodoId = ref<string | null>(null)

function formatDoneAt(iso: string | undefined): string {
  if (!iso) return '—'
  try {
    return new Date(iso).toLocaleDateString(undefined, { dateStyle: 'short' })
  } catch {
    return iso
  }
}

type TextSegment = { type: 'text'; value: string } | { type: 'mention'; slug: string }
function todoTextSegments(text: string): TextSegment[] {
  if (!text) return []
  const parts = text.split(/(@[a-zA-Z0-9_-]+)/g)
  const segments: TextSegment[] = []
  for (const p of parts) {
    if (p.startsWith('@')) {
      const slug = p.slice(1).toLowerCase()
      if (slug !== 'todo') segments.push({ type: 'mention', slug })
      else segments.push({ type: 'text', value: p })
    } else {
      segments.push({ type: 'text', value: p })
    }
  }
  return segments
}

async function setTodoDone(item: TodoWithNote, checked: boolean): Promise<void> {
  togglingTodoId.value = item.id
  try {
    await $fetch(`/api/notes/${item.noteId}/todos/${item.id}`, {
      method: 'PUT',
      body: {
        checked,
        ...(checked && { doneAt: new Date().toISOString() }),
      },
    })
    await refresh()
  } finally {
    togglingTodoId.value = null
  }
}

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
