/**
 * @registry-id: TestSalesModel
 * @created: 2026-01-27T00:00:00.000Z
 * @last-modified: 2026-01-29T00:00:00.000Z
 * @description: Test Sales data model - stores raw parsed sales data without transformations
 * @last-fix: [2026-01-29] Collection renamed to test-bork-sales (pattern test-source-type)
 * 
 * @exports-to:
 * ✓ app/lib/services/rawDataStorageService.ts => Stores raw sales data
 * ✓ app/api/inbox/test-data/[type]/route.ts => Retrieves sales data
 */

import mongoose, { Schema, Document, Model } from 'mongoose'

export interface ITestSales extends Document {
  // Raw data fields (dynamic - stored as-is from parsed file)
  [key: string]: unknown
  
  // Metadata
  sourceEmailId: mongoose.Types.ObjectId
  sourceAttachmentId: mongoose.Types.ObjectId
  sourceFileName: string
  fileFormat: 'csv' | 'xlsx' | 'pdf'
  parsedAt: Date
  created_at: Date
  updated_at: Date
}

const TestSalesSchema = new Schema<ITestSales>(
  {
    sourceEmailId: { type: Schema.Types.ObjectId, ref: 'InboxEmail', required: true, index: true },
    sourceAttachmentId: { type: Schema.Types.ObjectId, ref: 'EmailAttachment', required: true, index: true },
    sourceFileName: { type: String, required: true },
    fileFormat: {
      type: String,
      enum: ['csv', 'xlsx', 'pdf'],
      required: true,
    },
    parsedAt: { type: Date, default: Date.now, index: true },
    created_at: { type: Date, default: Date.now },
    updated_at: { type: Date, default: Date.now },
  },
  {
    timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' },
    collection: 'test-bork-sales',
    strict: false, // Allow dynamic fields from raw data
  }
)

// Indexes for common queries
TestSalesSchema.index({ sourceEmailId: 1, parsedAt: -1 })
TestSalesSchema.index({ parsedAt: -1 })

const TestSales: Model<ITestSales> =
  mongoose.models.TestSales || mongoose.model<ITestSales>('TestSales', TestSalesSchema)

export default TestSales
