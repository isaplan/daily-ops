/**
 * @registry-id: ProductMasterModel
 * @created: 2026-01-30T00:00:00.000Z
 * @last-modified: 2026-01-30T00:00:00.000Z
 * @description: Product master schema for enrichment (name, code, category, cogs, margin)
 * @last-fix: [2026-01-30] Initial implementation
 *
 * @exports-to:
 *   ✓ app/lib/services/cache/masterDataCacheService.ts
 *   ✓ app/lib/services/enrichment/salesEnrichmentService.ts
 *   ✓ app/lib/services/data-sources/borkCSVImportService.ts
 *   ✓ app/lib/services/data-sources/borkAPIImportService.ts
 */

import mongoose, { Schema, Document, Model } from 'mongoose';

export interface IProductMaster extends Document {
  name: string;
  code: string;
  category_id: mongoose.Types.ObjectId;
  cogs: number;
  margin: number;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
}

const ProductMasterSchema = new Schema<IProductMaster>(
  {
    name: { type: String, required: true },
    code: { type: String, required: true },
    category_id: { type: Schema.Types.ObjectId, ref: 'CategoryMaster', required: true },
    cogs: { type: Number, default: 0 },
    margin: { type: Number, default: 0 },
    is_active: { type: Boolean, default: true },
    created_at: { type: Date, default: Date.now },
    updated_at: { type: Date, default: Date.now },
  },
  {
    timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' },
  }
);

ProductMasterSchema.index({ code: 1 });
ProductMasterSchema.index({ category_id: 1 });

const ProductMaster: Model<IProductMaster> =
  mongoose.models.ProductMaster || mongoose.model<IProductMaster>('ProductMaster', ProductMasterSchema);

export default ProductMaster;
