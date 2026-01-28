/**
 * @registry-id: EmailAttachmentModel
 * @created: 2026-01-26T00:00:00.000Z
 * @last-modified: 2026-01-26T00:00:00.000Z
 * @description: EmailAttachment schema and model - stores attachment metadata and parse status
 * @last-fix: [2026-01-26] Initial implementation with Eitje metadata sheet support
 * 
 * @exports-to:
 * ✓ app/lib/services/inboxService.ts => Attachment CRUD operations
 * ✓ app/lib/services/documentParserService.ts => Attachment parsing
 * ✓ app/api/inbox/** => Attachment endpoints
 * ✓ app/lib/viewmodels/useInboxViewModel.ts => Attachment state management
 */

import mongoose, { Schema, Document, Model } from 'mongoose'

export interface IEmailAttachment extends Document {
  emailId: mongoose.Types.ObjectId
  fileName: string
  mimeType: string
  fileSize: number
  googleAttachmentId: string
  downloadedAt: Date
  storedLocally: boolean
  documentType: 'hours' | 'contracts' | 'finance' | 'sales' | 'payroll' | 'bi' | 'other' | 'formitabele' | 'pasy' | 'coming_soon'
  parseStatus: 'pending' | 'parsing' | 'success' | 'failed'
  parseError?: string
  parsedDataRef?: mongoose.Types.ObjectId
  metadata: {
    format: 'csv' | 'xlsx' | 'pdf' | 'unknown'
    sheets?: string[]
    rowCount?: number
    columnCount?: number
    userInfo?: Record<string, unknown>
    delimiter?: string
  }
  created_at: Date
  updated_at: Date
}

const EmailAttachmentSchema = new Schema<IEmailAttachment>(
  {
    emailId: { type: Schema.Types.ObjectId, ref: 'InboxEmail', required: true, index: true },
    fileName: { type: String, required: true },
    mimeType: { type: String, required: true },
    fileSize: { type: Number, required: true },
    googleAttachmentId: { type: String, required: true },
    downloadedAt: { type: Date, default: Date.now },
    storedLocally: { type: Boolean, default: false },
    documentType: {
      type: String,
      enum: ['hours', 'contracts', 'finance', 'sales', 'payroll', 'bi', 'other', 'formitabele', 'pasy', 'coming_soon'],
      default: 'other',
      index: true,
    },
    parseStatus: {
      type: String,
      enum: ['pending', 'parsing', 'success', 'failed'],
      default: 'pending',
      index: true,
    },
    parseError: { type: String },
    parsedDataRef: { type: Schema.Types.ObjectId, ref: 'ParsedData' },
    metadata: {
      format: {
        type: String,
        enum: ['csv', 'xlsx', 'pdf', 'unknown'],
        default: 'unknown',
      },
      sheets: [{ type: String }],
      rowCount: { type: Number },
      columnCount: { type: Number },
      userInfo: { type: Schema.Types.Mixed },
      delimiter: { type: String },
    },
    created_at: { type: Date, default: Date.now },
    updated_at: { type: Date, default: Date.now },
  },
  {
    timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' },
  }
)

// Indexes for common queries
EmailAttachmentSchema.index({ emailId: 1, parseStatus: 1 })
EmailAttachmentSchema.index({ documentType: 1, parseStatus: 1 })
EmailAttachmentSchema.index({ parsedDataRef: 1 })

const EmailAttachment: Model<IEmailAttachment> =
  mongoose.models.EmailAttachment ||
  mongoose.model<IEmailAttachment>('EmailAttachment', EmailAttachmentSchema)

export default EmailAttachment
