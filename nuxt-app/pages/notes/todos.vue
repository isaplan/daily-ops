<template>
  <div class="p-8 max-w-7xl mx-auto">
    <h1 class="text-4xl font-bold mb-2 text-gray-900">Todo's List</h1>
    <p class="text-gray-700 mb-6">Tasks from your notes (/todo and @todo … @Todo ends)</p>

    <div v-if="pending" class="space-y-3">
      <div v-for="i in 8" :key="i" class="h-14 rounded-lg bg-gray-100 animate-pulse" />
    </div>
    <UAlert v-else-if="error" color="error" :title="String(error)" />
    <p v-else-if="!items.length" class="text-gray-500 py-8">No todos in your notes yet. Add /todo or @todo … @Todo ends in a note.</p>
    <ul v-else class="space-y-2">
      <li
        v-for="item in items"
        :key="item.id"
        class="flex items-center gap-3 rounded-lg border border-gray-200 bg-white px-4 py-3"
      >
        <UCheckbox :model-value="item.checked" disabled class="shrink-0" />
        <span :class="item.checked ? 'text-gray-500 line-through text-sm flex-1' : 'text-sm flex-1'">{{ item.text }}</span>
        <NuxtLink :to="`/notes/${item.noteSlug || item.noteId}`" class="text-sm text-blue-600 hover:underline shrink-0">
          {{ item.noteTitle }}
        </NuxtLink>
      </li>
    </ul>
  </div>
</template>

<script setup lang="ts">
import type { NotesListResponse } from '~/types/note'
import type { BlockTodo } from '~/types/noteBlock'
import { parseBlockNoteContent } from '~/types/noteBlock'

const { data, pending, error } = await useFetch<NotesListResponse>('/api/notes?limit=200')

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
        out.push({ ...t, noteId, noteSlug, noteTitle })
      }
    }
  }
  return out
})
</script>
