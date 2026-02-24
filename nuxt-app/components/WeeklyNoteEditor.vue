<template>
  <form @submit.prevent="submit" class="flex w-full gap-6">
    <div class="min-w-0 flex-1 space-y-4">
      <div class="space-y-8">
        <section
          v-for="(block, index) in blocks"
          :key="block.id"
          class="rounded-lg bg-white shadow-sm p-4 space-y-3"
          :class="{ 'min-h-[75vh]': isDefaultNewBlock && index === 0 }"
        >
          <div class="flex items-center gap-2">
            <UInput
              v-if="isEditMode"
              v-model="block.title"
              placeholder="Block title (optional)"
              variant="none"
              class="min-w-0 flex-1 rounded-none px-0 font-semibold border-b border-black"
            />
            <span
              v-else
              class="min-w-0 flex-1 font-semibold border-b border-black pb-1"
            >
              {{ block.title || ' ' }}
            </span>
<UButton
            v-if="isEditMode && blocks.length > 1"
            type="button"
            variant="ghost"
            color="red"
            icon="i-heroicons-trash"
            square
            @click="removeBlock(index)"
            />
          </div>
          <RichTextEditor
            v-if="isEditMode"
            :model-value="block.content"
            :placeholder="index === 0 ? blockPlaceholder : 'Add content… Use /todo or /agree for tasks and agreements.'"
            class="min-w-0"
            @update:model-value="setBlockContent(index, $event)"
          />
          <div
            v-else
            class="min-h-[120px] px-3 py-2 prose prose-sm max-w-none min-w-0 [&_.ProseMirror]:min-h-[100px]"
            v-html="highlightTodoAgree(block.content)"
          />
          <div v-if="block.todos.length" class="ml-1 border-l-2 border-gray-300 pl-4 space-y-2">
            <label
              v-for="todo in block.todos"
              :key="todo.id"
              class="flex cursor-pointer items-start gap-3 rounded-md py-1.5 pr-2 hover:bg-gray-100/80"
            >
              <UCheckbox
                :model-value="todo.checked"
                @update:model-value="(v: boolean) => setTodoChecked(index, todo.id, v)"
              />
              <span
                :class="todo.checked ? 'text-gray-500 line-through text-sm' : 'text-sm'"
              >
                {{ todo.text }}
              </span>
            </label>
          </div>
          <div v-if="blockAgrees(block).length" class="ml-1 border-l-2 border-gray-300 pl-4 space-y-2">
            <div
              v-for="agree in blockAgrees(block)"
              :key="agree.id"
              class="flex items-start gap-3 py-1.5"
            >
              <UIcon name="i-lucide-handshake" class="mt-0.5 size-4 shrink-0 text-gray-500" />
              <span class="text-sm">{{ agree.text }}</span>
            </div>
          </div>
        </section>

        <div v-if="isEditMode" class="flex items-center gap-4">
          <div class="h-px flex-1 bg-gray-200" />
          <UButton
            type="button"
            variant="outline"
            trailing-icon="i-heroicons-plus"
            @click="addBlock"
          >
            Add block
          </UButton>
          <div class="h-px flex-1 bg-gray-200" />
        </div>
      </div>

      <div
        class="sticky bottom-0 z-30 flex w-full justify-end gap-2 border-t border-gray-200/50 bg-transparent backdrop-blur-sm p-2 -mx-1 rounded-b-lg"
      >
        <template v-if="isPublished && !isEditMode">
          <span
            class="inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium bg-emerald-100 text-emerald-800"
          >
            <UIcon name="i-lucide-check-circle" class="size-4" />
            Published
          </span>
          <UButton type="button" variant="solid" @click="$emit('startEdit')">
            Edit
          </UButton>
        </template>
        <template v-else>
          <UButton type="submit" :loading="loading">
            {{ note ? 'Save' : 'Create' }}
          </UButton>
          <UButton
            v-if="note && !isPublished"
            type="button"
            variant="outline"
            :loading="publishLoading"
            @click="publish"
          >
            Publish
          </UButton>
          <UButton type="button" variant="outline" @click="$emit('cancel')">
            Cancel
          </UButton>
        </template>
      </div>
    </div>
    <ClientOnly>
      <Teleport to="#details-panel-target" v-if="detailsOpenSynced && isEditMode">
        <aside class="w-full min-w-0 shrink-0 md:max-w-72">
          <div class="space-y-4">
            <h3 class="text-sm font-semibold text-gray-900">Details</h3>
            <UFormField label="Location">
              <USelectMenu
                v-model="form.location_id"
                :items="locationOptions"
                value-key="value"
                placeholder="Select location"
                @update:model-value="form.team_id = ''"
              />
            </UFormField>
            <UFormField label="Team">
              <USelectMenu
                v-model="form.team_id"
                :items="teamOptions"
                value-key="value"
                placeholder="Select team"
                :disabled="!form.location_id"
              />
            </UFormField>
            <UFormField label="Member">
              <USelectMenu
                v-model="form.member_id"
                :items="memberOptions"
                value-key="value"
                placeholder="Select member"
              />
            </UFormField>
            <UFormField label="Tags">
              <UInput
                v-model="form.tags"
                placeholder="tag1, tag2"
              />
            </UFormField>
            <div class="flex items-center gap-2">
              <UCheckbox v-model="form.is_pinned" />
              <span class="text-sm">Pin note</span>
            </div>
          </div>
        </aside>
      </Teleport>
    </ClientOnly>
  </form>
