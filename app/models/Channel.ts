/**
 * @registry-id: ChannelModel
 * @created: 2026-01-15T10:00:00.000Z
 * @last-modified: 2026-01-16T15:40:00.000Z
 * @description: Channel schema and model
 * @last-fix: [2026-01-16] Added linked_entities array for bi-directional linking (Design V2)
 * 
 * @exports-to:
 *   ✓ app/api/channels/** => Channel CRUD operations
 *   ✓ app/api/connections/** => Bi-directional entity linking
 */

import mongoose, { Schema, Document, Model } from 'mongoose';

export interface IChannel extends Document {
  name: string;
  description?: string;
  type: 'location' | 'team' | 'member' | 'general' | 'project';
  
  connected_to: {
    location_id?: mongoose.Types.ObjectId;
    team_id?: mongoose.Types.ObjectId;
    member_id?: mongoose.Types.ObjectId;
  };
  
  members: mongoose.Types.ObjectId[];
  created_by: mongoose.Types.ObjectId;
  
  linked_entities?: Array<{
    type: 'note' | 'channel' | 'todo' | 'decision' | 'event';
    id: mongoose.Types.ObjectId;
  }>;
  
  is_archived: boolean;
  
  created_at: Date;
  updated_at: Date;
}

const ChannelSchema = new Schema<IChannel>(
  {
    name: { type: String, required: true },
    description: { type: String },
    type: {
      type: String,
      enum: ['location', 'team', 'member', 'general', 'project'],
      required: true,
    },
    
    connected_to: {
      location_id: { type: Schema.Types.ObjectId, ref: 'Location' },
      team_id: { type: Schema.Types.ObjectId, ref: 'Team' },
      member_id: { type: Schema.Types.ObjectId, ref: 'Member' },
    },
    
    members: [{ type: Schema.Types.ObjectId, ref: 'Member' }],
    created_by: { type: Schema.Types.ObjectId, ref: 'Member', required: true },
    
    linked_entities: [{
      type: {
        type: String,
        enum: ['note', 'channel', 'todo', 'decision', 'event'],
        required: true,
      },
      id: { type: Schema.Types.ObjectId, required: true },
    }],
    
    is_archived: { type: Boolean, default: false },
    
    created_at: { type: Date, default: Date.now },
    updated_at: { type: Date, default: Date.now },
  },
  {
    timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' },
  }
);

ChannelSchema.index({ 'connected_to.location_id': 1 });
ChannelSchema.index({ 'connected_to.team_id': 1 });
ChannelSchema.index({ 'connected_to.member_id': 1 });
ChannelSchema.index({ members: 1 });
ChannelSchema.index({ 'linked_entities.id': 1 });
ChannelSchema.index({ 'linked_entities.type': 1 });
ChannelSchema.index({ type: 1 });

const Channel: Model<IChannel> = mongoose.models.Channel || mongoose.model<IChannel>('Channel', ChannelSchema);

export default Channel;
