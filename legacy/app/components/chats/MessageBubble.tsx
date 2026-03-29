/**
 * Message bubble component - Related to ChatThread component
 * Renders chat message HTML with mentions, attachments, and formatting
 */

'use client'

import { type ChatMessage } from '@/lib/services/chatService'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Card } from '@/components/ui/card'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Button } from '@/components/ui/button'
import { MoreVertical, Edit, Trash2 } from 'lucide-react'
import '../chats/MessageContent.css'

interface MessageBubbleProps {
  message: ChatMessage
  onEdit?: (messageId: string) => void
  onDelete?: (messageId: string) => void
  canEdit?: boolean
  canDelete?: boolean
}

export default function MessageBubble({
  message,
  onEdit,
  onDelete,
  canEdit = false,
  canDelete = false,
}: MessageBubbleProps) {
  const authorName =
    typeof message.author_id === 'object' ? message.author_id.name : 'Unknown'
  const authorEmail =
    typeof message.author_id === 'object' ? message.author_id.email : undefined

  return (
    <Card className="bg-card/50 border-border/50">
      <div className="flex items-start gap-3 p-4">
        <Avatar className="h-10 w-10 shrink-0">
          <AvatarFallback className="bg-gradient-to-br from-indigo-500 to-blue-500 text-white text-sm font-bold">
            {authorName.charAt(0).toUpperCase()}
          </AvatarFallback>
        </Avatar>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1.5">
            <span className="font-semibold text-foreground">{authorName}</span>
            {authorEmail && (
              <span className="text-xs text-muted-foreground">{authorEmail}</span>
            )}
            <span className="text-xs text-muted-foreground">
              {new Date(message.timestamp).toLocaleTimeString()}
            </span>
            {message.edited_at && (
              <span className="text-xs text-muted-foreground/70">(edited)</span>
            )}
            {(canEdit || canDelete) && (
              <div className="ml-auto">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground"
                    >
                      <MoreVertical className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    {canEdit && onEdit && (
                      <DropdownMenuItem
                        onClick={() => onEdit(message._id)}
                        className="cursor-pointer"
                      >
                        <Edit className="mr-2 h-4 w-4" />
                        Edit
                      </DropdownMenuItem>
                    )}
                    {canDelete && onDelete && (
                      <DropdownMenuItem
                        onClick={() => onDelete(message._id)}
                        className="cursor-pointer text-destructive focus:text-destructive"
                      >
                        <Trash2 className="mr-2 h-4 w-4" />
                        Delete
                      </DropdownMenuItem>
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            )}
          </div>
          <div
            className="message-html-content"
            dangerouslySetInnerHTML={{ __html: message.editor_html }}
          />
          {message.attachments && message.attachments.length > 0 && (
            <div className="mt-2 space-y-2">
              {message.attachments.map((att) => (
                <div key={att.id} className="rounded overflow-hidden">
                  {att.type === 'image' && (
                    <img
                      src={att.url}
                      alt={att.filename || 'Attachment'}
                      className="max-w-full max-h-96 rounded"
                      loading="lazy"
                    />
                  )}
                  {att.type === 'video' && (
                    <video
                      src={att.url}
                      controls
                      className="max-w-full max-h-96 rounded"
                    >
                      Your browser does not support the video tag.
                    </video>
                  )}
                  {att.type === 'file' && (
                    <a
                      href={att.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary hover:text-primary/80 underline flex items-center gap-2 transition-colors"
                    >
                      <span>{att.filename || 'Download file'}</span>
                      <span className="text-xs text-muted-foreground">
                        ({(att.size / 1024).toFixed(1)} KB)
                      </span>
                    </a>
                  )}
                </div>
              ))}
            </div>
          )}
          {message.linked_entities && message.linked_entities.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-2">
              {message.linked_entities.map((link, idx) => (
                <a
                  key={idx}
                  href={`/${link.type}s/${link.id}`}
                  className="text-xs px-2 py-1 bg-muted/50 rounded text-primary hover:text-primary/80 transition-colors"
                >
                  #{link.type}: {link.title || link.name || link.id}
                </a>
              ))}
            </div>
          )}
        </div>
      </div>
    </Card>
  )
}
