/**
 * @registry-id: ParsedDataModel
 * @created: 2026-01-26T00:00:00.000Z
 * @last-modified: 2026-01-26T00:00:00.000Z
 * @description: ParsedData schema and model - stores extracted structured data from attachments
 * @last-fix: [2026-01-26] Initial implementation
 * 
 * @exports-to:
 * ✓ app/lib/services/dataMappingService.ts => ParsedData storage and mapping
 * ✓ app/lib/services/documentParserService.ts => ParsedData creation
 * ✓ app/api/inbox/** => Parsed data endpoints
 * ✓ app/lib/viewmodels/useInboxViewModel.ts => Parsed data display
 */

import mongoose, { Schema, Document, Model } from 'mongoose'

export interface IParsedData extends Document {
  attachmentId: mongoose.Types.ObjectId
  emailId: mongoose.Types.ObjectId
  documentType: string
  extractedAt: Date
  format: 'csv' | 'xlsx' | 'pdf' | 'unknown'
  rowsProcessed: number
  rowsValid: number
  rowsFailed: number
  data: {
    headers: string[]
    rows: Record<string, unknown>[]
    metadata?: Record<string, unknown>
  }
  mapping: {
    mappedToCollection?: string
    matchedRecords?: number
    createdRecords?: number
    updatedRecords?: number
  }
  validationErrors?: Array<{
    row: number
    column: string
    error: string
  }>
  created_at: Date
  updated_at: Date
}

const ParsedDataSchema = new Schema<IParsedData>(
  {
    attachmentId: { type: Schema.Types.ObjectId, ref: 'EmailAttachment', required: true, index: true },
    emailId: { type: Schema.Types.ObjectId, ref: 'InboxEmail', required: true, index: true },
    documentType: { type: String, required: true, index: true },
    extractedAt: { type: Date, default: Date.now },
    format: {
      type: String,
      enum: ['csv', 'xlsx', 'pdf', 'unknown'],
      required: true,
    },
    rowsProcessed: { type: Number, default: 0 },
    rowsValid: { type: Number, default: 0 },
    rowsFailed: { type: Number, default: 0 },
    data: {
      headers: [{ type: String }],
      rows: [{ type: Schema.Types.Mixed }],
      metadata: { type: Schema.Types.Mixed },
    },
    mapping: {
      mappedToCollection: { type: String },
      matchedRecords: { type: Number, default: 0 },
      createdRecords: { type: Number, default: 0 },
      updatedRecords: { type: Number, default: 0 },
    },
    validationErrors: [
      {
        row: { type: Number, required: true },
        column: { type: String, required: true },
        error: { type: String, required: true },
      },
    ],
    created_at: { type: Date, default: Date.now },
    updated_at: { type: Date, default: Date.now },
  },
  {
    timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' },
  }
)

// Indexes for common queries
ParsedDataSchema.index({ attachmentId: 1, documentType: 1 })
ParsedDataSchema.index({ emailId: 1, documentType: 1 })
ParsedDataSchema.index({ 'mapping.mappedToCollection': 1 })

const ParsedData: Model<IParsedData> =
  mongoose.models.ParsedData || mongoose.model<IParsedData>('ParsedData', ParsedDataSchema)

export default ParsedData
