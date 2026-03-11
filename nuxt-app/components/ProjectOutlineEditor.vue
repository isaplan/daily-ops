<!--
/**
 * @registry-id: ProjectOutlineEditor
 * @created: 2026-03-02T00:00:00.000Z
 * @last-modified: 2026-03-02T00:00:00.000Z
 * @description: Editor component for hierarchical project outline nodes with drag-n-drop
 * @last-fix: [2026-03-02] Initial component creation
 * @exports-to:
 * ✓ nuxt-app/pages/notes/projects/[id].vue => ProjectOutlineEditor for editing project structure
 */
-->
<template>
  <div class="project-outline-editor space-y-0">
    <div
      v-if="nodes.length"
      class="drop-zone h-2 rounded mb-1 transition-colors"
      :class="{ 'bg-primary/30': isDropTargetRoot }"
      @dragover.prevent="isDropTargetRoot = true"
      @dragleave="isDropTargetRoot = false"
      @drop="onDropAtRoot"
    />
    <ProjectOutlineNodeRow
      v-for="(node, i) in nodes"
      :key="node.id"
      :node="node"
      :depth="0"
      :path="[i]"
      :expanded-ids="expandedIds"
      :selected-id="selectedId"
      :can-delete="nodes.length > 1"
      @update:title="updateTitle"
      @update:content="updateContent"
      @toggle-expand="toggleExpand"
      @select="selectedId = $event"
      @indent="indent"
      @outdent="outdent"
      @add-sibling-below="addSiblingBelow"
      @delete-node="deleteNode"
      @drag-start="onDragStart"
      @drop-on="onDropOn"
    />
  </div>
</template>

<script setup lang="ts">
import type { OutlineNode } from '~/types/projectOutline'
import {
  createOutlineNode,
  getNodeAtPath,
  setNodeAtPath,
  removeNodeAtPath,
  insertAtPath,
  moveNode,
} from '~/types/projectOutline'

const props = defineProps<{
  modelValue: OutlineNode[]
}>()

const emit = defineEmits<{
  'update:modelValue': [nodes: OutlineNode[]]
}>()

const nodes = computed({
  get: () => props.modelValue,
  set: (v: OutlineNode[]) => emit('update:modelValue', v),
})

const expandedIds = ref<Set<string>>(new Set())
const selectedId = ref<string | null>(null)
const draggedPath = ref<number[] | null>(null)
const isDropTargetRoot = ref(false)

function toggleExpand(id: string) {
  const next = new Set(expandedIds.value)
  if (next.has(id)) next.delete(id)
  else next.add(id)
  expandedIds.value = next
}

function updateTitle(path: number[], value: string) {
  nodes.value = setNodeAtPath(nodes.value, path, (n: OutlineNode) => ({ ...n, title: value }))
}

function updateContent(path: number[], value: string) {
  nodes.value = setNodeAtPath(nodes.value, path, (n: OutlineNode) => ({ ...n, content: value }))
}

function indent(path: number[]) {
  if (path.length < 2) return
  const parentPath = path.slice(0, -1)
  const index = path[path.length - 1] ?? 0
  if (index <= 0) return
  const node = getNodeAtPath(nodes.value, path)
  if (!node) return
  const prevSiblingPath = [...parentPath, index - 1]
  const prev = getNodeAtPath(nodes.value, prevSiblingPath)
  if (!prev) return
  let next = removeNodeAtPath(nodes.value, path)
  next = setNodeAtPath(next, prevSiblingPath, (n: OutlineNode) => ({
    ...n,
    children: [...n.children, node],
  }))
  nodes.value = next
  expandedIds.value = new Set([...expandedIds.value, prev.id])
}

function outdent(path: number[]) {
  if (path.length < 2) return
  const node = getNodeAtPath(nodes.value, path)
  if (!node) return
  const grandPath = path.slice(0, -2)
  const parentIndex = path[path.length - 2] ?? 0
  let next = removeNodeAtPath(nodes.value, path)
  next = insertAtPath(next, grandPath, parentIndex + 1, node)
  nodes.value = next
}

function addSiblingBelow(path: number[]) {
  const parentPath = path.length === 1 ? [] : path.slice(0, -1)
  const index = path.length === 1 ? path[0] + 1 : path[path.length - 1] + 1
  const newNode = createOutlineNode('')
  nodes.value = insertAtPath(nodes.value, parentPath, index, newNode)
  selectedId.value = newNode.id
  if (parentPath.length > 0) {
    const parent = getNodeAtPath(nodes.value, parentPath)
    if (parent) expandedIds.value = new Set([...expandedIds.value, parent.id])
  }
}

function deleteNode(path: number[]) {
  const node = getNodeAtPath(nodes.value, path)
  if (node?.id === selectedId.value) selectedId.value = null
  nodes.value = removeNodeAtPath(nodes.value, path)
}

function onDragStart(_e: DragEvent, _node: OutlineNode, path: number[]) {
  draggedPath.value = path
}

function onDropOn(toParentPath: number[], toIndex: number) {
  const fromPath = draggedPath.value
  draggedPath.value = null
  isDropTargetRoot.value = false
  if (fromPath == null) return
  const node = getNodeAtPath(nodes.value, fromPath)
  if (!node) return
  const lastFrom = fromPath[fromPath.length - 1]
  if (fromPath.length === 1 && toParentPath.length === 0 && toIndex === fromPath[0]) return
  if (fromPath.length === toParentPath.length + 1 && toParentPath.every((p, i) => p === fromPath[i]) && toIndex === lastFrom) return
  nodes.value = moveNode(nodes.value, fromPath, toParentPath, toIndex)
}

function onDropAtRoot(e: DragEvent) {
  e.preventDefault()
  isDropTargetRoot.value = false
  const from = draggedPath.value
  draggedPath.value = null
  if (from == null) return
  const node = getNodeAtPath(nodes.value, from)
  if (!node) return
  nodes.value = moveNode(nodes.value, from, [], 0)
}
</script>
