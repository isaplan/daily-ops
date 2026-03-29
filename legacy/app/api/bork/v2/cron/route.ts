/**
 * @registry-id: borkV2CronRoute
 * @created: 2026-01-30T00:00:00.000Z
 * @last-modified: 2026-01-30T00:00:00.000Z
 * @description: Bork V2 cron: start/stop/update/status/run-now. All jobs run all locations (no location selector).
 * @last-fix: [2026-01-30] Initial Bork cron API
 *
 * @imports-from:
 *   - app/lib/bork/v2-cron-manager.ts => getBorkCronManager, BorkCronJobConfig
 *
 * @exports-to:
 *   ✓ app/daily-ops/settings/bork-api/BorkApiSettingsClient.tsx => cron controls and status
 */

import { NextRequest, NextResponse } from 'next/server';
import { getBorkCronManager } from '@/lib/bork/v2-cron-manager';
import type { BorkCronJobConfig } from '@/lib/bork/v2-cron-manager';

export const runtime = 'nodejs';
export const maxDuration = 300; // 5 min for historical (31 days × locations)

const JOB_TYPES = ['daily-data', 'master-data', 'historical-data'] as const;
type JobType = (typeof JOB_TYPES)[number];

function formatAmsterdamTime(date: Date | null | undefined): string | null {
  if (!date) return null;
  return new Date(date).toLocaleString('en-GB', {
    timeZone: 'Europe/Amsterdam',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).replace(',', '');
}

function formatJobWithAmsterdamTime(job: BorkCronJobConfig | null): Record<string, unknown> | null {
  if (!job) return null;
  return {
    ...job,
    lastRun: formatAmsterdamTime(job.lastRun),
    lastRunUTC: job.lastRun ? new Date(job.lastRun).toISOString() : null,
    nextRun: formatAmsterdamTime(job.nextRun),
    createdAt: formatAmsterdamTime(job.createdAt),
    updatedAt: formatAmsterdamTime(job.updatedAt),
  };
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const jobType = searchParams.get('jobType') as JobType | null;
    const action = searchParams.get('action');

    if (action === 'run-now' && jobType && JOB_TYPES.includes(jobType)) {
      console.log(`[Bork Cron] GET run-now: ${jobType} started`);
      const manager = getBorkCronManager();
      const result = await manager.runJobNow(jobType);
      console.log(`[Bork Cron] GET run-now: ${jobType} done`, {
        credentialsRun: result.credentialsRun,
        totalRecordsSaved: result.totalRecordsSaved,
        totalTicketsProcessed: result.totalTicketsProcessed,
        details: result.details,
      });
      return NextResponse.json({
        success: true,
        message: `${jobType} cron job executed successfully`,
        credentialsRun: result.credentialsRun,
        totalRecordsSaved: result.totalRecordsSaved,
        totalTicketsProcessed: result.totalTicketsProcessed,
        details: result.details,
      });
    }

    const manager = getBorkCronManager();
    if (jobType && JOB_TYPES.includes(jobType)) {
      const status = await manager.getJobStatus(jobType);
      return NextResponse.json({
        success: true,
        data: status ? formatJobWithAmsterdamTime(status) : null,
      });
    }
    const all = await Promise.all(JOB_TYPES.map((t) => manager.getJobStatus(t)));
    const data = all
      .filter(Boolean)
      .map((j) => formatJobWithAmsterdamTime(j as BorkCronJobConfig));
    return NextResponse.json({ success: true, data });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to get cron status';
    console.error('[Bork Cron] GET error:', message);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const actionFromQuery = searchParams.get('action');
    const jobTypeFromQuery = searchParams.get('jobType');
    let body: { action?: string; jobType?: JobType; config?: Record<string, unknown> } = {};
    try {
      body = await request.json();
    } catch {
      body = {};
    }
    const action = actionFromQuery ?? body.action;
    const jobType = (jobTypeFromQuery ?? body.jobType) as JobType | undefined;
    const config = body.config;

    if (!action || !jobType || !JOB_TYPES.includes(jobType)) {
      return NextResponse.json(
        { success: false, error: 'action and jobType (daily-data|master-data|historical-data) are required' },
        { status: 400 }
      );
    }

    const manager = getBorkCronManager();

    switch (action) {
      case 'start':
        await manager.startJob(jobType);
        return NextResponse.json({ success: true, message: `${jobType} cron job started` });
      case 'stop':
        await manager.stopJob(jobType);
        return NextResponse.json({ success: true, message: `${jobType} cron job stopped` });
      case 'update':
        if (!config) {
          return NextResponse.json(
            { success: false, error: 'config is required for update action' },
            { status: 400 }
          );
        }
        await manager.updateJob({ ...config, jobType } as Partial<BorkCronJobConfig> & { jobType: JobType });
        return NextResponse.json({ success: true, message: `${jobType} cron job updated` });
      case 'run-now': {
        console.log(`[Bork Cron] POST run-now: ${jobType} started`);
        const result = await manager.runJobNow(jobType);
        console.log(`[Bork Cron] POST run-now: ${jobType} done`, {
          credentialsRun: result.credentialsRun,
          totalRecordsSaved: result.totalRecordsSaved,
          totalTicketsProcessed: result.totalTicketsProcessed,
          details: result.details,
        });
        return NextResponse.json({
          success: true,
          message: `${jobType} cron job executed successfully`,
          credentialsRun: result.credentialsRun,
          totalRecordsSaved: result.totalRecordsSaved,
          totalTicketsProcessed: result.totalTicketsProcessed,
          details: result.details,
        });
      }
      default:
        return NextResponse.json(
          { success: false, error: `Unknown action: ${action}` },
          { status: 400 }
        );
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to manage cron job';
    console.error('[Bork Cron] POST error:', message);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
