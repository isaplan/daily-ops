/**
 * @registry-id: NotificationModel
 * @created: 2026-01-15T10:00:00.000Z
 * @last-modified: 2026-01-15T10:00:00.000Z
 * @description: Notification schema for user notifications
 * @last-fix: [2026-01-15] Initial implementation
 * 
 * @exports-to:
 * ✓ app/api/notifications/** => Notification operations
 * ✓ app/lib/services/NotificationService.ts => Notification sending
 * ✓ app/components/notifications/** => Notification UI
 */

import mongoose, { Schema, Document, Model } from 'mongoose';

export interface INotification extends Document {
  member_id: mongoose.Types.ObjectId;
  
  type: 'message_mention' | 'todo_assigned' | 'todo_updated' | 'decision_created' | 'event_created' | 'labor_discrepancy' | 'system';
  title: string;
  message: string;
  
  link?: {
    type: 'todo' | 'note' | 'decision' | 'channel' | 'event' | 'member' | 'location' | 'team';
    id: mongoose.Types.ObjectId;
    url?: string;
  };
  
  read: boolean;
  read_at?: Date;
  
  metadata?: {
    from_member?: mongoose.Types.ObjectId;
    channel_id?: mongoose.Types.ObjectId;
    todo_id?: mongoose.Types.ObjectId;
    event_id?: mongoose.Types.ObjectId;
    [key: string]: any;
  };
  
  created_at: Date;
  updated_at: Date;
}

const NotificationSchema = new Schema<INotification>(
  {
    member_id: { type: Schema.Types.ObjectId, ref: 'Member', required: true },
    
    type: {
      type: String,
      enum: ['message_mention', 'todo_assigned', 'todo_updated', 'decision_created', 'event_created', 'labor_discrepancy', 'system'],
      required: true,
    },
    title: { type: String, required: true },
    message: { type: String, required: true },
    
    link: {
      type: {
        type: String,
        enum: ['todo', 'note', 'decision', 'channel', 'event', 'member', 'location', 'team'],
      },
      id: { type: Schema.Types.ObjectId },
      url: { type: String },
    },
    
    read: { type: Boolean, default: false },
    read_at: { type: Date },
    
    metadata: {
      type: Map,
      of: Schema.Types.Mixed,
      default: {},
    },
    
    created_at: { type: Date, default: Date.now },
    updated_at: { type: Date, default: Date.now },
  },
  {
    timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' },
  }
);

NotificationSchema.index({ member_id: 1, read: 1, created_at: -1 });
NotificationSchema.index({ member_id: 1, created_at: -1 });
NotificationSchema.index({ read: 1 });

const Notification: Model<INotification> = mongoose.models.Notification || mongoose.model<INotification>('Notification', NotificationSchema);

export default Notification;
