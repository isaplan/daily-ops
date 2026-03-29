/**
 * @registry-id: CategoryMasterModel
 * @created: 2026-01-30T00:00:00.000Z
 * @last-modified: 2026-01-30T00:00:00.000Z
 * @description: Category master schema for enrichment (name)
 * @last-fix: [2026-01-30] Initial implementation
 *
 * @exports-to:
 *   ✓ app/lib/services/cache/masterDataCacheService.ts
 *   ✓ app/lib/services/enrichment/salesEnrichmentService.ts
 *   ✓ app/models/ProductMaster.ts => ref CategoryMaster
 */

import mongoose, { Schema, Document, Model } from 'mongoose';

export interface ICategoryMaster extends Document {
  name: string;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
}

const CategoryMasterSchema = new Schema<ICategoryMaster>(
  {
    name: { type: String, required: true },
    is_active: { type: Boolean, default: true },
    created_at: { type: Date, default: Date.now },
    updated_at: { type: Date, default: Date.now },
  },
  {
    timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' },
  }
);

CategoryMasterSchema.index({ name: 1 });

const CategoryMaster: Model<ICategoryMaster> =
  mongoose.models.CategoryMaster || mongoose.model<ICategoryMaster>('CategoryMaster', CategoryMasterSchema);

export default CategoryMaster;
