/**
 * @registry-id: TestProductMixModel
 * @created: 2026-01-27T00:00:00.000Z
 * @last-modified: 2026-01-29T00:00:00.000Z
 * @description: Test Product Mix data model - stores raw parsed product mix data without transformations
 * @last-fix: [2026-01-29] Collection renamed to test-bork-product-mix (pattern test-source-type)
 * 
 * @exports-to:
 * ✓ app/lib/services/rawDataStorageService.ts => Stores raw product mix data
 * ✓ app/api/inbox/test-data/[type]/route.ts => Retrieves product mix data
 */

import mongoose, { Schema, Document, Model } from 'mongoose'

export interface ITestProductMix extends Document {
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

const TestProductMixSchema = new Schema<ITestProductMix>(
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
    collection: 'test-bork-product-mix',
    strict: false, // Allow dynamic fields from raw data
  }
)

// Indexes for common queries
TestProductMixSchema.index({ sourceEmailId: 1, parsedAt: -1 })
TestProductMixSchema.index({ parsedAt: -1 })

const TestProductMix: Model<ITestProductMix> =
  mongoose.models.TestProductMix || mongoose.model<ITestProductMix>('TestProductMix', TestProductMixSchema)

export default TestProductMix
