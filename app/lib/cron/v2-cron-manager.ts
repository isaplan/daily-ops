/**
 * @registry-id: eitjeV2CronManager
 * @created: 2026-01-22T00:00:00.000Z
 * @last-modified: 2026-01-24T00:00:00.000Z
 * @description: Cron orchestration for Eitje V2 sync (daily, master, historical) with MongoDB persistence
 * @last-fix: [2026-01-24] Added metadata header for validation
 *
 * @imports-from:
 *   - app/lib/mongodb/v2-connection.ts => getDatabase
 *   - app/lib/eitje/v2-types.ts => EITJE_DATE_LIMITS
 *   - node-cron => scheduling
 *
 * @exports-to:
 *   ✓ app/api/eitje/v2/cron/route.ts => start/stop/update/status/run-now operations
 *   ✓ app/api/eitje/v2/sync/route.ts => invoked via internal HTTP calls
 *   ✓ app/(authenticated)/settings/eitje-api/page.tsx => cron control UI
 */

import cron, { ScheduledTask } from 'node-cron';
import { getDatabase } from '@/lib/mongodb/v2-connection';
import { ObjectId } from 'mongodb';
import { EITJE_DATE_LIMITS } from '@/lib/eitje/v2-types';

export interface CronJobConfig {
  _id?: ObjectId;
  jobType: 'daily-data' | 'master-data' | 'historical-data';
  isActive: boolean;
  schedule: string; // Cron expression
  syncInterval?: number; // For daily data (minutes) or master data (seconds)
  enabledEndpoints?: {
    hours?: boolean;
    revenue?: boolean;
    planning?: boolean;
  };
  enabledMasterEndpoints?: {
    environments?: boolean;
    teams?: boolean;
    users?: boolean;
    shiftTypes?: boolean;
  };
  quietHours?: {
    start: string; // HH:mm format
    end: string; // HH:mm format
  };
  lastRun?: Date;
  nextRun?: Date;
  createdAt: Date;
  updatedAt: Date;
}

class CronJobManager {
  private jobs: Map<string, ScheduledTask> = new Map();
  private db: any = null;

  async initialize() {
    this.db = await getDatabase();
    await this.loadAndScheduleJobs();
  }

  /**
   * Load cron jobs from MongoDB and schedule them
   */
  async loadAndScheduleJobs() {
    if (!this.db) {
      this.db = await getDatabase();
    }

    const jobs = await this.db.collection('cron_jobs').find({ isActive: true }).toArray();
    
    for (const jobConfig of jobs) {
      await this.scheduleJob(jobConfig);
    }
  }

  /**
   * Schedule a cron job
   */
  async scheduleJob(config: CronJobConfig): Promise<void> {
    const jobId = config._id?.toString() || `${config.jobType}-${Date.now()}`;
    
    // Stop existing job if any
    if (this.jobs.has(jobId)) {
      this.jobs.get(jobId)?.stop();
      this.jobs.delete(jobId);
    }

    // Validate cron expression
    if (!cron.validate(config.schedule)) {
      throw new Error(`Invalid cron expression: ${config.schedule}`);
    }

    // Create and schedule the job
    const task = cron.schedule(config.schedule, async () => {
      console.log(`[Cron Job] Executing ${config.jobType} job at ${new Date().toISOString()}`);
      
      try {
        await this.executeJob(config);
        
        // Update last run time
        await this.db.collection('cron_jobs').updateOne(
          { _id: config._id },
          { 
            $set: { 
              lastRun: new Date(),
              updatedAt: new Date()
            }
          }
        );
      } catch (error: any) {
        console.error(`[Cron Job] Error executing ${config.jobType}:`, error);
        await this.recordError(config.jobType, error, { phase: 'scheduled-execute' });
      }
    }, {
      scheduled: config.isActive,
      timezone: 'Europe/Amsterdam',
    } as Parameters<typeof cron.schedule>[2]);

    this.jobs.set(jobId, task);
    console.log(`[Cron Job] Scheduled ${config.jobType} with schedule ${config.schedule}, active: ${config.isActive}`);
  }

