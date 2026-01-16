/**
 * @registry-id: connectionsAPI
 * @created: 2026-01-16T15:30:00.000Z
 * @last-modified: 2026-01-16T15:30:00.000Z
 * @description: API route for creating and listing bi-directional entity links
 * @last-fix: [2026-01-16] Initial implementation for Design V2 bi-directional linking
 * 
 * @imports-from:
 *   - app/lib/types/connections.ts => EntityLink, CreateEntityLinkDto types
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
import type { CreateEntityLinkDto, LinkedEntitiesResponse, EntityType } from '@/lib/types/connections'

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

export async function GET(request: NextRequest) {
  try {
    await connectToDatabase()
    const { searchParams } = new URL(request.url)
    const entityType = searchParams.get('entity_type') as EntityType
    const entityId = searchParams.get('entity_id')
    const skip = parseInt(searchParams.get('skip') || '0', 10)
    const limit = Math.min(parseInt(searchParams.get('limit') || '50', 10), 100)

    if (!entityType || !entityId) {
      return NextResponse.json(
        { success: false, error: 'entity_type and entity_id are required' },
        { status: 400 }
      )
    }

    const Model = await getModelByType(entityType)
    if (!Model) {
      return NextResponse.json(
        { success: false, error: 'Invalid entity type' },
        { status: 400 }
      )
    }

    const entity = await Model.findById(entityId)
    if (!entity) {
      return NextResponse.json(
        { success: false, error: 'Entity not found' },
        { status: 404 }
      )
    }

    const linkedEntities = entity.linked_entities || []
    const total = linkedEntities.length
    const paginated = linkedEntities.slice(skip, skip + limit)

    const linkedDetails: LinkedEntitiesResponse['linked_entities'] = []
    for (const link of paginated) {
      const LinkModel = await getModelByType(link.type)
      if (LinkModel) {
        const linkedEntity = await LinkModel.findById(link.id).select('title name slug status _id')
        if (linkedEntity) {
          linkedDetails.push({
            type: link.type,
            id: linkedEntity._id.toString(),
            title: (linkedEntity as { title?: string }).title,
            name: (linkedEntity as { name?: string }).name,
            slug: (linkedEntity as { slug?: string }).slug,
            status: (linkedEntity as { status?: string }).status,
          })
        }
      }
    }

    const response: LinkedEntitiesResponse = {
      linked_entities: linkedDetails,
      total,
      skip,
      limit,
    }

    return NextResponse.json({ success: true, data: response })
  } catch (error) {
    return NextResponse.json(
      { success: false, error: 'Failed to fetch linked entities' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    await connectToDatabase()
    const body: CreateEntityLinkDto = await request.json()

    const { source_type, source_id, target_type, target_id } = body

    if (!source_type || !source_id || !target_type || !target_id) {
      return NextResponse.json(
        { success: false, error: 'All fields are required' },
        { status: 400 }
      )
    }

    if (source_type === target_type && source_id === target_id) {
      return NextResponse.json(
        { success: false, error: 'Cannot link entity to itself' },
        { status: 400 }
      )
    }

    const SourceModel = await getModelByType(source_type)
    const TargetModel = await getModelByType(target_type)

    if (!SourceModel || !TargetModel) {
      return NextResponse.json(
        { success: false, error: 'Invalid entity type' },
        { status: 400 }
      )
    }

    const source = await SourceModel.findById(source_id)
    const target = await TargetModel.findById(target_id)

    if (!source || !target) {
      return NextResponse.json(
        { success: false, error: 'Source or target entity not found' },
        { status: 404 }
      )
    }

    if (!source.linked_entities) {
      source.linked_entities = []
    }
    if (!target.linked_entities) {
      target.linked_entities = []
    }

    const sourceLinkExists = source.linked_entities.some(
      (link: { type: string; id: string }) => link.type === target_type && link.id.toString() === target_id
    )
    const targetLinkExists = target.linked_entities.some(
      (link: { type: string; id: string }) => link.type === source_type && link.id.toString() === source_id
    )

    if (!sourceLinkExists) {
      source.linked_entities.push({ type: target_type, id: target_id })
    }
    if (!targetLinkExists) {
      target.linked_entities.push({ type: source_type, id: source_id })
    }

    await source.save()
    await target.save()

    return NextResponse.json({
      success: true,
      data: {
        source: { type: source_type, id: source_id },
        target: { type: target_type, id: target_id },
      },
    })
  } catch (error) {
    return NextResponse.json(
      { success: false, error: 'Failed to create entity link' },
      { status: 500 }
    )
  }
}
