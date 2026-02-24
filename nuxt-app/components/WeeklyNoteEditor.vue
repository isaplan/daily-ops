<template>
  <form @submit.prevent="onSaveClick" class="flex w-full gap-6">
    <div class="min-w-0 flex-1 space-y-4">
      <div class="space-y-8">
        <section
          v-for="(block, index) in blocks"
          :key="block.id"
          class="rounded-lg bg-white shadow-sm p-4 space-y-3"
        >
          <div class="flex items-center gap-2">
            <UInput
              v-model="block.title"
              placeholder="Block title (optional)"
              variant="none"
              class="min-w-0 flex-1 rounded-none px-0 font-semibold border-b border-black"
            />
            <UButton
              v-if="blocks.length > 1"
              type="button"
              variant="ghost"
              color="error"
              icon="i-heroicons-trash"
              square
              @click="removeBlock(index)"
            />
          </div>
          <RichTextEditor
            :model-value="block.content"
            :placeholder="index === 0 ? blockPlaceholder : 'Add content… Use /todo or /agree for tasks and agreements.'"
            class="min-w-0"
            @update:model-value="setBlockContent(index, $event)"
          />
          <div v-if="block.todos.length" class="ml-1 border-l-2 border-gray-300 pl-4 space-y-2">
            <label
              v-for="todo in block.todos"
              :key="todo.id"
              class="flex cursor-pointer items-start gap-3 rounded-md py-1.5 pr-2 hover:bg-gray-100/80"
            >
              <UCheckbox
                :model-value="todo.checked"
                @update:model-value="(v) => setTodoChecked(index, todo.id, v === true)"
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

        <div class="flex items-center gap-4">
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
        <UButton type="submit" :loading="loading">
          {{ note ? 'Save' : 'Create' }}
        </UButton>
        <UButton
          v-if="note && note.status !== 'published'"
          type="button"
          :loading="loading"
          @click="onPublishClick"
        >
          Publish
        </UButton>
        <UButton type="button" variant="outline" @click="$emit('cancel')">
          Cancel
        </UButton>
      </div>
    </div>
    <ClientOnly>
      <!-- ASIDE_DETAILS_PANEL_SPOT: Note aside (location, team, members, tags, visible_to_same_team, etc.) -->
      <Teleport to="#details-panel-target" v-if="detailsOpenSynced">
        <aside class="w-full min-w-0 shrink-0 md:max-w-72">
          <div class="space-y-4">
            <h3 class="text-sm font-semibold text-gray-900">Details</h3>
            <div class="grid grid-cols-2 gap-3">
              <UFormField label="Location">
                <USelectMenu
                  v-model="selectedLocationOption"
                  :items="locationOptions"
                  by="value"
                  placeholder="Select location"
                  @update:model-value="onLocationChange"
                />
              </UFormField>
              <UFormField label="Team">
                <USelectMenu
                  v-model="selectedTeamOption"
                  :items="teamOptions"
                  by="value"
                  placeholder="Select team"
                  :disabled="!form.location_id"
                />
              </UFormField>
            </div>
            <UFormField label="Attending">
              <div class="flex flex-col gap-1.5">
                <USelectMenu
                  v-model="attendingAddId"
                  :items="attendingCandidates"
                  value-key="value"
                  placeholder="Add attending…"
                  @update:model-value="addAttending"
                />
                <div class="flex flex-wrap gap-1.5">
                  <span
                    v-for="id in form.attending_ids"
                    :key="id"
                    class="inline-flex items-center gap-1 rounded-md bg-gray-100 px-2 py-1 text-sm"
                  >
                    {{ attendingLabel(id) }}
                    <button
                      type="button"
                      class="rounded p-0.5 hover:bg-gray-200"
                      aria-label="Remove"
                      @click="removeAttending(id)"
                    >
                      <UIcon name="i-lucide-x" class="size-3.5" />
                    </button>
                  </span>
                </div>
              </div>
            </UFormField>
            <UFormField v-if="mentionedMembers.length" label="Mentioned">
              <ul class="flex flex-wrap gap-1.5">
                <li
                  v-for="m in mentionedMembers"
                  :key="m._id"
                  class="inline-flex items-center rounded-md bg-amber-50 px-2 py-1 text-xs text-amber-900"
                >
                  {{ m.canonicalName }}
                </li>
              </ul>
            </UFormField>
            <UFormField label="Tags">
              <div class="flex flex-col gap-1.5">
                <UInput
                  v-model="tagInputBuffer"
                  placeholder="Type tag and press Enter"
                  class="min-w-0"
                  @keydown.enter.prevent="addCurrentTag"
                />
                <div class="flex flex-wrap gap-1.5">
                  <span
                    v-for="tag in allTags"
                    :key="tag"
                    class="inline-flex items-center gap-1 rounded-md bg-gray-100 px-2 py-1 text-sm"
                  >
                    #{{ tag }}
                    <button
                      type="button"
                      class="rounded p-0.5 hover:bg-gray-200"
                      aria-label="Remove tag"
                      @click="removeTag(tag)"
                    >
                      <UIcon name="i-lucide-x" class="size-3.5" />
                    </button>
                  </span>
                </div>
                <div v-if="tagSuggestionsFiltered.length" class="flex flex-wrap gap-1.5">
                  <UButton
                    v-for="s in tagSuggestionsFiltered"
                    :key="s"
                    size="xs"
                    variant="soft"
                    color="neutral"
                    @click="appendTag(s)"
                  >
                    #{{ s }}
                  </UButton>
                </div>
              </div>
            </UFormField>
            <div class="flex items-center gap-2">
              <UCheckbox v-model="form.visible_to_same_team_name" />
              <span class="text-sm">Visible to same team in other locations</span>
            </div>
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
  initialTemplate?: 'weekly'
  externalTitle?: string
  detailsOpen?: boolean
}>()

