<!--
/**
 * @registry-id: ProjectOutlineNodeRow
 * @created: 2026-03-02T00:00:00.000Z
 * @last-modified: 2026-03-02T00:00:00.000Z
 * @description: Individual outline node row component with drag-n-drop and edit capabilities
 * @last-fix: [2026-03-02] Initial component creation
 * @exports-to:
 * ✓ nuxt-app/components/ProjectOutlineEditor.vue => ProjectOutlineNodeRow for rendering each node
 */
-->
<template>
  <div class="outline-node">
    <div
      v-if="path.length > 0"
      class="drop-zone drop-before h-1 -mb-0.5 rounded transition-colors"
      :class="{ 'bg-primary/30': isDropTargetBefore }"
      :data-path-before="pathStr"
      @dragover.prevent="setDropTarget(true, false)"
      @dragleave="clearDropTarget"
      @drop="onDropBefore"
    />
    <div
      class="group flex items-center gap-1 py-0.5 rounded hover:bg-gray-100 min-h-8 drop-zone"
      :style="{ paddingLeft: `${depth * 20 + 4}px` }"
      :class="{ 'bg-gray-50': isSelected, 'ring-1 ring-primary/50': isDropTargetChild }"
      :data-path="pathStr"
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
        :value="node.title"
        type="text"
        class="min-w-0 flex-1 bg-transparent border-0 border-b border-transparent rounded-none px-1 py-0.5 text-sm focus:border-gray-300 focus:outline-none"
        placeholder="New item..."
        @input="onTitleInput($event)"
        @keydown.tab.prevent="indent"
        @keydown.shift.tab.prevent="outdent"
        @keydown.enter.exact.prevent="addSiblingBelow"
        @click.stop
      />
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
    <div
      v-if="isSelected"
      class="node-editor pl-8 pr-2 py-2 border-l-2 border-gray-200 ml-2 my-1 rounded-r bg-white"
      @click.stop
    >
      <RichTextEditor
        :model-value="node.content"
        placeholder="Add details..."
        class="min-h-[80px]"
        @update:model-value="onContentInput"
      />
    </div>
    <template v-if="isExpanded && node.children.length">
      <ProjectOutlineNodeRow
        v-for="(child, i) in node.children"
        :key="child.id"
        :node="child"
        :depth="depth + 1"
        :path="[...path, i]"
        :expanded-ids="expandedIds"
        :selected-id="selectedId"
        :can-delete="true"
        @update:title="(p, v) => $emit('update:title', p, v)"
        @update:content="(p, v) => $emit('update:content', p, v)"
        @toggle-expand="(id) => $emit('toggle-expand', id)"
        @select="(id) => $emit('select', id)"
        @indent="(p) => $emit('indent', p)"
        @outdent="(p) => $emit('outdent', p)"
        @add-sibling-below="(p) => $emit('add-sibling-below', p)"
        @delete-node="(p) => $emit('delete-node', p)"
        @drag-start="(e, n, p) => $emit('drag-start', e, n, p)"
        @drop-on="(e, targetPath, asChild) => $emit('drop-on', e, targetPath, asChild)"
      />
    </template>
  </div>
</template>

<script setup lang="ts">
import type { OutlineNode } from '~/types/projectOutline'

const props = withDefaults(
  defineProps<{
    node: OutlineNode
    depth: number
    path: number[]
    expandedIds: Set<string>
    selectedId: string | null
    canDelete?: boolean
  }>(),
  { canDelete: false }
)

const emit = defineEmits<{
  'update:title': [path: number[], value: string]
  'update:content': [path: number[], value: string]
  'toggle-expand': [id: string]
  select: [id: string]
  indent: [path: number[]]
  outdent: [path: number[]]
  'add-sibling-below': [path: number[]]
  'delete-node': [path: number[]]
  'drag-start': [e: DragEvent, node: OutlineNode, path: number[]]
  'drop-on': [toParentPath: number[], toIndex: number]
}>()

const pathStr = computed(() => JSON.stringify(props.path))
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

function onDropBefore(e: DragEvent) {
  e.preventDefault()
  clearDropTarget()
  if (props.path.length === 0) return
  const toParentPath = props.path.slice(0, -1)
  const toIndex = props.path[props.path.length - 1]
  emit('drop-on', toParentPath, toIndex)
}

function onDropChild(e: DragEvent) {
  e.preventDefault()
  clearDropTarget()
  emit('drop-on', props.path, 0)
}

const isExpanded = computed(() => props.expandedIds.has(props.node.id))
const isSelected = computed(() => props.selectedId === props.node.id)

function select() {
  emit('select', props.node.id)
}

function toggleExpand() {
  emit('toggle-expand', props.node.id)
}

function onTitleInput(ev: Event) {
  const v = (ev.target as HTMLInputElement).value
  emit('update:title', props.path, v)
}

function onContentInput(value: string) {
  emit('update:content', props.path, value)
}

function indent() {
  emit('indent', props.path)
}

function outdent() {
  emit('outdent', props.path)
}

function addSiblingBelow() {
  emit('add-sibling-below', props.path)
}

function deleteNode() {
  emit('delete-node', props.path)
}

function onDragStart(e: DragEvent) {
  if (e.dataTransfer) {
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('application/x-outline-path', JSON.stringify(props.path))
  }
  emit('drag-start', e, props.node, props.path)
}
</script>
