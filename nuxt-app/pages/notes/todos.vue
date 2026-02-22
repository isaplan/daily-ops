<template>
  <div class="space-y-4">
    <h1 class="text-4xl font-bold mb-2 text-gray-900">Todo's List</h1>
    <p class="text-gray-700 mb-6">Tasks from your notes (/todo and @todo … @Todo ends). Use @member in a todo to assign it.</p>

    <div class="flex flex-wrap items-center justify-between gap-3 mb-4">
      <div class="flex items-center gap-3">
        <span class="text-sm font-medium text-gray-600">Show:</span>
        <div class="flex rounded-md border border-gray-200 bg-white p-0.5">
          <button
            type="button"
            :class="['rounded px-3 py-1.5 text-sm font-medium transition-colors', filterMode === 'all' ? 'bg-gray-900 text-white' : 'text-gray-600 hover:bg-gray-100']"
            @click="filterMode = 'all'"
          >
            All
          </button>
          <button
            type="button"
            :class="['rounded px-3 py-1.5 text-sm font-medium transition-colors', filterMode === 'mine' ? 'bg-gray-900 text-white' : 'text-gray-600 hover:bg-gray-100']"
            @click="filterMode = 'mine'"
          >
            My todo's
          </button>
        </div>
      </div>
      <div class="flex items-center gap-1">
        <div class="relative w-48">
          <select
            v-model="selectedMemberId"
            class="w-full rounded-md border border-gray-200 bg-white pl-3 pr-10 py-2 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 appearance-none"
          >
            <option value="">Select member…</option>
            <option v-for="u in unifiedUsers" :key="u._id" :value="String(u._id)">
              {{ displayName(u) }}
            </option>
          </select>
          <span class="pointer-events-none absolute inset-y-0 right-3 flex items-center text-gray-500" aria-hidden="true">
            <UIcon name="i-lucide-chevron-down" class="size-4" />
          </span>
        </div>
        <button
          type="button"
          aria-label="Reset member"
          class="rounded-md p-2 text-gray-500 hover:bg-gray-100 hover:text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
          @click="selectedMemberId = ''"
        >
          <UIcon name="i-lucide-rotate-ccw" class="size-4" />
        </button>
      </div>
    </div>

    <div v-if="pending" class="space-y-3">
      <div v-for="i in 8" :key="i" class="h-14 rounded-lg bg-gray-100 animate-pulse" />
    </div>
    <UAlert v-else-if="error" color="error" :title="String(error)" />
    <p v-else-if="!filteredItems.length" class="text-gray-500 py-8">
      {{ filterMode === 'mine' ? "No todos assigned to you. Add @yourname in a todo." : "No todos in your notes yet. Add /todo or @todo … @Todo ends in a note." }}
    </p>
    <template v-else>
      <section v-if="activeTodos.length" class="space-y-2">
        <h2 class="text-sm font-semibold uppercase tracking-wide text-gray-500 mb-2">Todo's</h2>
        <ul class="space-y-2">
          <li
            v-for="item in activeTodos"
            :key="item.id"
            class="flex items-center gap-3 rounded-lg border border-gray-200 bg-white px-4 py-3"
          >
            <UCheckbox
              :model-value="item.checked"
              class="shrink-0"
              :disabled="togglingId === item.id"
              @update:model-value="(v: boolean) => setTodoDone(item, v)"
            />
            <div class="min-w-0 flex-1">
              <span class="text-sm">
                <template v-for="(seg, segIdx) in todoTextSegments(item.text)" :key="`${item.id}-${segIdx}`">
                  <template v-if="seg.type === 'mention'">
                    <button
                      type="button"
                      class="cursor-pointer text-blue-600 hover:underline font-medium focus:outline focus:ring-2 focus:ring-blue-400 rounded"
                      @click.prevent="filterByMention(seg.slug)"
                    >
                      @{{ seg.slug }}
                    </button>
                  </template>
                  <span v-else>{{ seg.value }}</span>
                </template>
              </span>
            </div>
            <NuxtLink :to="`/notes/${item.noteSlug || item.noteId}`" class="text-sm text-blue-600 hover:underline shrink-0">
              {{ item.noteTitle }}
            </NuxtLink>
          </li>
        </ul>
      </section>
      <section v-if="finishedTodos.length" class="space-y-2 mt-6">
        <h2 class="text-sm font-semibold uppercase tracking-wide text-gray-500 mb-2">Finished</h2>
        <ul class="space-y-2">
          <li
            v-for="item in finishedTodos"
            :key="item.id"
            class="flex items-center gap-3 rounded-lg border border-gray-200 bg-gray-50 px-4 py-3"
          >
            <UCheckbox
              :model-value="item.checked"
              class="shrink-0"
              :disabled="togglingId === item.id"
              @update:model-value="(v: boolean) => setTodoDone(item, v)"
            />
            <div class="min-w-0 flex-1">
              <span class="text-sm text-gray-500 line-through">
                <template v-for="(seg, segIdx) in todoTextSegments(item.text)" :key="`${item.id}-${segIdx}`">
                  <template v-if="seg.type === 'mention'">
                    <button
                      type="button"
                      class="cursor-pointer text-blue-600 hover:underline font-medium"
                      @click.prevent="filterByMention(seg.slug)"
                    >
                      @{{ seg.slug }}
                    </button>
                  </template>
                  <span v-else>{{ seg.value }}</span>
                </template>
              </span>
              <p v-if="item.doneBy || item.doneAt" class="text-xs text-gray-400 mt-1">
                Done by {{ item.doneBy || 'Unknown' }} on {{ formatDoneAt(item.doneAt) }}
              </p>
            </div>
            <NuxtLink :to="`/notes/${item.noteSlug || item.noteId}`" class="text-sm text-blue-600 hover:underline shrink-0">
              {{ item.noteTitle }}
            </NuxtLink>
          </li>
        </ul>
      </section>
    </template>
  </div>
