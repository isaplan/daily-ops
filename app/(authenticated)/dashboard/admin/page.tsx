/**
 * @registry-id: AdminDashboard
 * @created: 2026-01-15T12:00:00.000Z
 * @last-modified: 2026-01-15T12:00:00.000Z
 * @description: Admin dashboard - company-wide overview + admin controls
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

interface CompanyStats {
  totalMembers: number;
  activeMembers: number;
  totalLocations: number;
  totalTeams: number;
  totalHours: number;
  totalRevenue: number;
  totalLabor: number;
  overallProfit: number;
  taskCompletionRate: number;
}

export default function AdminDashboard() {
  const { user, loading: authLoading, isAdmin } = useAuth();
  const [stats, setStats] = useState<CompanyStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!authLoading) {
      if (!isAdmin) {
        // Redirect non-admins
        window.location.href = '/dashboard/member';
      } else {
        fetchCompanyStats();
      }
    }
  }, [authLoading, isAdmin]);

  async function fetchCompanyStats() {
    try {
      const response = await fetch('/api/admin/company-stats');
      if (response.ok) {
        const data = await response.json();
        setStats(data);
      }
    } catch (error) {
      console.error('Failed to fetch company stats:', error);
    } finally {
      setLoading(false);
    }
  }

  if (authLoading || loading) {
    return <div className="p-8">Loading admin dashboard...</div>;
  }

  if (!isAdmin) {
    return <div className="p-8 text-center">Admin access required</div>;
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold">Company Dashboard</h1>
        <p className="text-muted-foreground">Company-wide overview and management</p>
      </div>

      {/* Company KPIs */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Total Members</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.totalMembers || 0}</div>
            <p className="text-xs text-muted-foreground">{stats?.activeMembers || 0} active</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Locations</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.totalLocations || 0}</div>
            <p className="text-xs text-muted-foreground">{stats?.totalTeams || 0} teams</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">€{stats?.totalRevenue || 0}</div>
            <p className="text-xs text-muted-foreground">This period</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Net Profit</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">€{stats?.overallProfit || 0}</div>
            <p className="text-xs text-muted-foreground">Revenue - Labor</p>
          </CardContent>
        </Card>
      </div>

      {/* Operational KPIs */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Total Hours</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.totalHours || 0}h</div>
            <p className="text-xs text-muted-foreground">All locations</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Labor Cost</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">€{stats?.totalLabor || 0}</div>
            <p className="text-xs text-muted-foreground">All locations</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Task Completion Rate</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.taskCompletionRate || 0}%</div>
            <p className="text-xs text-muted-foreground">Company-wide</p>
          </CardContent>
        </Card>
      </div>

      {/* Admin Tabs */}
      <Tabs defaultValue="locations" className="w-full">
        <TabsList>
          <TabsTrigger value="locations">Locations</TabsTrigger>
          <TabsTrigger value="members">All Members</TabsTrigger>
          <TabsTrigger value="users">User Management</TabsTrigger>
          <TabsTrigger value="reports">Reports</TabsTrigger>
          <TabsTrigger value="settings">Settings</TabsTrigger>
        </TabsList>

        {/* Locations Tab */}
        <TabsContent value="locations" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>All Locations</CardTitle>
              <CardDescription>Manage and monitor all company locations</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">Locations list coming soon...</p>
            </CardContent>
          </Card>
        </TabsContent>

        {/* All Members Tab */}
        <TabsContent value="members" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>All Members</CardTitle>
              <CardDescription>Company-wide member directory</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">Members list coming soon...</p>
            </CardContent>
          </Card>
        </TabsContent>

        {/* User Management Tab */}
        <TabsContent value="users" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>User Management</CardTitle>
              <CardDescription>Manage user roles and permissions</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">User management interface coming soon...</p>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Reports Tab */}
        <TabsContent value="reports" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Reports & Analytics</CardTitle>
              <CardDescription>Generate and view company reports</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">Reports interface coming soon...</p>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Settings Tab */}
        <TabsContent value="settings" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>System Settings</CardTitle>
              <CardDescription>Configure system preferences and integrations</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">Settings interface coming soon...</p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
