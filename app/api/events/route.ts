/**
 * @registry-id: eventsAPI
 * @created: 2026-01-15T10:00:00.000Z
 * @last-modified: 2026-01-15T10:00:00.000Z
 * @description: Events API route - GET and POST
 * @last-fix: [2026-01-15] Initial POC setup
 */

import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import mongoose from 'mongoose';
import Event from '@/models/Event';
import Member from '@/models/Member';
import Location from '@/models/Location';
import Channel from '@/models/Channel';

export async function GET(request: NextRequest) {
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
    
    const { searchParams } = new URL(request.url);
    const location_id = searchParams.get('location_id');
    const status = searchParams.get('status');
    const date = searchParams.get('date');
    const assigned_to = searchParams.get('assigned_to');
    
    const query: any = {};
    
    if (location_id) {
      query.location_id = location_id;
    }
    if (status) {
      query.status = status;
    }
    if (date) {
      const dateObj = new Date(date);
      const nextDay = new Date(dateObj);
      nextDay.setDate(nextDay.getDate() + 1);
      query.date = { $gte: dateObj, $lt: nextDay };
    }
    if (assigned_to) {
      query.assigned_to = assigned_to;
    }
    
    const events = await Event.find(query)
      .populate('location_id', 'name')
      .populate('channel_id', 'name')
      .populate('assigned_to', 'name email')
      .populate('created_by', 'name email')
      .populate('timeline.assigned_to', 'name email')
      .populate('staffing.member_id', 'name email')
      .sort({ date: 1, created_at: -1 })
      .limit(100);
    
    return NextResponse.json({ success: true, data: events });
  } catch (error) {
    console.error('Error fetching events:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch events' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    await dbConnect();
    const body = await request.json();
    
    const event = await Event.create({
      name: body.name,
      client_name: body.client_name,
      guest_count: body.guest_count,
      date: body.date,
      location_id: body.location_id,
      channel_id: body.channel_id,
      assigned_to: body.assigned_to,
      status: body.status || 'planning',
      sections: body.sections || [],
      timeline: body.timeline || [],
      inventory: body.inventory || [],
      staffing: body.staffing || [],
      estimated_labor_cost: body.estimated_labor_cost,
      actual_labor_cost: body.actual_labor_cost,
      revenue: body.revenue,
      estimated_profit: body.estimated_profit,
      created_by: body.created_by,
    });
    
    await event.populate('location_id', 'name');
    await event.populate('channel_id', 'name');
    await event.populate('assigned_to', 'name email');
    await event.populate('created_by', 'name email');
    
    return NextResponse.json({ success: true, data: event }, { status: 201 });
  } catch (error: any) {
    console.error('Error creating event:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to create event' },
      { status: 400 }
    );
  }
}