</template>

<script setup lang="ts">
import type { Note, NoteResponse } from '~/types/note'
import type { NoteBlock } from '~/types/noteBlock'
import {
  createEmptyBlock,
  parseBlockNoteContent,
  serializeBlockNoteContent,
} from '~/types/noteBlock'
import { getWeeklyTemplateBlocks, getWeeklyNoteTitle } from '~/lib/templates/weeklyNoteTemplate'
import { parseBlockTodos, parseBlockAgrees } from '~/lib/utils/blockTodoParser'

const props = defineProps<{
  note?: Note | null
  /** When note is published: false = view mode (Edit button, read-only), true = edit mode. Ignored when draft/new. */
  editing?: boolean
  initialTemplate?: 'weekly'
  externalTitle?: string
  detailsOpen?: boolean
}>()

const emit = defineEmits<{
  saved: [note: Note]
  cancel: []
  startEdit: []
  'update:detailsOpen': [value: boolean]
}>()

const isPublished = computed(() => props.note?.status === 'published')
const isEditMode = computed(
  () => !props.note || props.note.status !== 'published' || props.editing !== false
)

const { isCollapsed: sidebarCollapsed } = useSidebar()

function connectedToId(ct: Note['connected_to'], key: 'location_id' | 'team_id' | 'member_id'): string {
  const v = ct?.[key]
  if (!v) return ''
  return typeof v === 'string' ? v : (v as { _id: string })._id
}

const form = reactive({
  title: props.note?.title ?? (props.initialTemplate === 'weekly' ? getWeeklyNoteTitle() : ''),
  location_id: connectedToId(props.note?.connected_to, 'location_id'),
  team_id: connectedToId(props.note?.connected_to, 'team_id'),
  member_id: connectedToId(props.note?.connected_to, 'member_id'),
  tags: (props.note?.tags ?? []).join(', '),
  is_pinned: props.note?.is_pinned ?? false,
})

watch(
  () => props.externalTitle,
  (v) => {
    if (v !== undefined && v !== null) form.title = v
  },
  { immediate: true }
)
watch(
  () => props.note?.connected_to,
  (ct) => {
    if (!ct) return
    form.location_id = connectedToId(ct, 'location_id')
    form.team_id = connectedToId(ct, 'team_id')
    form.member_id = connectedToId(ct, 'member_id')
  },
  { immediate: true }
)

const locations = ref<{ _id: string; name: string }[]>([])
const teams = ref<{ _id: string; name: string; location_id?: unknown }[]>([])
const members = ref<{ _id: string; name: string }[]>([])

onMounted(async () => {
  const [locRes, teamRes, memRes] = await Promise.all([
    $fetch<{ success: boolean; data: { _id: string; name: string }[] }>('/api/locations'),
    $fetch<{ success: boolean; data: { _id: string; name: string; location_id?: unknown }[] }>('/api/teams'),
    $fetch<{ success: boolean; data: { _id: string; name: string }[] }>('/api/members'),
  ])
  if (locRes.success && locRes.data) locations.value = locRes.data
  if (teamRes.success && teamRes.data) teams.value = teamRes.data
  if (memRes.success && memRes.data) members.value = memRes.data
})

const locationOptions = computed(() => [
  { label: 'None', value: '' },
  ...locations.value.map((l) => ({ label: l.name, value: l._id })),
])
const teamOptions = computed(() => {
  const locId = form.location_id
  const list = !locId
    ? teams.value
    : teams.value.filter((t) => {
        const tid = t.location_id
        if (!tid) return false
        const idStr = typeof tid === 'string' ? tid : (tid as { _id?: string })?._id ?? String(tid)
        return idStr === locId
      })
  return [{ label: 'None', value: '' }, ...list.map((t) => ({ label: t.name, value: t._id }))]
})
const memberOptions = computed(() => [
  { label: 'None', value: '' },
  ...members.value.map((m) => ({ label: m.name, value: m._id })),
])

const blocks = ref<NoteBlock[]>([])
/** Single empty block on new note (no template): give first block ~75% height */
const isDefaultNewBlock = computed(
  () => !props.note && blocks.value.length === 1
)

