/**
 * @registry-id: ProcessingLogModel
 * @created: 2026-01-26T00:00:00.000Z
 * @last-modified: 2026-01-26T00:00:00.000Z
 * @description: ProcessingLog schema and model - audit trail for all inbox operations
 * @last-fix: [2026-01-26] Initial implementation
 * 
 * @exports-to:
 * ✓ app/lib/services/inboxService.ts => Log creation
 * ✓ app/lib/services/documentParserService.ts => Parse event logging
 * ✓ app/lib/services/gmailApiService.ts => Fetch event logging
 * ✓ app/api/inbox/** => Log query endpoints
 */

import mongoose, { Schema, Document, Model } from 'mongoose'

export interface IProcessingLog extends Document {
  emailId?: mongoose.Types.ObjectId
  attachmentId?: mongoose.Types.ObjectId
  eventType: 'fetch' | 'parse' | 'validate' | 'store' | 'error'
  status: 'success' | 'warning' | 'error'
  message: string
  timestamp: Date
  duration?: number
  details?: Record<string, unknown>
  created_at: Date
}

const ProcessingLogSchema = new Schema<IProcessingLog>(
  {
    emailId: { type: Schema.Types.ObjectId, ref: 'InboxEmail', index: true },
    attachmentId: { type: Schema.Types.ObjectId, ref: 'EmailAttachment', index: true },
    eventType: {
      type: String,
      enum: ['fetch', 'parse', 'validate', 'store', 'error'],
      required: true,
      index: true,
    },
    status: {
      type: String,
      enum: ['success', 'warning', 'error'],
      required: true,
      index: true,
    },
    message: { type: String, required: true },
    timestamp: { type: Date, default: Date.now, index: true },
    duration: { type: Number },
    details: { type: Schema.Types.Mixed },
    created_at: { type: Date, default: Date.now },
  },
  {
    timestamps: { createdAt: 'created_at', updatedAt: false },
  }
)

// Indexes for common queries
ProcessingLogSchema.index({ emailId: 1, timestamp: -1 })
ProcessingLogSchema.index({ attachmentId: 1, timestamp: -1 })
ProcessingLogSchema.index({ eventType: 1, status: 1, timestamp: -1 })

const ProcessingLog: Model<IProcessingLog> =
  mongoose.models.ProcessingLog || mongoose.model<IProcessingLog>('ProcessingLog', ProcessingLogSchema)

export default ProcessingLog
