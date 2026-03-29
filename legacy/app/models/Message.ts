/**
 * @registry-id: MessageModel
 * @created: 2026-01-15T10:00:00.000Z
 * @last-modified: 2026-01-15T14:30:00.000Z
 * @description: Message schema and model for Channel messages
 * @last-fix: [2026-01-15] Added is_system field for system notifications
 * 
 * @exports-to:
 * ✓ app/api/channels/[id]/messages/** => Message CRUD operations
 * ✓ app/components/channels/** => Message display components
 */

import mongoose, { Schema, Document, Model } from 'mongoose';

export interface IMessage extends Document {
  channel_id: mongoose.Types.ObjectId;
  member_id: mongoose.Types.ObjectId;
  text: string;
  timestamp: Date;
  edited_at?: Date;
  
  reactions: Record<string, mongoose.Types.ObjectId[]>;
  
  mentioned_members: mongoose.Types.ObjectId[];
  linked_todo?: mongoose.Types.ObjectId;
  linked_note?: mongoose.Types.ObjectId;
  linked_event?: mongoose.Types.ObjectId;
  
  thread: Array<{
    member_id: mongoose.Types.ObjectId;
    text: string;
    timestamp: Date;
    reactions: Record<string, mongoose.Types.ObjectId[]>;
  }>;
  
  is_pinned: boolean;
  is_deleted: boolean;
  is_system: boolean;
  
  created_at: Date;
  updated_at: Date;
}

const MessageSchema = new Schema<IMessage>(
  {
    channel_id: { type: Schema.Types.ObjectId, ref: 'Channel', required: true },
    member_id: { type: Schema.Types.ObjectId, ref: 'Member', required: true },
    text: { type: String, required: true },
    timestamp: { type: Date, default: Date.now },
    edited_at: { type: Date },
    
    reactions: {
      type: Map,
      of: [{ type: Schema.Types.ObjectId, ref: 'Member' }],
      default: {},
    },
    
    mentioned_members: [{ type: Schema.Types.ObjectId, ref: 'Member' }],
    linked_todo: { type: Schema.Types.ObjectId, ref: 'Todo' },
    linked_note: { type: Schema.Types.ObjectId, ref: 'Note' },
    linked_event: { type: Schema.Types.ObjectId, ref: 'Event' },
    
    thread: [{
      member_id: { type: Schema.Types.ObjectId, ref: 'Member', required: true },
      text: { type: String, required: true },
      timestamp: { type: Date, default: Date.now },
      reactions: {
        type: Map,
        of: [{ type: Schema.Types.ObjectId, ref: 'Member' }],
        default: {},
      },
    }],
    
    is_pinned: { type: Boolean, default: false },
    is_deleted: { type: Boolean, default: false },
    is_system: { type: Boolean, default: false },
    
    created_at: { type: Date, default: Date.now },
    updated_at: { type: Date, default: Date.now },
  },
  {
    timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' },
  }
);

MessageSchema.index({ channel_id: 1, timestamp: -1 });
MessageSchema.index({ member_id: 1 });
MessageSchema.index({ mentioned_members: 1 });
MessageSchema.index({ is_pinned: 1 });

const Message: Model<IMessage> = mongoose.models.Message || mongoose.model<IMessage>('Message', MessageSchema);

export default Message;
