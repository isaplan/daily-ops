/**
 * @registry-id: dashboardStatsAPI
 * @created: 2026-01-15T15:00:00.000Z
 * @last-modified: 2026-01-15T15:00:00.000Z
 * @description: GET /api/dashboard/stats - Dashboard statistics endpoint
 * @last-fix: [2026-01-15] Initial implementation
 * 
 * @exports-to:
 * ✓ app/page.tsx => Main dashboard stats
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/api-middleware';
import dbConnect from '@/lib/mongodb';
import Location from '@/models/Location';
import Team from '@/models/Team';
import Member from '@/models/Member';
import Todo from '@/models/Todo';
import Note from '@/models/Note';
import Event from '@/models/Event';

export async function GET(req: NextRequest) {
  try {
    const auth = await requireAuth(req);
    if (!auth.authorized) {
      // Allow unauthenticated access for public stats
      // return auth.response;
    }

    await dbConnect();

    // Fetch all stats in parallel
    const [
      locations,
      teams,
      members,
      pendingTodos,
      inProgressTodos,
      completedTodos,
      recentTodos,
      recentNotes,
      recentEvents,
    ] = await Promise.all([
      Location.find({ is_active: { $ne: false } }).sort({ name: 1 }).limit(10).lean(),
      Team.find({ is_active: { $ne: false } }).populate('location_id', 'name').sort({ name: 1 }).limit(10).lean(),
      Member.find({ is_active: { $ne: false } }).populate('location_id', 'name').populate('team_id', 'name').sort({ created_at: -1 }).limit(10).lean(),
      Todo.countDocuments({ status: 'pending' }),
      Todo.countDocuments({ status: 'in_progress' }),
      Todo.countDocuments({ status: 'completed' }),
      Todo.find({}).sort({ created_at: -1 }).limit(5).populate('assigned_to', 'name').populate('created_by', 'name').lean(),
      Note.find({}).sort({ created_at: -1 }).limit(5).populate('created_by', 'name').lean(),
      Event.find({}).sort({ date: 1 }).limit(5).populate('location_id', 'name').lean(),
    ]);

    // Get total counts
    const [totalLocations, totalTeams, totalMembers, totalNotes] = await Promise.all([
      Location.countDocuments({ is_active: { $ne: false } }),
      Team.countDocuments({ is_active: { $ne: false } }),
      Member.countDocuments({ is_active: { $ne: false } }),
      Note.countDocuments({}),
    ]);

    // Filter upcoming events
    const upcomingEvents = recentEvents.filter((e: any) => {
      const eventDate = new Date(e.date);
      return eventDate >= new Date() && (e.status === 'planning' || e.status === 'confirmed');
    });

    return NextResponse.json({
      success: true,
      data: {
        locations: {
          total: totalLocations,
          active: locations.length,
          recent: locations.slice(0, 3),
        },
        teams: {
          total: totalTeams,
          active: teams.length,
          recent: teams.slice(0, 3),
        },
        members: {
          total: totalMembers,
          active: members.length,
          recent: members.slice(0, 5),
        },
        todos: {
          pending: pendingTodos,
          in_progress: inProgressTodos,
          completed: completedTodos,
          recent: recentTodos,
        },
        notes: {
          total: totalNotes,
          recent: recentNotes,
        },
        events: {
          upcoming: upcomingEvents.length,
          recent: recentEvents.slice(0, 3),
        },
      },
    });
  } catch (error) {
    console.error('Error fetching dashboard stats:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch dashboard stats' },
      { status: 500 }
    );
  }
}
