/**
 * @registry-id: EditorWrapper
 * @created: 2026-01-18T00:00:00.000Z
 * @last-modified: 2026-01-20T00:00:00.000Z
 * @description: Client Component wrapper for BlockNote editor with Suspense boundary
 * @last-fix: [2026-01-20] Added onSend prop for keyboard shortcut support (Cmd/Ctrl+Enter)
 * 
 * @imports-from:
 *   - app/components/editors/BlockNoteEditor.tsx => BlockNoteEditor component
 *   - app/components/ui/skeleton.tsx => Skeleton loading state
 * 
 * @exports-to:
 *   ✓ app/(authenticated)/chats/page.tsx => Uses EditorWrapper for chat messages
 *   ✓ app/components/notes/NoteDetailPage.tsx => Uses EditorWrapper for note editing
 */

'use client'

import { Suspense } from 'react'
import dynamic from 'next/dynamic'
import { Skeleton } from '@/components/ui/skeleton'
import type { EditorContent } from '@/lib/types/editor.types'

// Dynamic import to avoid SSR issues with BlockNote
const BlockNoteEditor = dynamic(() => import('./BlockNoteEditor'), {
  ssr: false,
  loading: () => (
    <div className="w-full min-h-24 p-3 bg-slate-800 border border-slate-700 rounded-md">
      <Skeleton className="h-20 w-full" />
    </div>
  ),
})

interface EditorWrapperProps {
  content?: EditorContent
  onChange?: (content: EditorContent) => void
  editable?: boolean
  roomId: string
  userId?: string
  userName?: string
  placeholder?: string
  onSend?: () => void
}

export default function EditorWrapper({
  content,
  onChange,
  editable = true,
  roomId,
  userId,
  userName,
  placeholder,
  onSend,
}: EditorWrapperProps) {
  return (
    <Suspense
      fallback={
        <div className="flex flex-col gap-2 p-4">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-20 w-full" />
        </div>
      }
    >
      <BlockNoteEditor
        content={content}
        onChange={onChange}
        editable={editable}
        roomId={roomId}
        userId={userId}
        userName={userName}
        placeholder={placeholder}
        onSend={onSend}
      />
    </Suspense>
  )
}
