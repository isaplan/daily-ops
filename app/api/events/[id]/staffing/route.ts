/**
 * @registry-id: eventStaffingAPI
 * @created: 2026-01-15T10:00:00.000Z
 * @last-modified: 2026-01-15T10:00:00.000Z
 * @description: Event staffing API route - GET and POST
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
    
    const event = await Event.findById(params.id)
      .select('staffing')
      .populate('staffing.member_id', 'name email slack_avatar');
    
    if (!event) {
      return NextResponse.json(
        { success: false, error: 'Event not found' },
        { status: 404 }
      );
    }
    
    return NextResponse.json({ success: true, data: event.staffing || [] });
  } catch (error) {
    console.error('Error fetching event staffing:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch staffing' },
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
    
    // Add new staffing assignment
    if (body.action === 'add' && body.staffing_item) {
      if (!event.staffing) event.staffing = [];
      event.staffing.push(body.staffing_item);
    }
    // Update staffing assignment
    else if (body.action === 'update' && body.index !== undefined && body.staffing_item) {
      if (!event.staffing) event.staffing = [];
      event.staffing[body.index] = body.staffing_item;
    }
    // Remove staffing assignment
    else if (body.action === 'remove' && body.index !== undefined) {
      if (event.staffing) {
        event.staffing.splice(body.index, 1);
      }
    }
    // Replace entire staffing
    else if (body.action === 'replace' && body.staffing) {
      event.staffing = body.staffing;
    }
    else {
      return NextResponse.json(
        { success: false, error: 'Invalid action. Use: add, update, remove, or replace' },
        { status: 400 }
      );
    }
    
    await event.save();
    
    const updatedEvent = await Event.findById(params.id)
      .populate('staffing.member_id', 'name email slack_avatar');
    
    return NextResponse.json({ success: true, data: updatedEvent?.staffing || [] });
  } catch (error: any) {
    console.error('Error updating event staffing:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to update staffing' },
      { status: 400 }
    );
  }
}
