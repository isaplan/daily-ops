/**
 * @registry-id: TipTapChatEditor
 * @created: 2026-01-20T00:00:00.000Z
 * @last-modified: 2026-01-20T00:00:00.000Z
 * @description: TipTap markdown editor for chat with @mentions and #hashtags - Slack-like UI
 * @last-fix: [2026-01-20] Added formatting toolbar, full markdown support, Slack-like UI
 * 
 * @imports-from:
 *   - @tiptap/react => TipTap React hooks
 *   - @tiptap/starter-kit => Basic markdown editor features
 *   - @tiptap/extension-mention => @ mention support
 *   - @tiptap/extension-placeholder => Placeholder text
 *   - app/lib/viewmodels/useMentionDataViewModel.ts => Mention/hashtag data
 * 
 * @exports-to:
 *   ✓ app/components/chats/MessageThread.tsx => Uses TipTapChatEditor for chat input
 */

'use client'

import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Mention from '@tiptap/extension-mention'
import Placeholder from '@tiptap/extension-placeholder'
import Underline from '@tiptap/extension-underline'
import Link from '@tiptap/extension-link'
import { useEffect, useRef, useState } from 'react'
import { useMentionDataViewModel } from '@/lib/viewmodels/useMentionDataViewModel'
import { HashtagExtension } from './HashtagExtension'
import { Bold, Italic, Underline as UnderlineIcon, Strikethrough, Code, List, Link as LinkIcon } from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import './TipTapChatEditor.css'

interface TipTapChatEditorProps {
  content?: string
  onChange?: (content: string) => void
  placeholder?: string
  onSend?: () => void
}


