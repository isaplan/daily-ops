/**
 * @registry-id: InboxEmailModel
 * @created: 2026-01-26T00:00:00.000Z
 * @last-modified: 2026-01-26T00:00:00.000Z
 * @description: InboxEmail schema and model - stores email metadata from Gmail
 * @last-fix: [2026-01-26] Initial implementation with soft archiving support
 * 
 * @exports-to:
 * ✓ app/lib/services/inboxService.ts => InboxEmail CRUD operations
 * ✓ app/api/inbox/** => Email list and detail endpoints
 * ✓ app/lib/viewmodels/useInboxViewModel.ts => Email state management
 */

import mongoose, { Schema, Document, Model } from 'mongoose'

export interface IInboxEmail extends Document {
  messageId: string
  from: string
  subject: string
  receivedAt: Date
  storedAt: Date
  status: 'received' | 'processing' | 'completed' | 'failed'
  hasAttachments: boolean
  attachmentCount: number
  summary?: string
  errorMessage?: string
  processedAt?: Date
  lastAttempt?: Date
  retryCount: number
  archived: boolean
  archivedAt?: Date
  metadata: {
    labels?: string[]
    threadId?: string
  }
  created_at: Date
  updated_at: Date
}

const InboxEmailSchema = new Schema<IInboxEmail>(
  {
    messageId: { type: String, required: true, unique: true, index: true },
    from: { type: String, required: true, index: true },
    subject: { type: String, required: true },
    receivedAt: { type: Date, required: true, index: true },
    storedAt: { type: Date, default: Date.now },
    status: {
      type: String,
      enum: ['received', 'processing', 'completed', 'failed'],
      default: 'received',
      index: true,
    },
    hasAttachments: { type: Boolean, default: false },
    attachmentCount: { type: Number, default: 0 },
    summary: { type: String, maxlength: 500 },
    errorMessage: { type: String },
    processedAt: { type: Date },
    lastAttempt: { type: Date },
    retryCount: { type: Number, default: 0 },
    archived: { type: Boolean, default: false, index: true },
    archivedAt: { type: Date },
    metadata: {
      labels: [{ type: String }],
      threadId: { type: String },
    },
    created_at: { type: Date, default: Date.now },
    updated_at: { type: Date, default: Date.now },
  },
  {
    timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' },
  }
)

// Compound indexes for common queries
InboxEmailSchema.index({ archived: 1, status: 1 })
InboxEmailSchema.index({ archived: 1, receivedAt: -1 })
InboxEmailSchema.index({ from: 1, receivedAt: -1 })

const InboxEmail: Model<IInboxEmail> =
  mongoose.models.InboxEmail || mongoose.model<IInboxEmail>('InboxEmail', InboxEmailSchema)

export default InboxEmail