  /**
   * Execute a cron job
   */
  private async executeJob(config: CronJobConfig): Promise<void> {
    // Get base URL for internal API calls
    let baseUrl = process.env.NEXT_PUBLIC_APP_URL;
    
    if (!baseUrl) {
      const vercelUrl = process.env.VERCEL_URL;
      if (vercelUrl) {
        baseUrl = `https://${vercelUrl}`;
      } else {
        baseUrl = 'http://localhost:3000';
      }
    }
    
    // Ensure baseUrl doesn't have trailing slash
    baseUrl = baseUrl.replace(/\/$/, '');
    
    console.log(`[Cron Job] Executing ${config.jobType} job with baseUrl: ${baseUrl}`);
    
    if (config.jobType === 'daily-data') {
      // Execute daily data sync - sync ALL available daily endpoints
      // All date-based endpoints that should be synced daily
      const allDailyEndpoints = [
        'time_registration_shifts',
        'revenue_days',
        'planning_shifts',
        'availability_shifts',
        'leave_requests',
        'events',
      ];

      // Get today's date in Amsterdam timezone
      const now = new Date();
      const amsterdamDate = new Date(now.toLocaleString('en-US', { timeZone: 'Europe/Amsterdam' }));
      const startDate = amsterdamDate.toISOString().split('T')[0];
      const endDate = amsterdamDate.toISOString().split('T')[0];

      // Check quiet hours
      if (config.quietHours) {
        const now = new Date();
        const currentHour = now.getHours();
        const currentMinute = now.getMinutes();
        
        const [startHour, startMin] = config.quietHours.start.split(':').map(Number);
        const [endHour, endMin] = config.quietHours.end.split(':').map(Number);
        
        const startTime = startHour * 60 + startMin;
        const endTime = endHour * 60 + endMin;
        const currentTimeMinutes = currentHour * 60 + currentMinute;
        
        if (currentTimeMinutes >= startTime && currentTimeMinutes <= endTime) {
          console.log(`[Cron Job] Skipping sync during quiet hours (${config.quietHours.start} - ${config.quietHours.end})`);
          return;
        }
      }

      // Sync ALL daily endpoints (ignore enabledEndpoints config - sync everything)
      for (const endpoint of allDailyEndpoints) {
        try {
          const syncUrl = `${baseUrl}/api/eitje/v2/sync`;
          console.log(`[Cron Job] Syncing ${endpoint} via ${syncUrl}`);
          
          const response = await fetch(syncUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              startDate,
              endDate,
              endpoint,
            }),
          });
          
          if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`HTTP ${response.status}: ${errorText}`);
          }
          
          const result = await response.json();
          
          if (!result.success) {
            throw new Error(result.error || 'Sync failed without error message');
          }
          
          console.log(`[Cron Job] Synced ${endpoint}: ${result.recordsSaved || 0} records`);
        } catch (error: any) {
          console.error(`[Cron Job] Error syncing ${endpoint}:`, error.message);
          await this.recordError(config.jobType, error, { endpoint, baseUrl, phase: 'daily-data-sync' });
        }
      }
    } else if (config.jobType === 'master-data') {
      // Execute master data sync - sync ALL available master endpoints
      // All master data endpoints that don't require dates
      const allMasterEndpoints = [
        'environments',
        'teams',
        'users',
        'shift_types',
      ];

      // Sync ALL master endpoints (ignore enabledMasterEndpoints config - sync everything)
      for (const endpoint of allMasterEndpoints) {
        try {
          const syncUrl = `${baseUrl}/api/eitje/v2/sync`;
          console.log(`[Cron Job] Syncing master data ${endpoint} via ${syncUrl}`);
          
          const response = await fetch(syncUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              endpoint,
              // Master endpoints don't require dates
            }),
          });
          
          if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`HTTP ${response.status}: ${errorText}`);
          }
          
          const result = await response.json();
          
          if (!result.success) {
            throw new Error(result.error || 'Sync failed without error message');
          }
          
          console.log(`[Cron Job] Synced ${endpoint}: ${result.recordsSaved || 0} records`);
        } catch (error: any) {
          console.error(`[Cron Job] Error syncing ${endpoint}:`, error.message);
          await this.recordError(config.jobType, error, { endpoint, baseUrl, phase: 'master-data-sync' });
        }
      }
    } else if (config.jobType === 'historical-data') {
      // Execute historical data sync (last 30 days to catch any missed changes)
      // Sync ALL available daily endpoints for historical data
      const allHistoricalEndpoints = [
        'time_registration_shifts',
        'revenue_days',
        'planning_shifts',
        'availability_shifts',
        'leave_requests',
        'events',
      ];

      // Get last 30 days date range in Amsterdam timezone
      const now = new Date();
      const today = new Date(now.toLocaleString('en-US', { timeZone: 'Europe/Amsterdam' }));
      const thirtyDaysAgo = new Date(today);
      thirtyDaysAgo.setDate(today.getDate() - 30);
      const overallStartDate = thirtyDaysAgo.toISOString().split('T')[0];
      const overallEndDate = today.toISOString().split('T')[0];

      console.log(`[Cron Job] Historical sync: fetching last 30 days (${overallStartDate} to ${overallEndDate})`);

      // Helper function to split date range into chunks
      const splitDateRange = (startDate: string, endDate: string, maxDays: number): Array<{ startDate: string; endDate: string }> => {
        const start = new Date(startDate);
        const end = new Date(endDate);
        const totalDays = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
        
        if (totalDays <= maxDays) {
          return [{ startDate, endDate }];
        }

        const chunks: Array<{ startDate: string; endDate: string }> = [];
        let currentStart = new Date(start);
        
        while (currentStart < end) {
          const currentEnd = new Date(currentStart);
          currentEnd.setDate(currentEnd.getDate() + maxDays - 1);
          
          if (currentEnd > end) {
            currentEnd.setTime(end.getTime());
          }
          
          chunks.push({
            startDate: currentStart.toISOString().split('T')[0],
            endDate: currentEnd.toISOString().split('T')[0],
          });
          
          currentStart = new Date(currentEnd);
          currentStart.setDate(currentStart.getDate() + 1);
        }
        
        return chunks;
      };

      // Sync ALL historical endpoints (ignore enabledEndpoints config - sync everything)
      for (const endpoint of allHistoricalEndpoints) {
        const maxDays = (EITJE_DATE_LIMITS as any)[endpoint] || 7;
        
        // Split into chunks if needed
        const dateChunks = splitDateRange(overallStartDate, overallEndDate, maxDays);
        
        console.log(`[Cron Job] Historical sync ${endpoint}: splitting into ${dateChunks.length} chunk(s) (max ${maxDays} days per chunk)`);
        
        let totalRecords = 0;
        
        for (const chunk of dateChunks) {
          try {
            const syncUrl = `${baseUrl}/api/eitje/v2/sync`;
            console.log(`[Cron Job] Historical sync ${endpoint} (${chunk.startDate} to ${chunk.endDate}) via ${syncUrl}`);
            
            const response = await fetch(syncUrl, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                startDate: chunk.startDate,
                endDate: chunk.endDate,
                endpoint,
              }),
            });
            
            if (!response.ok) {
              const errorText = await response.text();
              throw new Error(`HTTP ${response.status}: ${errorText}`);
            }
            
            const result = await response.json();
            
            if (!result.success) {
              throw new Error(result.error || 'Sync failed without error message');
            }
            
            const recordsSaved = result.recordsSaved || 0;
            totalRecords += recordsSaved;
            console.log(`[Cron Job] Historical sync ${endpoint} (${chunk.startDate} to ${chunk.endDate}): ${recordsSaved} records`);
          } catch (error: any) {
            console.error(`[Cron Job] Error in historical sync ${endpoint} (${chunk.startDate} to ${chunk.endDate}):`, error.message);
            await this.recordError(config.jobType, error, { endpoint, baseUrl, chunk, phase: 'historical-data-sync' });
          }
        }
        
        console.log(`[Cron Job] Historical sync ${endpoint} completed: ${totalRecords} total records`);
      }
    }
  }

  /**
   * Record a cron job error to the `cron_errors` collection
   */
  async recordError(jobType: string, error: unknown, context?: Record<string, any>) {
    try {
      if (!this.db) this.db = await getDatabase();

      const message = (error && (error as any).message) ? (error as any).message : String(error || 'unknown error');
      const stack = (error && (error as any).stack) ? (error as any).stack : undefined;

      const doc = {
        jobType,
        message,
        stack,
        context: context || {},
        createdAt: new Date(),
      } as any;

      await this.db.collection('cron_errors').insertOne(doc);
    } catch (e) {
      console.error('[Cron Job] Failed to record error to cron_errors collection', e);
    }
  }

  /**
   * Start a cron job
   */
  async startJob(jobType: 'daily-data' | 'master-data' | 'historical-data'): Promise<void> {
    if (!this.db) {
      this.db = await getDatabase();
    }

    const job = await this.db.collection('cron_jobs').findOne({ jobType });
    
    if (!job) {
      throw new Error(`Cron job ${jobType} not found`);
    }

    await this.db.collection('cron_jobs').updateOne(
      { _id: job._id },
      { 
        $set: { 
          isActive: true,
          updatedAt: new Date()
        }
      }
    );

    job.isActive = true;
    await this.scheduleJob(job);
  }

  /**
   * Stop a cron job
   */
  async stopJob(jobType: 'daily-data' | 'master-data' | 'historical-data'): Promise<void> {
    if (!this.db) {
      this.db = await getDatabase();
    }

    const job = await this.db.collection('cron_jobs').findOne({ jobType });
    
    if (!job) {
      throw new Error(`Cron job ${jobType} not found`);
    }

    await this.db.collection('cron_jobs').updateOne(
      { _id: job._id },
      { 
        $set: { 
          isActive: false,
          updatedAt: new Date()
        }
      }
    );

    // Stop the scheduled task
    const jobId = job._id.toString();
    if (this.jobs.has(jobId)) {
      this.jobs.get(jobId)?.stop();
      this.jobs.delete(jobId);
    }
  }

  /**
   * Update cron job configuration
   */
  async updateJob(config: Partial<CronJobConfig> & { jobType: CronJobConfig['jobType'] }): Promise<void> {
    if (!this.db) {
      this.db = await getDatabase();
    }

    const existing = await this.db.collection('cron_jobs').findOne({ jobType: config.jobType });
    
    if (existing) {
      // Update existing
      const updateData: any = {
        ...config,
        updatedAt: new Date(),
      };
      delete updateData._id;

      await this.db.collection('cron_jobs').updateOne(
        { _id: existing._id },
        { $set: updateData }
      );

      // Reschedule if active
      if (updateData.isActive !== false) {
        const updated = await this.db.collection('cron_jobs').findOne({ _id: existing._id });
        await this.scheduleJob(updated);
      }
    } else {
      // Create new
      const newJob: CronJobConfig = {
        jobType: config.jobType,
        isActive: config.isActive ?? false,
        schedule: config.schedule || (() => {
          switch (config.jobType) {
            case 'master-data':
              return '0 0 * * *';
            case 'historical-data':
              return '0 1 * * *';
            default:
              return '0 * * * *';
          }
        })(),
        syncInterval: config.syncInterval,
        enabledEndpoints: config.enabledEndpoints,
        enabledMasterEndpoints: config.enabledMasterEndpoints,
        quietHours: config.quietHours,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const result = await this.db.collection('cron_jobs').insertOne(newJob);
      newJob._id = result.insertedId;

      if (newJob.isActive) {
        await this.scheduleJob(newJob);
      }
    }
  }

  /**
   * Get cron job status
   */
  async getJobStatus(jobType: 'daily-data' | 'master-data' | 'historical-data'): Promise<CronJobConfig | null> {
    if (!this.db) {
      this.db = await getDatabase();
    }

    return await this.db.collection('cron_jobs').findOne({ jobType });
  }

  /**
   * Get all cron jobs
   */
  async getAllJobs(): Promise<CronJobConfig[]> {
    if (!this.db) {
      this.db = await getDatabase();
    }

    return await this.db.collection('cron_jobs').find({}).toArray();
  }

  /**
   * Manually execute a cron job immediately (for testing)
   */
  async runJobNow(jobType: 'daily-data' | 'master-data' | 'historical-data'): Promise<void> {
    if (!this.db) {
      this.db = await getDatabase();
    }

    const job = await this.db.collection('cron_jobs').findOne({ jobType });
    
    if (!job) {
      throw new Error(`Cron job ${jobType} not found. Please save configuration first.`);
    }

    console.log(`[Cron Job] Manually executing ${jobType} job at ${new Date().toISOString()}`);
    
    try {
      await this.executeJob(job);
      
      // Update last run time
      await this.db.collection('cron_jobs').updateOne(
        { _id: job._id },
        { 
          $set: { 
            lastRun: new Date(),
            updatedAt: new Date()
          }
        }
      );
      
      console.log(`[Cron Job] Successfully executed ${jobType} job`);
    } catch (error: any) {
      console.error(`[Cron Job] Error executing ${jobType}:`, error);
      await this.recordError(jobType, error, { phase: 'run-now' });
      throw error;
    }
  }
}

// Singleton instance
let cronManager: CronJobManager | null = null;

export function getCronManager(): CronJobManager {
  if (!cronManager) {
    cronManager = new CronJobManager();
    // Initialize on first access (will be called in API routes)
    cronManager.initialize().catch(console.error);
  }
  return cronManager;
}
