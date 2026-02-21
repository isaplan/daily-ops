<template>
  <div class="p-8 max-w-4xl mx-auto">
    <div class="flex justify-between items-center mb-6">
      <h1 class="text-2xl font-semibold">Notes</h1>
      <div class="flex gap-2">
        <UButton to="/notes/new" variant="solid">New note</UButton>
        <UButton to="/notes/new?template=weekly" variant="outline">New Weekly</UButton>
      </div>
    </div>

    <div v-if="pending" class="space-y-3">
      <USkeleton class="h-24 w-full" v-for="i in 5" :key="i" />
    </div>
    <div v-else-if="error" class="text-red-600">
      Failed to load notes. Check that MongoDB is running and .env has MONGODB_URI.
    </div>
    <div v-else-if="!data?.data?.length" class="text-gray-500 py-8">
      No notes yet. Create one with “New note”.
    </div>
    <ul v-else class="space-y-3">
      <li v-for="note in data.data" :key="note._id">
        <UCard class="hover:border-primary/50 transition-colors">
          <div class="flex items-start justify-between gap-2">
            <NuxtLink
              :to="`/notes/${note.slug || note._id}`"
              class="min-w-0 flex-1 cursor-pointer"
            >
              <h2 class="font-medium truncate">{{ note.title }}</h2>
              <p v-if="notePreview(note)" class="text-sm text-gray-500 line-clamp-2 mt-1">
                {{ notePreview(note) }}
              </p>
              <p class="text-xs text-gray-400 mt-2">
                {{ note.created_at ? formatDate(note.created_at) : '' }}
              </p>
            </NuxtLink>
            <div class="flex items-center gap-2 shrink-0">
              <UBadge v-if="note.is_pinned" color="primary" size="xs">Pinned</UBadge>
              <UButton
                :to="`/notes/${note.slug || note._id}`"
                variant="ghost"
                size="xs"
                trailing-icon="i-heroicons-pencil-square"
                color="neutral"
              >
                Edit
              </UButton>
            </div>
          </div>
        </UCard>
      </li>
    </ul>

    <div v-if="data?.data?.length && data.data.length >= limit" class="mt-6 flex gap-2">
      <UButton
        size="sm"
        variant="outline"
        :disabled="skip === 0"
        @click="skip = Math.max(0, skip - limit)"
      >
        Previous
      </UButton>
      <UButton
        size="sm"
        variant="outline"
        :disabled="data.data.length < limit"
        @click="skip += limit"
      >
        Next
      </UButton>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { NotesListResponse, Note } from '~/types/note'
import { isBlockNoteContent, parseBlockNoteContent } from '~/types/noteBlock'

const skip = ref(0)
const limit = 20

const url = computed(() => `/api/notes?skip=${skip.value}&limit=${limit}`)
const { data, pending, error } = await useFetch<NotesListResponse>(url)

function formatDate(value: string): string {
  try {
    return new Date(value).toLocaleDateString()
  } catch {
    return ''
  }
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
