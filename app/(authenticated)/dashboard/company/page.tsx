/**
 * @registry-id: CompanyDashboard
 * @created: 2026-01-15T12:00:00.000Z
 * @last-modified: 2026-01-15T12:00:00.000Z
 * @description: Company consolidated view - accessible by managers (read-only) and admins (full access)
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

interface LocationData {
  _id: string;
  name: string;
  city: string;
  active_members: number;
  this_period: {
    total_hours: number;
    total_labor_cost: number;
    total_revenue: number;
    task_completion_rate: number;
  };
}

export default function CompanyDashboard() {
  const { user, loading: authLoading, isManager, isAdmin, canViewConsolidatedView } = useAuth();
  const [stats, setStats] = useState<CompanyStats | null>(null);
  const [locations, setLocations] = useState<LocationData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!authLoading && (isManager || isAdmin)) {
      if (!canViewConsolidatedView()) {
        // Redirect if no access
        window.location.href = '/dashboard/location';
        return;
      }
      fetchCompanyData();
    }
  }, [authLoading, isManager, isAdmin, canViewConsolidatedView]);

  async function fetchCompanyData() {
    try {
      const [statsRes, locationsRes] = await Promise.all([
        fetch('/api/admin/company-stats'),
        fetch('/api/locations'),
      ]);

      if (statsRes.ok) {
        const data = await statsRes.json();
        setStats(data);
      }

      if (locationsRes.ok) {
        const data = await locationsRes.json();
        setLocations(data);
      }
    } catch (error) {
      console.error('Failed to fetch company data:', error);
    } finally {
      setLoading(false);
    }
  }

  if (authLoading || loading) {
    return <div className="p-8">Loading company dashboard...</div>;
  }

  if (!canViewConsolidatedView()) {
    return <div className="p-8 text-center">You don't have access to company consolidated view</div>;
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold">Company Overview</h1>
        <p className="text-muted-foreground">
          {isAdmin ? 'Full company management' : 'Consolidated view (read-only)'}
        </p>
      </div>

      {/* Company KPIs */}
      {stats && (
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Total Members</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.totalMembers}</div>
              <p className="text-xs text-muted-foreground">{stats.activeMembers} active</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Locations</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.totalLocations}</div>
              <p className="text-xs text-muted-foreground">{stats.totalTeams} teams</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">€{stats.totalRevenue.toLocaleString()}</div>
              <p className="text-xs text-muted-foreground">This period</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Net Profit</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">€{stats.overallProfit.toLocaleString()}</div>
              <p className="text-xs text-muted-foreground">Revenue - Labor</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Operational Metrics */}
      {stats && (
        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Total Hours</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.totalHours.toLocaleString()}h</div>
              <p className="text-xs text-muted-foreground">All locations</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Labor Cost</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">€{stats.totalLabor.toLocaleString()}</div>
              <p className="text-xs text-muted-foreground">All locations</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Task Completion Rate</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.taskCompletionRate}%</div>
              <p className="text-xs text-muted-foreground">Company-wide</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Tabs */}
      <Tabs defaultValue="locations" className="w-full">
        <TabsList>
          <TabsTrigger value="locations">All Locations</TabsTrigger>
          <TabsTrigger value="comparison">Location Comparison</TabsTrigger>
          {isAdmin && <TabsTrigger value="management">Management</TabsTrigger>}
        </TabsList>

        {/* All Locations Tab */}
        <TabsContent value="locations" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>All Locations</CardTitle>
              <CardDescription>Overview of all company locations</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {locations.map((location) => (
                  <div key={location._id} className="border rounded-lg p-4">
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <h3 className="font-semibold text-lg">{location.name}</h3>
                        <p className="text-sm text-muted-foreground">{location.city}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm text-muted-foreground">Active Members</p>
                        <p className="text-lg font-semibold">{location.active_members}</p>
                      </div>
                    </div>
                    <div className="grid grid-cols-4 gap-4 mt-4">
                      <div>
                        <p className="text-xs text-muted-foreground">Hours</p>
                        <p className="font-semibold">{location.this_period.total_hours}h</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Revenue</p>
                        <p className="font-semibold">€{location.this_period.total_revenue.toLocaleString()}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Labor</p>
                        <p className="font-semibold">€{location.this_period.total_labor_cost.toLocaleString()}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Completion</p>
                        <p className="font-semibold">{location.this_period.task_completion_rate}%</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Location Comparison Tab */}
        <TabsContent value="comparison" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Location Comparison</CardTitle>
              <CardDescription>Compare performance across locations</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">Comparison charts coming soon...</p>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Management Tab (Admin only) */}
        {isAdmin && (
          <TabsContent value="management" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Company Management</CardTitle>
                <CardDescription>Admin controls for company-wide settings</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">Management interface coming soon...</p>
              </CardContent>
            </Card>
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}