</template>

<script setup lang="ts">
import type { NotesListResponse } from '~/types/note'
import type { BlockTodo } from '~/types/noteBlock'
import { parseBlockNoteContent } from '~/types/noteBlock'
import { extractAssignedTo } from '~/lib/utils/blockTodoParser'

const { data, pending, error, refresh } = await useFetch<NotesListResponse>('/api/notes?limit=200')

const MEMBER_STORAGE_KEY = 'nuxt-todos-my-unified-user'

type TodoItem = BlockTodo & { noteId: string; noteSlug?: string; noteTitle: string }

const items = computed<TodoItem[]>(() => {
  const notes = data.value?.data ?? []
  const out: TodoItem[] = []
  for (const note of notes) {
    if (!note.content) continue
    const blocks = parseBlockNoteContent(note.content)
    if (!blocks?.length) continue
    const noteTitle = note.title || 'Untitled'
    const noteId = note._id
    const noteSlug = note.slug
    for (const block of blocks) {
      const todos = block.todos ?? []
      for (const t of todos) {
        out.push({
          ...t,
          noteId,
          noteSlug,
          noteTitle,
          assignedTo: t.assignedTo ?? extractAssignedTo(t.text),
        })
      }
    }
  }
  return out
})

const filterMode = ref<'all' | 'mine'>('all')

type UnifiedUser = { _id: string; canonicalName: string; primaryName: string; slackUsername: string | null }
const { data: unifiedUsersData } = await useFetch<{ success: boolean; data: UnifiedUser[] }>('/api/unified-users', { server: false })
const { data: membersFallbackData } = await useFetch<{ success: boolean; data: { _id: string; name: string }[] }>('/api/members', { server: false })
const unifiedUsers = computed(() => {
  const list = unifiedUsersData.value?.data ?? []
  if (list.length > 0) {
    return list.map((u) => ({
      _id: typeof u._id === 'string' ? u._id : String((u._id as { toString?: () => string })?.toString?.() ?? u._id),
      canonicalName: u.canonicalName ?? '',
      primaryName: u.primaryName ?? '',
      slackUsername: u.slackUsername ?? null,
    }))
  }
  const members = membersFallbackData.value?.data ?? []
  return members.map((m) => {
    const name = m.name ?? 'Unknown'
    const first = name.trim().split(/\s+/)[0] ?? ''
    const id = typeof m._id === 'string' ? m._id : String((m._id as { toString?: () => string })?.toString?.() ?? m._id)
    return { _id: id, canonicalName: name, primaryName: name, slackUsername: first ? first.toLowerCase() : null }
  })
})

function displayName(u: UnifiedUser): string {
  const n = (u.canonicalName || u.primaryName || '').trim()
  return n || 'Unknown'
}

/** Slug used to match @mention to unified user (slackUsername, or first word of canonical/primary name). */
function unifiedUserSlug(u: UnifiedUser): string {
  if (u.slackUsername) return u.slackUsername.toLowerCase()
  const first = (u.canonicalName || u.primaryName || '').trim().split(/\s+/)[0] ?? ''
  return first.toLowerCase()
}

const savedMemberId = typeof localStorage !== 'undefined' ? localStorage.getItem(MEMBER_STORAGE_KEY) : null
const selectedMemberId = ref<string>(savedMemberId ?? '')

watch(selectedMemberId, (id) => {
  if (typeof localStorage !== 'undefined') {
    if (id) localStorage.setItem(MEMBER_STORAGE_KEY, id)
    else localStorage.removeItem(MEMBER_STORAGE_KEY)
  }
}, { immediate: true })

const filteredItems = computed<TodoItem[]>(() => {
  const list = items.value
  if (filterMode.value !== 'mine') return list
  const user = unifiedUsers.value.find((u) => u._id === selectedMemberId.value)
  if (!user) return list
  const slug = unifiedUserSlug(user)
  return list.filter((item) => item.assignedTo === slug)
})

const activeTodos = computed(() => filteredItems.value.filter((t) => !t.checked))
const finishedTodos = computed(() => filteredItems.value.filter((t) => t.checked))

const togglingId = ref<string | null>(null)

function formatDoneAt(iso: string | undefined): string {
  if (!iso) return '—'
  try {
    return new Date(iso).toLocaleDateString(undefined, { dateStyle: 'short' })
  } catch {
    return iso
  }
}

async function setTodoDone(item: TodoItem, checked: boolean): Promise<void> {
  togglingId.value = item.id
  try {
    const selected = unifiedUsers.value.find((u) => u._id === selectedMemberId.value)
    const doneBy = checked && selected ? displayName(selected) : undefined
    const doneAt = checked ? new Date().toISOString() : undefined
    await $fetch(`/api/notes/${item.noteId}/todos/${item.id}`, {
      method: 'PUT',
      body: { checked, doneBy, doneAt },
    })
    await refresh()
  } finally {
    togglingId.value = null
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

function filterByMention(slug: string): void {
  const user = unifiedUsers.value.find((u) => unifiedUserSlug(u) === slug)
  if (user) {
    selectedMemberId.value = user._id
    filterMode.value = 'mine'
  }
}
</script>
