/**
 * @registry-id: MemberDashboard
 * @created: 2026-01-15T12:00:00.000Z
 * @last-modified: 2026-01-15T12:00:00.000Z
 * @description: Member dashboard - personal data + team context
 * @last-fix: [2026-01-15] Initial implementation
 * 
 * @exports-to:
 * ✓ app/(authenticated)/dashboard/** => Navigation
 */

'use client';

import { useAuth } from '@/lib/hooks/useAuth';
import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import type { IMember } from '@/models/Member';

interface MemberData {
  _id: string;
  name: string;
  email: string;
  team_id?: string;
  location_id?: string;
  role: string;
  this_period: {
    hours_worked: number;
    tasks_completed: number;
    revenue_generated: number;
  };
}

interface TeamData {
  _id: string;
  name: string;
  type: string;
  members: IMember[];
  this_period: {
    total_hours: number;
    total_labor_cost: number;
    task_completion_rate: number;
  };
}

export default function MemberDashboard() {
  const { user, loading: authLoading, canView } = useAuth();
  const [memberData, setMemberData] = useState<MemberData | null>(null);
  const [teamData, setTeamData] = useState<TeamData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!authLoading && user) {
      fetchDashboardData();
    }
  }, [authLoading, user]);

  async function fetchDashboardData() {
    try {
      const [memberRes, teamRes] = await Promise.all([
        fetch(`/api/members/${user?.id}`),
        user?.team_id ? fetch(`/api/teams/${user.team_id}`) : Promise.resolve(null),
      ]);

      if (memberRes.ok) {
        const data = await memberRes.json();
        setMemberData(data);
      }

      if (teamRes?.ok) {
        const data = await teamRes.json();
        setTeamData(data);
      }
    } catch (error) {
      console.error('Failed to fetch dashboard data:', error);
    } finally {
      setLoading(false);
    }
  }

  if (authLoading || loading) {
    return <div className="p-8">Loading dashboard...</div>;
  }

  if (!user) {
    return <div className="p-8">Please log in to view dashboard</div>;
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold">Welcome, {memberData?.name}</h1>
        <p className="text-muted-foreground">
          {memberData?.role} • {teamData?.name || 'No team assigned'}
        </p>
      </div>

      {/* Personal Stats */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Hours Worked</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{memberData?.this_period.hours_worked || 0}h</div>
            <p className="text-xs text-muted-foreground">This period</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Tasks Completed</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{memberData?.this_period.tasks_completed || 0}</div>
            <p className="text-xs text-muted-foreground">This period</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Revenue Generated</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">€{memberData?.this_period.revenue_generated || 0}</div>
            <p className="text-xs text-muted-foreground">This period</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Performance</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">4.2/5</div>
            <p className="text-xs text-muted-foreground">Team rating</p>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="team" className="w-full">
        <TabsList>
          <TabsTrigger value="team">My Team</TabsTrigger>
          <TabsTrigger value="location">Location Info</TabsTrigger>
          <TabsTrigger value="recent">Recent Activity</TabsTrigger>
        </TabsList>

        {/* Team Tab */}
        <TabsContent value="team" className="space-y-4">
          {teamData ? (
            <Card>
              <CardHeader>
                <CardTitle>{teamData.name}</CardTitle>
                <CardDescription>{teamData.type} team</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-4 md:grid-cols-3">
                  <div>
                    <p className="text-sm text-muted-foreground">Team Members</p>
                    <p className="text-lg font-semibold">{teamData.members?.length || 0}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Total Hours</p>
                    <p className="text-lg font-semibold">{teamData.this_period.total_hours}h</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Task Completion</p>
                    <p className="text-lg font-semibold">{teamData.this_period.task_completion_rate}%</p>
                  </div>
                </div>

                <div>
                  <h3 className="font-semibold mb-2">Team Members</h3>
                  <div className="space-y-2">
                    {teamData.members?.slice(0, 5).map((member) => (
                      <div key={member._id} className="flex justify-between text-sm p-2 bg-muted rounded">
                        <span>{member.name}</span>
                        <span className="text-muted-foreground">{member.role}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="p-8">
                <p className="text-center text-muted-foreground">No team assigned</p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Location Tab */}
        <TabsContent value="location">
          {canView('location') ? (
            <Card>
              <CardHeader>
                <CardTitle>Location Overview</CardTitle>
                <CardDescription>View your team's location information</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">Location details coming soon...</p>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="p-8">
                <p className="text-center text-muted-foreground">No access to location data</p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Recent Activity Tab */}
        <TabsContent value="recent">
          <Card>
            <CardHeader>
              <CardTitle>Recent Activity</CardTitle>
              <CardDescription>Your recent actions and team updates</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">Activity feed coming soon...</p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
