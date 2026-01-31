# Data Sync Strategy: Scheduled Snapshots + Hourly API

## The Challenge

```
Inbox Emails (Status Snapshots at Fixed Times):
├─ 08:00 → Morning snapshot
├─ 15:00 → Afternoon snapshot (3 PM)
├─ 19:00 → Evening snapshot (7 PM)
└─ 23:00 → Night snapshot (11 PM)

API Calls (On the Hour):
├─ 00:00 → Midnight
├─ 01:00 → 1 AM
├─ 02:00 → 2 AM
├─ ...
└─ 23:00 → 11 PM

Conflict: Email snapshots don't align with hourly API calls!
```

---

## Solution: Multi-Source Reconciliation Strategy

### Core Principle: **Store Everything, Reconcile Intelligently**

```
┌─────────────────────────────────────────────────────────────┐
│ DATA INGESTION LAYER                                        │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│ Email Snapshot (15:00)         API Call (15:00)            │
│ └─ Eitje Finance CSV           └─ Eitje REST API           │
│    (labor totals at 15:00)         (shifts from 14:00-15:00)
│         │                               │                  │
│         └───────────────┬───────────────┘                  │
│                         ▼                                   │
│              Reconciliation Service                         │
│              (Compare & Merge)                              │
│                         │                                   │
│         ┌───────────────┴───────────────┐                  │
│         │                               │                  │
│    Data Match?           Data Mismatch?                     │
│    └─ YES: Store both    └─ WARN: Flag variance             │
│         confidence=high       confidence=low                │
│                         │                                   │
│         ┌───────────────┴───────────────┐                  │
│         │                               │                  │
│    ✅ Store               ⚠️ Store + Flag                   │
│    source=email           source=email,api (merged)         │
│    source=api             variance_detected=true             │
│                           variance_reason="..."             │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## Architecture: 4-Layer Sync System

### Layer 1: Source Collectors

```typescript
// app/lib/services/sync/sourceCollectors.ts

export class SourceCollectors {
  
  // ─────────────────────────────────────────────────────────────
  // EMAIL SNAPSHOT COLLECTOR (4x daily: 08, 15, 19, 23)
  // ─────────────────────────────────────────────────────────────
  
  async collectEmailSnapshot(snapshotTime: '08:00' | '15:00' | '19:00' | '23:00') {
    /**
     * Called by cron at each snapshot time
     * Inbox has processed emails from that hour
     * Store the exact state at that timestamp
     */
    
    return {
      timestamp: new Date(),
      snapshotTime,
      type: 'email_snapshot',
      
      data: {
        eitjeFinance: await this.getLatestEitjeFinanceEmail(),
        // eitjeFinance has totals for the day UP TO this snapshot time
        
        borkBasisReport: await this.getLatestBorkBasisReportEmail(),
        // borkBasisReport has sales totals UP TO this snapshot time
      },
      
      // Tag as snapshot for reconciliation
      snapshot_metadata: {
        intended_time: snapshotTime,
        actual_received_time: new Date(),
        delay_minutes: 0,
        source: 'email',
      }
    };
  }
  
  // ─────────────────────────────────────────────────────────────
  // API CALL COLLECTOR (Every hour: 00, 01, 02, ..., 23)
  // ─────────────────────────────────────────────────────────────
  
  async collectAPISnapshot(hour: number) { // 0-23
    /**
     * Called hourly by cron
     * Fetches REAL-TIME data from API
     * Data is fresher but may not yet be in email
     */
    
    const timestamp = new Date();
    timestamp.setHours(hour, 0, 0, 0); // Set to :00
    
    return {
      timestamp,
      hour,
      type: 'api_snapshot',
      
      data: {
        eitjeHours: await this.eitjeApiClient.getHoursByDate(
          timestamp.toISOString().split('T')[0]
        ),
        // Fresh from Eitje API
        
        borkSales: await this.borkApiClient.getSalesByDate(
          timestamp.toISOString().split('T')[0]
        ),
        // Fresh from Bork API
      },
      
      snapshot_metadata: {
        intended_hour: hour,
        actual_fetch_time: new Date(),
        delay_minutes: 0,
        source: 'api',
        api_latency_ms: timestamp.getTime() - new Date().getTime(),
      }
    };
  }
}
```

### Layer 2: Snapshot Storage

```typescript
// Collections for storing raw snapshots

