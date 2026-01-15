/**
 * @registry-id: LocationModel
 * @created: 2026-01-15T10:00:00.000Z
 * @last-modified: 2026-01-15T10:00:00.000Z
 * @description: Location schema and model
 * @last-fix: [2026-01-15] Initial POC setup
 */

import mongoose, { Schema, Document, Model } from 'mongoose';

export interface ILocation extends Document {
  name: string;
  address?: string;
  city?: string;
  country?: string;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
}

const LocationSchema = new Schema<ILocation>(
  {
    name: { type: String, required: true, unique: true },
    address: { type: String },
    city: { type: String },
    country: { type: String },
    is_active: { type: Boolean, default: true },
    created_at: { type: Date, default: Date.now },
    updated_at: { type: Date, default: Date.now },
  },
  {
    timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' },
  }
);

// name already has unique index from schema definition

const Location: Model<ILocation> = mongoose.models.Location || mongoose.model<ILocation>('Location', LocationSchema);

export default Location;
