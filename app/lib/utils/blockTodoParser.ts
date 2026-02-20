/**
 * @registry-id: blockTodoParser
 * @created: 2026-02-19T00:00:00.000Z
 * @last-modified: 2026-02-19T00:00:00.000Z
 * @description: Parse @todo ... @Todo ends and /todo from block content (HTML or plain text)
 *
 * @exports-to:
 *   ✓ app/components/notes/BlockBasedNoteEditor.tsx
 */

import type { BlockTodo } from '@/lib/types/noteBlock.types'
import { createEmptyBlockTodo } from '@/lib/types/noteBlock.types'

/**
 * Convert HTML to plain text while preserving paragraph/line boundaries
 * so that /todo is "rest of line" and hard Enter closes the todo.
 */
function htmlToLines(html: string): string[] {
  if (!html.trim()) return []
  // Turn block/line boundaries into newlines before stripping tags
  const withNewlines = html
    .replace(/<br\s*\/?>\s*/gi, '\n')
    .replace(/<\/p>\s*<p[^>]*>/gi, '\n')
    .replace(/<\/p>\s*/gi, '\n')
    .replace(/<p[^>]*>\s*/gi, '')
  // Strip remaining tags, collapse spaces but keep newlines
  const text = withNewlines
    .replace(/<[^>]*>/g, ' ')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n+/g, '\n')
    .trim()
  return text.split('\n').map((s) => s.trim()).filter(Boolean)
}

/**
 * Parse block content for:
 * - @todo ... @Todo ends  (inline block → one todo)
 * - /todo <rest of line>   (slash command → one todo per line; hard Enter closes)
 * Preserves existing todo id and checked state when text matches.
 */
export function parseBlockTodos(content: string, existingTodos: BlockTodo[]): BlockTodo[] {
  const lines = htmlToLines(content)
  const text = lines.join('\n')
  const existingByText = new Map(existingTodos.map((t) => [t.text, t]))
  const todos: BlockTodo[] = []
  const seen = new Set<string>()

  // @todo ... @Todo ends (case-insensitive)
  const inlineRegex = /@todo\s+([\s\S]*?)@Todo\s+ends/gi
  let m
  while ((m = inlineRegex.exec(text)) !== null) {
    const t = m[1].trim()
    if (t && !seen.has(t)) {
      seen.add(t)
      todos.push(existingByText.get(t) ?? createEmptyBlockTodo(t, 'inline'))
    }
  }

  // /todo <rest of line> — one todo per line; hard Enter closes the todo
  for (const line of lines) {
    const idx = line.toLowerCase().indexOf('/todo')
    if (idx === -1) continue
    const rest = line.slice(idx + 5).trim()
    if (rest && !seen.has(rest)) {
      seen.add(rest)
      todos.push(existingByText.get(rest) ?? createEmptyBlockTodo(rest, 'slash'))
    }
  }

  // Keep existing todos that are checked but no longer in content
  for (const existing of existingTodos) {
    if (existing.checked && !seen.has(existing.text)) {
      todos.push({ ...existing })
    }
  }

  return todos.length ? todos : existingTodos
}
