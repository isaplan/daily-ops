<template>
  <div class="space-y-4">
    <div v-if="pending" class="space-y-3">
      <div v-for="i in 5" :key="i" class="h-24 rounded-lg bg-gray-100 animate-pulse" />
    </div>
    <UAlert v-else-if="error" color="error" :title="String(error)" />
    <p v-else-if="!notes.length" class="text-gray-500 py-8">No notes in this list.</p>
    <ul v-else class="space-y-3">
      <li v-for="note in notes" :key="note._id">
        <UCard class="hover:border-primary/50 transition-colors">
          <div class="flex items-start justify-between gap-2">
            <NuxtLink :to="`/notes/${note.slug || note._id}`" class="min-w-0 flex-1 cursor-pointer">
              <h2 class="font-medium truncate">{{ note.title }}</h2>
              <p v-if="notePreview(note)" class="text-sm text-gray-500 line-clamp-2 mt-1">{{ notePreview(note) }}</p>
              <p class="text-xs text-gray-400 mt-2">{{ formatDate(note.created_at) }}</p>
            </NuxtLink>
            <div class="flex items-center gap-2 shrink-0">
              <UBadge v-if="note.is_pinned" color="primary" size="xs">Pinned</UBadge>
              <UButton :to="`/notes/${note.slug || note._id}`" variant="ghost" size="xs" trailing-icon="i-heroicons-pencil-square" color="neutral">Edit</UButton>
              <UButton variant="ghost" size="xs" color="red" icon="i-heroicons-trash" :loading="deletingId === note._id" @click="deleteNote(note._id)" />
            </div>
          </div>
        </UCard>
      </li>
    </ul>
    <div v-if="notes.length >= pageLimit" class="flex gap-2">
      <UButton size="sm" variant="outline" :disabled="skip === 0" @click="emit('update:skip', Math.max(0, skip - pageLimit))">Previous</UButton>
      <UButton size="sm" variant="outline" :disabled="notes.length < pageLimit" @click="emit('update:skip', skip + pageLimit)">Next</UButton>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { Note } from '~/types/note'
import { isBlockNoteContent, parseBlockNoteContent } from '~/types/noteBlock'

const props = defineProps<{
  notes: Note[]
  pending: boolean
  error: unknown
  skip: number
  pageLimit: number
}>()

const emit = defineEmits<{
  'update:skip': [value: number]
  trashed: []
}>()

const toast = useToast()
const deletingId = ref<string | null>(null)

function formatDate(value: string): string {
  try { return new Date(value).toLocaleDateString() } catch { return '' }
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

async function deleteNote(noteId: string) {
  if (!confirm('Move this note to trash? You can restore it from Trash later.')) return
  deletingId.value = noteId
  try {
    await $fetch(`/api/notes/${noteId}`, { method: 'DELETE' })
    toast.add({ title: 'Moved to trash', color: 'green' })
    emit('trashed')
  } catch (err) {
    toast.add({ title: 'Could not move note to trash', color: 'red' })
    deletingId.value = null
  } finally {
    deletingId.value = null
  }
}
</script>
