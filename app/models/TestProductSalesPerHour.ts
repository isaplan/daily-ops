/**
 * @registry-id: TestProductSalesPerHourModel
 * @created: 2026-01-27T00:00:00.000Z
 * @last-modified: 2026-01-27T00:00:00.000Z
 * @description: Test Product Sales Per Hour data model - stores raw parsed product sales per hour data without transformations
 * @last-fix: [2026-01-27] Initial implementation
 * 
 * @exports-to:
 * ✓ app/lib/services/rawDataStorageService.ts => Stores raw product sales per hour data
 * ✓ app/api/inbox/test-data/[type]/route.ts => Retrieves product sales per hour data
 */

import mongoose, { Schema, Document, Model } from 'mongoose'

export interface ITestProductSalesPerHour extends Document {
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

const TestProductSalesPerHourSchema = new Schema<ITestProductSalesPerHour>(
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
    collection: 'test-product-sales-per-hour',
    strict: false, // Allow dynamic fields from raw data
  }
)

// Indexes for common queries
TestProductSalesPerHourSchema.index({ sourceEmailId: 1, parsedAt: -1 })
TestProductSalesPerHourSchema.index({ parsedAt: -1 })

const TestProductSalesPerHour: Model<ITestProductSalesPerHour> =
  mongoose.models.TestProductSalesPerHour || mongoose.model<ITestProductSalesPerHour>('TestProductSalesPerHour', TestProductSalesPerHourSchema)

export default TestProductSalesPerHour
