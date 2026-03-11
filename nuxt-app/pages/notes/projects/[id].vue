<!--
/**
 * @registry-id: ProjectsId
 * @created: 2026-03-02T00:00:00.000Z
 * @last-modified: 2026-03-02T00:00:00.000Z
 * @description: Project detail page - edit project with outline view and editor
 * @last-fix: [2026-03-02] Initial page creation
 * @exports-to:
 * ✓ nuxt-app/server/api/notes/index.get.ts => Fetches project note
 * ✓ nuxt-app/components/ProjectOutliner.vue => ProjectOutliner for outline display
 * ✓ nuxt-app/components/ProjectOutlineEditor.vue => ProjectOutlineEditor for editing
 */
-->
<template>
  <div class="flex h-full min-h-0 flex-col">
    <header class="sticky top-0 z-20 flex shrink-0 items-center gap-3 border-b border-gray-200 bg-[hsl(45,15%,95%)] px-3 py-2">
      <UButton variant="ghost" size="sm" to="/notes/projects" class="shrink-0">
        ← Projects
      </UButton>
      <UInput
        v-if="projectNote"
        v-model="projectTitle"
        placeholder="Project title"
        variant="none"
        class="min-w-0 flex-1 text-lg font-bold rounded-none px-0"
      />
      <UButton :loading="savingProject" size="sm" class="shrink-0" @click="saveProject">
        Save project
      </UButton>
    </header>

    <div v-if="pending" class="flex flex-1 items-center justify-center text-gray-500">Loading...</div>
    <p v-else-if="error" class="p-4 text-red-600">{{ String(error) }}</p>
    <p v-else-if="projectNote && !isProjectV2" class="p-4 text-gray-600">This project uses an older format. Open in list view or re-create.</p>

    <template v-else-if="projectNote && isProjectV2">
      <div class="flex min-h-0 flex-1 overflow-hidden">
        <!-- Left: outliner -->
        <aside class="flex w-56 shrink-0 flex-col border-r border-gray-200 bg-white overflow-hidden">
          <div class="shrink-0 border-b border-gray-200 px-3 py-2">
            <h2 class="text-sm font-semibold text-gray-900">Outline</h2>
          </div>
          <ProjectOutliner
            v-model="outlineNodes"
            :selected-note-id="selectedNoteId"
            class="min-h-0"
            @select="selectNote"
            @add-root="addRootNode"
            @add-child="addChildNode"
            @update:title="onOutlineTitleUpdate"
          />
        </aside>

        <!-- Center: note editor -->
        <main class="flex min-w-0 flex-1 flex-col overflow-hidden bg-[hsl(45,15%,95%)]">
          <template v-if="selectedNoteId">
            <div v-if="selectedNotePending" class="flex flex-1 items-center justify-center text-gray-500">Loading note...</div>
            <div v-else-if="selectedNoteError" class="p-4 text-red-600">{{ String(selectedNoteError) }}</div>
            <div v-else-if="selectedNote" class="flex min-h-0 flex-1 flex-col overflow-y-auto p-4">
              <WeeklyNoteEditor
                v-if="isBlockNote"
                v-model:details-open="detailsOpen"
                :note="selectedNote"
                :external-title="selectedNoteTitle"
                @saved="onSelectedNoteSaved"
              />
              <NotesForm
                v-else
                :note="selectedNote"
                :external-title="selectedNoteTitle"
                @saved="onSelectedNoteSaved"
              />
            </div>
          </template>
          <div v-else class="flex flex-1 flex-col items-center justify-center text-gray-500 p-8">
            <UIcon name="i-lucide-file-text" class="size-12 mb-4 opacity-40" />
            <p>Select a note from the outline to edit.</p>
          </div>
        </main>

        <!-- Right: details + todos -->
        <aside
          v-if="selectedNote"
          class="flex w-72 shrink-0 flex-col border-l border-gray-200 bg-[hsl(45,12%,92%)]/90 overflow-hidden"
        >
          <div class="shrink-0 border-b border-gray-200 px-3 py-2">
            <h2 class="text-sm font-semibold text-gray-900">Details & Todos</h2>
          </div>
          <div class="min-h-0 flex-1 overflow-y-auto p-3 space-y-4">
            <div>
              <h3 class="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-2">Todo</h3>
              <ul v-if="selectedNoteTodos.length" class="space-y-1.5">
                <li
                  v-for="todo in selectedNoteTodos"
                  :key="todo.id"
                  class="flex items-start gap-2 rounded-md border border-gray-200 bg-white px-3 py-2 text-sm"
                >
                  <span :class="todo.checked ? 'text-gray-500 line-through' : 'text-gray-900'">{{ todo.text }}</span>
                </li>
              </ul>
              <p v-else class="text-sm text-gray-400">No todos in this note.</p>
            </div>
            <div>
              <h3 class="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-2">Agreed</h3>
              <ul v-if="selectedNoteAgrees.length" class="space-y-1.5">
                <li
                  v-for="agree in selectedNoteAgrees"
                  :key="agree.id"
                  class="flex items-start gap-2 rounded-md border border-gray-200 bg-white px-3 py-2 text-sm"
                >
                  <UIcon name="i-lucide-handshake" class="mt-0.5 size-4 shrink-0 text-gray-500" />
                  {{ agree.text }}
                </li>
              </ul>
              <p v-else class="text-sm text-gray-400">No agreements.</p>
            </div>
            <div v-if="selectedNote?.tags?.length">
              <h3 class="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-2">Tags</h3>
              <div class="flex flex-wrap gap-1.5">
                <span v-for="tag in selectedNote.tags" :key="tag" class="rounded-md bg-gray-100 px-2 py-1 text-sm">#{{ tag }}</span>
              </div>
            </div>
          </div>
        </aside>
      </div>
    </template>

    <div v-else class="p-4 text-gray-500">Project not found.</div>
  </div>
