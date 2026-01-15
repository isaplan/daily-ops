/**
 * @registry-id: TeamDashboard
 * @created: 2026-01-15T12:00:00.000Z
 * @last-modified: 2026-01-15T12:00:00.000Z
 * @description: Team dashboard - all team data, accessible by team members + managers
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

interface TeamData {
  _id: string;
  name: string;
  type: string;
  location_id: string;
  members: IMember[];
  this_period: {
    total_hours: number;
    total_labor_cost: number;
    total_revenue: number;
    task_completion_rate: number;
    quality_score: number;
    events_serviced: number;
  };
}

export default function TeamDashboard() {
  const { user, loading: authLoading, canView, canEdit } = useAuth();
  const [teamData, setTeamData] = useState<TeamData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!authLoading && user?.team_id) {
      fetchTeamData();
    }
  }, [authLoading, user?.team_id]);

  async function fetchTeamData() {
    try {
      if (!user?.team_id) return;

      const response = await fetch(`/api/teams/${user.team_id}`);
      if (response.ok) {
        const data = await response.json();
        setTeamData(data);
      }
    } catch (error) {
      console.error('Failed to fetch team data:', error);
    } finally {
      setLoading(false);
    }
  }

  if (authLoading || loading) {
    return <div className="p-8">Loading team dashboard...</div>;
  }

  if (!teamData) {
    return <div className="p-8">No team data available</div>;
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold">{teamData.name}</h1>
        <p className="text-muted-foreground">{teamData.type} team • {teamData.members?.length || 0} members</p>
      </div>

      {/* Key Metrics */}
      <div className="grid gap-4 md:grid-cols-5">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Total Hours</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{teamData.this_period.total_hours}h</div>
            <p className="text-xs text-muted-foreground">This period</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Labor Cost</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">€{teamData.this_period.total_labor_cost}</div>
            <p className="text-xs text-muted-foreground">This period</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Revenue</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">€{teamData.this_period.total_revenue}</div>
            <p className="text-xs text-muted-foreground">This period</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Task Completion</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{teamData.this_period.task_completion_rate}%</div>
            <p className="text-xs text-muted-foreground">Rate</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Quality Score</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{teamData.this_period.quality_score}/5</div>
            <p className="text-xs text-muted-foreground">Average</p>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="members" className="w-full">
        <TabsList>
          <TabsTrigger value="members">Members</TabsTrigger>
          <TabsTrigger value="todos">Tasks</TabsTrigger>
          <TabsTrigger value="notes">Notes</TabsTrigger>
          {canView('team') && <TabsTrigger value="analytics">Analytics</TabsTrigger>}
        </TabsList>

        {/* Members Tab */}
        <TabsContent value="members" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Team Members ({teamData.members?.length})</CardTitle>
              <CardDescription>All members in this team</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {teamData.members?.map((member) => (
                  <div key={member._id} className="flex items-center justify-between p-3 border rounded-lg">
                    <div className="flex items-center gap-3">
                      {member.slack_avatar && (
                        <img src={member.slack_avatar} alt={member.name} className="w-8 h-8 rounded-full" />
                      )}
                      <div>
                        <p className="font-semibold">{member.name}</p>
                        <p className="text-xs text-muted-foreground">{member.role}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-medium">{member.this_period?.hours_worked || 0}h</p>
                      <p className="text-xs text-muted-foreground">{member.email}</p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tasks Tab */}
        <TabsContent value="todos" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Team Tasks</CardTitle>
              <CardDescription>All tasks assigned to team members</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">Tasks list coming soon...</p>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Notes Tab */}
        <TabsContent value="notes" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Team Notes</CardTitle>
              <CardDescription>Notes shared with this team</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">Notes list coming soon...</p>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Analytics Tab */}
        {canView('team') && (
          <TabsContent value="analytics" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Team Analytics</CardTitle>
                <CardDescription>Performance metrics and trends</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">Analytics dashboard coming soon...</p>
              </CardContent>
            </Card>
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}
