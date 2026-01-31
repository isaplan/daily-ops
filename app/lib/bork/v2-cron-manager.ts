/**
 * @registry-id: borkV2CronManager
 * @created: 2026-01-30T00:00:00.000Z
 * @last-modified: 2026-01-30T00:00:00.000Z
 * @description: Cron for Bork V2 sync (daily, master, historical). Always runs all locations; no location selector.
 * @last-fix: [2026-01-30] Initial Bork cron manager
 *
 * @imports-from:
 *   - app/lib/mongodb/v2-connection.ts => getDatabase
 *   - app/lib/bork/v2-credentials.ts => getAllBorkCredentials
 *
 * @exports-to:
 *   ✓ app/api/bork/v2/cron/route.ts => start/stop/update/status/run-now
 *   ✓ app/daily-ops/settings/bork-api/BorkApiSettingsClient.tsx => cron control UI
 */

import cron, { ScheduledTask } from 'node-cron';
import { getDatabase } from '@/lib/mongodb/v2-connection';
import { ObjectId } from 'mongodb';
import { getAllBorkCredentials } from '@/lib/bork/v2-credentials';
import { ensureBorkCollections } from '@/lib/bork/v2-ensure-collections';
import { syncSalesData } from '@/lib/services/salesSyncService';
import { runMasterSyncEndpoint } from '@/lib/bork/v2-master-sync-service';
import type { MasterSyncEndpoint } from '@/lib/bork/v2-master-sync-service';

const BORK_CRON_COLLECTION = 'bork_cron_jobs';

export type BorkCronJobType = 'daily-data' | 'master-data' | 'historical-data';

export interface BorkCronJobConfig {
  _id?: ObjectId;
  jobType: BorkCronJobType;
  isActive: boolean;
  schedule: string;
  lastRun?: Date;
  nextRun?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const MASTER_ENDPOINTS: MasterSyncEndpoint[] = ['product_groups', 'payment_methods', 'cost_centers', 'users'];

export type RunJobLocationDetail = {
  locationId: string;
  recordsSaved: number;
  ticketsProcessed?: number;
  error?: string;
};

export type RunJobResult = {
  jobType: BorkCronJobType;
  credentialsRun: number;
  totalRecordsSaved: number;
  totalTicketsProcessed: number;
  details: RunJobLocationDetail[];
};

class BorkCronJobManager {
  private jobs: Map<string, ScheduledTask> = new Map();
  private db: Awaited<ReturnType<typeof getDatabase>> | null = null;

  async initialize(): Promise<void> {
    this.db = await getDatabase();
    await this.loadAndScheduleJobs();
  }

  private async loadAndScheduleJobs(): Promise<void> {
    if (!this.db) this.db = await getDatabase();
    const list = await this.db.collection(BORK_CRON_COLLECTION).find({
      isActive: true,
    }).toArray();
    for (const config of list as BorkCronJobConfig[]) {
      await this.scheduleJob(config);
    }
  }

  private async scheduleJob(config: BorkCronJobConfig): Promise<void> {
    const jobId = config._id?.toString() ?? `${config.jobType}-${Date.now()}`;
    if (this.jobs.has(jobId)) {
      this.jobs.get(jobId)?.stop();
      this.jobs.delete(jobId);
    }
    if (!cron.validate(config.schedule)) {
      throw new Error(`Invalid cron expression: ${config.schedule}`);
    }
    const task = cron.schedule(
      config.schedule,
      async () => {
        try {
          await this.executeJob(config); // result not needed for scheduled run
          if (this.db && config._id) {
            await this.db.collection(BORK_CRON_COLLECTION).updateOne(
              { _id: config._id },
              { $set: { lastRun: new Date(), updatedAt: new Date() } }
            );
          }
        } catch (error: unknown) {
          await this.recordError(config.jobType, error, { phase: 'scheduled-execute' });
        }
      },
      { scheduled: config.isActive, timezone: 'Europe/Amsterdam' } as Parameters<typeof cron.schedule>[2]
    );
    this.jobs.set(jobId, task);
  }

