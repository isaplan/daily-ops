/**
 * @registry-id: DashboardRouter
 * @created: 2026-01-15T12:00:00.000Z
 * @last-modified: 2026-01-24T00:00:00.000Z
 * @description: Main dashboard page that routes to appropriate dashboard based on role
 * @last-fix: [2026-01-24] Moved to /daily-work/dashboard and updated redirects
 */

'use client';

import { useAuth } from '@/lib/hooks/useAuth';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function DashboardPage() {
  const { loading, isAdmin, isManager, isMember } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;

    // Route to appropriate dashboard based on role
    if (isAdmin) {
      router.push('/daily-work/dashboard/admin');
    } else if (isManager) {
      router.push('/daily-work/dashboard/location'); // Managers default to location, but can access company view
    } else if (isMember) {
      router.push('/daily-work/dashboard/member');
    } else {
      router.push('/daily-work');
    }
  }, [loading, isAdmin, isManager, isMember, router]);

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

