/**
 * @registry-id: editorService
 * @created: 2026-01-18T00:00:00.000Z
 * @last-modified: 2026-01-18T00:00:00.000Z
 * @description: Service for BlockNote editor content parsing, serialization, and conversion
 * @last-fix: [2026-01-18] Implemented mention extraction from BlockNote blocks with recursive traversal
 * 
 * @imports-from:
 *   - app/lib/types/editor.types.ts => EditorContent, EditorSerialized types
 * 
 * @exports-to:
 *   ✓ app/lib/viewmodels/useEditorViewModel.ts => Uses editorService methods
 *   ✓ app/components/editors/BlockNoteEditor.tsx => Uses editorService for serialization
 */

import type { Block } from '@blocknote/core'
import type { EditorContent, EditorSerialized, EditorMention } from '@/lib/types/editor.types'

export class EditorService {
  /**
   * Convert BlockNote content to plain text
   */
  static parseEditorContent(content: EditorContent): string {
    if (!Array.isArray(content) || content.length === 0) {
      return ''
    }

    return content
      .map((block) => {
        if (typeof block === 'string') return block
        if (block.type === 'paragraph' && block.content) {
          return Array.isArray(block.content)
            ? block.content.map((item) => (typeof item === 'string' ? item : item.text || '')).join('')
            : ''
        }
        if (block.type === 'heading' && block.content) {
          return Array.isArray(block.content)
            ? block.content.map((item) => (typeof item === 'string' ? item : item.text || '')).join('')
            : ''
        }
        return ''
      })
      .filter(Boolean)
      .join('\n')
  }

  /**
   * Serialize BlockNote content for database storage
   */
  static serializeMessage(content: EditorContent, mentions?: EditorMention[]): EditorSerialized {
    const plainText = this.parseEditorContent(content)
    return {
      json: content,
      plainText,
    }
  }

  /**
   * Deserialize database content to BlockNote format
   */
  static deserializeMessage(data: { editor_content?: EditorContent; content?: string }): EditorContent | null {
    if (data.editor_content && Array.isArray(data.editor_content)) {
      return data.editor_content as EditorContent
    }
    if (data.content) {
      // Convert plain text to simple paragraph block
      return [
        {
          id: crypto.randomUUID(),
          type: 'paragraph',
          content: data.content,
        } as Block,
      ]
    }
    return null
  }

  /**
   * Extract mentions from BlockNote content
   */
  static extractMentions(content: EditorContent): EditorMention[] {
    const mentions: EditorMention[] = []
    
    const traverseBlocks = (blocks: EditorContent): void => {
      for (const block of blocks) {
        if (typeof block === 'string' || !block) continue
        
        if (block.content && Array.isArray(block.content)) {
          for (const contentItem of block.content) {
            if (typeof contentItem === 'string') continue
            
            if (contentItem.type === 'mention' && contentItem.props) {
              const props = contentItem.props as { userId?: string; userName?: string }
              if (props.userId && props.userName) {
                mentions.push({
                  type: 'user',
                  id: props.userId,
                  name: props.userName,
                })
              }
            }
            
            if (contentItem.type === 'hashtag' && contentItem.props) {
              const props = contentItem.props as {
                entityType?: string
                entityId?: string
                entityName?: string
              }
              if (props.entityId && props.entityName) {
                const mentionType = props.entityType === 'channel' ? 'channel' :
                  props.entityType === 'note' ? 'note' :
                  props.entityType === 'todo' ? 'todo' : 'channel'
                mentions.push({
                  type: mentionType,
                  id: props.entityId,
                  name: props.entityName,
                })
              }
            }
          }
        }
        
        if (block.children && Array.isArray(block.children)) {
          traverseBlocks(block.children)
        }
      }
    }
    
    traverseBlocks(content)
    return mentions
  }
}