</template>

<script setup lang="ts">
import type { Note, NoteResponse } from '~/types/note'
import type { ProjectOutlineNode } from '~/types/projectOutline'
import {
  parseProjectOutlineV2,
  serializeProjectOutlineV2,
  isProjectOutlineV2,
  createProjectOutlineNode,
  insertAtPathV2,
  setNodeAtPathV2,
  getPathOfNoteIdV2,
  getNodeAtPathV2,
} from '~/types/projectOutline'
import { isBlockNoteContent, parseBlockNoteContent } from '~/types/noteBlock'

const route = useRoute()
const projectId = computed(() => route.params.id as string)

const { data, pending, error, refresh } = await useFetch<NoteResponse>(() => `/api/notes/${projectId.value}`)
const projectNote = computed(() => data.value?.data ?? null)

const isProjectV2 = computed(() => projectNote.value?.content != null && isProjectOutlineV2(projectNote.value.content))

const projectTitle = ref('')
watch(projectNote, (n) => { projectTitle.value = n?.title ?? '' }, { immediate: true })

const outlineNodes = ref<ProjectOutlineNode[]>([])
watch(
  projectNote,
  (n) => {
    if (!n?.content || !isProjectOutlineV2(n.content)) {
      outlineNodes.value = []
      return
    }
    const parsed = parseProjectOutlineV2(n.content)
    outlineNodes.value = parsed?.length ? parsed : []
  },
  { immediate: true }
)

const selectedNoteId = ref<string | null>(null)
const detailsOpen = ref(false)

const noteFetch = await useFetch<NoteResponse>(
  () => (selectedNoteId.value ? `/api/notes/${selectedNoteId.value}` : null),
  { watch: [selectedNoteId] }
)
const selectedNote = computed(() => noteFetch.data.value?.data ?? null)
const selectedNotePending = computed(() => noteFetch.pending.value)
const selectedNoteError = computed(() => noteFetch.error.value)

const selectedNoteBlocks = computed(() =>
  selectedNote.value?.content ? (parseBlockNoteContent(selectedNote.value.content) ?? []) : []
)
const selectedNoteTitle = ref('')
watch(selectedNote, (n) => { selectedNoteTitle.value = n?.title ?? '' }, { immediate: true })
const selectedNoteTodos = computed(() => selectedNoteBlocks.value.flatMap((b) => b.todos ?? []))
const selectedNoteAgrees = computed(() => selectedNoteBlocks.value.flatMap((b) => b.agrees ?? []))
const isBlockNote = computed(() =>
  selectedNote.value?.content ? isBlockNoteContent(selectedNote.value.content) : false
)

function selectNote(noteId: string) {
  selectedNoteId.value = noteId
}

const savingProject = ref(false)
async function saveProject() {
  if (!projectNote.value) return
  savingProject.value = true
  try {
    await $fetch(`/api/notes/${projectId.value}`, {
      method: 'PUT',
      body: {
        title: projectTitle.value.trim() || 'Untitled project',
        content: serializeProjectOutlineV2(outlineNodes.value),
      },
    })
    await refresh()
  } finally {
    savingProject.value = false
  }
}

async function createNoteAndGetId(title: string): Promise<{ _id: string } | null> {
  const res = await $fetch<NoteResponse>('/api/notes', {
    method: 'POST',
    body: { title: title || 'Untitled', tags: [] },
  })
  const id = res?.data?._id
  return id ? { _id: id } : null
}

async function addRootNode() {
  const created = await createNoteAndGetId('Untitled')
  if (!created) return
  const newNode = createProjectOutlineNode(created._id, 'Untitled')
  outlineNodes.value = [...outlineNodes.value, newNode]
  await saveProject()
  selectedNoteId.value = created._id
}

async function addChildNode(path: number[]) {
  const created = await createNoteAndGetId('Untitled')
  if (!created) return
  const newNode = createProjectOutlineNode(created._id, 'Untitled')
  outlineNodes.value = insertAtPathV2(outlineNodes.value, path, 0, newNode)
  await saveProject()
  selectedNoteId.value = created._id
}

async function onSelectedNoteSaved(updated: Note) {
  const path = getPathOfNoteIdV2(outlineNodes.value, updated._id)
  if (path != null) {
    const node = getNodeAtPathV2(outlineNodes.value, path)
    if (node && (updated.title || '') !== (node.title ?? '')) {
      outlineNodes.value = setNodeAtPathV2(outlineNodes.value, path, (n) => ({ ...n, title: updated.title || 'Untitled' }))
      saveProject()
    }
  }
  await noteFetch.refresh()
}

async function onOutlineTitleUpdate(path: number[], title: string) {
  const node = getNodeAtPathV2(outlineNodes.value, path)
  if (!node) return
  outlineNodes.value = setNodeAtPathV2(outlineNodes.value, path, (n) => ({ ...n, title }))
  await $fetch(`/api/notes/${node.noteId}`, { method: 'PUT', body: { title } })
  await saveProject()
}
</script>
