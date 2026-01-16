/**
 * @registry-id: NoteModel
 * @created: 2026-01-15T10:00:00.000Z
 * @last-modified: 2026-01-16T15:40:00.000Z
 * @description: Note schema and model with slug-based routing and publish status
 * @last-fix: [2026-01-16] Added linked_entities array for bi-directional linking (Design V2)
 * 
 * @exports-to:
 * ✓ app/api/notes/** => Note CRUD operations with slug resolution
 * ✓ app/api/notes/[id]/todos/** => Note-todo linking
 * ✓ app/api/connections/** => Bi-directional entity linking
 * ✓ app/notes/[slug]/page.tsx => Individual note page lookup
 * ✓ app/components/NoteDetailPage.tsx => Display note details
 */

import mongoose, { Schema, Document, Model } from 'mongoose';

export interface INote extends Document {
  title: string;
  content: string;
  slug: string;
  
  author_id: mongoose.Types.ObjectId;
  
  connected_to: {
    location_id?: mongoose.Types.ObjectId;
    team_id?: mongoose.Types.ObjectId;
    member_id?: mongoose.Types.ObjectId;
  };
  
  // Individual members responsible for this note (attending, responsible, etc.)
  connected_members: Array<{
    member_id: mongoose.Types.ObjectId;
    role?: 'responsible' | 'attending' | 'reviewer' | 'contributor';
    added_at: Date;
  }>;
  
  linked_todos: mongoose.Types.ObjectId[];
  
  linked_entities?: Array<{
    type: 'note' | 'channel' | 'todo' | 'decision' | 'event';
    id: mongoose.Types.ObjectId;
  }>;
  
  tags?: string[];
  is_pinned: boolean;
  is_archived: boolean;
  
  status: 'draft' | 'published';
  published_at?: Date;
  
  created_at: Date;
  updated_at: Date;
}

const NoteSchema = new Schema<INote>(
  {
    title: { type: String, required: true },
    content: { type: String, required: true },
    slug: { type: String, lowercase: true, sparse: true, index: true },
    
    author_id: { type: Schema.Types.ObjectId, ref: 'Member', required: true },
    
    connected_to: {
      location_id: { type: Schema.Types.ObjectId, ref: 'Location' },
      team_id: { type: Schema.Types.ObjectId, ref: 'Team' },
      member_id: { type: Schema.Types.ObjectId, ref: 'Member' },
    },
    
    connected_members: [{
      member_id: { type: Schema.Types.ObjectId, ref: 'Member', required: true },
      role: {
        type: String,
        enum: ['responsible', 'attending', 'reviewer', 'contributor'],
        default: 'contributor',
      },
      added_at: { type: Date, default: Date.now },
    }],
    
    linked_todos: [{ type: Schema.Types.ObjectId, ref: 'Todo' }],
    
    linked_entities: [{
      type: {
        type: String,
        enum: ['note', 'channel', 'todo', 'decision', 'event'],
        required: true,
      },
      id: { type: Schema.Types.ObjectId, required: true },
    }],
    
    tags: [{ type: String }],
    is_pinned: { type: Boolean, default: false },
    is_archived: { type: Boolean, default: false },
    
    status: { type: String, enum: ['draft', 'published'], default: 'draft' },
    published_at: { type: Date },
    
    created_at: { type: Date, default: Date.now },
    updated_at: { type: Date, default: Date.now },
  },
  {
    timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' },
  }
);

NoteSchema.index({ author_id: 1 });
NoteSchema.index({ slug: 1 }, { sparse: true });
NoteSchema.index({ 'connected_to.location_id': 1 });
NoteSchema.index({ 'connected_to.team_id': 1 });
NoteSchema.index({ 'connected_to.member_id': 1 });
NoteSchema.index({ 'connected_members.member_id': 1 });
NoteSchema.index({ linked_todos: 1 });
NoteSchema.index({ 'linked_entities.id': 1 });
NoteSchema.index({ 'linked_entities.type': 1 });
NoteSchema.index({ is_archived: 1 });
NoteSchema.index({ status: 1 });

const Note: Model<INote> = mongoose.models.Note || mongoose.model<INote>('Note', NoteSchema);

export default Note;