interface EmailSnapshot {
  _id: ObjectId
  timestamp: Date
  snapshotTime: '08:00' | '15:00' | '19:00' | '23:00'
  type: 'email_snapshot'
  
  // Raw email data
  eitjeFinanceCsv: {
    filename: string
    received_at: Date
    data: {
      location: string
      revenue: number
      labor_cost: number
      labor_cost_percentage: number
      hours: number
    }[]
  }
  
  borkBasisReportCsv: {
    filename: string
    received_at: Date
    data: Record<string, any>[]
  }
  
  // Metadata
  snapshot_metadata: {
    intended_time: string
    actual_received_time: Date
    delay_minutes: number
    source: 'email'
  }
}

interface APISnapshot {
  _id: ObjectId
  timestamp: Date
  hour: number // 0-23
  type: 'api_snapshot'
  
  // Raw API response
  eitjeHours: {
    total_records: number
    data: any[]
  }
  
  borkSales: {
    total_records: number
    data: any[]
  }
  
  // Metadata
  snapshot_metadata: {
    intended_hour: number
    actual_fetch_time: Date
    api_latency_ms: number
    source: 'api'
  }
}

// Collections
db.collection('snapshots_email')     // 4 per day
db.collection('snapshots_api')       // 24 per day
db.collection('snapshot_reconciliation')  // Comparison results
```

### Layer 3: Reconciliation Engine

```typescript
// app/lib/services/sync/snapshotReconciliationService.ts

export class SnapshotReconciliationService {
  
  /**
   * Reconcile Email snapshot with nearest API snapshots
   */
  async reconcileEmailSnapshot(emailSnapshot: EmailSnapshot) {
    // Find API snapshots near this email snapshot time
    // Email arrives at 15:00, so check API calls at 14:00 and 15:00
    
    const emailHour = parseInt(emailSnapshot.snapshotTime.split(':')[0]);
    
    const nearbyApiSnapshots = await db.collection('snapshots_api')
      .find({
        hour: { $in: [emailHour - 1, emailHour] },
        timestamp: {
          $gte: new Date(emailSnapshot.timestamp.getTime() - 3600000), // -1 hour
          $lte: new Date(emailSnapshot.timestamp.getTime() + 3600000), // +1 hour
        }
      })
      .sort({ timestamp: -1 })
      .limit(2)
      .toArray();
    
    if (!nearbyApiSnapshots.length) {
      // No nearby API snapshot yet, store as provisional
      return {
        email_snapshot_id: emailSnapshot._id,
        status: 'provisional',
        message: 'Email snapshot stored. Awaiting API snapshot for reconciliation.',
        reconciliation: null,
      };
    }
    
    // Compare email data with API data
    const reconciliation = {
      email_snapshot_id: emailSnapshot._id,
      api_snapshot_id: nearbyApiSnapshots[0]._id,
      timestamp: new Date(),
      
      // Labor comparison
      labor: this.compareLaborData(
        emailSnapshot.eitjeFinanceCsv.data,
        nearbyApiSnapshots[0].eitjeHours.data
      ),
      
      // Sales comparison
      sales: this.compareSalesData(
        emailSnapshot.borkBasisReportCsv.data,
        nearbyApiSnapshots[0].borkSales.data
      ),
      
      status: 'reconciled',
      matches: true, // Both match?
      variance: null,
    };
    
    // Flag if mismatches
    if (reconciliation.labor.variance > 0.01 || reconciliation.sales.variance > 0.01) {
      reconciliation.matches = false;
      reconciliation.variance = {
        labor_diff_percent: reconciliation.labor.variance,
        sales_diff_percent: reconciliation.sales.variance,
        reason: 'Email and API data differ. Check for timing issues.',
      };
    }
    
    // Store reconciliation result
    await db.collection('snapshot_reconciliation').insertOne(reconciliation);
    
    return reconciliation;
  }
  
