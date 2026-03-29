/**
 * @registry-id: decisionAPI
 * @created: 2026-01-16T22:30:00.000Z
 * @last-modified: 2026-01-16T22:30:00.000Z
 * @description: Single decision API route - GET, PUT, DELETE
 * @last-fix: [2026-01-16] Initial implementation with full CRUD
 */

import { NextRequest, NextResponse } from 'next/server'
import dbConnect from '@/lib/mongodb'
import mongoose from 'mongoose'
import Decision from '@/models/Decision'
import Member from '@/models/Member'
import Location from '@/models/Location'
import Team from '@/models/Team'
import { getErrorMessage } from '@/lib/types/errors'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await dbConnect()

    // Ensure all models are registered
    if (!mongoose.models.Member) {
      await import('@/models/Member')
    }
    if (!mongoose.models.Location) {
      await import('@/models/Location')
    }
    if (!mongoose.models.Team) {
      await import('@/models/Team')
    }

    const { id } = await params
    const decision = await Decision.findById(id)
      .populate('created_by', 'name email')
      .populate('approved_by', 'name email')
      .populate('involved_members', 'name email')
      .populate('connected_to.location_id', 'name')
      .populate('connected_to.team_id', 'name')
      .populate('connected_to.member_id', 'name email')

    if (!decision) {
      return NextResponse.json(
        { success: false, error: 'Decision not found' },
        { status: 404 }
      )
    }

    return NextResponse.json({ success: true, data: decision })
  } catch (error: unknown) {
    console.error('Error fetching decision:', error)
    return NextResponse.json(
      { success: false, error: getErrorMessage(error) },
      { status: 500 }
    )
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await dbConnect()
    const body = await request.json()
    const { id } = await params

    const updateData: Record<string, unknown> = {}
    if (body.title !== undefined) updateData.title = body.title
    if (body.description !== undefined) updateData.description = body.description
    if (body.decision !== undefined) updateData.decision = body.decision
    if (body.status !== undefined) updateData.status = body.status
    if (body.approved_by !== undefined) updateData.approved_by = body.approved_by
    if (body.involved_members !== undefined) updateData.involved_members = body.involved_members
    if (body.connected_to !== undefined) updateData.connected_to = body.connected_to

    const decision = await Decision.findByIdAndUpdate(id, updateData, {
      new: true,
      runValidators: true,
    })
      .populate('created_by', 'name email')
      .populate('approved_by', 'name email')
      .populate('involved_members', 'name email')

    if (!decision) {
      return NextResponse.json(
        { success: false, error: 'Decision not found' },
        { status: 404 }
      )
    }

    return NextResponse.json({ success: true, data: decision })
  } catch (error: unknown) {
    console.error('Error updating decision:', error)
    return NextResponse.json(
      { success: false, error: getErrorMessage(error) },
      { status: 400 }
    )
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await dbConnect()
    const { id } = await params

    const decision = await Decision.findByIdAndDelete(id)

    if (!decision) {
      return NextResponse.json(
        { success: false, error: 'Decision not found' },
        { status: 404 }
      )
    }

    return NextResponse.json({ success: true, message: 'Decision deleted' })
  } catch (error: unknown) {
    console.error('Error deleting decision:', error)
    return NextResponse.json(
      { success: false, error: getErrorMessage(error) },
      { status: 500 }
    )
  }
}
