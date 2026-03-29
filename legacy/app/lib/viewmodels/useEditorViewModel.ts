/**
 * @registry-id: useEditorViewModel
 * @created: 2026-01-18T00:00:00.000Z
 * @last-modified: 2026-01-18T00:00:00.000Z
 * @description: MVVM ViewModel for BlockNote editor state management
 * @last-fix: [2026-01-18] Updated metadata to reflect current implementation (removed Yjs claim)
 * 
 * @imports-from:
 *   - app/lib/types/editor.types.ts => EditorContent, EditorMessage types
 *   - app/lib/types/collaboration.types.ts => UserPresence, CollaborationState types
 *   - app/lib/services/editorService.ts => EditorService methods
 *   - app/lib/services/collaborationService.ts => CollaborationService methods
 * 
 * @exports-to:
 *   ✓ app/components/editors/BlockNoteEditor.tsx => useEditorViewModel() hook
 *   ✓ app/components/chats/ChatsDashboard.tsx => editor state sync
 *   ✓ app/components/notes/NoteDetailPage.tsx => editor state for notes
 */

'use client'

import { useState, useCallback, useEffect, useRef } from 'react'
import type { Block } from '@blocknote/core'
import type { EditorContent, EditorMessage } from '@/lib/types/editor.types'
import type { UserPresence, CollaborationState } from '@/lib/types/collaboration.types'
import { EditorService } from '@/lib/services/editorService'
import { CollaborationService } from '@/lib/services/collaborationService'

interface UseEditorViewModelProps {
  roomId: string
  userId?: string
  userName?: string
  initialContent?: EditorContent
}

interface UseEditorViewModelReturn {
  content: EditorContent
  presence: UserPresence[]
  collaboration: CollaborationState
  isLoading: boolean
  error: string | null
  updateContent: (content: EditorContent) => void
  syncPresence: (presence: Partial<UserPresence>) => void
  serialize: () => EditorMessage
  reset: () => void
}

export function useEditorViewModel({
  roomId,
  userId,
  userName,
  initialContent = [],
}: UseEditorViewModelProps): UseEditorViewModelReturn {
  const [content, setContent] = useState<EditorContent>(initialContent)
  const [presence, setPresence] = useState<UserPresence[]>([])
  const [collaboration, setCollaboration] = useState<CollaborationState>({
    provider: null,
    activeUsers: [],
    isConnected: false,
    isSyncing: false,
    error: null,
  })
  const [isLoading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const presenceRef = useRef<UserPresence | null>(null)

  useEffect(() => {
    if (userId && userName) {
      const userPresence = CollaborationService.createUserPresence(userId, userName)
      presenceRef.current = userPresence
      setPresence((prev) => {
        const existing = prev.find((p) => p.userId === userId)
        if (existing) return prev
        return [...prev, userPresence]
      })
    }

    return () => {
      if (presenceRef.current) {
        CollaborationService.removePresence(presenceRef.current)
      }
    }
  }, [userId, userName])

  const updateContent = useCallback((newContent: EditorContent) => {
    setContent(newContent)
  }, [])

  const syncPresence = useCallback(
    (updates: Partial<UserPresence>) => {
      if (presenceRef.current) {
        const updated = CollaborationService.updatePresence(presenceRef.current, updates)
        presenceRef.current = updated
        setPresence((prev) => prev.map((p) => (p.userId === updated.userId ? updated : p)))
      }
    },
    []
  )

  const serialize = useCallback((): EditorMessage => {
    const plainText = EditorService.parseEditorContent(content)
    const mentions = EditorService.extractMentions(content)
    return {
      content,
      mentions,
      plainText,
    }
  }, [content])

  const reset = useCallback(() => {
    setContent(initialContent)
    setError(null)
  }, [initialContent])

  return {
    content,
    presence,
    collaboration,
    isLoading,
    error,
    updateContent,
    syncPresence,
    serialize,
    reset,
  }
}
