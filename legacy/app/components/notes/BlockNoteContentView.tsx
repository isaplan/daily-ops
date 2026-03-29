/**
 * @registry-id: BlockNoteContentView
 * @created: 2026-02-19T00:00:00.000Z
 * @last-modified: 2026-02-19T00:00:00.000Z
 * @description: Renders note content - block-based (blocks + todos per block) or legacy plain/HTML
 *
 * @exports-to:
 *   ✓ app/components/NoteDetailPage.tsx
 */

'use client'

import { parseBlockNoteContent } from '@/lib/types/noteBlock.types'
import { Checkbox } from '@/components/ui/checkbox'

interface BlockNoteContentViewProps {
  content: string
  className?: string
}

export default function BlockNoteContentView({ content, className = '' }: BlockNoteContentViewProps) {
  const blocks = parseBlockNoteContent(content)
  if (!blocks?.length) {
    return (
      <div className={`prose prose-sm max-w-none whitespace-pre-wrap ${className}`}>
        {content}
      </div>
    )
  }

  return (
    <div className={`space-y-6 ${className}`}>
      {blocks.map((block) => (
        <section key={block.id} className="space-y-2">
          {block.title && (
            <h2 className="text-lg font-semibold text-foreground border-b pb-1">{block.title}</h2>
          )}
          {block.content && (
            <div
              className="prose prose-sm max-w-none"
              dangerouslySetInnerHTML={{ __html: block.content }}
            />
          )}
          {block.todos.length > 0 && (
            <ul className="ml-1 list-none border-l-2 border-muted pl-4 space-y-1.5">
              {block.todos.map((todo) => (
                <li key={todo.id} className="flex items-center gap-2">
                  <Checkbox checked={todo.checked} disabled className="shrink-0" />
                  <span className={todo.checked ? 'text-muted-foreground text-sm line-through' : 'text-sm'}>
                    {todo.text}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      ))}
    </div>
  )
}
