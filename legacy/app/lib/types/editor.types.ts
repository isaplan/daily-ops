/**
 * @registry-id: editorTypes
 * @created: 2026-01-18T00:00:00.000Z
 * @last-modified: 2026-01-18T00:00:00.000Z
 * @description: Type definitions for BlockNote editor content, blocks, mentions, and attachments
 * @last-fix: [2026-01-18] Initial implementation for BlockNote integration
 * 
 * @exports-to:
 *   ✓ app/lib/services/editorService.ts => Uses EditorContent, EditorBlock types
 *   ✓ app/lib/viewmodels/useEditorViewModel.ts => Uses editor types for state
 *   ✓ app/components/editors/BlockNoteEditor.tsx => Uses editor types for props
 *   ✓ app/components/chats/ChatsDashboard.tsx => Uses EditorContent for message display
 *   ✓ app/components/notes/NoteDetailPage.tsx => Uses EditorContent for note editing
 */

import type { Block } from '@blocknote/core'

export type EditorContent = Block[]

export interface EditorBlock extends Block {
  id: string
  type: string
  content?: string
  props?: Record<string, unknown>
}

export interface EditorMention {
  type: 'user' | 'channel' | 'note' | 'todo'
  id: string
  name: string
  slug?: string
}

export interface EditorAttachment {
  id: string
  url: string
  filename: string
  mimeType: string
  size: number
  uploadedAt: string
  uploadedBy: string
}

export interface EditorMessage {
  content: EditorContent
  mentions?: EditorMention[]
  attachments?: EditorAttachment[]
  plainText?: string
}

export interface EditorSerialized {
  json: EditorContent
  html?: string
  plainText: string
}
