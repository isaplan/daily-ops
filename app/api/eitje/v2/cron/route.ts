/**
 * @registry-id: eitjeV2CronRoute
 * @created: 2026-01-22T00:00:00.000Z
 * @last-modified: 2026-01-24T00:00:00.000Z
 * @description: Route to manage and trigger Eitje V2 cron jobs (start/stop/update/status/run-now)
 * @last-fix: [2026-01-24] Added metadata header for validation
 *
 * @imports-from:
 *   - app/lib/cron/v2-cron-manager.ts => getCronManager, CronJobConfig
 *
 * @exports-to:
 *   ✓ app/(authenticated)/settings/eitje-api/page.tsx => cron controls and status display
 *   ✓ app/lib/cron/v2-cron-manager.ts => invoked for cron orchestration
 */

import { NextRequest, NextResponse } from 'next/server';
import { getCronManager } from '@/lib/cron/v2-cron-manager';
import type { CronJobConfig } from '@/lib/cron/v2-cron-manager';

export const runtime = 'nodejs';

// Helper to format timestamps in Amsterdam timezone
const formatAmsterdamTime = (date: Date | null | undefined): string | null => {
  if (!date) return null;
  const d = new Date(date);
  return d.toLocaleString('en-GB', {
    timeZone: 'Europe/Amsterdam',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).replace(',', '');
};

// Helper to format job object with Amsterdam timestamps
const formatJobWithAmsterdamTime = (job: CronJobConfig | null): any => {
  if (!job) return null;
  return {
    ...job,
    lastRun: formatAmsterdamTime(job.lastRun),
    lastRunUTC: job.lastRun ? new Date(job.lastRun).toISOString() : null,
    nextRun: formatAmsterdamTime(job.nextRun),
    createdAt: formatAmsterdamTime(job.createdAt),
    updatedAt: formatAmsterdamTime(job.updatedAt),
  };
};

export async function POST(request: NextRequest) {
  try {
    // Support both POST body and query params (for Vercel cron jobs)
    const { searchParams } = new URL(request.url);
    const actionFromQuery = searchParams.get('action');
    const jobTypeFromQuery = searchParams.get('jobType');
    
    let body: any = {};
    try {
      body = await request.json();
    } catch {
      // If no body, use query params (Vercel cron calls)
      body = {};
    }
    
    const { action, jobType, config } = {
      action: actionFromQuery || body.action,
      jobType: jobTypeFromQuery || body.jobType,
      config: body.config,
    };

    if (!action || !jobType) {
      return NextResponse.json(
        { success: false, error: 'action and jobType are required' },
        { status: 400 }
      );
    }

    const cronManager = getCronManager();

    switch (action) {
      case 'start':
        await cronManager.startJob(jobType);
        return NextResponse.json({
          success: true,
          message: `${jobType} cron job started`,
        });

      case 'stop':
        await cronManager.stopJob(jobType);
        return NextResponse.json({
          success: true,
          message: `${jobType} cron job stopped`,
        });

      case 'update':
        if (!config) {
          return NextResponse.json(
            { success: false, error: 'config is required for update action' },
            { status: 400 }
          );
        }
        await cronManager.updateJob({ ...config, jobType });
        return NextResponse.json({
          success: true,
          message: `${jobType} cron job updated`,
        });

      case 'run-now':
        await cronManager.runJobNow(jobType);
        return NextResponse.json({
          success: true,
          message: `${jobType} cron job executed successfully`,
        });

      case 'status':
        const status = await cronManager.getJobStatus(jobType);
        return NextResponse.json({
          success: true,
          data: status,
        });

      default:
        return NextResponse.json(
          { success: false, error: `Unknown action: ${action}` },
          { status: 400 }
        );
    }
  } catch (error: any) {
    console.error('[API /eitje/v2/cron] Error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Failed to manage cron job',
      },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const jobType = searchParams.get('jobType') as 'daily-data' | 'master-data' | 'historical-data' | null;
    const action = searchParams.get('action'); // For Vercel cron jobs

    // If action is 'run-now', execute the job (Vercel cron calls)
    if (action === 'run-now' && jobType) {
      const cronManager = getCronManager();
      await cronManager.runJobNow(jobType);
      return NextResponse.json({
        success: true,
        message: `${jobType} cron job executed successfully`,
      });
    }

    const cronManager = getCronManager();

    if (jobType) {
      const status = await cronManager.getJobStatus(jobType);
      
      // Return status if found, otherwise return null (job doesn't exist yet)
      if (!status) {
        return NextResponse.json({
          success: true,
          data: null,
        });
      }
      
      // Format timestamps in Amsterdam timezone
      return NextResponse.json({
        success: true,
        data: formatJobWithAmsterdamTime(status),
      });
    } else {
      const allJobs = await cronManager.getAllJobs();
      // Filter to only Eitje jobs
      const eitjeJobs = allJobs.filter(job => 
        job.jobType === 'daily-data' || 
        job.jobType === 'master-data' || 
        job.jobType === 'historical-data'
      );
      // Format timestamps in Amsterdam timezone
      return NextResponse.json({
        success: true,
        data: eitjeJobs.map(formatJobWithAmsterdamTime),
      });
    }
  } catch (error: any) {
    console.error('[API /eitje/v2/cron] Error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Failed to get cron job status',
      },
      { status: 500 }
    );
  }
}
