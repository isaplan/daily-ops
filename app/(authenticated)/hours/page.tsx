/**
 * @registry-id: HoursPage
 * @created: 2026-01-22T00:00:00.000Z
 * @last-modified: 2026-01-22T00:00:00.000Z
 * @description: Hours overview page - shows hours per day per location with sort and filter
 * @last-fix: [2026-01-22] Initial implementation
 * 
 * @imports-from:
 *   - app/lib/hooks/useAuth.ts => useAuth for loading state
 *   - app/components/ui/data-table.tsx => DataTable component
 *   - app/components/ui/card.tsx => Card components
 *   - app/components/ui/select.tsx => Select for filters
 *   - app/components/ui/input.tsx => Input for date filters
 * 
 * @exports-to:
 *   ✓ app/components/DailyOpsSidebar.tsx => Navigation link
 */

'use client';

import { useAuth } from '@/lib/hooks/useAuth';
import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { DataTable, DataTableColumn } from '@/components/ui/data-table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';

interface HoursData {
  date: string;
  location_id: string;
  location_name: string;
  total_hours: number;
  total_cost: number;
  record_count: number;
}

interface Location {
  _id: string;
  name: string;
}

export default function HoursPage() {
  const { loading: authLoading } = useAuth();
  const [hoursData, setHoursData] = useState<HoursData[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Set default date range to last 30 days
  const today = new Date();
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(today.getDate() - 30);
  const defaultStartDate = thirtyDaysAgo.toISOString().split('T')[0];
  const defaultEndDate = today.toISOString().split('T')[0];
  
  const [filters, setFilters] = useState({
    startDate: defaultStartDate,
    endDate: defaultEndDate,
    locationId: 'all',
    endpoint: 'time_registration_shifts',
    sortBy: 'date',
    sortOrder: 'desc',
  });

  useEffect(() => {
    if (!authLoading) {
      fetchHoursData();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading, filters.startDate, filters.endDate, filters.locationId, filters.endpoint, filters.sortBy, filters.sortOrder]);

  async function fetchHoursData() {
    try {
      setLoading(true);
      setError(null);
      const params = new URLSearchParams();
      
      if (filters.startDate) params.append('startDate', filters.startDate);
      if (filters.endDate) params.append('endDate', filters.endDate);
      if (filters.locationId && filters.locationId !== 'all') params.append('locationId', filters.locationId);
      params.append('endpoint', filters.endpoint);
      params.append('sortBy', filters.sortBy);
      params.append('sortOrder', filters.sortOrder);

      const response = await fetch(`/api/hours?${params.toString()}`);
      if (response.ok) {
        const result = await response.json();
        if (result.success) {
          setHoursData(result.data || []);
          setLocations(result.locations || []);
        } else {
          setError(result.error || 'Failed to fetch hours data');
        }
      } else {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        setError(errorData.error || `HTTP ${response.status}: Failed to fetch hours data`);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to fetch hours data';
      setError(errorMessage);
      console.error('Failed to fetch hours data:', error);
    } finally {
      setLoading(false);
    }
  }

  const handleFilterChange = (key: string, value: string) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
  };

  const resetFilters = () => {
    setFilters({
      startDate: defaultStartDate,
      endDate: defaultEndDate,
      locationId: 'all',
      endpoint: 'time_registration_shifts',
      sortBy: 'date',
      sortOrder: 'desc',
    });
  };

  // Get column headers based on selected endpoint
  const getHoursHeader = () => {
    if (filters.endpoint === 'revenue_days') return 'Revenue';
    if (filters.endpoint === 'planning_shifts') return 'Planned Hours';
    return 'Total Hours';
  };

  const getCostHeader = () => {
    if (filters.endpoint === 'revenue_days') return 'Total Revenue';
    return 'Total Cost';
  };

  const columns: DataTableColumn<HoursData>[] = [
    {
      key: 'date',
      header: 'Date',
      render: (row) => {
        const date = new Date(row.date);
        return date.toLocaleDateString('en-US', {
          year: 'numeric',
          month: 'short',
          day: 'numeric',
        });
      },
    },
    {
      key: 'location_name',
      header: 'Location',
      render: (row) => row.location_name || 'Unknown',
    },
    {
      key: 'total_hours',
      header: getHoursHeader(),
      render: (row) => {
        if (filters.endpoint === 'revenue_days') {
          return `€${row.total_hours.toFixed(2)}`;
        }
        return row.total_hours.toFixed(2);
      },
    },
    {
      key: 'total_cost',
      header: getCostHeader(),
      render: (row) => `€${row.total_cost.toFixed(2)}`,
    },
    {
      key: 'record_count',
      header: 'Records',
      render: (row) => row.record_count,
    },
  ];

  if (authLoading) {
    return (
      <div className="p-8">
        <div className="text-center">Loading...</div>
      </div>
    );
  }

  return (
    <div className="p-8 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Hours Overview</h1>
        <p className="text-muted-foreground">
          View hours worked per day per location
        </p>
      </div>

      {error && (
        <Card className="border-destructive">
          <CardContent className="pt-6">
            <div className="text-destructive">
              <strong>Error:</strong> {error}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle>Filters</CardTitle>
          <CardDescription>Filter and sort hours data</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-5">
            <div className="space-y-2">
              <Label htmlFor="endpoint">Endpoint</Label>
              <Select
                value={filters.endpoint}
                onValueChange={(value) => handleFilterChange('endpoint', value)}
              >
                <SelectTrigger id="endpoint">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="time_registration_shifts">Time Registration Shifts</SelectItem>
                  <SelectItem value="revenue_days">Revenue Days</SelectItem>
                  <SelectItem value="planning_shifts">Planning Shifts</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="startDate">Start Date</Label>
              <Input
                id="startDate"
                type="date"
                value={filters.startDate}
                onChange={(e) => handleFilterChange('startDate', e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="endDate">End Date</Label>
              <Input
                id="endDate"
                type="date"
                value={filters.endDate}
                onChange={(e) => handleFilterChange('endDate', e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="location">Location</Label>
              <Select
                value={filters.locationId}
                onValueChange={(value) => handleFilterChange('locationId', value)}
              >
                <SelectTrigger id="location">
                  <SelectValue placeholder="All locations" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All locations</SelectItem>
                  {locations.map((loc) => (
                    <SelectItem key={loc._id} value={loc._id}>
                      {loc.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="sortBy">Sort By</Label>
              <Select
                value={filters.sortBy}
                onValueChange={(value) => handleFilterChange('sortBy', value)}
              >
                <SelectTrigger id="sortBy">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="date">Date</SelectItem>
                  <SelectItem value="location">Location</SelectItem>
                  <SelectItem value="total_hours">Total Hours</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="flex items-center gap-4 mt-4">
            <div className="space-y-2">
              <Label htmlFor="sortOrder">Sort Order</Label>
              <Select
                value={filters.sortOrder}
                onValueChange={(value) => handleFilterChange('sortOrder', value)}
              >
                <SelectTrigger id="sortOrder" className="w-[140px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="desc">Descending</SelectItem>
                  <SelectItem value="asc">Ascending</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button variant="outline" onClick={resetFilters} className="mt-6">
              Reset Filters
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Summary Stats */}
      {hoursData.length > 0 && (
        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Total Hours</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {hoursData.reduce((sum, row) => sum + row.total_hours, 0).toFixed(2)}h
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Total Cost</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                €{hoursData.reduce((sum, row) => sum + row.total_cost, 0).toFixed(2)}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Total Records</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {hoursData.reduce((sum, row) => sum + row.record_count, 0)}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Hours Table */}
      <Card>
        <CardHeader>
          <CardTitle>Hours by Day and Location</CardTitle>
          <CardDescription>
            {loading ? 'Loading...' : `${hoursData.length} ${hoursData.length === 1 ? 'record' : 'records'} found`}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-8">Loading hours data...</div>
          ) : hoursData.length === 0 ? (
            <div className="text-center py-8 space-y-4">
              <p className="text-muted-foreground">No hours data found for the selected date range.</p>
              <div className="text-sm text-muted-foreground space-y-2">
                <p>Hours data is synced from the Eitje API.</p>
                <p>To populate data:</p>
                <ul className="list-disc list-inside space-y-1 mt-2">
                  <li>Go to <strong>Settings → Eitje API</strong> to configure credentials</li>
                  <li>Use the <strong>/api/eitje/v2/sync</strong> endpoint to sync data</li>
                  <li>Or check if the automatic cron sync is running</li>
                </ul>
              </div>
            </div>
          ) : (
            <DataTable
              data={hoursData}
              columns={columns}
              searchable={false}
            />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
