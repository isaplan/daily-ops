/**
 * @registry-id: eventInventoryAPI
 * @created: 2026-01-15T10:00:00.000Z
 * @last-modified: 2026-01-15T10:00:00.000Z
 * @description: Event inventory API route - GET and POST
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
    
    const event = await Event.findById(params.id).select('inventory');
    
    if (!event) {
      return NextResponse.json(
        { success: false, error: 'Event not found' },
        { status: 404 }
      );
    }
    
    return NextResponse.json({ success: true, data: event.inventory || [] });
  } catch (error) {
    console.error('Error fetching event inventory:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch inventory' },
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
    
    // Add new inventory item
    if (body.action === 'add' && body.inventory_item) {
      if (!event.inventory) event.inventory = [];
      event.inventory.push(body.inventory_item);
    }
    // Update inventory item
    else if (body.action === 'update' && body.index !== undefined && body.inventory_item) {
      if (!event.inventory) event.inventory = [];
      event.inventory[body.index] = body.inventory_item;
    }
    // Replace entire inventory
    else if (body.action === 'replace' && body.inventory) {
      event.inventory = body.inventory;
    }
    else {
      return NextResponse.json(
        { success: false, error: 'Invalid action. Use: add, update, or replace' },
        { status: 400 }
      );
    }
    
    await event.save();
    
    const updatedEvent = await Event.findById(params.id);
    
    return NextResponse.json({ success: true, data: updatedEvent?.inventory || [] });
  } catch (error: any) {
    console.error('Error updating event inventory:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to update inventory' },
      { status: 400 }
    );
  }
}
