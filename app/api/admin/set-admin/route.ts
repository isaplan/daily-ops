/**
 * @registry-id: setAdminRoute
 * @created: 2026-01-24T00:00:00.000Z
 * @last-modified: 2026-01-24T00:00:00.000Z
 * @description: POST /api/admin/set-admin - Set a user as admin (temporary dev endpoint)
 * @last-fix: [2026-01-24] Initial implementation
 * 
 * @exports-to:
 * ✓ Temporary dev endpoint for setting admin role
 */

import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import Member from '@/models/Member';

export async function POST(req: NextRequest) {
  try {
    const { email } = await req.json();

    if (!email) {
      return NextResponse.json({ error: 'Email is required' }, { status: 400 });
    }

    await dbConnect();

    const member = await Member.findOne({ email });

    if (!member) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Check if user already has overall_manager role
    const hasAdminRole = member.roles?.some(r => r.role === 'overall_manager');

    if (!hasAdminRole) {
      // Add overall_manager role with company scope
      member.roles = member.roles || [];
      member.roles.push({
        role: 'overall_manager',
        scope: 'company',
        grantedAt: new Date(),
      });
      await member.save();
    }

    return NextResponse.json({
      success: true,
      message: `User ${email} is now an admin`,
      member: {
        email: member.email,
        name: member.name,
        roles: member.roles,
      },
    });
  } catch (error) {
    console.error('POST /api/admin/set-admin error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
