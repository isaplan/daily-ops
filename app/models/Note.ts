/**
 * @registry-id: NoteModel
 * @created: 2026-01-15T10:00:00.000Z
 * @last-modified: 2026-01-15T14:30:00.000Z
 * @description: Note schema and model with slug-based routing and publish status
 * @last-fix: [2026-01-15] Added slug, status, and published_at for individual note pages
 * 
 * @exports-to:
 * ✓ app/api/notes/** => Note CRUD operations with slug resolution
 * ✓ app/api/notes/[id]/todos/** => Note-todo linking
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
  
  linked_todos: mongoose.Types.ObjectId[];
  
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
    
    linked_todos: [{ type: Schema.Types.ObjectId, ref: 'Todo' }],
    
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
NoteSchema.index({ linked_todos: 1 });
NoteSchema.index({ is_archived: 1 });
NoteSchema.index({ status: 1 });

// Pre-save hook to generate slug if not present
NoteSchema.pre('save', async function (next) {
  if (!this.slug) {
    const { generateSlug } = await import('@/lib/utils/slug');
    let slug = generateSlug(this.title);
    
    // Check for duplicate slugs and append timestamp if needed
    let existingSlug = await mongoose.model('Note').findOne({ slug });
    if (existingSlug) {
      slug = `${slug}-${Date.now()}`;
    }
    
    this.slug = slug;
  }
  next();
});

const Note: Model<INote> = mongoose.models.Note || mongoose.model<INote>('Note', NoteSchema);

export default Note;
