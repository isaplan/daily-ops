/**
 * @registry-id: BlockNoteEditor
 * @created: 2026-01-18T00:00:00.000Z
 * @last-modified: 2026-01-20T00:00:00.000Z
 * @description: Full BlockNote editor with @mentions, #hashtags, and file uploads
 * @last-fix: [2026-01-20] Simplified for chat: full-width, disabled slash menu/toolbars, basic markdown-like editor
 * 
 * @imports-from:
 *   - app/lib/types/editor.types.ts => EditorContent types
 *   - app/lib/viewmodels/useEditorViewModel.ts => useEditorViewModel hook
 *   - app/lib/services/mentionInlineSpec.ts => createMentionInlineSpec
 *   - app/lib/services/hashtagInlineSpec.ts => createHashtagInlineSpec
 *   - app/lib/viewmodels/useMentionDataViewModel.ts => useMentionDataViewModel hook
 *   - app/components/ui/** => Shadcn microcomponents only
 * 
 * @exports-to:
 *   ✓ app/components/editors/EditorWrapper.tsx => Uses BlockNoteEditor
 *   ✓ app/components/chats/MessageThread.tsx => Uses BlockNoteEditor for message input
 */

'use client'

import { useEffect, useMemo, useRef } from 'react'
import { PartialBlock, defaultInlineContentSpecs } from '@blocknote/core'
import { BlockNoteViewRaw, useCreateBlockNote, SuggestionMenuController } from '@blocknote/react'
import '@blocknote/core/fonts/inter.css'
import '@blocknote/react/style.css'
import { useEditorViewModel } from '@/lib/viewmodels/useEditorViewModel'
import { createMentionInlineSpec } from '@/lib/services/mentionInlineSpec'
import { createHashtagInlineSpec } from '@/lib/services/hashtagInlineSpec'
import { useMentionDataViewModel } from '@/lib/viewmodels/useMentionDataViewModel'
import type { EditorContent } from '@/lib/types/editor.types'

interface BlockNoteEditorProps {
  content?: EditorContent
  onChange?: (content: EditorContent) => void
  editable?: boolean
  roomId: string
  userId?: string
  userName?: string
  placeholder?: string
  onSend?: () => void
}

