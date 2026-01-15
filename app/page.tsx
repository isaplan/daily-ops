/**
 * @registry-id: MainDashboard
 * @created: 2026-01-15T10:00:00.000Z
 * @last-modified: 2026-01-15T15:00:00.000Z
 * @description: Main dashboard overview with dynamic data - locations, teams, members, recent activity, KPIs
 * @last-fix: [2026-01-15] Made fully dynamic with real data, role-based visibility, metrics, recent activity, and optimized stats API
 * 
 * @exports-to:
 * ✓ app/layout.tsx => Main dashboard entry point
 */

'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/lib/hooks/useAuth';
import type { IEvent } from '@/models/Event';
import type { ILocation } from '@/models/Location';
import type { ITeam } from '@/models/Team';
import type { IMember } from '@/models/Member';
import type { ITodo } from '@/models/Todo';
import type { INote } from '@/models/Note';

interface DashboardStats {
  locations: {
    total: number;
    active: number;
    recent: ILocation[];
  };
  teams: {
    total: number;
    active: number;
    recent: ITeam[];
  };
  members: {
    total: number;
    active: number;
    recent: IMember[];
  };
  todos: {
    pending: number;
    in_progress: number;
    completed: number;
    recent: ITodo[];
  };
  notes: {
    total: number;
    recent: INote[];
  };
  events: {
    upcoming: number;
    recent: IEvent[];
  };
}