  /**
   * Compare labor totals from email vs API
   */
  private compareLaborData(emailData: any[], apiData: any[]) {
    const emailTotal = emailData.reduce((sum, r) => sum + r.labor_cost, 0);
    const apiTotal = apiData.reduce((sum, r) => sum + (r.labor_cost || 0), 0);
    
    const variance = Math.abs(emailTotal - apiTotal) / emailTotal;
    
    return {
      email_total: emailTotal,
      api_total: apiTotal,
      difference: emailTotal - apiTotal,
      variance: variance,
      matches: variance < 0.01, // 1% tolerance
    };
  }
  
  /**
   * Compare sales totals from email vs API
   */
  private compareSalesData(emailData: any[], apiData: any[]) {
    const emailTotal = emailData.reduce((sum, r) => sum + r.revenue, 0);
    const apiTotal = apiData.reduce((sum, r) => sum + (r.revenue || 0), 0);
    
    const variance = Math.abs(emailTotal - apiTotal) / emailTotal;
    
    return {
      email_total: emailTotal,
      api_total: apiTotal,
      difference: emailTotal - apiTotal,
      variance: variance,
      matches: variance < 0.01,
    };
  }
}
```

### Layer 4: Unified Data Merge

```typescript
// app/lib/services/sync/snapshotMergeService.ts

export class SnapshotMergeService {
  
  /**
   * Merge email + API data into unified collection
   * Use email as source of truth, supplement with API
   */
  async mergeSnapshots(reconciliation: any) {
    
    if (!reconciliation.matches) {
      // Data mismatch - log warning but continue
      console.warn('⚠️ Variance detected:', reconciliation.variance);
      
      await db.collection('data_quality_alerts').insertOne({
        timestamp: new Date(),
        type: 'snapshot_variance',
        email_snapshot_id: reconciliation.email_snapshot_id,
        api_snapshot_id: reconciliation.api_snapshot_id,
        variance: reconciliation.variance,
        severity: reconciliation.variance.labor_diff_percent > 0.05 ? 'high' : 'low',
        recommendation: 'Manual review recommended',
      });
    }
    
    // Store merged data
    const mergedData = {
      _id: new ObjectId(),
      
      timestamp: reconciliation.timestamp,
      
      // Which sources contributed
      sources: {
        email: reconciliation.email_snapshot_id,
        api: reconciliation.api_snapshot_id,
      },
      
      // Use email as primary (most reliable)
      labor: {
        total_cost: reconciliation.labor.email_total,
        hours: reconciliation.labor.email_hours,
        source: 'email',
        
        // Add API data for comparison
        api_comparison: {
          total_cost: reconciliation.labor.api_total,
          hours: reconciliation.labor.api_hours,
          variance: reconciliation.labor.variance,
          matches: reconciliation.labor.matches,
        }
      },
      
      sales: {
        total_revenue: reconciliation.sales.email_total,
        source: 'email',
        
        api_comparison: {
          total_revenue: reconciliation.sales.api_total,
          variance: reconciliation.sales.variance,
          matches: reconciliation.sales.matches,
        }
      },
      
      // Mark confidence level
      confidence: reconciliation.matches ? 'high' : 'low',
      reconciliation_status: reconciliation.status,
      variance_detected: !reconciliation.matches,
    };
    
    // Store in final collection
    await db.collection('v2_daily_snapshot_merged').insertOne(mergedData);
    
    return mergedData;
  }
}
```

---

## Sync Schedule: Real Example

### Day Scenario

```
TIME    EVENT                          DATA STORED
─────   ─────────────────────────────  ──────────────────────────
08:00   Email Snapshot #1              snapshots_email
        (eitje-financien.csv)          {"snapshotTime": "08:00", ...}
        