export default function BlockNoteEditorComponent({
  content,
  onChange,
  editable = true,
  roomId,
  userId,
  userName,
  placeholder = 'Type a message... Use @ for mentions, # for channels',
  onSend,
}: BlockNoteEditorProps) {
  const { updateContent } = useEditorViewModel({
    roomId,
    userId,
    userName,
    initialContent: content,
  })

  // Validate and normalize initial content - use useMemo to ensure it's computed once
  const initialContent = useMemo((): PartialBlock[] | undefined => {
    // If no content or empty array, return undefined (BlockNote creates empty editor)
    if (!content || !Array.isArray(content) || content.length === 0) {
      return undefined
    }
    
    // Validate that content is valid BlockNote blocks
    try {
      // Check if content has the basic structure of BlockNote blocks
      const isValid = content.every((block: any) => {
        return block && typeof block === 'object' && block.type && typeof block.type === 'string'
      })
      
      if (!isValid) {
        console.warn('Invalid BlockNote content format, using empty editor')
        return undefined
      }
      
      return content as PartialBlock[]
    } catch (error) {
      console.warn('Error validating BlockNote content:', error)
      return undefined
    }
  }, [content])

  const { getMentionItems, getHashtagItems } = useMentionDataViewModel()
  const editorWrapperRef = useRef<HTMLDivElement>(null)

  const inlineContentSpecs = useMemo(() => {
    return {
      ...defaultInlineContentSpecs,
      mention: createMentionInlineSpec(),
      hashtag: createHashtagInlineSpec(),
    }
  }, [])

  const editor = useCreateBlockNote({
    initialContent,
    inlineContentSpecs,
    uploadFile: async (file: File) => {
      const formData = new FormData()
      formData.append('file', file)
      
      const response = await fetch('/api/files/upload', {
        method: 'POST',
        body: formData,
      })
      
      if (!response.ok) {
        throw new Error('Failed to upload file')
      }
      
      const data = await response.json()
      return data.data.url
    },
  })

  // Sync editor content when prop changes (only if content is valid and different)
  useEffect(() => {
    if (!editor) return
    
    // Only sync if content is valid and non-empty
    if (content && Array.isArray(content) && content.length > 0) {
      try {
        const currentContent = JSON.stringify(editor.document)
        const newContent = JSON.stringify(content)
        if (currentContent !== newContent) {
          // Validate content before replacing
          const isValid = content.every((block: any) => {
            return block && typeof block === 'object' && block.type
          })
          
          if (isValid) {
            editor.replaceBlocks(editor.document, content as PartialBlock[])
          }
        }
      } catch (error) {
        console.warn('Error syncing BlockNote content:', error)
      }
    } else if (content && Array.isArray(content) && content.length === 0) {
      // Clear editor if content is explicitly empty
      try {
        editor.replaceBlocks(editor.document, [])
      } catch (error) {
        console.warn('Error clearing BlockNote editor:', error)
      }
    }
  }, [content, editor])

  // Handle editor changes
  useEffect(() => {
    if (!editor) return

    const handleChange = () => {
      const blocks = editor.document
      updateContent(blocks as EditorContent)
      onChange?.(blocks as EditorContent)
    }

    editor.onChange(handleChange)
    
    return () => {
      // Cleanup if needed
    }
  }, [editor, onChange, updateContent])

  // Handle keyboard shortcuts (Cmd/Ctrl+Enter to send)
  useEffect(() => {
    if (!editor || !onSend || !editorWrapperRef.current) return

    const handleKeyDown = (event: KeyboardEvent) => {
      // Check for Cmd+Enter (Mac) or Ctrl+Enter (Windows/Linux)
      if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') {
        event.preventDefault()
        event.stopPropagation()
        onSend()
      }
    }

    const editorElement = editorWrapperRef.current
    editorElement.addEventListener('keydown', handleKeyDown, true)
    
    return () => {
      editorElement.removeEventListener('keydown', handleKeyDown, true)
    }
  }, [editor, onSend])

  if (!editor) {
    return (
      <div className="blocknote-editor-wrapper w-full min-h-24 p-3 bg-slate-800 border border-slate-700 rounded-md">
        <div className="text-slate-400">Loading editor...</div>
      </div>
    )
  }

  return (
    <>
      <style dangerouslySetInnerHTML={{__html: `
        .blocknote-editor-wrapper .bn-editor {
          width: 100% !important;
          max-width: 100% !important;
        }
        .blocknote-editor-wrapper .bn-block-content {
          width: 100% !important;
          max-width: 100% !important;
        }
        .blocknote-editor-wrapper .bn-inline-content {
          width: 100% !important;
        }
        .blocknote-editor-wrapper .bn-slash-menu {
          display: none !important;
        }
        .blocknote-editor-wrapper .bn-side-menu {
          display: none !important;
        }
        .blocknote-editor-wrapper .bn-formatting-toolbar {
          display: none !important;
        }
      `}} />
      <div 
        ref={editorWrapperRef} 
        className="blocknote-editor-wrapper w-full"
        style={{ 
          width: '100%',
          maxWidth: '100%'
        }}
      >
        <BlockNoteViewRaw 
          editor={editor} 
          editable={editable} 
          theme="dark"
          sideMenu={false}
        >
        <SuggestionMenuController
          triggerCharacter="@"
          getItems={async (query) => {
            const items = await getMentionItems(query)
            return items.map((item) => ({
              id: item.id,
              title: item.title,
              group: item.group,
            }))
          }}
          onItemClick={(item) => {
            const mentionItem = item as { id: string; title: string; userId?: string; userName?: string }
            editor.insertInlineContent([
              {
                type: 'mention',
                props: {
                  userId: mentionItem.userId || mentionItem.id,
                  userName: mentionItem.userName || mentionItem.title,
                },
              },
            ])
          }}
        />
        <SuggestionMenuController
          triggerCharacter="#"
          getItems={async (query) => {
            const items = await getHashtagItems(query)
            return items.map((item) => ({
              id: item.id,
              title: item.title,
              group: item.group,
            }))
          }}
          onItemClick={(item) => {
            const hashtagItem = item as { id: string; title: string; entityType?: string; entityId?: string; entityName?: string }
            editor.insertInlineContent([
              {
                type: 'hashtag',
                props: {
                  entityType: hashtagItem.entityType || 'channel',
                  entityId: hashtagItem.entityId || hashtagItem.id,
                  entityName: hashtagItem.entityName || hashtagItem.title,
                },
              },
            ])
          }}
        />
      </BlockNoteViewRaw>
      </div>
    </>
  )
}