const emit = defineEmits<{
  saved: [note: Note]
  cancel: []
  'update:detailsOpen': [value: boolean]
}>()

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
  visible_to_same_team_name: props.note?.visible_to_same_team_name ?? false,
  attending_ids: [] as string[],
  tag_list: [...(props.note?.tags ?? [])],
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
  },
  { immediate: true }
)
watch(
  () => props.note?.visible_to_same_team_name,
  (v) => {
    if (v !== undefined && v !== null) form.visible_to_same_team_name = v
  },
  { immediate: true }
)
watch(
  () => props.note?.attending_members,
  (list) => {
    form.attending_ids = (list ?? []).map((m) => m._id)
  },
  { immediate: true }
)
watch(
  () => props.note?.tags,
  (t) => {
    const raw = Array.isArray(t) ? t : []
    form.tag_list = dedupeTags(raw)
  },
  { immediate: true }
)

const tagInputBuffer = ref('')
const locations = ref<{ _id: string; name: string }[]>([])
const teams = ref<{ _id: string; name: string; location_id?: unknown }[]>([])
const unifiedUsers = ref<{ _id: string; canonicalName: string; location_id?: string | null }[]>([])
const tagSuggestions = ref<string[]>([])
const attendingAddId = ref('')

function toOptionValue(v: unknown): string {
  if (v == null) return ''
  if (typeof v === 'string') return v
  const o = v as { value?: string; _id?: string }
  return (o.value ?? o._id ?? '') as string
}

type Option = { label: string; value: string }

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
const selectedLocationOption = computed({
  get: (): Option => locationOptions.value.find((o) => o.value === form.location_id) ?? locationOptions.value[0] ?? { label: 'None', value: '' },
  set: (v: unknown) => {
    form.location_id = toOptionValue(v)
  },
})
const selectedTeamOption = computed({
  get: (): Option => teamOptions.value.find((o) => o.value === form.team_id) ?? teamOptions.value[0] ?? { label: 'None', value: '' },
  set: (v: unknown) => {
    form.team_id = toOptionValue(v)
  },
})
function onLocationChange() {
  form.team_id = ''
}

