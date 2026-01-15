/**
 * @registry-id: DashboardRouter
 * @created: 2026-01-15T12:00:00.000Z
 * @last-modified: 2026-01-15T12:00:00.000Z
 * @description: Main dashboard page that routes to appropriate dashboard based on role
 * @last-fix: [2026-01-15] Initial implementation
 * 
 * @exports-to:
 * ✓ app/(authenticated)/** => Dashboard entry point
 */

'use client';

import { useAuth } from '@/lib/hooks/useAuth';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function DashboardPage() {
  const { user, loading, isAdmin, isManager, isMember } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;

    // Route to appropriate dashboard based on role
    if (isAdmin) {
      router.push('/dashboard/admin');
    } else if (isManager) {
      router.push('/dashboard/location'); // Managers default to location, but can access company view
    } else if (isMember) {
      router.push('/dashboard/member');
    } else {
      router.push('/auth/signin');
    }
  }, [user, loading, isAdmin, isManager, isMember, router]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="mb-4 text-lg">Loading dashboard...</div>
          <div className="text-sm text-muted-foreground">Redirecting you to your dashboard</div>
        </div>
      </div>
    );
  }

  return null;
}
