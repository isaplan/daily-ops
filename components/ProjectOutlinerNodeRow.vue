<!--
/**
 * @registry-id: ProjectOutlinerNodeRow
 * @created: 2026-03-02T00:00:00.000Z
 * @last-modified: 2026-03-02T00:00:00.000Z
 * @description: Individual outline node row component for ProjectOutliner display
 * @last-fix: [2026-03-02] Initial component creation
 * @exports-to:
 * ✓ nuxt-app/components/ProjectOutliner.vue => ProjectOutlinerNodeRow for rendering each note node
 */
-->
<template>
  <div class="outline-node">
    <div
      v-if="path.length > 0"
      class="drop-zone drop-before h-1 -mb-0.5 rounded transition-colors"
      :class="{ 'bg-primary/30': isDropTargetBefore }"
      @dragover.prevent="setDropTarget(true, false)"
      @dragleave="clearDropTarget"
      @drop="onDropBefore"
    />
    <div
      class="group flex items-center gap-1 py-1 rounded hover:bg-gray-100 min-h-8 drop-zone cursor-pointer"
      :style="{ paddingLeft: `${depth * 20 + 4}px` }"
      :class="{ 'bg-gray-200': isSelected, 'ring-1 ring-primary/50': isDropTargetChild }"
      @click="select"
      @dragover.prevent="setDropTarget(false, true)"
      @dragleave="clearDropTarget"
      @drop="onDropChild"
    >
      <button
        v-if="node.children.length > 0"
        type="button"
        class="shrink-0 p-0.5 rounded opacity-60 hover:opacity-100 text-gray-500"
        aria-label="Expand/collapse"
        @click.stop="toggleExpand"
      >
        <UIcon
          :name="isExpanded ? 'i-lucide-chevron-down' : 'i-lucide-chevron-right'"
          class="size-4"
        />
      </button>
      <span v-else class="shrink-0 w-5 inline-block" aria-hidden="true" />
      <span
        class="shrink-0 cursor-grab active:cursor-grabbing p-0.5 rounded text-gray-400 hover:text-gray-600 touch-none"
        aria-label="Drag"
        draggable="true"
        @dragstart="onDragStart"
        @click.stop
      >
        <UIcon name="i-lucide-grip-vertical" class="size-4" />
      </span>
      <input
        v-if="editingTitle"
        ref="titleInputEl"
        v-model="editTitleValue"
        type="text"
        class="min-w-0 flex-1 text-sm border border-primary rounded px-1 py-0.5 bg-white outline-none"
        @blur="commitTitleEdit"
        @keydown.enter="commitTitleEdit"
        @keydown.escape="cancelTitleEdit"
      >
      <span
        v-else
        class="min-w-0 flex-1 truncate text-sm cursor-text select-text"
        @dblclick.stop="startTitleEdit"
      >{{ node.title || 'Untitled' }}</span>
      <button
        type="button"
        class="shrink-0 p-0.5 rounded opacity-0 group-hover:opacity-100 text-gray-400 hover:text-gray-600"
        aria-label="Add child"
        @click.stop="addChild"
      >
        <UIcon name="i-lucide-plus" class="size-3.5" />
      </button>
      <button
        v-if="canDelete"
        type="button"
        class="shrink-0 p-0.5 rounded opacity-0 group-hover:opacity-100 text-gray-400 hover:text-red-600"
        aria-label="Delete"
        @click.stop="deleteNode"
      >
        <UIcon name="i-lucide-trash-2" class="size-3.5" />
      </button>
    </div>
    <template v-if="isExpanded && node.children.length">
      <ProjectOutlinerNodeRow
        v-for="(child, i) in node.children"
        :key="child.noteId"
        :node="child"
        :depth="depth + 1"
        :path="[...path, i]"
        :expanded-ids="expandedIds"
        :selected-note-id="selectedNoteId"
        :can-delete="true"
        @select="(id) => $emit('select', id)"
        @toggle-expand="(id) => $emit('toggle-expand', id)"
        @add-child="(p) => $emit('add-child', p)"
        @delete-node="(p) => $emit('delete-node', p)"
        @drag-start="(e, p) => $emit('drag-start', e, p)"
        @drop-on="(toParent, toIdx) => $emit('drop-on', toParent, toIdx)"
        @update:title="(p, t) => $emit('update:title', p, t)"
      />
    </template>
  </div>
</template>

<script setup lang="ts">
import type { ProjectOutlineNode } from '~/types/projectOutline'

const props = withDefaults(
  defineProps<{
    node: ProjectOutlineNode
    depth: number
    path: number[]
    expandedIds: Set<string>
    selectedNoteId: string | null
    canDelete?: boolean
  }>(),
  { canDelete: false }
)

const emit = defineEmits<{
  select: [noteId: string]
  'toggle-expand': [noteId: string]
  'add-child': [path: number[]]
  'delete-node': [path: number[]]
  'drag-start': [e: DragEvent, path: number[]]
  'drop-on': [toParentPath: number[], toIndex: number]
  'update:title': [path: number[], title: string]
}>()

const editingTitle = ref(false)
const editTitleValue = ref('')
const titleInputEl = ref<HTMLInputElement | null>(null)

function startTitleEdit() {
  editTitleValue.value = props.node.title || 'Untitled'
  editingTitle.value = true
  nextTick(() => titleInputEl.value?.focus())
}

function commitTitleEdit() {
  if (!editingTitle.value) return
  editingTitle.value = false
  const t = editTitleValue.value.trim() || 'Untitled'
  if (t !== (props.node.title || 'Untitled')) {
    emit('update:title', props.path, t)
  }
}

function cancelTitleEdit() {
  editingTitle.value = false
}

function addChild() {
  emit('add-child', props.path)
}

const isExpanded = computed(() => props.expandedIds.has(props.node.noteId))
const isSelected = computed(() => props.selectedNoteId === props.node.noteId)
const isDropTargetBefore = ref(false)
const isDropTargetChild = ref(false)

function setDropTarget(before: boolean, child: boolean) {
  isDropTargetBefore.value = before
  isDropTargetChild.value = child
}

function clearDropTarget() {
  isDropTargetBefore.value = false
  isDropTargetChild.value = false
}

function select() {
  emit('select', props.node.noteId)
}

function toggleExpand() {
  emit('toggle-expand', props.node.noteId)
}

function deleteNode() {
  emit('delete-node', props.path)
}

function onDragStart(e: DragEvent) {
  if (e.dataTransfer) {
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('application/x-outline-path', JSON.stringify(props.path))
  }
  emit('drag-start', e, props.path)
}

function onDropBefore() {
  clearDropTarget()
  if (props.path.length === 0) return
  const toParentPath = props.path.slice(0, -1)
  const toIndex = props.path[props.path.length - 1] ?? 0
  emit('drop-on', toParentPath, toIndex)
}

function onDropChild() {
  clearDropTarget()
  emit('drop-on', props.path, 0)
}
</script>