export default function TipTapChatEditor({
  content = '',
  onChange,
  placeholder = 'Type a message... Use @ for mentions, # for channels',
  onSend,
}: TipTapChatEditorProps) {
  const { getMentionItems, getHashtagItems } = useMentionDataViewModel()
  const editorRef = useRef<HTMLDivElement>(null)
  const [linkDialogOpen, setLinkDialogOpen] = useState(false)
  const [linkUrl, setLinkUrl] = useState('')

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({
        // Enable basic markdown features for Slack-like editor
        heading: false,
        codeBlock: true,
        blockquote: false,
        horizontalRule: false,
      }),
      Placeholder.configure({
        placeholder,
      }),
      Underline,
      Link.configure({
        openOnClick: false,
        HTMLAttributes: {
          class: 'text-blue-400 hover:text-blue-300 underline',
        },
      }),
      HashtagExtension,
      Mention.configure({
        HTMLAttributes: {
          class: 'mention',
        },
        suggestion: {
          items: async ({ query }: { query: string }) => {
            const items = await getMentionItems(query)
            return items.map((item) => ({
              id: item.id,
              label: item.title,
              ...item,
            }))
          },
          render: () => {
            let component: HTMLDivElement | null = null
            let popup: any = null

            return {
              onStart: async (props: any) => {
                try {
                  const tippyModule = await import('tippy.js')
                  await import('tippy.js/dist/tippy.css')
                  const tippy = tippyModule.default
                  
                  component = document.createElement('div')
                  component.className = 'mention-suggestions'

                  popup = tippy('body', {
                    getReferenceClientRect: props.clientRect,
                    appendTo: () => document.body,
                    content: component,
                    showOnCreate: true,
                    interactive: true,
                    trigger: 'manual',
                    placement: 'bottom-start',
                  })
                } catch (error) {
                  console.warn('Tippy.js failed to load:', error)
                }
              },
              onUpdate: (props: any) => {
                if (!component) return
                
                component.innerHTML = ''
                if (props.items.length === 0) {
                  if (popup && Array.isArray(popup) && popup[0]) {
                    popup[0].hide()
                  }
                  return
                }

                const list = document.createElement('ul')
                list.className = 'mention-list'

                props.items.forEach((item: any, index: number) => {
                  const li = document.createElement('li')
                  li.className = index === props.selectedIndex ? 'mention-item selected' : 'mention-item'
                  li.textContent = item.label
                  li.addEventListener('click', () => {
                    props.selectItem(item)
                  })
                  list.appendChild(li)
                })

                component.appendChild(list)
              },
              onKeyDown: (props: any) => {
                if (props.event.key === 'ArrowUp') {
                  props.upHandler()
                  return true
                }
                if (props.event.key === 'ArrowDown') {
                  props.downHandler()
                  return true
                }
                if (props.event.key === 'Enter') {
                  props.enterHandler()
                  return true
                }
                return false
              },
              onExit: () => {
                if (popup && Array.isArray(popup) && popup[0]) {
                  popup[0].destroy()
                }
                popup = null
                component = null
              },
            }
          },
        },
      }),
    ],
    content,
    onUpdate: ({ editor }) => {
      // Get HTML content from TipTap
      const html = editor.getHTML()
      // Only update if content actually changed (avoid infinite loops)
      if (html !== content) {
        onChange?.(html)
      }
    },
    editorProps: {
      attributes: {
        class: 'tiptap-chat-editor prose prose-invert max-w-none focus:outline-none',
      },
    },
  })

  // Handle keyboard shortcuts (Cmd/Ctrl+Enter to send)
  useEffect(() => {
    if (!editor || !onSend || !editorRef.current) return

    const handleKeyDown = (event: KeyboardEvent) => {
      // Check for Cmd+Enter (Mac) or Ctrl+Enter (Windows/Linux)
      if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') {
        event.preventDefault()
        event.stopPropagation()
        onSend()
      }
    }

    const editorElement = editorRef.current
    editorElement.addEventListener('keydown', handleKeyDown, true)
    
    return () => {
      editorElement.removeEventListener('keydown', handleKeyDown, true)
    }
  }, [editor, onSend])

  // Sync content when prop changes
  useEffect(() => {
    if (!editor || content === undefined) return
    
    const currentContent = editor.getHTML()
    if (currentContent !== content) {
      editor.commands.setContent(content || '')
    }
  }, [content, editor])

  if (!editor) {
    return (
      <div className="tiptap-chat-editor-wrapper w-full min-h-24 p-3 bg-slate-800 border border-slate-700 rounded-md">
        <div className="text-slate-400">Loading editor...</div>
      </div>
    )
  }

  return (
    <div 
      ref={editorRef}
      className="tiptap-chat-editor-wrapper w-full rounded-lg border border-slate-700 bg-slate-800/50 overflow-hidden"
    >
      {/* Formatting Toolbar */}
      <div className="flex items-center gap-1 px-2 py-1.5 border-b border-slate-700/50">
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleBold().run()}
          disabled={!editor.can().chain().focus().toggleBold().run()}
          className={`p-1.5 rounded hover:bg-slate-700/50 transition-colors ${
            editor.isActive('bold') ? 'bg-slate-700 text-white' : 'text-slate-400'
          }`}
          title="Bold (Cmd+B)"
        >
          <Bold className="w-4 h-4" />
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleItalic().run()}
          disabled={!editor.can().chain().focus().toggleItalic().run()}
          className={`p-1.5 rounded hover:bg-slate-700/50 transition-colors ${
            editor.isActive('italic') ? 'bg-slate-700 text-white' : 'text-slate-400'
          }`}
          title="Italic (Cmd+I)"
        >
          <Italic className="w-4 h-4" />
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleUnderline().run()}
          disabled={!editor.can().chain().focus().toggleUnderline().run()}
          className={`p-1.5 rounded hover:bg-slate-700/50 transition-colors ${
            editor.isActive('underline') ? 'bg-slate-700 text-white' : 'text-slate-400'
          }`}
          title="Underline (Cmd+U)"
        >
          <UnderlineIcon className="w-4 h-4" />
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleStrike().run()}
          disabled={!editor.can().chain().focus().toggleStrike().run()}
          className={`p-1.5 rounded hover:bg-slate-700/50 transition-colors ${
            editor.isActive('strike') ? 'bg-slate-700 text-white' : 'text-slate-400'
          }`}
          title="Strikethrough"
        >
          <Strikethrough className="w-4 h-4" />
        </button>
        <div className="w-px h-4 bg-slate-700 mx-1" />
        <button
          type="button"
          onClick={() => {
            if (editor.isActive('link')) {
              editor.chain().focus().unsetLink().run()
            } else {
              setLinkUrl('')
              setLinkDialogOpen(true)
            }
          }}
          className={`p-1.5 rounded hover:bg-slate-700/50 transition-colors ${
            editor.isActive('link') ? 'bg-slate-700 text-white' : 'text-slate-400'
          }`}
          title="Insert Link"
        >
          <LinkIcon className="w-4 h-4" />
        </button>
        <div className="w-px h-4 bg-slate-700 mx-1" />
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
          className={`p-1.5 rounded hover:bg-slate-700/50 transition-colors ${
            editor.isActive('orderedList') ? 'bg-slate-700 text-white' : 'text-slate-400'
          }`}
          title="Numbered List"
        >
          <List className="w-4 h-4" />
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          className={`p-1.5 rounded hover:bg-slate-700/50 transition-colors ${
            editor.isActive('bulletList') ? 'bg-slate-700 text-white' : 'text-slate-400'
          }`}
          title="Bullet List"
        >
          <List className="w-4 h-4 rotate-90" />
        </button>
        <div className="w-px h-4 bg-slate-700 mx-1" />
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleCode().run()}
          disabled={!editor.can().chain().focus().toggleCode().run()}
          className={`p-1.5 rounded hover:bg-slate-700/50 transition-colors ${
            editor.isActive('code') ? 'bg-slate-700 text-white' : 'text-slate-400'
          }`}
          title="Inline Code"
        >
          <Code className="w-4 h-4" />
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleCodeBlock().run()}
          className={`p-1.5 rounded hover:bg-slate-700/50 transition-colors ${
            editor.isActive('codeBlock') ? 'bg-slate-700 text-white' : 'text-slate-400'
          }`}
          title="Code Block"
        >
          <Code className="w-4 h-4" />
        </button>
      </div>
      
      {/* Editor Content */}
      <div className="min-h-24 max-h-48 overflow-y-auto p-3">
        <EditorContent editor={editor} />
      </div>

      {/* Link Dialog */}
      <Dialog open={linkDialogOpen} onOpenChange={setLinkDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Insert Link</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <Input
              type="url"
              placeholder="https://example.com"
              value={linkUrl}
              onChange={(e) => setLinkUrl(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && linkUrl.trim()) {
                  editor.chain().focus().setLink({ href: linkUrl.trim() }).run()
                  setLinkDialogOpen(false)
                  setLinkUrl('')
                }
              }}
              autoFocus
            />
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setLinkDialogOpen(false)
                setLinkUrl('')
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={() => {
                if (linkUrl.trim()) {
                  editor.chain().focus().setLink({ href: linkUrl.trim() }).run()
                  setLinkDialogOpen(false)
                  setLinkUrl('')
                }
              }}
              disabled={!linkUrl.trim()}
            >
              Insert
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
