/**
 * @registry-id: ContractTypeMasterModel
 * @created: 2026-01-30T00:00:00.000Z
 * @last-modified: 2026-01-30T00:00:00.000Z
 * @description: Contract type master schema for enrichment (code, name, hourly_rate)
 * @last-fix: [2026-01-30] Initial implementation
 *
 * @exports-to:
 *   ✓ app/lib/services/cache/masterDataCacheService.ts
 *   ✓ app/lib/services/enrichment/laborEnrichmentService.ts
 *   ✓ app/lib/services/data-sources/eitjeCSVImportService.ts
 *   ✓ app/lib/services/data-sources/eitjeAPIImportService.ts
 */

import mongoose, { Schema, Document, Model } from 'mongoose';

export interface IContractTypeMaster extends Document {
  code: string;
  name: string;
  hourly_rate: number;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
}

const ContractTypeMasterSchema = new Schema<IContractTypeMaster>(
  {
    code: { type: String, required: true },
    name: { type: String, required: true },
    hourly_rate: { type: Number, default: 0 },
    is_active: { type: Boolean, default: true },
    created_at: { type: Date, default: Date.now },
    updated_at: { type: Date, default: Date.now },
  },
  {
    timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' },
  }
);

ContractTypeMasterSchema.index({ code: 1 });

const ContractTypeMaster: Model<IContractTypeMaster> =
  mongoose.models.ContractTypeMaster ||
  mongoose.model<IContractTypeMaster>('ContractTypeMaster', ContractTypeMasterSchema);

export default ContractTypeMaster;
