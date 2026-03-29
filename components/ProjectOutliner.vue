<!--
/**
 * @registry-id: ProjectOutliner
 * @created: 2026-03-02T00:00:00.000Z
 * @last-modified: 2026-03-02T00:00:00.000Z
 * @description: Outliner component for displaying and managing project note hierarchy
 * @last-fix: [2026-03-02] Initial component creation
 * @exports-to:
 * ✓ nuxt-app/pages/notes/projects/[id].vue => ProjectOutliner for displaying project outline
 */
-->
<template>
  <div class="project-outliner flex flex-col h-full">
    <div class="flex-1 overflow-y-auto py-2">
      <div
        v-if="nodes.length"
        class="drop-zone h-2 rounded mb-1 transition-colors"
        :class="{ 'bg-primary/30': isDropTargetRoot }"
        @dragover.prevent="isDropTargetRoot = true"
        @dragleave="isDropTargetRoot = false"
        @drop="onDropAtRoot"
      />
      <ProjectOutlinerNodeRow
        v-for="(node, i) in nodes"
        :key="node.noteId"
        :node="node"
        :depth="0"
        :path="[i]"
        :expanded-ids="expandedIds"
        :selected-note-id="selectedNoteId"
        :can-delete="nodes.length > 1"
        @select="(id) => $emit('select', id)"
        @toggle-expand="toggleExpand"
        @add-child="(p) => $emit('add-child', p)"
        @delete-node="deleteNode"
        @drag-start="onDragStart"
        @drop-on="onDropOn"
        @update:title="(p, t) => $emit('update:title', p, t)"
      />
    </div>
    <div class="shrink-0 border-t border-gray-200 pt-2 mt-2">
      <UButton
        variant="outline"
        size="sm"
        icon="i-lucide-plus"
        class="w-full justify-center"
        @click="$emit('add-root')"
      >
        Add note
      </UButton>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { ProjectOutlineNode } from '~/types/projectOutline'
import { getNodeAtPathV2, removeNodeAtPathV2, insertAtPathV2, moveNodeV2 } from '~/types/projectOutline'

const props = defineProps<{
  modelValue: ProjectOutlineNode[]
  selectedNoteId: string | null
}>()

const emit = defineEmits<{
  'update:modelValue': [nodes: ProjectOutlineNode[]]
  select: [noteId: string]
  'add-root': []
  'add-child': [path: number[]]
  'update:title': [path: number[], title: string]
}>()

const nodes = computed({
  get: () => props.modelValue,
  set: (v: ProjectOutlineNode[]) => emit('update:modelValue', v),
})

const expandedIds = ref<Set<string>>(new Set())
const draggedPath = ref<number[] | null>(null)
const isDropTargetRoot = ref(false)

function toggleExpand(noteId: string) {
  const next = new Set(expandedIds.value)
  if (next.has(noteId)) next.delete(noteId)
  else next.add(noteId)
  expandedIds.value = next
}

function deleteNode(path: number[]) {
  nodes.value = removeNodeAtPathV2(nodes.value, path)
}

function onDragStart(_e: DragEvent, path: number[]) {
  draggedPath.value = path
}

function onDropOn(toParentPath: number[], toIndex: number) {
  const fromPath = draggedPath.value
  draggedPath.value = null
  isDropTargetRoot.value = false
  if (fromPath == null) return
  const node = getNodeAtPathV2(nodes.value, fromPath)
  if (!node) return
  const lastFrom = fromPath[fromPath.length - 1]
  if (fromPath.length === 1 && toParentPath.length === 0 && toIndex === fromPath[0]) return
  if (fromPath.length === toParentPath.length + 1 && toParentPath.every((p, i) => p === fromPath[i]) && toIndex === lastFrom) return
  nodes.value = moveNodeV2(nodes.value, fromPath, toParentPath, toIndex)
}

function onDropAtRoot(e: DragEvent) {
  e.preventDefault()
  isDropTargetRoot.value = false
  const fromPath = draggedPath.value
  draggedPath.value = null
  if (fromPath == null) return
  const node = getNodeAtPathV2(nodes.value, fromPath)
  if (!node) return
  nodes.value = moveNodeV2(nodes.value, fromPath, [], 0)
}
</script>
