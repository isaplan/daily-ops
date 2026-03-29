/**
 * @registry-id: messageParser
 * @created: 2026-01-16T15:55:00.000Z
 * @last-modified: 2026-01-16T15:55:00.000Z
 * @description: Message parser for @mentions (note, todo, channel) with type-safe parsing
 * @last-fix: [2026-01-16] Initial implementation for Design V2 bi-directional linking
 * 
 * @imports-from:
 *   - app/lib/types/connections.ts => EntityType type
 * 
 * @exports-to:
 *   ✓ app/lib/services/messageService.ts => Uses messageParser for mention extraction
 *   ✓ app/components/chats/** => Components use messageParser for rendering mentions
 */

import type { EntityType } from '@/lib/types/connections'

export interface ParsedMention {
  type: EntityType
  id: string
  slug?: string
  original: string
  startIndex: number
  endIndex: number
}

export function parseMentions(text: string): ParsedMention[] {
  const mentions: ParsedMention[] = []
  const patterns = [
    { regex: /@note:([a-zA-Z0-9-_]+)/g, type: 'note' as EntityType },
    { regex: /@todo:([a-zA-Z0-9]+)/g, type: 'todo' as EntityType },
    { regex: /@channel:([a-zA-Z0-9-_]+)/g, type: 'channel' as EntityType },
  ]

  patterns.forEach((pattern) => {
    let match: RegExpExecArray | null
    while ((match = pattern.regex.exec(text)) !== null) {
      mentions.push({
        type: pattern.type,
        id: match[1],
        slug: pattern.type === 'note' ? match[1] : undefined,
        original: match[0],
        startIndex: match.index,
        endIndex: match.index + match[0].length,
      })
    }
  })

  return mentions.sort((a, b) => a.startIndex - b.startIndex)
}

export function renderMentions(text: string, mentions: ParsedMention[]): Array<string | ParsedMention> {
  if (mentions.length === 0) {
    return [text]
  }

  const parts: Array<string | ParsedMention> = []
  let lastIndex = 0

  mentions.forEach((mention) => {
    if (mention.startIndex > lastIndex) {
      parts.push(text.slice(lastIndex, mention.startIndex))
    }
    parts.push(mention)
    lastIndex = mention.endIndex
  })

  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex))
  }

  return parts
}
