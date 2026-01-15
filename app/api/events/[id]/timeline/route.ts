/**
 * @registry-id: eventTimelineAPI
 * @created: 2026-01-15T10:00:00.000Z
 * @last-modified: 2026-01-15T10:00:00.000Z
 * @description: Event timeline API route - GET and POST
 * @last-fix: [2026-01-15] Initial implementation
 */

import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import Event from '@/models/Event';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    await dbConnect();
    
    const event = await Event.findById(params.id).select('timeline');
    
    if (!event) {
      return NextResponse.json(
        { success: false, error: 'Event not found' },
        { status: 404 }
      );
    }
    
    return NextResponse.json({ success: true, data: event.timeline });
  } catch (error) {
    console.error('Error fetching event timeline:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch timeline' },
      { status: 500 }
    );
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    await dbConnect();
    const body = await request.json();
    
    const event = await Event.findById(params.id);
    
    if (!event) {
      return NextResponse.json(
        { success: false, error: 'Event not found' },
        { status: 404 }
      );
    }
    
    // Add new timeline item
    if (body.action === 'add' && body.timeline_item) {
      event.timeline.push(body.timeline_item);
    }
    // Update timeline item
    else if (body.action === 'update' && body.index !== undefined && body.timeline_item) {
      event.timeline[body.index] = body.timeline_item;
    }
    // Replace entire timeline
    else if (body.action === 'replace' && body.timeline) {
      event.timeline = body.timeline;
    }
    else {
      return NextResponse.json(
        { success: false, error: 'Invalid action. Use: add, update, or replace' },
        { status: 400 }
      );
    }
    
    await event.save();
    
    const updatedEvent = await Event.findById(params.id)
      .populate('timeline.assigned_to', 'name email');
    
    return NextResponse.json({ success: true, data: updatedEvent?.timeline });
  } catch (error: any) {
    console.error('Error updating event timeline:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to update timeline' },
      { status: 400 }
    );
  }
}
