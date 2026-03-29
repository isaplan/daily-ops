/**
 * @registry-id: TestBasisReportModel
 * @created: 2026-01-27T00:00:00.000Z
 * @last-modified: 2026-01-27T00:00:00.000Z
 * @description: Test Basis Report data model - stores raw parsed basis report data without transformations
 * @last-fix: [2026-01-27] Initial implementation
 * 
 * @exports-to:
 * ✓ app/lib/services/rawDataStorageService.ts => Stores raw basis report data
 * ✓ app/api/inbox/test-data/[type]/route.ts => Retrieves basis report data
 */

import mongoose, { Schema, Document, Model } from 'mongoose'

export interface ITestBasisReport extends Document {
  // Raw data fields (dynamic - stored as-is from parsed file)
  [key: string]: unknown
  
  // Metadata
  sourceEmailId: mongoose.Types.ObjectId
  sourceAttachmentId: mongoose.Types.ObjectId
  sourceFileName: string
  fileFormat: 'csv' | 'xlsx' | 'pdf' | 'html'
  parsedAt: Date
  created_at: Date
  updated_at: Date
}

const TestBasisReportSchema = new Schema<ITestBasisReport>(
  {
    sourceEmailId: { type: Schema.Types.ObjectId, ref: 'InboxEmail', required: true, index: true },
    sourceAttachmentId: { type: Schema.Types.ObjectId, ref: 'EmailAttachment', required: true, index: true },
    sourceFileName: { type: String, required: true },
    fileFormat: {
      type: String,
      enum: ['csv', 'xlsx', 'pdf', 'html'],
      required: true,
    },
    parsedAt: { type: Date, default: Date.now, index: true },
    created_at: { type: Date, default: Date.now },
    updated_at: { type: Date, default: Date.now },
  },
  {
    timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' },
    collection: 'test-basis-report',
    strict: false, // Allow dynamic fields from raw data
  }
)

// Indexes for common queries
TestBasisReportSchema.index({ sourceEmailId: 1, parsedAt: -1 })
TestBasisReportSchema.index({ parsedAt: -1 })

const TestBasisReport: Model<ITestBasisReport> =
  mongoose.models.TestBasisReport || mongoose.model<ITestBasisReport>('TestBasisReport', TestBasisReportSchema)

export default TestBasisReport
