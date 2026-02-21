export interface BlockTodo {
  id: string
  text: string
  checked: boolean
  source: 'inline' | 'slash'
}

export interface BlockAgree {
  id: string
  text: string
}

export interface NoteBlock {
  id: string
  title?: string
  content: string
  todos: BlockTodo[]
  agrees: BlockAgree[]
}

export interface NoteBlockDocument {
  version: 2
  blocks: NoteBlock[]
}

export function createEmptyBlock(): NoteBlock {
  return {
    id: crypto.randomUUID?.() ?? `block-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    content: '',
    todos: [],
    agrees: [],
  }
}

export function createEmptyBlockAgree(text: string): BlockAgree {
  return {
    id: crypto.randomUUID?.() ?? `agree-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    text,
  }
}

export function createEmptyBlockTodo(text: string, source: BlockTodo['source']): BlockTodo {
  return {
    id: crypto.randomUUID?.() ?? `todo-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    text,
    checked: false,
    source,
  }
}

const BLOCK_DOC_PREFIX = '{"version":2'

export function isBlockNoteContent(content: string): boolean {
  const t = (content ?? '').trim()
  return t.startsWith(BLOCK_DOC_PREFIX) && t.includes('"blocks"')
}

export function parseBlockNoteContent(content: string): NoteBlock[] | null {
  if (!isBlockNoteContent(content)) return null
  try {
    const doc = JSON.parse(content) as NoteBlockDocument
    if (doc.version === 2 && Array.isArray(doc.blocks)) {
      return doc.blocks.map((b) => ({
        ...b,
        agrees: Array.isArray(b.agrees) ? b.agrees : [],
      }))
    }
  } catch {
    return null
  }
  return null
}

export function serializeBlockNoteContent(blocks: NoteBlock[]): string {
  const doc: NoteBlockDocument = { version: 2, blocks }
  return JSON.stringify(doc)
}
