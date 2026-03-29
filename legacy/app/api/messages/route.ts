/**
 * @registry-id: messagesAPI
 * @created: 2026-01-15T10:00:00.000Z
 * @last-modified: 2026-01-15T14:30:00.000Z
 * @description: Messages API route - GET and POST
 * @last-fix: [2026-01-15] Added auto-add mentioned members to channel + system messages
 */

import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import mongoose from 'mongoose';
import Message from '@/models/Message';
import Member from '@/models/Member';
import Channel from '@/models/Channel';
import Note from '@/models/Note';
import Todo from '@/models/Todo';
import Event from '@/models/Event';
import Decision from '@/models/Decision';
import { getErrorMessage } from '@/lib/types/errors';

export async function GET(request: NextRequest) {
  try {
    await dbConnect();
    
    // Ensure all models are registered
    if (!mongoose.models.Member) {
      await import('@/models/Member');
    }
    if (!mongoose.models.Channel) {
      await import('@/models/Channel');
    }
    
    const { searchParams } = new URL(request.url);
    const channel_id = searchParams.get('channel_id');
    
    interface MessageQuery {
      channel_id?: string;
      is_deleted: boolean;
    }
    
    const query: MessageQuery = { is_deleted: false };
    if (channel_id) {
      query.channel_id = channel_id;
    }
    
    if (channel_id) {
      query.channel_id = channel_id;
    }
    
    const messages = await Message.find(query)
      .populate('member_id', 'name email')
      .populate('channel_id', 'name')
      .populate('mentioned_members', 'name email')
      .populate('linked_note', 'title')
      .populate('linked_todo', 'title')
      .populate('linked_event', 'name')
      .sort({ timestamp: 1 })
      .limit(100);
    
    return NextResponse.json({ success: true, data: messages });
  } catch (error) {
    console.error('Error fetching messages:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch messages' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    await dbConnect();
    
    // Ensure all models are registered
    if (!mongoose.models.Member) {
      await import('@/models/Member');
    }
    if (!mongoose.models.Channel) {
      await import('@/models/Channel');
    }
    if (!mongoose.models.Note) {
      await import('@/models/Note');
    }
    if (!mongoose.models.Todo) {
      await import('@/models/Todo');
    }
    if (!mongoose.models.Event) {
      await import('@/models/Event');
    }
    if (!mongoose.models.Decision) {
      await import('@/models/Decision');
    }
    
    const body = await request.json();
    
    // Parse mentions and links from text
    const text = body.text;
    const mentionedMemberIds: string[] = [];
    let linkedNote: string | undefined;
    let linkedTodo: string | undefined;
    let linkedEvent: string | undefined;
    
    // Parse @mentions
    const mentionRegex = /@(\w+)/g;
    let mentionMatch;
    const allMembers = await Member.find({ is_active: true });
    
    while ((mentionMatch = mentionRegex.exec(text)) !== null) {
      const mentionText = mentionMatch[1].toLowerCase();
      const member = allMembers.find(
        (m) => m.name.toLowerCase().includes(mentionText) ||
        m.name.toLowerCase().replace(/\s+/g, '').includes(mentionText)
      );
      if (member && !mentionedMemberIds.includes(member._id.toString())) {
        mentionedMemberIds.push(member._id.toString());
      }
    }
    
    // Parse #links
    const linkRegex = /#(\w+)/g;
    let linkMatch;
    
    while ((linkMatch = linkRegex.exec(text)) !== null) {
      const linkText = linkMatch[1].toLowerCase();
      
      // Try to find in notes
      if (!linkedNote) {
        const notes = await Note.find({ is_archived: false }).limit(50);
        const note = notes.find((n) => 
          n.title.toLowerCase().includes(linkText) ||
          n.title.toLowerCase().replace(/\s+/g, '').includes(linkText)
        );
        if (note) linkedNote = note._id.toString();
      }
      
      // Try to find in todos
      if (!linkedTodo) {
        const todos = await Todo.find().limit(50);
        const todo = todos.find((t) => 
          t.title.toLowerCase().includes(linkText) ||
          t.title.toLowerCase().replace(/\s+/g, '').includes(linkText)
        );
        if (todo) linkedTodo = todo._id.toString();
      }
      
      // Try to find in events
      if (!linkedEvent) {
        const events = await Event.find().limit(50);
        const event = events.find((e) => 
          e.name.toLowerCase().includes(linkText) ||
          e.name.toLowerCase().replace(/\s+/g, '').includes(linkText)
        );
        if (event) linkedEvent = event._id.toString();
      }
    }
    
    // Auto-add mentioned members to channel if they're not already members
    const addedMembers: string[] = [];
    if (body.channel_id && mentionedMemberIds.length > 0) {
      const channel = await Channel.findById(body.channel_id);
      if (channel) {
        const currentMemberIds = channel.members.map((id: mongoose.Types.ObjectId) => id.toString());
        const newMemberIds = mentionedMemberIds.filter(
          (id) => !currentMemberIds.includes(id)
        );
        
        if (newMemberIds.length > 0) {
          // Add new members to channel
          channel.members.push(...newMemberIds.map(id => new mongoose.Types.ObjectId(id)));
          await channel.save();
          addedMembers.push(...newMemberIds);
          
          // Create system message about added members
          if (newMemberIds.length > 0) {
            const addedMemberNames = await Member.find({
              _id: { $in: newMemberIds }
            }).select('name');
            
            const memberNames = addedMemberNames.map(m => m.name).join(', ');
            const systemMessageText = `👋 ${memberNames} ${newMemberIds.length === 1 ? 'has' : 'have'} been added to this channel`;
            
            await Message.create({
              text: systemMessageText,
              channel_id: body.channel_id,
              member_id: body.author_id || body.member_id,
              is_system: true,
            });
          }
        }
      }
    }
    
    const message = await Message.create({
      text: body.text,
      channel_id: body.channel_id,
      member_id: body.author_id || body.member_id,
      mentioned_members: mentionedMemberIds,
      linked_note: linkedNote,
      linked_todo: linkedTodo,
      linked_event: linkedEvent,
    });
    
    await message.populate('member_id', 'name email');
    await message.populate('channel_id', 'name');
    await message.populate('mentioned_members', 'name email');
    
    return NextResponse.json({ 
      success: true, 
      data: message,
      addedMembers: addedMembers.length > 0 ? addedMembers : undefined
    }, { status: 201 });
  } catch (error: unknown) {
    console.error('Error creating message:', error);
    return NextResponse.json(
      { success: false, error: getErrorMessage(error) },
      { status: 400 }
    );
  }
}
