/**
 * @registry-id: HoursByWorkerPage
 * @created: 2026-01-25T00:00:00.000Z
 * @last-modified: 2026-01-25T00:00:00.000Z
 * @description: Hours breakdown by worker - shows total hours per worker
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

interface HoursByWorkerData {
  worker_id: string;
  worker_name: string;
  total_hours: number;
  total_cost: number;
  record_count: number;
  location_count: number;
}

export default function HoursByWorkerPage() {
  const { loading: authLoading } = useAuth();
  const [hoursData, setHoursData] = useState<HoursByWorkerData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const today = new Date();
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(today.getDate() - 30);
  const defaultStartDate = thirtyDaysAgo.toISOString().split('T')[0];
  const defaultEndDate = today.toISOString().split('T')[0];
  
  const [filters, setFilters] = useState({
    startDate: defaultStartDate,
    endDate: defaultEndDate,
    endpoint: 'time_registration_shifts',
    sortBy: 'total_hours',
    sortOrder: 'desc',
  });

  useEffect(() => {
    if (!authLoading) {
      fetchHoursData();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading, filters.startDate, filters.endDate, filters.endpoint, filters.sortBy, filters.sortOrder]);

  async function fetchHoursData() {
    try {
      setLoading(true);
      setError(null);
      const params = new URLSearchParams();
      
      if (filters.startDate) params.append('startDate', filters.startDate);
      if (filters.endDate) params.append('endDate', filters.endDate);
      params.append('endpoint', filters.endpoint);
      params.append('groupBy', 'worker');
      params.append('sortBy', filters.sortBy);
      params.append('sortOrder', filters.sortOrder);

      const response = await fetch(`/api/hours?${params.toString()}`);
      if (response.ok) {
        const result = await response.json();
        if (result.success) {
          setHoursData(result.data || []);
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
      endpoint: 'time_registration_shifts',
      sortBy: 'total_hours',
      sortOrder: 'desc',
    });
  };

  const columns: DataTableColumn<HoursByWorkerData>[] = [
    {
      key: 'worker_name',
      header: 'Worker',
      render: (row) => row.worker_name || 'Unknown',
    },
    {
      key: 'total_hours',
      header: 'Total Hours',
      render: (row) => row.total_hours.toFixed(2),
    },
    {
      key: 'total_cost',
      header: 'Total Cost',
      render: (row) => `€${row.total_cost.toFixed(2)}`,
    },
    {
      key: 'location_count',
      header: 'Locations',
      render: (row) => row.location_count || 0,
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
        <h1 className="text-3xl font-bold">Hours by Worker</h1>
        <p className="text-muted-foreground">
          View total hours worked per worker
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
          <div className="grid gap-4 md:grid-cols-4">
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
              <Label htmlFor="sortBy">Sort By</Label>
              <Select
                value={filters.sortBy}
                onValueChange={(value) => handleFilterChange('sortBy', value)}
              >
                <SelectTrigger id="sortBy">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="worker_name">Worker Name</SelectItem>
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
              <CardTitle className="text-sm font-medium">Total Workers</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {hoursData.length}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Hours Table */}
      <Card>
        <CardHeader>
          <CardTitle>Hours by Worker</CardTitle>
          <CardDescription>
            {loading ? 'Loading...' : `${hoursData.length} ${hoursData.length === 1 ? 'worker' : 'workers'} found`}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-8">Loading hours data...</div>
          ) : (
            <>
              <DataTable
                data={hoursData}
                columns={columns}
                searchable={false}
              />
              {hoursData.length === 0 && !loading && (
                <div className="mt-4 text-center space-y-2">
                  <p className="text-sm text-muted-foreground">Hours data is synced from the Eitje API.</p>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