/** Normalize for comparison: strip leading #, trim, lowercase. Same tag cannot be added twice. */
function canonicalTag(t: string): string {
  return t.replace(/^#+/, '').trim().toLowerCase()
}

function dedupeTags(tags: string[]): string[] {
  const seen = new Set<string>()
  return tags.filter((t) => {
    const c = canonicalTag(t)
    if (!c || seen.has(c)) return false
    seen.add(c)
    return true
  }).map((t) => t.replace(/^#+/, '').trim() || t)
}

/** #tags parsed from block content (shown in Details, included on save). */
const tagsFromContent = computed(() => collectTagsFromBlocks(blocks.value))

/** When user removes a tag that came only from content, we don't persist it. */
const tagsExcludedFromContent = ref<Set<string>>(new Set())

/** All tags to show in Details and to save: content tags (minus excluded) + manually added. */
const allTags = computed(() => {
  const fromContent = tagsFromContent.value.filter((c) => !tagsExcludedFromContent.value.has(c))
  return dedupeTags([...fromContent, ...form.tag_list])
})

const existingTagsSet = computed(() => new Set(allTags.value.map((t) => canonicalTag(t)).filter(Boolean)))

/** Autocomplete: suggest existing tags (from API) while typing; only show tags not already on the note. */
const tagSuggestionsFiltered = computed(() => {
  const prefix = canonicalTag(tagInputBuffer.value)
  const existing = existingTagsSet.value
  if (!prefix) return tagSuggestions.value.filter((t) => !existing.has(canonicalTag(t))).slice(0, 12)
  return tagSuggestions.value
    .filter((t) => {
      const c = canonicalTag(t)
      return !existing.has(c) && c.startsWith(prefix)
    })
    .slice(0, 12)
})

function addCurrentTag() {
  const raw = tagInputBuffer.value.trim()
  const c = canonicalTag(raw)
  if (!c) {
    tagInputBuffer.value = ''
    return
  }
  if (existingTagsSet.value.has(c)) {
    tagInputBuffer.value = ''
    return
  }
  form.tag_list = [...form.tag_list, raw.replace(/^#+/, '').trim() || raw]
  tagInputBuffer.value = ''
}

function appendTag(tag: string) {
  const c = canonicalTag(tag)
  if (!c || existingTagsSet.value.has(c)) return
  form.tag_list = [...form.tag_list, tag.replace(/^#+/, '').trim() || tag]
}

function removeTag(tag: string) {
  const c = canonicalTag(tag)
  if (!c) return
  const inForm = form.tag_list.some((x) => canonicalTag(x) === c)
  if (inForm) {
    form.tag_list = form.tag_list.filter((x) => canonicalTag(x) !== c)
  } else {
    tagsExcludedFromContent.value = new Set([...tagsExcludedFromContent.value, c])
  }
}

onMounted(async () => {
  const [locRes, teamRes, tagRes, unifiedRes] = await Promise.all([
    $fetch<{ success: boolean; data: { _id: string; name: string }[] }>('/api/locations'),
    $fetch<{ success: boolean; data: { _id: string; name: string; location_id?: unknown }[] }>('/api/teams'),
    $fetch<{ success: boolean; data: string[] }>('/api/tags').catch(() => ({ success: false, data: [] })),
    $fetch<{ success: boolean; data: { _id: string; canonicalName: string; location_id?: string | null }[] }>('/api/unified-users').catch(() => ({ success: false, data: [] })),
  ])
  if (locRes.success && locRes.data) locations.value = locRes.data
  if (teamRes.success && teamRes.data) teams.value = teamRes.data
  if (tagRes.success && tagRes.data) tagSuggestions.value = tagRes.data
  if (unifiedRes.success && unifiedRes.data) unifiedUsers.value = unifiedRes.data
  if (locations.value.length === 1 && !form.location_id) {
    const first = locations.value[0]
    if (first) form.location_id = first._id
  }
})

const attendingCandidates = computed(() => {
  const added = new Set(form.attending_ids)
  const locId = (form.location_id && String(form.location_id).trim()) || null
  const available = unifiedUsers.value.filter((u) => !added.has(u._id))
  const norm = (id: string | null | undefined) => (id == null || id === '') ? null : String(id).trim()
  const sameLocation = available
    .filter((u) => norm(u.location_id) === locId)
    .sort((a, b) => a.canonicalName.localeCompare(b.canonicalName, undefined, { sensitivity: 'base' }))
    .map((u) => ({ label: u.canonicalName, value: u._id }))
  const other = available
    .filter((u) => norm(u.location_id) !== locId)
    .sort((a, b) => a.canonicalName.localeCompare(b.canonicalName, undefined, { sensitivity: 'base' }))
    .map((u) => ({ label: u.canonicalName, value: u._id }))
  const sep = { type: 'separator' as const, label: '' }
  if (sameLocation.length === 0 && other.length === 0) return []
  if (sameLocation.length === 0) return other
  if (other.length === 0) return sameLocation
  return [...sameLocation, sep, ...other]
})

function attendingLabel(id: string): string {
  return unifiedUsers.value.find((u) => u._id === id)?.canonicalName ?? id.slice(-6)
}

function addAttending(v: unknown) {
  const id = toOptionValue(v)
  if (!id || form.attending_ids.includes(id)) return
  form.attending_ids = [...form.attending_ids, id]
  attendingAddId.value = ''
}

function removeAttending(id: string) {
  form.attending_ids = form.attending_ids.filter((x) => x !== id)
}

const blocks = ref<NoteBlock[]>([])

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
watch(() => [props.note?._id, props.initialTemplate], () => {
  tagsExcludedFromContent.value = new Set()
  initBlocks()
}, { immediate: false })

/** Collect @mention slugs from current blocks (content + todo text). */
function collectMentionSlugsFromBlocks(blockList: NoteBlock[]): string[] {
  const slugs = new Set<string>()
  for (const block of blockList) {
    const raw = (block.content ?? '').replace(/<[^>]+>/g, ' ')
    const matches = raw.match(/@([a-zA-Z0-9_-]+)/g)
    if (matches) for (const m of matches) { const s = m.slice(1).toLowerCase(); if (s !== 'todo') slugs.add(s) }
    for (const todo of block.todos ?? []) {
      const t = todo as { text?: string; assignedTo?: string }
      const slug = t.assignedTo ?? (t.text ?? '').match(/@([a-zA-Z0-9_-]+)/g)?.slice(-1)[0]?.slice(1).toLowerCase()
      if (slug && slug !== 'todo') slugs.add(slug)
    }
  }
  return [...slugs]
}

/** Collect #tag strings from current block content (same as @mentions: show in Details, persist on save). */
function collectTagsFromBlocks(blockList: NoteBlock[]): string[] {
  const tags = new Set<string>()
  for (const block of blockList) {
    const raw = (block.content ?? '').replace(/<[^>]+>/g, ' ')
    const matches = raw.match(/#([a-zA-Z0-9_-]+)/g)
    if (matches) for (const m of matches) { tags.add(canonicalTag(m.slice(1))) }
  }
  return [...tags].filter(Boolean)
}

const mentionedMembers = computed(() => {
  const fromNote = new Map<string, { _id: string; canonicalName: string }>((props.note?.mentioned_members ?? []).map((m) => [m._id, m]))
  const slugs = collectMentionSlugsFromBlocks(blocks.value)
  for (const slug of slugs) {
    const u = unifiedUsers.value.find(
      (x) =>
        (x.canonicalName?.toLowerCase() === slug) ||
        (x.canonicalName?.toLowerCase().replace(/\s+/g, '-') === slug) ||
        (x.canonicalName?.toLowerCase().split(/\s+/)[0] === slug)
    )
    if (u && !fromNote.has(u._id)) fromNote.set(u._id, { _id: u._id, canonicalName: u.canonicalName })
  }
  return Array.from(fromNote.values())
})

const blockPlaceholder = 'Write your note… Use @todo … @Todo ends or /todo for tasks, /agree for agreements. Add blocks with the button below.'

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
const publishAfterSave = ref(false)
const detailsOpenInternal = ref(false)
const detailsOpenSynced = computed({
  get: () => props.detailsOpen ?? detailsOpenInternal.value,
  set: (v: boolean) => {
    if (props.detailsOpen !== undefined) emit('update:detailsOpen', v)
    else detailsOpenInternal.value = v
  },
})

function onSaveClick() {
  publishAfterSave.value = false
  submit()
}

function onPublishClick() {
  publishAfterSave.value = true
  submit()
}

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
  const tags = allTags.value.filter((t) => t.trim() !== '')
  loading.value = true
  try {
    if (props.note) {
      const res = await $fetch<NoteResponse>(`/api/notes/${props.note._id}`, {
        method: 'PUT',
        body: {
          title,
          content,
          tags,
          visible_to_same_team_name: form.visible_to_same_team_name,
          attending_unified_user_ids: form.attending_ids,
          is_pinned: form.is_pinned,
          location_id: form.location_id || undefined,
          team_id: form.team_id || undefined,
        },
      })
      if (res.success && res.data) {
        if (publishAfterSave.value) {
          const published = await $fetch<NoteResponse>(`/api/notes/${props.note._id}`, {
            method: 'PUT',
            body: { status: 'published' },
          })
          if (published.success && published.data) {
            emit('saved', published.data)
          } else {
            emit('saved', res.data)
          }
        } else {
          emit('saved', res.data)
        }
        publishAfterSave.value = false
      }
    } else {
      const res = await $fetch<NoteResponse>('/api/notes', {
        method: 'POST',
        body: {
          title,
          content,
          tags,
          visible_to_same_team_name: form.visible_to_same_team_name,
          attending_unified_user_ids: form.attending_ids,
          is_pinned: form.is_pinned,
          location_id: form.location_id || undefined,
          team_id: form.team_id || undefined,
        },
      })
      if (res.success && res.data) emit('saved', res.data)
    }
  } finally {
    loading.value = false
  }
}
</script>
