<template>
  <div class="space-y-4">
    <div class="flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 class="text-4xl font-bold mb-2 text-gray-900">Trash</h1>
        <p class="text-gray-700">Notes you removed are kept here until you restore or delete them forever.</p>
      </div>
      <UButton to="/notes/all" variant="outline" size="sm">Back to all notes</UButton>
    </div>
    <NotesScopeNav active="deleted" />

    <div v-if="pending" class="space-y-3">
      <div v-for="i in 5" :key="i" class="h-24 rounded-lg bg-gray-100 animate-pulse" />
    </div>
    <UAlert v-else-if="error" color="error" :title="String(error)" />
    <p v-else-if="!notes.length" class="text-gray-500 py-8">Trash is empty.</p>
    <ul v-else class="space-y-3">
      <li v-for="note in notes" :key="note._id">
        <UCard>
          <div class="flex flex-wrap items-start justify-between gap-3">
            <div class="min-w-0 flex-1">
              <NuxtLink
                :to="{ path: `/notes/${note.slug || note._id}`, query: { fromTrash: '1' } }"
                class="font-medium truncate text-gray-900 hover:underline"
              >
                {{ note.title }}
              </NuxtLink>
              <p class="text-xs text-gray-400 mt-1">
                Deleted {{ formatDate(note.deleted_at) }}
              </p>
            </div>
            <div class="flex flex-wrap items-center gap-2 shrink-0">
              <UButton
                size="sm"
                variant="outline"
                :loading="busyId === `restore-${note._id}`"
                @click="restoreNote(note._id)"
              >
                Restore
              </UButton>
              <UButton
                size="sm"
                color="error"
                variant="outline"
                :loading="busyId === `perm-${note._id}`"
                @click="permanentDelete(note._id)"
              >
                Delete forever
              </UButton>
            </div>
          </div>
        </UCard>
      </li>
    </ul>
    <div v-if="notes.length >= pageLimit" class="flex gap-2">
      <UButton size="sm" variant="outline" :disabled="skip === 0" @click="skip = Math.max(0, skip - pageLimit)">Previous</UButton>
      <UButton size="sm" variant="outline" :disabled="notes.length < pageLimit" @click="skip += pageLimit">Next</UButton>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { NotesListResponse, Note } from '~/types/note'

const toast = useToast()
const skip = ref(0)
const pageLimit = 20
const busyId = ref<string | null>(null)

const url = computed(() => {
  const params = new URLSearchParams()
  params.set('skip', String(skip.value))
  params.set('limit', String(pageLimit))
  params.set('scope', 'trash')
  return `/api/notes?${params.toString()}`
})

const { data, pending, error, refresh } = await useFetch<NotesListResponse>(url)

const notes = computed(() => (data.value?.data ?? []) as Note[])

function formatDate(value: string | undefined | null): string {
  if (!value) return '—'
  try {
    return new Date(value).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })
  } catch {
    return '—'
  }
}

async function restoreNote(id: string) {
  busyId.value = `restore-${id}`
  try {
    await $fetch(`/api/notes/${id}/restore`, { method: 'POST' })
    toast.add({ title: 'Note restored', color: 'green' })
    await refresh()
  } catch {
    toast.add({ title: 'Could not restore note', color: 'red' })
  } finally {
    busyId.value = null
  }
}

async function permanentDelete(id: string) {
  if (!confirm('Permanently delete this note? This cannot be undone.')) return
  busyId.value = `perm-${id}`
  try {
    await $fetch(`/api/notes/${id}/permanent`, { method: 'DELETE' })
    toast.add({ title: 'Note permanently deleted', color: 'green' })
    await refresh()
  } catch {
    toast.add({ title: 'Could not delete note', color: 'red' })
  } finally {
    busyId.value = null
  }
}
</script>
