/**
 * @registry-id: eventAPI
 * @created: 2026-01-15T10:00:00.000Z
 * @last-modified: 2026-01-16T22:30:00.000Z
 * @description: Single event API route - GET, PUT, DELETE
 * @last-fix: [2026-01-16] Fixed error handling to use unknown and getErrorMessage
 */

import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import mongoose from 'mongoose';
import Event from '@/models/Event';
import Member from '@/models/Member';
import Location from '@/models/Location';
import Channel from '@/models/Channel';
import { getErrorMessage } from '@/lib/types/errors';
import type { IEvent } from '@/models/Event';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await dbConnect();
    
    // Ensure all models are registered
    if (!mongoose.models.Channel) {
      await import('@/models/Channel');
    }
    if (!mongoose.models.Member) {
      await import('@/models/Member');
    }
    if (!mongoose.models.Location) {
      await import('@/models/Location');
    }
    
    const { id } = await params;
    const event = await Event.findById(id)
      .populate('location_id', 'name')
      .populate('channel_id', 'name')
      .populate('assigned_to', 'name email')
      .populate('created_by', 'name email')
      .populate('timeline.assigned_to', 'name email')
      .populate('staffing.member_id', 'name email');
    
    if (!event) {
      return NextResponse.json(
        { success: false, error: 'Event not found' },
        { status: 404 }
      );
    }
    
    return NextResponse.json({ success: true, data: event });
  } catch (error: unknown) {
    console.error('Error fetching event:', error);
    return NextResponse.json(
      { success: false, error: getErrorMessage(error) },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await dbConnect();
    const body = await request.json();
    const { id } = await params;
    
    const updateData: Partial<IEvent> = {};
    if (body.name !== undefined) updateData.name = body.name;
    if (body.client_name !== undefined) updateData.client_name = body.client_name;
    if (body.guest_count !== undefined) updateData.guest_count = body.guest_count;
    if (body.date !== undefined) updateData.date = body.date;
    if (body.location_id !== undefined) updateData.location_id = body.location_id;
    if (body.channel_id !== undefined) updateData.channel_id = body.channel_id;
    if (body.assigned_to !== undefined) updateData.assigned_to = body.assigned_to;
    if (body.status !== undefined) updateData.status = body.status;
    if (body.sections !== undefined) updateData.sections = body.sections;
    if (body.timeline !== undefined) updateData.timeline = body.timeline;
    if (body.inventory !== undefined) updateData.inventory = body.inventory;
    if (body.staffing !== undefined) updateData.staffing = body.staffing;
    if (body.estimated_labor_cost !== undefined) updateData.estimated_labor_cost = body.estimated_labor_cost;
    if (body.actual_labor_cost !== undefined) updateData.actual_labor_cost = body.actual_labor_cost;
    if (body.revenue !== undefined) updateData.revenue = body.revenue;
    if (body.estimated_profit !== undefined) updateData.estimated_profit = body.estimated_profit;
    
    const event = await Event.findByIdAndUpdate(
      id,
      updateData,
      { new: true, runValidators: true }
    )
      .populate('location_id', 'name')
      .populate('channel_id', 'name')
      .populate('assigned_to', 'name email')
      .populate('created_by', 'name email')
      .populate('timeline.assigned_to', 'name email')
      .populate('staffing.member_id', 'name email');
    
    if (!event) {
      return NextResponse.json(
        { success: false, error: 'Event not found' },
        { status: 404 }
      );
    }
    
    return NextResponse.json({ success: true, data: event });
  } catch (error: unknown) {
    console.error('Error updating event:', error);
    return NextResponse.json(
      { success: false, error: getErrorMessage(error) },
      { status: 400 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await dbConnect();
    const { id } = await params;
    const event = await Event.findByIdAndDelete(id);
    
    if (!event) {
      return NextResponse.json(
        { success: false, error: 'Event not found' },
        { status: 404 }
      );
    }
    
    return NextResponse.json({ success: true, message: 'Event deleted' });
  } catch (error: unknown) {
    console.error('Error deleting event:', error);
    return NextResponse.json(
      { success: false, error: getErrorMessage(error) },
      { status: 500 }
    );
  }
}