09:00   API Call #1                    snapshots_api
        (Eitje /shifts for today)       {"hour": 9, ...}
        
10:00   API Call #2                    snapshots_api
        
11:00   API Call #3                    snapshots_api
        
12:00   API Call #4                    snapshots_api
        
13:00   API Call #5                    snapshots_api
        
14:00   API Call #6                    snapshots_api
        
15:00   Email Snapshot #2              snapshots_email
        (eitje-financien.csv)          {"snapshotTime": "15:00", ...}
        
        ⏱️  RECONCILIATION TRIGGER
        Compare email@15:00 with API@14:00 & API@15:00
        └─ Result stored in snapshot_reconciliation
        └─ Merged data stored in v2_daily_snapshot_merged
        
16:00   API Call #7                    snapshots_api
        
17:00   API Call #8                    snapshots_api
        
18:00   API Call #9                    snapshots_api
        
19:00   Email Snapshot #3              snapshots_email
        (eitje-financien.csv)          {"snapshotTime": "19:00", ...}
        
        ⏱️  RECONCILIATION TRIGGER (vs API@18:00 & API@19:00)
        
20:00   API Call #10                   snapshots_api
        
21:00   API Call #11                   snapshots_api
        
22:00   API Call #12                   snapshots_api
        
23:00   Email Snapshot #4              snapshots_email
        (eitje-financien.csv)          {"snapshotTime": "23:00", ...}
        
        ⏱️  RECONCILIATION TRIGGER (vs API@22:00 & API@23:00)
        
24:00   Daily Aggregation Cron         v2_daily_ops_dashboard_aggregated
        Runs at 11:00 PM
        Uses v2_daily_snapshot_merged (contains all sources)
```

---

## Implementation: Cron Jobs

```typescript
// app/api/cron/sync/email-snapshot/route.ts

