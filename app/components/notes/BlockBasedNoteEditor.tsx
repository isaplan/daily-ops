/**
 * @registry-id: BlockBasedNoteEditor
 * @created: 2026-02-19T00:00:00.000Z
 * @last-modified: 2026-02-19T00:00:00.000Z
 * @description: Block-based note editor - each block has content + todos listed below it
 * @last-fix: [2026-02-19] Matches screenshot UX: add new block, todos separate per block
 *
 * @exports-to:
 *   ✓ app/components/notes/NoteEditorV2.tsx
 */

'use client'

import { useCallback, useEffect } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import TipTapNoteEditor from '@/components/editors/TipTapNoteEditor'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import {
  type NoteBlock,
  createEmptyBlock,
} from '@/lib/types/noteBlock.types'
import { parseBlockTodos } from '@/lib/utils/blockTodoParser'

interface BlockBasedNoteEditorProps {
  blocks: NoteBlock[]
  onChange: (blocks: NoteBlock[]) => void
  placeholder?: string
}

export default function BlockBasedNoteEditor({
  blocks,
  onChange,
  placeholder = 'Write your note… Use @todo … @Todo ends or /todo for tasks.',
}: BlockBasedNoteEditorProps) {
  const setBlock = useCallback(
    (index: number, updater: (prev: NoteBlock) => NoteBlock) => {
      const next = blocks.map((b, i) => (i === index ? updater(b) : b))
      onChange(next)
    },
    [blocks, onChange]
  )

  const setBlockTitle = useCallback(
    (index: number, title: string) => {
      setBlock(index, (prev) => ({ ...prev, title: title || undefined }))
    },
    [setBlock]
  )

  const setBlockContent = useCallback(
    (index: number, content: string) => {
      setBlock(index, (prev) => {
        const todos = parseBlockTodos(content, prev.todos)
        return { ...prev, content, todos }
      })
    },
    [setBlock]
  )

  const setBlockTodoChecked = useCallback(
    (blockIndex: number, todoId: string, checked: boolean) => {
      setBlock(blockIndex, (prev) => ({
        ...prev,
        todos: prev.todos.map((t) => (t.id === todoId ? { ...t, checked } : t)),
      }))
    },
    [setBlock]
  )

  const removeBlock = useCallback(
    (index: number) => {
      if (blocks.length <= 1) return
      onChange(blocks.filter((_, i) => i !== index))
    },
    [blocks, onChange]
  )

  const addBlock = useCallback(() => {
    onChange([...blocks, createEmptyBlock()])
  }, [blocks, onChange])

  // Ensure at least one block
  useEffect(() => {
    if (blocks.length === 0) {
      onChange([createEmptyBlock()])
    }
  }, [blocks.length, onChange])

  return (
    <div className="space-y-8">
      {blocks.map((block, index) => (
        <section key={block.id} className="space-y-3">
          {/* Editable title above the block */}
          <Input
            value={block.title ?? ''}
            onChange={(e) => setBlockTitle(index, e.target.value)}
            placeholder="Block title (optional)"
            className="h-9 border-0 border-b rounded-none px-0 font-semibold text-base placeholder:text-muted-foreground focus-visible:ring-0 focus-visible:ring-offset-0"
          />
          {/* Block content editor with bubble toolbar */}
          <div className="flex gap-2">
            <div className="min-w-0 flex-1">
              <TipTapNoteEditor
                content={block.content}
                onChange={(html) => setBlockContent(index, html)}
                placeholder={index === 0 ? placeholder : 'Add content or use @todo … @Todo ends or /todo for tasks.'}
                className="min-h-[120px]"
                bubbleMenu
              />
            </div>
            {blocks.length > 1 && (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="shrink-0 text-muted-foreground hover:text-destructive"
                onClick={() => removeBlock(index)}
                title="Remove block"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            )}
          </div>

          {/* Todos for this block - separate below the block */}
          {block.todos.length > 0 && (
            <div className="ml-1 border-l-2 border-muted pl-4">
              <div className="space-y-2">
                {block.todos.map((todo) => (
                  <label
                    key={todo.id}
                    className="flex cursor-pointer items-start gap-3 rounded-md py-1.5 pr-2 hover:bg-muted/50"
                  >
                    <Checkbox
                      checked={todo.checked}
                      onCheckedChange={(checked) =>
                        setBlockTodoChecked(index, todo.id, checked === true)
                      }
                      className="mt-0.5"
                    />
                    <span
                      className={
                        todo.checked
                          ? 'text-muted-foreground text-sm line-through'
                          : 'text-sm'
                      }
                    >
                      {todo.text}
                    </span>
                  </label>
                ))}
              </div>
            </div>
          )}
        </section>
      ))}

      {/* Add new block */}
      <div className="flex items-center gap-4">
        <div className="h-px flex-1 bg-border" />
        <Button
          type="button"
          variant="outline"
          className="shrink-0 gap-2"
          onClick={addBlock}
        >
          <Plus className="h-4 w-4" />
          add new block
        </Button>
        <div className="h-px flex-1 bg-border" />
      </div>
    </div>
  )
}
