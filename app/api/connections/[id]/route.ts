/**
 * @registry-id: connectionByIdAPI
 * @created: 2026-01-16T15:30:00.000Z
 * @last-modified: 2026-01-16T15:30:00.000Z
 * @description: API route for deleting bi-directional entity links
 * @last-fix: [2026-01-16] Initial implementation for Design V2 bi-directional linking
 * 
 * @imports-from:
 *   - app/lib/types/connections.ts => EntityType type
 *   - app/models/Note.ts => Note model
 *   - app/models/Channel.ts => Channel model
 *   - app/models/Todo.ts => Todo model
 * 
 * @exports-to:
 *   ✓ app/lib/services/connectionService.ts => Calls this API route
 */

import { NextRequest, NextResponse } from 'next/server'
import { connectToDatabase } from '@/lib/mongodb'
import Note from '@/models/Note'
import Channel from '@/models/Channel'
import Todo from '@/models/Todo'
import type { EntityType } from '@/lib/types/connections'

async function getModelByType(type: EntityType) {
  switch (type) {
    case 'note':
      return Note
    case 'channel':
      return Channel
    case 'todo':
      return Todo
    default:
      return null
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    await connectToDatabase()
    const { searchParams } = new URL(request.url)
    const sourceType = searchParams.get('source_type') as EntityType
    const targetType = searchParams.get('target_type') as EntityType
    const targetId = params.id

    if (!sourceType || !targetType || !targetId) {
      return NextResponse.json(
        { success: false, error: 'source_type, target_type, and target_id are required' },
        { status: 400 }
      )
    }

    const SourceModel = await getModelByType(sourceType)
    const TargetModel = await getModelByType(targetType)

    if (!SourceModel || !TargetModel) {
      return NextResponse.json(
        { success: false, error: 'Invalid entity type' },
        { status: 400 }
      )
    }

    const sourceId = searchParams.get('source_id')
    if (!sourceId) {
      return NextResponse.json(
        { success: false, error: 'source_id is required' },
        { status: 400 }
      )
    }

    const source = await SourceModel.findById(sourceId)
    const target = await TargetModel.findById(targetId)

    if (!source || !target) {
      return NextResponse.json(
        { success: false, error: 'Source or target entity not found' },
        { status: 404 }
      )
    }

    if (source.linked_entities) {
      source.linked_entities = source.linked_entities.filter(
        (link: { type: string; id: string }) =>
          !(link.type === targetType && link.id.toString() === targetId)
      )
    }
    if (target.linked_entities) {
      target.linked_entities = target.linked_entities.filter(
        (link: { type: string; id: string }) =>
          !(link.type === sourceType && link.id.toString() === sourceId)
      )
    }

    await source.save()
    await target.save()

    return NextResponse.json({ success: true })
  } catch (error) {
    return NextResponse.json(
      { success: false, error: 'Failed to delete entity link' },
      { status: 500 }
    )
  }
}
