/**
 * @registry-id: adminCompanyStatsRoute
 * @created: 2026-01-15T12:00:00.000Z
 * @last-modified: 2026-01-15T12:00:00.000Z
 * @description: GET /api/admin/company-stats - Company-wide statistics (admin only)
 * @last-fix: [2026-01-15] Initial implementation
 * 
 * @exports-to:
 * ✓ app/(authenticated)/dashboard/admin/** => Fetch company stats
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, requireRole } from '@/lib/api-middleware';
import dbConnect from '@/lib/mongodb';
import Member from '@/models/Member';
import Location from '@/models/Location';
import Team from '@/models/Team';
import type { ILocation } from '@/models/Location';

export async function GET(req: NextRequest) {
  try {
    // Verify authentication and admin role
    const auth = await requireAuth(req);
    if (!auth.authorized) return auth.response;

    if (!requireRole('admin')(auth.user)) {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    await dbConnect();

    // Fetch all statistics
    const [members, locations, teams, activeMembers] = await Promise.all([
      Member.countDocuments({}),
      Location.countDocuments({}),
      Team.countDocuments({}),
      Member.countDocuments({ is_active: true }),
    ]);

    // Fetch location stats for aggregation
    const locationStats = await Location.find({}).lean() as unknown as ILocation[];

    const totalHours = locationStats.reduce((sum: number, loc: ILocation) => sum + ((loc as unknown as { this_period?: { total_hours?: number } }).this_period?.total_hours || 0), 0);
    const totalLabor = locationStats.reduce((sum: number, loc: ILocation) => sum + ((loc as unknown as { this_period?: { total_labor_cost?: number } }).this_period?.total_labor_cost || 0), 0);
    const totalRevenue = locationStats.reduce((sum: number, loc: ILocation) => sum + ((loc as unknown as { this_period?: { total_revenue?: number } }).this_period?.total_revenue || 0), 0);
    const totalProfit = totalRevenue - totalLabor;

    // Calculate average task completion rate
    const taskRates = locationStats
      .map((loc: ILocation) => (loc as unknown as { this_period?: { task_completion_rate?: number } }).this_period?.task_completion_rate || 0)
      .filter((rate: number) => rate > 0);
    const avgTaskCompletion = taskRates.length > 0 ? Math.round(taskRates.reduce((a: number, b: number) => a + b, 0) / taskRates.length) : 0;

    return NextResponse.json({
      totalMembers: members,
      activeMembers,
      totalLocations: locations,
      totalTeams: teams,
      totalHours: Math.round(totalHours * 10) / 10,
      totalRevenue: Math.round(totalRevenue * 100) / 100,
      totalLabor: Math.round(totalLabor * 100) / 100,
      overallProfit: Math.round(totalProfit * 100) / 100,
      taskCompletionRate: avgTaskCompletion,
    });
  } catch (error) {
    console.error('GET /api/admin/company-stats error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
