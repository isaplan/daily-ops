/**
 * @registry-id: projectOutlineTypes
 * @created: 2026-03-02T00:00:00.000Z
 * @last-modified: 2026-03-02T00:00:00.000Z
 * @description: Type definitions for project outline tree structure and note hierarchy
 * @last-fix: [2026-03-02] Initial types creation
 * @exports-to:
 * ✓ nuxt-app/components/ProjectOutlineEditor.vue => ProjectOutlineNode, ProjectOutlineDocument
 * ✓ nuxt-app/components/ProjectOutliner.vue => ProjectOutlineNode, ProjectOutlineDocumentV2
 * ✓ nuxt-app/pages/notes/projects/[id].vue => ProjectOutlineNode and document types
 * 
 * Project outline: tree of note references. Each node = one note (page + todos).
 * Stored in project note.content as JSON (version 2).
 */

/** Node in the outline: references one note. Title is denormalized for display. */
export type ProjectOutlineNode = {
  noteId: string
  title: string
  children: ProjectOutlineNode[]
}

export type ProjectOutlineDocumentV2 = {
  version: 2
  nodes: ProjectOutlineNode[]
}

/** Legacy: inline content per node (version 1). */
export type OutlineNode = {
  id: string
  title: string
  content: string
  children: OutlineNode[]
}

export type ProjectOutlineDocument = {
  version: 1
  nodes: OutlineNode[]
}

const PREFIX = '{"version":1,"nodes":'

export function isProjectOutlineContent(content: string): boolean {
  const t = (content ?? '').trim()
  return t.startsWith(PREFIX) || t.startsWith('{"version":1')
}

export function parseProjectOutline(content: string): OutlineNode[] | null {
  if (!content?.trim()) return []
  try {
    const doc = JSON.parse(content) as ProjectOutlineDocument
    if (doc.version === 1 && Array.isArray(doc.nodes)) {
      return doc.nodes
    }
  } catch {
    return null
  }
  return null
}

export function serializeProjectOutline(nodes: OutlineNode[]): string {
  const doc: ProjectOutlineDocument = { version: 1, nodes }
  return JSON.stringify(doc)
}

