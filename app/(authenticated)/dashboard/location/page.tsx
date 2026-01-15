/**
 * @registry-id: LocationDashboard
 * @created: 2026-01-15T12:00:00.000Z
 * @last-modified: 2026-01-15T12:00:00.000Z
 * @description: Location dashboard - all location data, accessible by managers + admins
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

interface LocationData {
  _id: string;
  name: string;
  address: string;
  city: string;
  country: string;
  total_members: number;
  active_members: number;
  this_period: {
    total_hours: number;
    total_labor_cost: number;
    total_revenue: number;
    total_transactions: number;
    task_completion_rate: number;
    events_serviced: number;
    events_revenue: number;
  };
}

export default function LocationDashboard() {
  const { user, loading: authLoading, canView, canEdit, isManager, isAdmin, canViewOtherLocations } = useAuth();
  const [locationData, setLocationData] = useState<LocationData | null>(null);
  const [loading, setLoading] = useState(true);

  // Only managers and admins can access location dashboard
  useEffect(() => {
    if (!authLoading && user?.location_id && (isManager || isAdmin)) {
      fetchLocationData();
    }
  }, [authLoading, user?.location_id, isManager, isAdmin]);

  async function fetchLocationData() {
    try {
      if (!user?.location_id) return;

      const response = await fetch(`/api/locations/${user.location_id}`);
      if (response.ok) {
        const data = await response.json();
        setLocationData(data);
      }
    } catch (error) {
      console.error('Failed to fetch location data:', error);
    } finally {
      setLoading(false);
    }
  }

  if (authLoading || loading) {
    return <div className="p-8">Loading location dashboard...</div>;
  }

  if (!canView('location')) {
    return <div className="p-8 text-center">You don't have access to location data</div>;
  }

  if (!locationData) {
    return <div className="p-8">No location data available</div>;
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold">{locationData.name}</h1>
        <p className="text-muted-foreground">
          {locationData.address} • {locationData.city}, {locationData.country}
        </p>
        {isManager && !isAdmin && (
          <p className="text-sm text-muted-foreground mt-1">
            View-only mode • You can view but not edit location settings
          </p>
        )}
      </div>

      {/* Key KPIs */}
      <div className="grid gap-4 md:grid-cols-6">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Active Members</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{locationData.active_members}</div>
            <p className="text-xs text-muted-foreground">of {locationData.total_members}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Total Hours</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{locationData.this_period.total_hours}h</div>
            <p className="text-xs text-muted-foreground">This period</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Labor Cost</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">€{locationData.this_period.total_labor_cost}</div>
            <p className="text-xs text-muted-foreground">This period</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Revenue</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">€{locationData.this_period.total_revenue}</div>
            <p className="text-xs text-muted-foreground">This period</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Profit</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              €{locationData.this_period.total_revenue - locationData.this_period.total_labor_cost}
            </div>
            <p className="text-xs text-muted-foreground">Revenue - Labor</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Task Completion</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{locationData.this_period.task_completion_rate}%</div>
            <p className="text-xs text-muted-foreground">Rate</p>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="teams" className="w-full">
        <TabsList>
          <TabsTrigger value="teams">Teams</TabsTrigger>
          <TabsTrigger value="members">Members</TabsTrigger>
          <TabsTrigger value="events">Events</TabsTrigger>
          {(isManager || isAdmin) && <TabsTrigger value="financials">Financials</TabsTrigger>}
          {canViewOtherLocations() && <TabsTrigger value="other-locations">Other Locations</TabsTrigger>}
        </TabsList>

        {/* Teams Tab */}
        <TabsContent value="teams" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Location Teams</CardTitle>
              <CardDescription>All teams at this location</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">Teams list coming soon...</p>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Members Tab */}
        <TabsContent value="members" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Location Staff</CardTitle>
              <CardDescription>All members at this location</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">Members list coming soon...</p>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Events Tab */}
        <TabsContent value="events" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Events</CardTitle>
              <CardDescription>Events serviced at this location</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <p className="text-sm text-muted-foreground">Total Events</p>
                  <p className="text-2xl font-bold">{locationData.this_period.events_serviced}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Events Revenue</p>
                  <p className="text-2xl font-bold">€{locationData.this_period.events_revenue}</p>
                </div>
              </div>
              <p className="text-muted-foreground mt-4">Events list coming soon...</p>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Financials Tab - For managers and admins */}
        {(isManager || isAdmin) && (
          <TabsContent value="financials" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Financial Summary</CardTitle>
                <CardDescription>
                  Financial data for this location {isManager && '(read-only)'}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">Financial summary coming soon...</p>
              </CardContent>
            </Card>
          </TabsContent>
        )}

        {/* Other Locations Tab - For managers and admins */}
        {canViewOtherLocations() && (
          <TabsContent value="other-locations" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Other Locations</CardTitle>
                <CardDescription>View other company locations</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">Other locations list coming soon...</p>
                <p className="text-sm text-muted-foreground mt-2">
                  You can also view the <a href="/dashboard/company" className="text-blue-600 underline">consolidated company view</a>.
                </p>
              </CardContent>
            </Card>
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}