export async function POST(req: Request) {
  const snapshotTime = new Date();
  const hour = snapshotTime.getHours();
  
  // Email snapshots only at: 08, 15, 19, 23
  const validSnapshots = [8, 15, 19, 23];
  if (!validSnapshots.includes(hour)) {
    return Response.json({ 
      success: false, 
      message: `Email snapshot not scheduled for ${hour}:00` 
    });
  }
  
  try {
    const collector = new SourceCollectors();
    const timeStr = `${String(hour).padStart(2, '0')}:00`;
    
    // Collect email snapshot
    const snapshot = await collector.collectEmailSnapshot(
      timeStr as any
    );
    
    // Store raw snapshot
    await db.collection('snapshots_email').insertOne(snapshot);
    
    // Reconcile with nearby API snapshots
    const reconciliation = await new SnapshotReconciliationService()
      .reconcileEmailSnapshot(snapshot);
    
    // Merge if reconciled
    if (reconciliation.reconciliation) {
      await new SnapshotMergeService()
        .mergeSnapshots(reconciliation.reconciliation);
    }
    
    return Response.json({
      success: true,
      snapshotTime: timeStr,
      snapshot_id: snapshot._id,
      reconciliation: reconciliation.status,
    });
  } catch (error) {
    console.error('[email-snapshot]', error);
    return Response.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}

// Cron config in vercel.json or package.json
{
  "crons": [
    {
      "path": "/api/cron/sync/email-snapshot",
      "schedule": "0 8 * * *"  // 08:00 daily
    },
    {
      "path": "/api/cron/sync/email-snapshot",
      "schedule": "0 15 * * *"  // 15:00 daily
    },
    {
      "path": "/api/cron/sync/email-snapshot",
      "schedule": "0 19 * * *"  // 19:00 daily
    },
    {
      "path": "/api/cron/sync/email-snapshot",
      "schedule": "0 23 * * *"  // 23:00 daily
    }
  ]
}
```

```typescript
// app/api/cron/sync/api-snapshot/route.ts

export async function POST(req: Request) {
  const now = new Date();
  const hour = now.getHours();
  
  try {
    const collector = new SourceCollectors();
    
    // Collect API snapshot for current hour
    const snapshot = await collector.collectAPISnapshot(hour);
    
    // Store raw snapshot
    await db.collection('snapshots_api').insertOne(snapshot);
    
    // Check if we should trigger reconciliation
    // (email snapshots at 8, 15, 19, 23)
    const emailSnapshotHours = [8, 15, 19, 23];
    
    if (emailSnapshotHours.includes(hour)) {
      // Email snapshot coming this hour, get it and reconcile
      const emailSnapshot = await db.collection('snapshots_email')
        .findOne({
          snapshotTime: `${String(hour).padStart(2, '0')}:00`,
          timestamp: {
            $gte: new Date(now.getTime() - 3600000), // Last hour
            $lte: now,
          }
        });
      
      if (emailSnapshot) {
        const reconciliation = await new SnapshotReconciliationService()
          .reconcileEmailSnapshot(emailSnapshot);
        
        if (reconciliation.reconciliation) {
          await new SnapshotMergeService()
            .mergeSnapshots(reconciliation.reconciliation);
        }
      }
    }
    
    return Response.json({
      success: true,
      hour,
      snapshot_id: snapshot._id,
    });
  } catch (error) {
    console.error('[api-snapshot]', error);
    return Response.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}

// Cron config - runs every hour
{
  "crons": [
    {
      "path": "/api/cron/sync/api-snapshot",
      "schedule": "0 * * * *"  // Every hour at :00
    }
  ]
}
```

---

## Data Quality Monitoring

```typescript
// app/lib/services/sync/dataQualityMonitor.ts

export class DataQualityMonitor {
  
  /**
   * Check snapshot health for today
   */
  async getDailyHealth(date: string) {
    const startOfDay = new Date(date);
    const endOfDay = new Date(date);
    endOfDay.setDate(endOfDay.getDate() + 1);
    
    // Get all snapshots for today
    const emailSnapshots = await db.collection('snapshots_email')
      .find({
        timestamp: { $gte: startOfDay, $lt: endOfDay }
      })
      .toArray();
    
    const apiSnapshots = await db.collection('snapshots_api')
      .find({
        timestamp: { $gte: startOfDay, $lt: endOfDay }
      })
      .toArray();
    
    const reconciliations = await db.collection('snapshot_reconciliation')
      .find({
        timestamp: { $gte: startOfDay, $lt: endOfDay }
      })
      .toArray();
    
    // Check for alerts
    const alerts = await db.collection('data_quality_alerts')
      .find({
        timestamp: { $gte: startOfDay, $lt: endOfDay }
      })
      .toArray();
    
    return {
      date,
      summary: {
        email_snapshots: emailSnapshots.length,
        api_snapshots: apiSnapshots.length,
        reconciliations: reconciliations.length,
        
        // Expected values
        expected_email: 4,  // 08, 15, 19, 23
        expected_api: 24,   // 00-23
        
        email_complete: emailSnapshots.length === 4,
        api_complete: apiSnapshots.length === 24,
      },
      
      reconciliation_status: {
        total: reconciliations.length,
        matches: reconciliations.filter(r => r.matches).length,
        variance_detected: reconciliations.filter(r => !r.matches).length,
      },
      
      alerts: alerts.length,
      alert_details: alerts.map(a => ({
        type: a.type,
        severity: a.severity,
        variance: a.variance,
      })),
      
      health: this.calculateHealth(reconciliations, alerts),
    };
  }
  
  private calculateHealth(reconciliations: any[], alerts: any[]) {
    if (reconciliations.length === 0) return 'unknown';
    
    const matchPercentage = 
      (reconciliations.filter(r => r.matches).length / reconciliations.length) * 100;
    
    const highSeverityAlerts = alerts.filter(a => a.severity === 'high').length;
    
    if (matchPercentage === 100 && highSeverityAlerts === 0) return 'green';
    if (matchPercentage >= 95 && highSeverityAlerts === 0) return 'yellow';
    return 'red';
  }
}
```

---

## Dashboard: Sync Status

```typescript
// app/daily-ops/sync-status/page.tsx

export default async function SyncStatusPage() {
  const monitor = new DataQualityMonitor();
  const health = await monitor.getDailyHealth(new Date().toISOString().split('T')[0]);
  
  return (
    <div className="p-6 space-y-6">
      <h1>Daily Data Sync Status</h1>
      
      {/* Summary */}
      <div className="grid grid-cols-4 gap-4">
        <Card>
          <h3>Email Snapshots</h3>
          <p className="text-2xl">{health.summary.email_snapshots}/4</p>
          <p className={health.summary.email_complete ? 'text-green-500' : 'text-yellow-500'}>
            {health.summary.email_complete ? '✅ Complete' : '⏳ Waiting'}
          </p>
        </Card>
        
        <Card>
          <h3>API Snapshots</h3>
          <p className="text-2xl">{health.summary.api_snapshots}/24</p>
          <p className={health.summary.api_complete ? 'text-green-500' : 'text-yellow-500'}>
            {health.summary.api_complete ? '✅ Complete' : '⏳ In Progress'}
          </p>
        </Card>
        
        <Card>
          <h3>Reconciliation</h3>
          <p className="text-2xl">{health.reconciliation_status.matches}/{health.reconciliation_status.total}</p>
          <p className={health.reconciliation_status.variance_detected === 0 ? 'text-green-500' : 'text-orange-500'}>
            {health.reconciliation_status.variance_detected > 0 
              ? `⚠️ ${health.reconciliation_status.variance_detected} variances` 
              : '✅ All match'}
          </p>
        </Card>
        
        <Card>
          <h3>Overall Health</h3>
          <p className="text-2xl">
            {health.health === 'green' ? '🟢' : health.health === 'yellow' ? '🟡' : '🔴'}
          </p>
          <p className="capitalize">{health.health}</p>
        </Card>
      </div>
      
      {/* Alerts */}
      {health.alerts > 0 && (
        <AlertBox alerts={health.alert_details} />
      )}
      
      {/* Timeline */}
      <SyncTimeline />
    </div>
  );
}
```

---

## Mitigation Summary

| Issue | Mitigation |
|-------|-----------|
| **Email at 15:00, API ongoing hourly** | Store both separately, reconcile when both available |
| **Data arrives at different times** | Use timestamps, allow time windows (±1 hour) for matching |
| **Email shows totals, API shows details** | Email = source of truth, API = supplementary verification |
| **Timing mismatches** | Flag as "provisional" until reconciled |
| **Missing data** | Store alerts, retry on next sync |
| **Variance detected** | Store both, mark confidence level, alert admin |
| **Query needs both** | Merge into `v2_daily_snapshot_merged` once reconciled |

---

## Key Implementation Rules

✅ **Store everything** - Raw emails, raw API, reconciliation results  
✅ **Email is truth** - Use email totals as primary source  
✅ **API is verification** - Use API to verify email data  
✅ **Reconcile automatically** - Compare within ±1 hour window  
✅ **Flag variance** - Alert if email ≠ API (within tolerance)  
✅ **Preserve history** - Keep all snapshots for audit trail  
✅ **Dashboard shows health** - Users see sync status in real-time  
✅ **Aggregation waits for merge** - Only use merged data for final dashboard
