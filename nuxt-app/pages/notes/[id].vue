<template>
  <div class="flex min-h-0 flex-1 flex-col bg-[hsl(45,15%,95%)]">
    <div class="sticky top-3 z-10 mb-4 flex min-w-0 shrink-0 items-center gap-3 border-b border-gray-200 pb-2">
          <UButton variant="ghost" size="sm" to="/" class="shrink-0">
            ← Back
          </UButton>
<UInput
        v-if="!pending && (note || isNew)"
        v-model="editableTitle"
        placeholder="Note title"
        variant="none"
        class="min-w-0 flex-1 text-5xl font-bold rounded-none px-0"
      />
          <div
            v-if="showDetailsButton || hasTodos || hasAgrees"
            class="shrink-0 flex rounded-md border border-black bg-white p-0.5"
          >
            <button
              v-if="showDetailsButton"
              type="button"
              :class="[
                'rounded px-3 py-1.5 text-sm font-medium transition-colors',
                asideTab === 'details'
                  ? 'bg-gray-900 text-white'
                  : 'text-gray-600 hover:bg-gray-100',
              ]"
              @click="asideTab === 'details' ? closeAside() : setAsideTab('details')"
            >
              Details
            </button>
            <button
              v-if="hasTodos"
              type="button"
              :class="[
                'rounded px-3 py-1.5 text-sm font-medium transition-colors',
                asideTab === 'todos' ? 'bg-gray-900 text-white' : 'text-gray-600 hover:bg-gray-100',
              ]"
              @click="asideTab === 'todos' ? closeAside() : setAsideTab('todos')"
            >
              Todo
            </button>
            <button
              v-if="hasAgrees"
              type="button"
              :class="[
                'rounded px-3 py-1.5 text-sm font-medium transition-colors',
                asideTab === 'agreed' ? 'bg-gray-900 text-white' : 'text-gray-600 hover:bg-gray-100',
              ]"
              @click="asideTab === 'agreed' ? closeAside() : setAsideTab('agreed')"
            >
              Agreed
            </button>
          </div>
        </div>

    <div v-if="!isNew && note" class="flex min-h-0 flex-1 flex-col gap-6 overflow-hidden md:flex-row">
      <div class="flex min-h-0 min-w-0 flex-1 flex-col">
        <div class="min-h-0 flex-1 overflow-y-auto">
          <WeeklyNoteEditor
            v-if="isBlockNote"
            v-model:details-open="detailsOpen"
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
        </div>
      </div>
      <div
        v-if="asideVisible || activeMembers.length"
        class="sticky top-0 flex h-fit w-full shrink-0 flex-col gap-4 self-start rounded-lg p-4 md:max-w-[25%] md:w-3/12 bg-[hsl(45,12%,92%)]/90 backdrop-blur-md"
      >
        <!-- Tab content (tabs are in the header now) -->
        <div v-if="asideTab === 'details' && detailsOpen" id="details-panel-target" class="min-h-0" />
        <div v-else-if="asideTab === 'todos'" class="min-h-0 space-y-2">
          <h3 class="text-xs font-semibold uppercase tracking-wide text-gray-500">Todo</h3>
          <ul class="space-y-1.5">
            <li
              v-for="todo in noteTodos"
              :key="todo.id"
              class="flex items-start gap-2 rounded-md border border-gray-200 bg-white px-3 py-2 text-sm"
            >
              <span
                :class="todo.checked ? 'text-gray-500 line-through' : 'text-gray-900'"
              >
                {{ todo.text }}
              </span>
            </li>
          </ul>
        </div>
        <div v-else-if="asideTab === 'agreed'" class="min-h-0 space-y-2">
          <h3 class="text-xs font-semibold uppercase tracking-wide text-gray-500">Agreed</h3>
          <ul class="space-y-1.5">
            <li
              v-for="agree in noteAgrees"
              :key="agree.id"
              class="flex items-start gap-2 rounded-md border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900"
            >
              <UIcon name="i-lucide-handshake" class="mt-0.5 size-4 shrink-0 text-gray-500" />
              {{ agree.text }}
            </li>
          </ul>
        </div>
        <aside v-if="activeMembers.length" class="shrink-0">
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
    </div>

    <div v-else-if="isNew" class="flex min-h-0 flex-1 flex-col gap-6 overflow-y-auto md:flex-row">
      <div class="min-h-0 min-w-0 flex-1 overflow-y-auto">
          <WeeklyNoteEditor
            v-if="useWeekly"
            v-model:details-open="detailsOpen"
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
      </div>
      <div
        v-if="detailsOpen && showDetailsButton"
        id="details-panel-target"
        class="w-full shrink-0 rounded-lg p-4 md:max-w-[25%] md:w-3/12 bg-[hsl(45,12%,92%)]/90 backdrop-blur-md"
      />
    </div>

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
import { isBlockNoteContent, parseBlockNoteContent } from '~/types/noteBlock'
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
const noteBlocks = computed(() =>
  note.value?.content ? (parseBlockNoteContent(note.value.content) ?? []) : []
)
const noteTodos = computed(() => noteBlocks.value.flatMap((b) => b.todos ?? []))
const noteAgrees = computed(() => noteBlocks.value.flatMap((b) => b.agrees ?? []))
const hasTodos = computed(() => !isNew.value && isBlockNote.value && noteTodos.value.length > 0)
const hasAgrees = computed(() => !isNew.value && isBlockNote.value && noteAgrees.value.length > 0)

const activeMembers = computed(() => note.value?.mentioned_members ?? [])
const showDetailsButton = computed(() => (!isNew.value && isBlockNote.value) || (isNew.value && useWeekly.value))
const detailsOpen = ref(false)
/** Which tab is shown in the aside: details (More), todos, or agreed. null = aside closed. */
const asideTab = ref<'details' | 'todos' | 'agreed' | null>(null)

const asideVisible = computed(
  () =>
    (detailsOpen.value && showDetailsButton.value) ||
    asideTab.value === 'todos' ||
    asideTab.value === 'agreed' ||
    activeMembers.value.length > 0
)

function closeAside() {
  detailsOpen.value = false
  asideTab.value = null
}
function setAsideTab(tab: 'details' | 'todos' | 'agreed') {
  asideTab.value = tab
  detailsOpen.value = tab === 'details'
}

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
