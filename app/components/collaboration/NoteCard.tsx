/**
 * @registry-id: NoteCard
 * @created: 2026-01-16T15:50:00.000Z
 * @last-modified: 2026-01-16T15:50:00.000Z
 * @description: Note card component using shadcn microcomponents only
 * @last-fix: [2026-01-16] Initial implementation for Design V2 Collaboration dashboard
 * 
 * @imports-from:
 *   - app/components/ui/** => Shadcn microcomponents only
 *   - app/lib/types/note.types.ts => Note type
 * 
 * @exports-to:
 *   ✓ app/components/collaboration/CollaborationDashboard.tsx => Uses NoteCard
 */

'use client'

import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import type { Note } from '@/lib/types/note.types'

interface NoteCardProps {
  note: Note
}

export default function NoteCard({ note }: NoteCardProps) {
  return (
    <Card className="border-white/10 bg-slate-900/70 hover:bg-slate-900/90 transition-colors">
      <CardHeader>
        <div className="flex items-start justify-between">
          <CardTitle className="text-lg line-clamp-2">{note.title}</CardTitle>
          {note.is_pinned && (
            <Badge variant="outline" className="text-yellow-400 border-yellow-400">
              📌
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          <p className="text-sm text-slate-300 line-clamp-3">{note.content}</p>
          <div className="flex flex-wrap gap-2">
            {note.tags?.slice(0, 3).map((tag) => (
              <Badge key={tag} variant="secondary" className="text-xs">
                {tag}
              </Badge>
            ))}
            {note.status && (
              <Badge variant={note.status === 'published' ? 'default' : 'outline'}>
                {note.status}
              </Badge>
            )}
          </div>
          <div className="flex items-center justify-between pt-2">
            <span className="text-xs text-slate-400">
              {new Date(note.created_at).toLocaleDateString()}
            </span>
            <Button variant="ghost" size="sm" asChild>
              <Link href={`/notes/${note.slug || note._id}`}>View</Link>
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
