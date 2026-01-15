/**
 * @registry-id: decisionsAPI
 * @created: 2026-01-15T10:00:00.000Z
 * @last-modified: 2026-01-15T10:00:00.000Z
 * @description: Decisions API route - GET and POST
 * @last-fix: [2026-01-15] Initial POC setup
 */

import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import mongoose from 'mongoose';
import Decision from '@/models/Decision';
import Member from '@/models/Member';
import Location from '@/models/Location';
import Team from '@/models/Team';

export async function GET() {
  try {
    await dbConnect();
    
    // Ensure all models are registered
    if (!mongoose.models.Member) {
      await import('@/models/Member');
    }
    if (!mongoose.models.Location) {
      await import('@/models/Location');
    }
    if (!mongoose.models.Team) {
      await import('@/models/Team');
    }
    const decisions = await Decision.find()
      .populate('created_by', 'name email')
      .populate('approved_by', 'name email')
      .populate('involved_members', 'name email')
      .populate('connected_to.location_id', 'name')
      .populate('connected_to.team_id', 'name')
      .populate('connected_to.member_id', 'name email')
      .sort({ created_at: -1 })
      .limit(100);
    
    return NextResponse.json({ success: true, data: decisions });
  } catch (error) {
    console.error('Error fetching decisions:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch decisions' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    await dbConnect();
    const body = await request.json();
    
    const decision = await Decision.create({
      title: body.title,
      description: body.description,
      decision: body.decision,
      status: body.status || 'proposed',
      created_by: body.created_by,
      approved_by: body.approved_by,
      involved_members: body.involved_members || [],
      connected_to: {
        location_id: body.location_id,
        team_id: body.team_id,
        member_id: body.member_id,
      },
    });
    
    await decision.populate('created_by', 'name email');
    
    return NextResponse.json({ success: true, data: decision }, { status: 201 });
  } catch (error: any) {
    console.error('Error creating decision:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to create decision' },
      { status: 400 }
    );
  }
}
