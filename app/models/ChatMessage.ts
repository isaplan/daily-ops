/**
 * @registry-id: ChatMessageModel
 * @created: 2026-01-20T00:00:00.000Z
 * @last-modified: 2026-01-20T00:00:00.000Z
 * @description: Chat message schema for TipTap editor content with mentions, attachments, and linked entities
 * @last-fix: [2026-01-20] Initial implementation - chat-specific message model with rich content support
 * 
 * @exports-to:
 *   ✓ app/api/chats/messages/** => Chat message CRUD operations
 *   ✓ app/lib/services/chatService.ts => Chat message service
 */

import mongoose, { Schema, Document, Model } from 'mongoose'

export interface IChatMessage extends Document {
  channel_id: mongoose.Types.ObjectId
  author_id: mongoose.Types.ObjectId
  
  // Rich content storage
  editor_html: string              // TipTap HTML output
  plain_text: string               // Extracted for search/preview
  
  // Mentions & links
  mentioned_members: mongoose.Types.ObjectId[]    // @user IDs
  
  // Many-to-many linked entities (same pattern as Notes)
  linked_entities?: Array<{
    type: 'note' | 'channel' | 'todo' | 'decision' | 'event'
    id: mongoose.Types.ObjectId
  }>
  
  // Media attachments
  attachments?: Array<{
    id: string                     // UUID
    url: string
    type: 'image' | 'video' | 'file'
    mime_type: string
    size: number
    upload_timestamp: Date
    uploaded_by: mongoose.Types.ObjectId
    filename?: string
  }>
  
  // Metadata
  timestamp: Date
  edited_at?: Date                 // null = unedited
  is_deleted: boolean
  reactions?: Map<string, mongoose.Types.ObjectId[]>
  
  // Thread support
  thread_count?: number
  is_thread_starter?: boolean
  
  created_at: Date
  updated_at: Date
}

const ChatMessageSchema = new Schema<IChatMessage>(
  {
    channel_id: { type: Schema.Types.ObjectId, ref: 'Channel', required: true },
    author_id: { type: Schema.Types.ObjectId, ref: 'Member', required: true },
    
    editor_html: { type: String, required: true },
    plain_text: { type: String, required: true },
    
    mentioned_members: [{ type: Schema.Types.ObjectId, ref: 'Member' }],
    
    linked_entities: [{
      type: {
        type: String,
        enum: ['note', 'channel', 'todo', 'decision', 'event'],
        required: true,
      },
      id: { type: Schema.Types.ObjectId, required: true },
    }],
    
    attachments: [{
      id: { type: String, required: true },
      url: { type: String, required: true },
      type: {
        type: String,
        enum: ['image', 'video', 'file'],
        required: true,
      },
      mime_type: { type: String, required: true },
      size: { type: Number, required: true },
      upload_timestamp: { type: Date, default: Date.now },
      uploaded_by: { type: Schema.Types.ObjectId, ref: 'Member', required: true },
      filename: { type: String },
    }],
    
    timestamp: { type: Date, default: Date.now },
    edited_at: { type: Date },
    is_deleted: { type: Boolean, default: false },
    
    reactions: {
      type: Map,
      of: [{ type: Schema.Types.ObjectId, ref: 'Member' }],
      default: {},
    },
    
    thread_count: { type: Number, default: 0 },
    is_thread_starter: { type: Boolean, default: false },
    
    created_at: { type: Date, default: Date.now },
    updated_at: { type: Date, default: Date.now },
  },
  {
    timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' },
  }
)

ChatMessageSchema.index({ channel_id: 1, timestamp: -1 })
ChatMessageSchema.index({ author_id: 1 })
ChatMessageSchema.index({ mentioned_members: 1 })
ChatMessageSchema.index({ 'linked_entities.id': 1 })
ChatMessageSchema.index({ 'linked_entities.type': 1 })
ChatMessageSchema.index({ is_deleted: 1 })

const ChatMessage: Model<IChatMessage> =
  mongoose.models.ChatMessage || mongoose.model<IChatMessage>('ChatMessage', ChatMessageSchema)

export default ChatMessage