export function createOutlineNode(title = ''): OutlineNode {
  return {
    id: crypto.randomUUID?.() ?? `node-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    title,
    content: '',
    children: [],
  }
}

export function createEmptyOutline(): OutlineNode[] {
  return [createOutlineNode('')]
}

/** Get node at path (path = array of indices into nodes/children). */
export function getNodeAtPath(nodes: OutlineNode[], path: number[]): OutlineNode | null {
  if (path.length === 0) return null
  let current: OutlineNode[] = nodes
  for (let i = 0; i < path.length; i++) {
    const idx = path[i]
    if (idx < 0 || idx >= current.length) return null
    const node = current[idx]
    if (i === path.length - 1) return node
    current = node.children
  }
  return null
}

/** Immutable set: replace node at path with updated node. */
export function setNodeAtPath(nodes: OutlineNode[], path: number[], updater: (n: OutlineNode) => OutlineNode): OutlineNode[] {
  if (path.length === 0) return nodes
  const [idx, ...rest] = path
  if (idx < 0 || idx >= nodes.length) return nodes
  const node = nodes[idx]
  if (rest.length === 0) {
    return nodes.map((n, i) => (i === idx ? updater(n) : n))
  }
  return nodes.map((n, i) =>
    i === idx ? { ...node, children: setNodeAtPath(node.children, rest, updater) } : n
  )
}

/** Remove node at path; return new root nodes. */
export function removeNodeAtPath(nodes: OutlineNode[], path: number[]): OutlineNode[] {
  if (path.length === 0) return nodes
  if (path.length === 1) {
    const idx = path[0]
    return nodes.filter((_, i) => i !== idx)
  }
  const [idx, ...rest] = path
  const node = nodes[idx]
  return nodes.map((n, i) =>
    i === idx ? { ...n, children: removeNodeAtPath(n.children, rest) } : n
  )
}

/** Insert node at path (path points to position; for "after" use path = [siblingIndex+1] or appropriate). */
export function insertNodeAtPath(nodes: OutlineNode[], path: number[], newNode: OutlineNode): OutlineNode[] {
  if (path.length === 0) return [newNode, ...nodes]
  const [idx, ...rest] = path
  if (rest.length === 0) {
    const i = Math.max(0, Math.min(idx, nodes.length))
    return [...nodes.slice(0, i), newNode, ...nodes.slice(i)]
  }
  const node = nodes[idx]
  return nodes.map((n, i) =>
    i === idx ? { ...n, children: insertNodeAtPath(n.children, rest, newNode) } : n
  )
}

/** Insert as child at parentPath, at index. */
export function insertAtPath(nodes: OutlineNode[], parentPath: number[], index: number, newNode: OutlineNode): OutlineNode[] {
  if (parentPath.length === 0) {
    const i = Math.max(0, Math.min(index, nodes.length))
    return [...nodes.slice(0, i), newNode, ...nodes.slice(i)]
  }
  const [idx, ...rest] = parentPath
  const node = nodes[idx]
  return nodes.map((n, i) =>
    i === idx ? { ...n, children: insertAtPath(n.children, rest, index, newNode) } : n
  )
}

/** Move node from fromPath to (toParentPath, toIndex). Removes then inserts. */
export function moveNode(nodes: OutlineNode[], fromPath: number[], toParentPath: number[], toIndex: number): OutlineNode[] {
  const node = getNodeAtPath(nodes, fromPath)
  if (!node) return nodes
  const afterRemove = removeNodeAtPath(nodes, fromPath)
  return insertAtPath(afterRemove, toParentPath, toIndex, node)
}

// --- Version 2: project = tree of note refs ---

const PREFIX_V2 = '{"version":2,"nodes":'

export function isProjectOutlineV2(content: string): boolean {
  const t = (content ?? '').trim()
  return t.startsWith(PREFIX_V2) || t.startsWith('{"version":2')
}

export function parseProjectOutlineV2(content: string): ProjectOutlineNode[] | null {
  if (!content?.trim()) return []
  try {
    const doc = JSON.parse(content) as ProjectOutlineDocumentV2
    if (doc.version === 2 && Array.isArray(doc.nodes)) return doc.nodes
  } catch {
    return null
  }
  return null
}

export function serializeProjectOutlineV2(nodes: ProjectOutlineNode[]): string {
  return JSON.stringify({ version: 2, nodes })
}

export function createProjectOutlineNode(noteId: string, title = ''): ProjectOutlineNode {
  return { noteId, title, children: [] }
}

export function getNodeAtPathV2(nodes: ProjectOutlineNode[], path: number[]): ProjectOutlineNode | null {
  if (path.length === 0) return null
  let current: ProjectOutlineNode[] = nodes
  for (let i = 0; i < path.length; i++) {
    const idx = path[i]
    if (idx < 0 || idx >= current.length) return null
    const node = current[idx]
    if (i === path.length - 1) return node
    current = node.children
  }
  return null
}

export function setNodeAtPathV2(nodes: ProjectOutlineNode[], path: number[], updater: (n: ProjectOutlineNode) => ProjectOutlineNode): ProjectOutlineNode[] {
  if (path.length === 0) return nodes
  const [idx, ...rest] = path
  if (idx < 0 || idx >= nodes.length) return nodes
  const node = nodes[idx]
  if (rest.length === 0) return nodes.map((n, i) => (i === idx ? updater(n) : n))
  return nodes.map((n, i) =>
    i === idx ? { ...node, children: setNodeAtPathV2(node.children, rest, updater) } : n
  )
}

export function removeNodeAtPathV2(nodes: ProjectOutlineNode[], path: number[]): ProjectOutlineNode[] {
  if (path.length === 0) return nodes
  if (path.length === 1) return nodes.filter((_, i) => i !== path[0])
  const [idx, ...rest] = path
  const node = nodes[idx]
  return nodes.map((n, i) =>
    i === idx ? { ...n, children: removeNodeAtPathV2(n.children, rest) } : n
  )
}

export function insertAtPathV2(nodes: ProjectOutlineNode[], parentPath: number[], index: number, newNode: ProjectOutlineNode): ProjectOutlineNode[] {
  if (parentPath.length === 0) {
    const i = Math.max(0, Math.min(index, nodes.length))
    return [...nodes.slice(0, i), newNode, ...nodes.slice(i)]
  }
  const [idx, ...rest] = parentPath
  const node = nodes[idx]
  return nodes.map((n, i) =>
    i === idx ? { ...n, children: insertAtPathV2(n.children, rest, index, newNode) } : n
  )
}

export function moveNodeV2(nodes: ProjectOutlineNode[], fromPath: number[], toParentPath: number[], toIndex: number): ProjectOutlineNode[] {
  const node = getNodeAtPathV2(nodes, fromPath)
  if (!node) return nodes
  const afterRemove = removeNodeAtPathV2(nodes, fromPath)
  return insertAtPathV2(afterRemove, toParentPath, toIndex, node)
}

/** Find path to node with given noteId (DFS). */
export function getPathOfNoteIdV2(nodes: ProjectOutlineNode[], noteId: string, prefix: number[] = []): number[] | null {
  for (let i = 0; i < nodes.length; i++) {
    const n = nodes[i]
    if (n.noteId === noteId) return [...prefix, i]
    const found = getPathOfNoteIdV2(n.children, noteId, [...prefix, i])
    if (found) return found
  }
  return null
}
