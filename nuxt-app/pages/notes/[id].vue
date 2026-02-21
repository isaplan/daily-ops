<template>
  <div>
    <UButton variant="ghost" size="sm" class="mb-4 -ml-2" to="/">
      ← Back
    </UButton>

    <div v-if="!isNew && note" class="flex gap-6">
      <div class="min-w-0 flex-1">
        <UCard
          class="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm"
          :ui="{ body: { base: '', padding: 'p-6' }, header: { padding: 'px-6 pt-6 pb-0' } }"
        >
          <template #header>
            <UInput
              v-model="editableTitle"
              placeholder="Note title"
              class="text-xl font-semibold border-0 border-b border-gray-200 rounded-none px-0 focus:ring-0 bg-transparent w-full"
            />
          </template>
          <WeeklyNoteEditor
            v-if="isBlockNote"
            :note="note"
            :external-title="editableTitle"
            @saved="onSaved"
            @cancel="navigateTo('/')"
          />
          <NotesForm
            v-else
            :note="note"
            :external-title="editableTitle"
            @saved="onSaved"
            @cancel="navigateTo('/')"
          />
        </UCard>
      </div>
      <aside v-if="activeMembers.length" class="w-56 shrink-0">
        <div class="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
          <h3 class="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-3">Active members</h3>
          <ul class="space-y-2">
            <li
              v-for="m in activeMembers"
              :key="m._id"
              class="text-sm font-medium text-gray-900"
            >
              {{ m.canonicalName }}
            </li>
          </ul>
        </div>
      </aside>
    </div>

    <UCard
      v-else-if="isNew"
      class="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm"
      :ui="{ body: { base: '', padding: 'p-6' }, header: { padding: 'px-6 pt-6 pb-0' } }"
    >
      <template #header>
        <UInput
          v-model="editableTitle"
          placeholder="Note title"
          class="text-xl font-semibold border-0 border-b border-gray-200 rounded-none px-0 focus:ring-0 bg-transparent w-full"
        />
      </template>
      <WeeklyNoteEditor
        v-if="useWeekly"
        :initial-template="useWeekly ? 'weekly' : undefined"
        :external-title="editableTitle"
        @saved="onSaved"
        @cancel="navigateTo('/')"
      />
      <NotesForm
        v-else
        :external-title="editableTitle"
        @saved="onSaved"
        @cancel="navigateTo('/')"
      />
    </UCard>

    <div v-else-if="pending">
      <USkeleton class="h-12 w-3/4 mb-4" />
      <USkeleton class="h-64 w-full" />
    </div>
    <div v-else-if="error || !note">
      <p class="text-red-600">Note not found or failed to load.</p>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { Note, NoteResponse } from '~/types/note'
import { isBlockNoteContent } from '~/types/noteBlock'
import { getWeeklyNoteTitle } from '~/lib/templates/weeklyNoteTemplate'

const route = useRoute()
const router = useRouter()
const id = computed(() => route.params.id as string)
const isNew = computed(() => id.value === 'new')
const useWeekly = computed(() => isNew.value && route.query.template === 'weekly')

const { data, pending, error, refresh } = await useFetch<NoteResponse>(
  () => (isNew.value ? null : `/api/notes/${id.value}`),
  { watch: [id] }
)

const note = computed(() => data.value?.data ?? null)
const isBlockNote = computed(() =>
  note.value?.content ? isBlockNoteContent(note.value.content) : false
)
const activeMembers = computed(() => note.value?.mentioned_members ?? [])

const editableTitle = ref('')
watch(
  () => ({ isNew: isNew.value, useWeekly: useWeekly.value, note: note.value }),
  ({ isNew: newMode, useWeekly: weekly, note: n }) => {
    if (newMode && weekly) editableTitle.value = getWeeklyNoteTitle()
    else if (newMode) editableTitle.value = ''
    else if (n?.title) editableTitle.value = n.title
  },
  { immediate: true }
)

function onSaved(updated: Note) {
  if (isNew.value) {
    navigateTo(`/notes/${updated.slug || updated._id}`)
  } else {
    refresh()
  }
}

function navigateTo(path: string) {
  router.push(path)
}
</script>