  private async executeJob(config: BorkCronJobConfig): Promise<RunJobResult> {
    console.log(`[Bork Cron] executeJob started: ${config.jobType}`);
    await ensureBorkCollections();
    const creds = await getAllBorkCredentials();
    if (creds.length === 0) {
      throw new Error('No Bork credentials found. Add credentials in the Credentials tab.');
    }
    console.log(`[Bork Cron] executeJob: ${config.jobType}, credentials: ${creds.length}`);

    const details: RunJobLocationDetail[] = [];
    let totalRecordsSaved = 0;
    let totalTicketsProcessed = 0;

    if (config.jobType === 'daily-data') {
      const now = new Date();
      const today = new Date(now.toLocaleString('en-US', { timeZone: 'Europe/Amsterdam' }));
      const dateStr = today.toISOString().split('T')[0];
      for (const c of creds) {
        if (!c.locationId) continue;
        try {
          const result = await syncSalesData(
            c.locationId,
            dateStr,
            dateStr,
            c.baseUrl,
            c.apiKey,
            false
          );
          if (!result.success) throw new Error(result.error ?? 'Sync failed');
          totalRecordsSaved += result.recordsSaved;
          totalTicketsProcessed += result.ticketsProcessed;
          details.push({
            locationId: c.locationId,
            recordsSaved: result.recordsSaved,
            ticketsProcessed: result.ticketsProcessed,
          });
          console.log(`[Bork Cron] daily location ${c.locationId}: saved ${result.recordsSaved}, tickets ${result.ticketsProcessed}`);
        } catch (err: unknown) {
          const msg = err instanceof Error ? err.message : String(err);
          await this.recordError(config.jobType, err, { locationId: c.locationId, phase: 'daily-sync' });
          details.push({ locationId: c.locationId, recordsSaved: 0, ticketsProcessed: 0, error: msg });
          console.log(`[Bork Cron] daily location ${c.locationId} error:`, msg);
        }
      }
    } else if (config.jobType === 'master-data') {
      for (const c of creds) {
        if (!c.locationId) continue;
        let locationRecords = 0;
        try {
          for (const endpoint of MASTER_ENDPOINTS) {
            const result = await runMasterSyncEndpoint(
              c.locationId,
              endpoint,
              c.baseUrl,
              c.apiKey
            );
            if (!result.success) throw new Error(result.error ?? 'Master sync failed');
            locationRecords += result.recordsSaved;
          }
          totalRecordsSaved += locationRecords;
          details.push({ locationId: c.locationId, recordsSaved: locationRecords });
        } catch (err: unknown) {
          const msg = err instanceof Error ? err.message : String(err);
          await this.recordError(config.jobType, err, { locationId: c.locationId, phase: 'master-sync' });
          details.push({ locationId: c.locationId, recordsSaved: 0, error: msg });
        }
      }
    } else if (config.jobType === 'historical-data') {
      const now = new Date();
      const today = new Date(now.toLocaleString('en-US', { timeZone: 'Europe/Amsterdam' }));
      const endStr = today.toISOString().split('T')[0];
      const start = new Date(today);
      start.setDate(start.getDate() - 30);
      const startStr = start.toISOString().split('T')[0];
      for (const c of creds) {
        if (!c.locationId) continue;
        try {
          const result = await syncSalesData(
            c.locationId,
            startStr,
            endStr,
            c.baseUrl,
            c.apiKey,
            false
          );
          if (!result.success) throw new Error(result.error ?? 'Sync failed');
          totalRecordsSaved += result.recordsSaved;
          totalTicketsProcessed += result.ticketsProcessed;
          details.push({
            locationId: c.locationId,
            recordsSaved: result.recordsSaved,
            ticketsProcessed: result.ticketsProcessed,
          });
          console.log(`[Bork Cron] historical location ${c.locationId}: saved ${result.recordsSaved}, tickets ${result.ticketsProcessed}`);
        } catch (err: unknown) {
          const msg = err instanceof Error ? err.message : String(err);
          await this.recordError(config.jobType, err, { locationId: c.locationId, phase: 'historical-sync' });
          details.push({ locationId: c.locationId, recordsSaved: 0, ticketsProcessed: 0, error: msg });
          console.log(`[Bork Cron] historical location ${c.locationId} error:`, msg);
        }
      }
    }

    console.log(`[Bork Cron] executeJob done: ${config.jobType}, saved: ${totalRecordsSaved}, tickets: ${totalTicketsProcessed}`, { details });
    return {
      jobType: config.jobType,
      credentialsRun: creds.filter((c) => c.locationId).length,
      totalRecordsSaved,
      totalTicketsProcessed,
      details,
    };
  }

