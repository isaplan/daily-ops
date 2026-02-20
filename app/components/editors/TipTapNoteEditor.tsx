/**
 * @registry-id: TipTapNoteEditor
 * @created: 2026-02-19T00:00:00.000Z
 * @last-modified: 2026-02-19T00:00:00.000Z
 * @description: TipTap rich text editor for notes - headings, lists, B/I/U/S, hr
 * @last-fix: [2026-02-19] Initial implementation for Note V2
 *
 * @exports-to:
 *   ✓ app/components/notes/NoteEditorV2.tsx => Main note editor body
 */

'use client'

import { useEditor, EditorContent } from '@tiptap/react'
import { BubbleMenu } from '@tiptap/react/menus'
import StarterKit from '@tiptap/starter-kit'
import Placeholder from '@tiptap/extension-placeholder'
import Underline from '@tiptap/extension-underline'
import { useEffect, useRef } from 'react'
import {
  Bold,
  Italic,
  Underline as UnderlineIcon,
  Strikethrough,
  List,
  ListOrdered,
  Minus,
  Heading1,
  Heading2,
  Heading3,
  Pilcrow,
} from 'lucide-react'

interface TipTapNoteEditorProps {
  content?: string
  onChange?: (html: string) => void
  placeholder?: string
  className?: string
  /** When true, show toolbar as bubble menu on selection instead of fixed header */
  bubbleMenu?: boolean
}

export default function TipTapNoteEditor({
  content = '',
  onChange,
  placeholder = 'Write your note… Use the toolbar for headings and lists.',
  className = '',
  bubbleMenu = false,
}: TipTapNoteEditorProps) {
  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
        codeBlock: true,
        blockquote: true,
        horizontalRule: true,
        link: false,
        underline: false,
      }),
      Placeholder.configure({ placeholder }),
      Underline,
    ],
    content: content || '',
    editorProps: {
      attributes: {
        class: 'prose prose-sm max-w-none min-h-[240px] px-3 py-2 focus:outline-none',
      },
    },
    onUpdate: ({ editor }) => {
      onChange?.(editor.getHTML())
    },
  })

  const prevContent = useRef(content)
  useEffect(() => {
    if (!editor) return
    const current = editor.getHTML()
    const next = content ?? ''
    if (next !== prevContent.current) {
      prevContent.current = next
      if (current !== next) editor.commands.setContent(next, false)
    }
  }, [content, editor])

  if (!editor) {
    return (
      <div className={`rounded-md border bg-muted/30 p-4 ${className}`}>
        <div className="text-muted-foreground text-sm">Loading editor…</div>
      </div>
    )
  }

  const ToolbarButton = ({
    onClick,
    active,
    disabled,
    children,
    title,
  }: {
    onClick: () => void
    active?: boolean
    disabled?: boolean
    children: React.ReactNode
    title: string
  }) => (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={`rounded p-1.5 transition-colors hover:bg-muted ${active ? 'bg-muted text-foreground' : 'text-muted-foreground'}`}
    >
      {children}
    </button>
  )

  const toolbar = (
    <>
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
        active={editor.isActive('heading', { level: 1 })}
        title="Heading 1"
      >
        <Heading1 className="h-4 w-4" />
      </ToolbarButton>
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
        active={editor.isActive('heading', { level: 2 })}
        title="Heading 2"
      >
        <Heading2 className="h-4 w-4" />
      </ToolbarButton>
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
        active={editor.isActive('heading', { level: 3 })}
        title="Heading 3"
      >
        <Heading3 className="h-4 w-4" />
      </ToolbarButton>
      <ToolbarButton
        onClick={() => editor.chain().focus().setParagraph().run()}
        active={editor.isActive('paragraph')}
        title="Paragraph"
      >
        <Pilcrow className="h-4 w-4" />
      </ToolbarButton>
      <span className="mx-1 text-muted-foreground/50">|</span>
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleBold().run()}
        active={editor.isActive('bold')}
        disabled={!editor.can().chain().focus().toggleBold().run()}
        title="Bold"
      >
        <Bold className="h-4 w-4" />
      </ToolbarButton>
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleItalic().run()}
        active={editor.isActive('italic')}
        disabled={!editor.can().chain().focus().toggleItalic().run()}
        title="Italic"
      >
        <Italic className="h-4 w-4" />
      </ToolbarButton>
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleUnderline().run()}
        active={editor.isActive('underline')}
        disabled={!editor.can().chain().focus().toggleUnderline().run()}
        title="Underline"
      >
        <UnderlineIcon className="h-4 w-4" />
      </ToolbarButton>
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleStrike().run()}
        active={editor.isActive('strike')}
        disabled={!editor.can().chain().focus().toggleStrike().run()}
        title="Strikethrough"
      >
        <Strikethrough className="h-4 w-4" />
      </ToolbarButton>
      <span className="mx-1 text-muted-foreground/50">|</span>
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleHorizontalRule().run()}
        title="Horizontal rule"
      >
        <Minus className="h-4 w-4" />
      </ToolbarButton>
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleBulletList().run()}
        active={editor.isActive('bulletList')}
        title="Bullet list"
      >
        <List className="h-4 w-4" />
      </ToolbarButton>
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleOrderedList().run()}
        active={editor.isActive('orderedList')}
        title="Ordered list"
      >
        <ListOrdered className="h-4 w-4" />
      </ToolbarButton>
    </>
  )

  return (
    <div className={`rounded-md border bg-background ${className}`}>
      {bubbleMenu ? (
        <BubbleMenu editor={editor} className="flex flex-wrap items-center gap-0.5 rounded-md border bg-background px-2 py-1 shadow-md">
          {toolbar}
        </BubbleMenu>
      ) : (
        <div className="flex flex-wrap items-center gap-0.5 border-b px-2 py-1">
          {toolbar}
        </div>
      )}
      <EditorContent editor={editor} />
    </div>
  )
}