function initBlocks() {
  if (props.initialTemplate === 'weekly' && !props.note) {
    blocks.value = getWeeklyTemplateBlocks()
    return
  }
  if (props.note?.content) {
    const parsed = parseBlockNoteContent(props.note.content)
    if (parsed?.length) {
      blocks.value = parsed
      return
    }
  }
  blocks.value = [createEmptyBlock()]
}

onMounted(initBlocks)
watch(() => [props.note?._id, props.initialTemplate], initBlocks, { immediate: false })

const blockPlaceholder = 'Write your note… Use @todo … @Todo ends or /todo for tasks, /agree for agreements. Add blocks with the button below.'

function slugFromTitle(title: string): string {
  const t = (title || 'untitled').trim().toLowerCase()
  return t
    .replace(/[^\w\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '') || 'untitled'
}

/** Wrap /todo and /agree phrases in HTML with highlight classes for published view mode. */
function highlightTodoAgree(html: string): string {
  if (!html) return ''
  return html
    .replace(
      /(\/todo\s+[^<\n]*)/gi,
      '<mark class="bg-amber-100 text-amber-900 rounded px-0.5">$1</mark>'
    )
    .replace(
      /(\/agree\s+[^<\n]*)/gi,
      '<mark class="bg-emerald-100 text-emerald-900 rounded px-0.5">$1</mark>'
    )
}

function blockAgrees(block: NoteBlock) {
  return block.agrees ?? []
}

function setBlockContent(index: number, content: string) {
  blocks.value = blocks.value.map((b, i) => {
    if (i !== index) return b
    const todos = parseBlockTodos(content, b.todos)
    const agrees = parseBlockAgrees(content, b.agrees ?? [])
    return { ...b, content, todos, agrees }
  })
}

function setTodoChecked(blockIndex: number, todoId: string, checked: boolean) {
  blocks.value = blocks.value.map((b, i) => {
    if (i !== blockIndex) return b
    return {
      ...b,
      todos: b.todos.map((t) => (t.id === todoId ? { ...t, checked } : t)),
    }
  })
}

function removeBlock(index: number) {
  if (blocks.value.length <= 1) return
  blocks.value = blocks.value.filter((_, i) => i !== index)
}

function addBlock() {
  blocks.value = [...blocks.value, createEmptyBlock()]
}

const loading = ref(false)
const publishLoading = ref(false)
const detailsOpenInternal = ref(false)
const detailsOpenSynced = computed({
  get: () => props.detailsOpen ?? detailsOpenInternal.value,
  set: (v: boolean) => {
    if (props.detailsOpen !== undefined) emit('update:detailsOpen', v)
    else detailsOpenInternal.value = v
  },
})

async function submit() {
  // Flush editor content (blur so any pending update is emitted)
  ;(document.activeElement as HTMLElement)?.blur()
  await nextTick()
  const title = (props.externalTitle !== undefined && props.externalTitle !== null ? props.externalTitle : form.title).trim() || 'Untitled'
  // Re-parse todos and agrees from current block content so we never persist stale state
  const normalized = blocks.value.map((b) => ({
    ...b,
    todos: parseBlockTodos(b.content, b.todos),
    agrees: parseBlockAgrees(b.content, b.agrees ?? []),
  }))
  blocks.value = normalized
  const content = serializeBlockNoteContent(blocks.value)
  const tags = form.tags
    .split(',')
    .map((t) => t.trim())
    .filter(Boolean)
  loading.value = true
  try {
    if (props.note) {
      const res = await $fetch<NoteResponse>(`/api/notes/${props.note._id}`, {
        method: 'PUT',
        body: {
        title,
        slug: slugFromTitle(title),
        content,
        tags,
        is_pinned: form.is_pinned,
        location_id: form.location_id || undefined,
        team_id: form.team_id || undefined,
        member_id: form.member_id || undefined,
      },
      })
      if (res.success && res.data) emit('saved', res.data)
    } else {
      const res = await $fetch<NoteResponse>('/api/notes', {
        method: 'POST',
        body: {
        title,
        content,
        tags,
        is_pinned: form.is_pinned,
        location_id: form.location_id || undefined,
        team_id: form.team_id || undefined,
        member_id: form.member_id || undefined,
      },
      })
      if (res.success && res.data) emit('saved', res.data)
    }
  } finally {
    loading.value = false
  }
}

async function publish() {
  if (!props.note) return
  publishLoading.value = true
  try {
    const res = await $fetch<NoteResponse>(`/api/notes/${props.note._id}`, {
      method: 'PUT',
      body: { status: 'published' },
    })
    if (res.success && res.data) emit('saved', res.data)
  } finally {
    publishLoading.value = false
  }
}
</script>
