import type { BlockTodo, BlockAgree } from '~/types/noteBlock'
import { createEmptyBlockTodo, createEmptyBlockAgree } from '~/types/noteBlock'

function htmlToLines(html: string): string[] {
  if (!html.trim()) return []
  const withNewlines = html
    .replace(/<br\s*\/?>\s*/gi, '\n')
    .replace(/<\/p>\s*<p[^>]*>/gi, '\n')
    .replace(/<\/p>\s*/gi, '\n')
    .replace(/<p[^>]*>\s*/gi, '')
  const text = withNewlines
    .replace(/<[^>]*>/g, ' ')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n+/g, '\n')
    .trim()
  return text.split('\n').map((s) => s.trim()).filter(Boolean)
}

/** Extract @member mention from todo text (last @word wins). Ignores @todo/@Todo. Returns lowercase slug, e.g. "alvinio". */
export function extractAssignedTo(todoText: string): string | undefined {
  const match = todoText.match(/@([a-zA-Z0-9_-]+)/g)
  if (!match?.length) return undefined
  const slugs = match.map((m) => m.slice(1).toLowerCase()).filter((s) => s !== 'todo')
  return slugs[slugs.length - 1]
}

/**
 * Parse block content for:
 * - @todo ... @Todo ends  (inline block → one todo)
 * - /todo <rest of line>   (slash command → one todo per line)
 * - @member in text assigns the todo to that member (for "My todo's" filter).
 * Preserves existing todo id and checked state when text matches.
 */
export function parseBlockTodos(content: string, existingTodos: BlockTodo[]): BlockTodo[] {
  const lines = htmlToLines(content)
  const text = lines.join('\n')
  const existingByText = new Map(existingTodos.map((t) => [t.text, t]))
  const todos: BlockTodo[] = []
  const seen = new Set<string>()

  const inlineRegex = /@todo\s+([\s\S]*?)@Todo\s+ends/gi
  let m
  while ((m = inlineRegex.exec(text)) !== null) {
    const t = m[1].trim()
    if (t && !seen.has(t)) {
      seen.add(t)
      const assignedTo = extractAssignedTo(t)
      const existing = existingByText.get(t)
      if (existing) {
        todos.push({ ...existing, assignedTo: assignedTo ?? existing.assignedTo })
      } else {
        todos.push(createEmptyBlockTodo(t, 'inline', assignedTo))
      }
    }
  }

  for (const line of lines) {
    const idx = line.toLowerCase().indexOf('/todo')
    if (idx === -1) continue
    const rest = line.slice(idx + 5).trim()
    if (rest && !seen.has(rest)) {
      seen.add(rest)
      const assignedTo = extractAssignedTo(rest)
      const existing = existingByText.get(rest)
      if (existing) {
        todos.push({ ...existing, assignedTo: assignedTo ?? existing.assignedTo })
      } else {
        todos.push(createEmptyBlockTodo(rest, 'slash', assignedTo))
      }
    }
  }

  for (const existing of existingTodos) {
    if (existing.checked && !seen.has(existing.text)) {
      todos.push({ ...existing })
    }
  }

  return todos.length ? todos : existingTodos
}

/**
 * Parse block content for /agree <rest of line> (one agree per line).
 * Preserves existing agree id when text matches.
 */
export function parseBlockAgrees(content: string, existingAgrees: BlockAgree[]): BlockAgree[] {
  const lines = htmlToLines(content)
  const existingByText = new Map(existingAgrees.map((a) => [a.text, a]))
  const agrees: BlockAgree[] = []
  const seen = new Set<string>()

  for (const line of lines) {
    const idx = line.toLowerCase().indexOf('/agree')
    if (idx === -1) continue
    const rest = line.slice(idx + 6).trim()
    if (rest && !seen.has(rest)) {
      seen.add(rest)
      agrees.push(existingByText.get(rest) ?? createEmptyBlockAgree(rest))
    }
  }

  return agrees.length ? agrees : existingAgrees
}
