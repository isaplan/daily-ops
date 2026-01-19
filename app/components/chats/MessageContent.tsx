/**
 * @registry-id: MessageContent
 * @created: 2026-01-20T00:00:00.000Z
 * @last-modified: 2026-01-20T00:00:00.000Z
 * @description: Component to render message content - HTML or plain text with proper formatting
 * @last-fix: [2026-01-20] Initial implementation - renders HTML content with line breaks preserved
 */

'use client'

import { parseMentions, renderMentions } from '@/lib/utils/messageParser'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import './MessageContent.css'

interface MessageContentProps {
  content: string
  editorContent?: string | Array<Record<string, unknown>>
  mentions?: string[]
}

export default function MessageContent({ content, editorContent, mentions }: MessageContentProps) {
  // If we have HTML editor content, render it
  if (editorContent) {
    let htmlContent = ''
    
    if (typeof editorContent === 'string') {
      htmlContent = editorContent.trim()
    } else if (Array.isArray(editorContent)) {
      // BlockNote format - convert to HTML (basic conversion)
      htmlContent = content // Fallback to plain text for now
    }
    
    // If we have HTML content (starts with < or contains HTML tags), render it
    if (htmlContent && (htmlContent.startsWith('<') || /<[a-z][\s\S]*>/i.test(htmlContent))) {
      // Ensure we have valid HTML - TipTap outputs <p> tags
      if (htmlContent === '<p></p>') {
        // Empty content, fall through to plain text
      } else {
        return (
          <div 
            className="message-html-content"
            dangerouslySetInnerHTML={{ __html: htmlContent }}
          />
        )
      }
    }
  }

  // Otherwise, render plain text with mention parsing
  const parsedMentions = parseMentions(content)
  const renderedParts = renderMentions(content, parsedMentions)

  return (
    <div className="text-slate-200 whitespace-pre-wrap break-words">
      {renderedParts.map((part, idx) => {
        if (typeof part === 'string') {
          return <span key={idx}>{part}</span>
        }
        return (
          <Button
            key={idx}
            variant="link"
            className="h-auto p-0 text-blue-400 hover:text-blue-300"
            asChild
          >
            <Link
              href={
                part.type === 'note'
                  ? `/notes/${part.slug || part.id}`
                  : part.type === 'todo'
                  ? `/todos`
                  : `/channels/${part.id}`
              }
            >
              {part.original}
            </Link>
          </Button>
        )
      })}
    </div>
  )
}