export default function Home() {
  const { user, loading: authLoading, canView, isAdmin, isManager, isMember } = useAuth();
  const router = useRouter();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [assignedEvents, setAssignedEvents] = useState<IEvent[]>([]);

  useEffect(() => {
    if (!authLoading) {
      fetchDashboardData();
    }
  }, [authLoading, user]);

  async function fetchDashboardData() {
    try {
      // Fetch dashboard stats from optimized endpoint
      const statsRes = await fetch('/api/dashboard/stats');
      if (statsRes.ok) {
        const statsData = await statsRes.json();
        if (statsData.success) {
          setStats(statsData.data);
        }
      }

      // Get user's assigned events if authenticated
      if (user?.id) {
        try {
          const userEventsRes = await fetch(`/api/events?assigned_to=${user.id}`);
          if (userEventsRes.ok) {
            const userEventsData = await userEventsRes.json();
            if (userEventsData.success) {
              setAssignedEvents(
                userEventsData.data.filter((e: IEvent) => e.status === 'planning' || e.status === 'confirmed')
              );
            }
          }
        } catch (error) {
          console.error('Error fetching user events:', error);
        }
      }
    } catch (error) {
      console.error('Error loading dashboard data:', error);
    } finally {
      setLoading(false);
    }
  }

  if (authLoading || loading) {
    return (
      <div className="min-h-screen p-8 bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="mb-4 text-lg">Loading dashboard...</div>
          <div className="text-sm text-muted-foreground">Fetching your data</div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-8 bg-gray-50">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold mb-2 text-gray-900">Dashboard</h1>
          <p className="text-gray-700">
            Overview of your organization
            {user && (
              <span className="ml-2 text-sm text-gray-500">
                • Welcome, {user.name}
                {isAdmin && ' (Admin)'}
                {isManager && ' (Manager)'}
                {isMember && ' (Member)'}
              </span>
            )}
          </p>
        </div>

        {/* Quick Stats */}
        {stats && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
            <div className="p-4 bg-white border rounded-lg shadow-sm">
              <div className="text-sm text-gray-600 mb-1">Total Members</div>
              <div className="text-3xl font-bold text-gray-900">{stats.members.total}</div>
              <div className="text-xs text-gray-500 mt-1">{stats.members.active} active</div>
            </div>
            <div className="p-4 bg-white border rounded-lg shadow-sm">
              <div className="text-sm text-gray-600 mb-1">Total Teams</div>
              <div className="text-3xl font-bold text-gray-900">{stats.teams.total}</div>
              <div className="text-xs text-gray-500 mt-1">{stats.teams.active} active</div>
            </div>
            <div className="p-4 bg-white border rounded-lg shadow-sm">
              <div className="text-sm text-gray-600 mb-1">Total Locations</div>
              <div className="text-3xl font-bold text-gray-900">{stats.locations.total}</div>
              <div className="text-xs text-gray-500 mt-1">{stats.locations.active} active</div>
            </div>
            <div className="p-4 bg-white border rounded-lg shadow-sm">
              <div className="text-sm text-gray-600 mb-1">Pending Tasks</div>
              <div className="text-3xl font-bold text-orange-600">{stats.todos.pending}</div>
              <div className="text-xs text-gray-500 mt-1">{stats.todos.in_progress} in progress</div>
            </div>
          </div>
        )}

        {/* User's Assigned Events */}
        {assignedEvents.length > 0 && (
          <div className="mb-8 p-6 bg-blue-50 border border-blue-200 rounded-lg">
            <h2 className="text-2xl font-semibold mb-4 text-blue-900">📅 Events Assigned to You</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {assignedEvents.map((event) => (
                <div
                  key={event._id}
                  className="p-4 bg-white border rounded-lg shadow-sm hover:shadow-md cursor-pointer transition-shadow"
                  onClick={() => router.push(`/events?event=${event._id}`)}
                >
                  <div className="flex justify-between items-start mb-2">
                    <h3 className="font-semibold text-lg text-gray-900">{event.name}</h3>
                    <span className={`px-2 py-1 text-xs rounded ${
                      event.status === 'confirmed' ? 'bg-blue-100 text-blue-800' :
                      event.status === 'planning' ? 'bg-yellow-100 text-yellow-800' :
                      'bg-gray-100 text-gray-800'
                    }`}>
                      {event.status}
                    </span>
                  </div>
                  <div className="text-sm text-gray-600">
                    <div>Client: {event.client_name}</div>
                    <div>Date: {new Date(event.date).toLocaleDateString()}</div>
                    {event.location_id && typeof event.location_id === 'object' && (
                      <div>📍 {event.location_id.name}</div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Main Cards - Locations, Teams, Members */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          {/* Locations Card */}
          {canView('location') && (
            <Link
              href="/organization"
              className="p-6 bg-white border rounded-lg shadow-sm hover:shadow-md transition-shadow cursor-pointer"
            >
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-2xl font-semibold text-gray-900">Locations</h2>
                <span className="text-3xl">📍</span>
              </div>
              {stats ? (
                <div>
                  <p className="text-gray-600 mb-3">Manage your locations</p>
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">Total:</span>
                      <span className="font-semibold">{stats.locations.total}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">Active:</span>
                      <span className="font-semibold text-green-600">{stats.locations.active}</span>
                    </div>
                    {stats.locations.recent.length > 0 && (
                      <div className="mt-3 pt-3 border-t">
                        <div className="text-xs text-gray-500 mb-2">Recent:</div>
                        {stats.locations.recent.map((loc: ILocation) => (
                          <div key={loc._id} className="text-sm text-gray-700 truncate">
                            {loc.name}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <p className="text-gray-600">Manage your locations</p>
              )}
            </Link>
          )}

          {/* Teams Card */}
          {canView('team') && (
            <Link
              href="/organization"
              className="p-6 bg-white border rounded-lg shadow-sm hover:shadow-md transition-shadow cursor-pointer"
            >
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-2xl font-semibold text-gray-900">Teams</h2>
                <span className="text-3xl">👥</span>
              </div>
              {stats ? (
                <div>
                  <p className="text-gray-600 mb-3">View and manage teams</p>
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">Total:</span>
                      <span className="font-semibold">{stats.teams.total}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">Active:</span>
                      <span className="font-semibold text-green-600">{stats.teams.active}</span>
                    </div>
                    {stats.teams.recent.length > 0 && (
                      <div className="mt-3 pt-3 border-t">
                        <div className="text-xs text-gray-500 mb-2">Recent:</div>
                        {stats.teams.recent.map((team: ITeam) => (
                          <div key={team._id} className="text-sm text-gray-700 truncate">
                            {team.name}
                            {team.location_id && typeof team.location_id === 'object' && (
                              <span className="text-xs text-gray-500 ml-2">• {team.location_id.name}</span>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <p className="text-gray-600">View and manage teams</p>
              )}
            </Link>
          )}

          {/* Members Card */}
          {canView('team') && (
            <Link
              href="/organization"
              className="p-6 bg-white border rounded-lg shadow-sm hover:shadow-md transition-shadow cursor-pointer"
            >
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-2xl font-semibold text-gray-900">Members</h2>
                <span className="text-3xl">👤</span>
              </div>
              {stats ? (
                <div>
                  <p className="text-gray-600 mb-3">Your organization members</p>
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">Total:</span>
                      <span className="font-semibold">{stats.members.total}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">Active:</span>
                      <span className="font-semibold text-green-600">{stats.members.active}</span>
                    </div>
                    {stats.members.recent.length > 0 && (
                      <div className="mt-3 pt-3 border-t">
                        <div className="text-xs text-gray-500 mb-2">Recent:</div>
                        {stats.members.recent.slice(0, 3).map((member: IMember) => (
                          <div key={member._id} className="text-sm text-gray-700 truncate">
                            {member.name}
                            {member.team_id && typeof member.team_id === 'object' && (
                              <span className="text-xs text-gray-500 ml-2">• {member.team_id.name}</span>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <p className="text-gray-600">Your organization members</p>
              )}
            </Link>
          )}
        </div>

        {/* Recent Activity Section */}
        {stats && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Recent Todos */}
            {stats.todos.recent.length > 0 && (
              <div className="p-6 bg-white border rounded-lg shadow-sm">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-xl font-semibold text-gray-900">Recent Tasks</h2>
                  <Link href="/todos" className="text-sm text-blue-600 hover:underline">
                    View all
                  </Link>
                </div>
                <div className="space-y-3">
                  {stats.todos.recent.map((todo: ITodo) => (
                    <div key={todo._id} className="p-3 bg-gray-50 rounded-lg">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <h3 className="font-medium text-gray-900">{todo.title}</h3>
                          {todo.description && (
                            <p className="text-sm text-gray-600 mt-1 line-clamp-2">{todo.description}</p>
                          )}
                        </div>
                        <span className={`ml-2 px-2 py-1 text-xs rounded ${
                          todo.status === 'completed' ? 'bg-green-100 text-green-800' :
                          todo.status === 'in_progress' ? 'bg-blue-100 text-blue-800' :
                          'bg-yellow-100 text-yellow-800'
                        }`}>
                          {todo.status}
                        </span>
                      </div>
                      {todo.priority && (
                        <div className="mt-2 text-xs text-gray-500">
                          Priority: <span className="font-medium">{todo.priority}</span>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Recent Notes */}
            {stats.notes.recent.length > 0 && (
              <div className="p-6 bg-white border rounded-lg shadow-sm">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-xl font-semibold text-gray-900">Recent Notes</h2>
                  <Link href="/notes" className="text-sm text-blue-600 hover:underline">
                    View all
                  </Link>
                </div>
                <div className="space-y-3">
                  {stats.notes.recent.map((note: INote) => (
                    <Link
                      key={note._id}
                      href={`/notes/${note.slug || note._id}`}
                      className="block p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
                    >
                      <h3 className="font-medium text-gray-900">{note.title}</h3>
                      {note.content && (
                        <p className="text-sm text-gray-600 mt-1 line-clamp-2">
                          {typeof note.content === 'string' 
                            ? note.content 
                            : JSON.stringify(note.content).substring(0, 100)}
                        </p>
                      )}
                      <div className="mt-2 text-xs text-gray-500">
                        {note.created_at && new Date(note.created_at).toLocaleDateString()}
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
            )}

            {/* Upcoming Events */}
            {stats.events.recent.length > 0 && (
              <div className="p-6 bg-white border rounded-lg shadow-sm">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-xl font-semibold text-gray-900">Upcoming Events</h2>
                  <Link href="/events" className="text-sm text-blue-600 hover:underline">
                    View all
                  </Link>
                </div>
                <div className="space-y-3">
                  {stats.events.recent
                    .filter((e: IEvent) => new Date(e.date) >= new Date())
                    .slice(0, 3)
                    .map((event: IEvent) => (
                      <div
                        key={event._id}
                        className="p-3 bg-gray-50 rounded-lg cursor-pointer hover:bg-gray-100 transition-colors"
                        onClick={() => router.push(`/events?event=${event._id}`)}
                      >
                        <h3 className="font-medium text-gray-900">{event.name}</h3>
                        <div className="text-sm text-gray-600 mt-1">
                          <div>Client: {event.client_name}</div>
                          <div>Date: {new Date(event.date).toLocaleDateString()}</div>
                        </div>
                        <span className={`mt-2 inline-block px-2 py-1 text-xs rounded ${
                          event.status === 'confirmed' ? 'bg-blue-100 text-blue-800' :
                          event.status === 'planning' ? 'bg-yellow-100 text-yellow-800' :
                          'bg-gray-100 text-gray-800'
                        }`}>
                          {event.status}
                        </span>
                      </div>
                    ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Role-based Quick Actions */}
        {user && (
          <div className="mt-8 p-6 bg-white border rounded-lg shadow-sm">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Quick Actions</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <Link
                href="/todos"
                className="p-4 bg-blue-50 border border-blue-200 rounded-lg hover:bg-blue-100 transition-colors text-center"
              >
                <div className="text-2xl mb-2">✓</div>
                <div className="text-sm font-medium text-blue-900">Create Todo</div>
              </Link>
              <Link
                href="/notes"
                className="p-4 bg-green-50 border border-green-200 rounded-lg hover:bg-green-100 transition-colors text-center"
              >
                <div className="text-2xl mb-2">📝</div>
                <div className="text-sm font-medium text-green-900">Create Note</div>
              </Link>
              <Link
                href="/events"
                className="p-4 bg-purple-50 border border-purple-200 rounded-lg hover:bg-purple-100 transition-colors text-center"
              >
                <div className="text-2xl mb-2">📅</div>
                <div className="text-sm font-medium text-purple-900">Create Event</div>
              </Link>
              {(isManager || isAdmin) && (
                <Link
                  href="/organization"
                  className="p-4 bg-orange-50 border border-orange-200 rounded-lg hover:bg-orange-100 transition-colors text-center"
                >
                  <div className="text-2xl mb-2">🏢</div>
                  <div className="text-sm font-medium text-orange-900">Organization</div>
                </Link>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
