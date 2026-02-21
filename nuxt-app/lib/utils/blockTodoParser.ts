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

/**
 * Parse block content for:
 * - @todo ... @Todo ends  (inline block → one todo)
 * - /todo <rest of line>   (slash command → one todo per line)
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
      todos.push(existingByText.get(t) ?? createEmptyBlockTodo(t, 'inline'))
    }
  }

  for (const line of lines) {
    const idx = line.toLowerCase().indexOf('/todo')
    if (idx === -1) continue
    const rest = line.slice(idx + 5).trim()
    if (rest && !seen.has(rest)) {
      seen.add(rest)
      todos.push(existingByText.get(rest) ?? createEmptyBlockTodo(rest, 'slash'))
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