  private async recordError(jobType: string, error: unknown, context?: Record<string, unknown>): Promise<void> {
    try {
      if (!this.db) this.db = await getDatabase();
      const message = error instanceof Error ? error.message : String(error ?? 'unknown');
      await this.db.collection('cron_errors').insertOne({
        provider: 'bork',
        jobType,
        message,
        context: context ?? {},
        createdAt: new Date(),
      });
    } catch {
      // ignore
    }
  }

  async startJob(jobType: BorkCronJobType): Promise<void> {
    if (!this.db) this.db = await getDatabase();
    const job = await this.db.collection(BORK_CRON_COLLECTION).findOne({ jobType }) as BorkCronJobConfig | null;
    if (!job) throw new Error(`Cron job ${jobType} not found`);
    await this.db.collection(BORK_CRON_COLLECTION).updateOne(
      { _id: job._id },
      { $set: { isActive: true, updatedAt: new Date() } }
    );
    job.isActive = true;
    await this.scheduleJob(job);
  }

  async stopJob(jobType: BorkCronJobType): Promise<void> {
    if (!this.db) this.db = await getDatabase();
    const job = await this.db.collection(BORK_CRON_COLLECTION).findOne({ jobType }) as BorkCronJobConfig | null;
    if (!job) throw new Error(`Cron job ${jobType} not found`);
    await this.db.collection(BORK_CRON_COLLECTION).updateOne(
      { _id: job._id },
      { $set: { isActive: false, updatedAt: new Date() } }
    );
    const jobId = job._id?.toString();
    if (jobId && this.jobs.has(jobId)) {
      this.jobs.get(jobId)?.stop();
      this.jobs.delete(jobId);
    }
  }

  async updateJob(config: Partial<BorkCronJobConfig> & { jobType: BorkCronJobType }): Promise<void> {
    if (!this.db) this.db = await getDatabase();
    const existing = await this.db.collection(BORK_CRON_COLLECTION).findOne({
      jobType: config.jobType,
    }) as BorkCronJobConfig | null;

    const schedule =
      config.schedule ??
      (config.jobType === 'master-data' ? '0 0 * * *' : config.jobType === 'historical-data' ? '0 1 * * *' : '0 1,8,15,18,19,20,21,23 * * *');

    if (existing) {
      await this.db.collection(BORK_CRON_COLLECTION).updateOne(
        { _id: existing._id },
        { $set: { ...config, schedule, updatedAt: new Date() } }
      );
      const updated = await this.db.collection(BORK_CRON_COLLECTION).findOne({ _id: existing._id }) as BorkCronJobConfig;
      if (updated?.isActive) await this.scheduleJob(updated);
    } else {
      const newJob: BorkCronJobConfig = {
        jobType: config.jobType,
        isActive: config.isActive ?? false,
        schedule,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      const result = await this.db.collection(BORK_CRON_COLLECTION).insertOne(newJob);
      newJob._id = result.insertedId as ObjectId;
      if (newJob.isActive) await this.scheduleJob(newJob);
    }
  }

  async getJobStatus(jobType: BorkCronJobType): Promise<BorkCronJobConfig | null> {
    if (!this.db) this.db = await getDatabase();
    return this.db.collection(BORK_CRON_COLLECTION).findOne({ jobType }) as Promise<BorkCronJobConfig | null>;
  }

  async runJobNow(jobType: BorkCronJobType): Promise<RunJobResult> {
    if (!this.db) this.db = await getDatabase();
    const job = await this.db.collection(BORK_CRON_COLLECTION).findOne({ jobType }) as BorkCronJobConfig | null;
    if (!job) throw new Error(`Cron job ${jobType} not found. Please save configuration first.`);
    const result = await this.executeJob(job);
    await this.db.collection(BORK_CRON_COLLECTION).updateOne(
      { _id: job._id },
      { $set: { lastRun: new Date(), updatedAt: new Date() } }
    );
    return result;
  }
}

let borkCronManager: BorkCronJobManager | null = null;

export function getBorkCronManager(): BorkCronJobManager {
  if (!borkCronManager) {
    borkCronManager = new BorkCronJobManager();
    borkCronManager.initialize().catch(() => {});
  }
  return borkCronManager;
}
