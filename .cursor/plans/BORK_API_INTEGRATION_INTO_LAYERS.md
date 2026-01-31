# Bork API Integration into 3-Layer Architecture

## Current Bork API Setup (Already Implemented)

```typescript
// What you already have:
API Endpoint: GET {baseUrl}/ticket/day.json/{YYYYMMDD}?appid={apiKey}

Response: Array of Tickets
[
  {
    "ActualDate": "20260129",
    "Key": "0001",
    "TicketNumber": 1,
    "Date": "2026-01-29",
    "PaymentMethod": "Cash",
    "CenterKey": "Amsterdam",
    "CenterName": "Bar Bea",
    "CenterNr": "001",
    "Orders": [
      {
        "OrderNumber": 1,
        "OrderLines": [
          {
            "ProductName": "Burger",
            "ProductKey": "BUR-001",
            "Quantity": 2,
            "Price": 26.50,
            "TotalInc": 53.00,
            "TotalEx": 47.32,
            "Vat": 5.68
          }
        ]
      }
    ],
    "TotalPrice": 53.00
  },
  // ... more tickets
]

Master Data Endpoints:
├─ GET /catalog/productgrouplist.json       (Products)
├─ GET /catalog/paymodegrouplist.json       (Payment methods)
├─ GET /centers.json                        (Cost centers / Locations)
└─ GET /users.json                          (Users / Staff)

Storage:
└─ bork_raw_data collection (raw Bork API tickets)
```

---

## How Bork Fits Into Your 3-Layer Architecture

### The Current State (Working)

```
Bork API (24x per day - on the hour)
    ↓
v2-cron-manager
    ├─ daily-data:     Sync yesterday's sales (daily)
    ├─ master-data:    Sync product/payment/center/user (configurable)
    └─ historical-data: Backfill date range (daily or on-demand)
    ↓
fetchBorkDataForDateRange() (with batching & rate limiting)
    ├─ Day-by-day requests (100ms delay between days)
    ├─ Batch chunks (31 days per batch, 200ms between batches)
    └─ Extract essential fields (optimize storage)
    ↓
optimizeBorkTickets() (sanitize $ fields, extract essentials)
    ↓
bork_raw_data collection (one doc per ticket)
```

---

## Integration: How to Add Bork to Your Architecture

### Current 3-Layer Architecture

```
Layer 1: Raw Data Collections
├─ test-eitje-hours (from CSV + Eitje API)
├─ test-eitje-contracts (from CSV + Eitje API)
├─ test-eitje-finance-summary (from CSV only - verification)
├─ test-bork-sales (from CSV)
├─ test-bork-basis-rapport (from CSV)
└─ bork_raw_data ← ✅ Already here! (from Bork API)

Layer 2: Enrichment + Validation
├─ eitje_snapshots_email (4x daily)
├─ eitje_snapshots_api (24x hourly)
└─ snapshot_reconciliation (compare email vs API)

Layer 3: Aggregated Daily Documents
└─ v2_daily_ops_dashboard_aggregated
```

### Updated: Bork Already Fits!

```
Bork API (Running on cron)
    ↓
Normalize to Unified Format
    ↓
Store in Same Collections
    ├─ test-bork-sales       (from CSV)
    └─ bork_raw_data         (from Bork API) ← Same data, different sources!
```

---

## Solution: Unified Bork Storage Strategy

### Current Problem

```
CSV Data:
└─ test-bork-sales        (one doc per row)

API Data:
└─ bork_raw_data          (one doc per ticket)

Issue: Different collections, different sync patterns
```

### Solution: Merge Into Same Collection + Layer

```typescript
// New unified strategy for Bork

interface UnifiedBorkSalesRecord {
  _id: ObjectId
  
  // Identity
  date: Date                    // '2026-01-29'
  location_id: ObjectId        // Link to Location
  transaction_id?: string      // Bork TicketKey or similar
  
  // Denormalized for speed
  location_name: string        // 'Bar Bea'
  center_key: string           // Bork center code
  
  // Sales data
  product_name: string         // 'Burger'
  product_code: string         // 'BUR-001'
  quantity: number             // 2
  price_per_unit: number       // 26.50
  total_revenue: number        // 53.00 (inc VAT)
  total_ex_vat: number         // 47.32
  vat_amount: number           // 5.68
  cogs?: number                // From ProductMaster
  
  // Source tracking
  source: 'bork-csv' | 'bork-api'
  external_id?: string         // Bork ticket ID
  support_id?: string          // CSV support ID
  
  // Raw data preservation
  raw_csv?: Record<string, any>
  raw_api?: Record<string, any>
  
  // Metadata
  imported_at: Date
}
```

---

## Implementation: 4 Steps

### Step 1: Normalize CSV → Unified Format (Already done for Eitje!)

```typescript
// app/lib/services/data-sources/borkCSVImportService.ts

export class BorkCSVImportService {
  async importBorkCSVRow(csvRow: any, location_id: ObjectId) {
    // Parse from CSV
    const normalized = {
      date: new Date(csvRow.datum),
      location_id,
      location_name: csvRow.vestiging,
      product_name: csvRow.product,
      product_code: csvRow.productCode,
      quantity: parseFloat(csvRow.quantity),
      price_per_unit: parseFloat(csvRow.pricePerUnit),
      total_revenue: parseFloat(csvRow.totalRevenue),
      
      source: 'bork-csv' as const,
      support_id: csvRow.supportId,
      raw_csv: csvRow,
      
      imported_at: new Date(),
    };
    
    await db.collection('test-bork-sales-unified').insertOne(normalized);
    return normalized;
  }
}
```

### Step 2: Normalize API → Same Unified Format

```typescript
// app/lib/services/data-sources/borkAPIImportService.ts

export class BorkAPIImportService {
  async importBorkAPITicket(
    ticket: any,
    locationId: ObjectId,
    locationName: string
  ) {
    // Bork API returns tickets with multiple OrderLines
    // Flatten: one unified record per line item
    
    const records = [];
    
    if (ticket.Orders && Array.isArray(ticket.Orders)) {
      for (const order of ticket.Orders) {
        if (order.OrderLines && Array.isArray(order.OrderLines)) {
          for (const line of order.OrderLines) {
            const normalized = {
              date: new Date(ticket.ActualDate || ticket.Date),
              location_id: locationId,
              location_name: locationName,
              transaction_id: ticket.Key,
              
              product_name: line.ProductName,
              product_code: line.ProductKey,
              quantity: line.Quantity,
              price_per_unit: line.Price,
              total_revenue: line.TotalInc,
              total_ex_vat: line.TotalEx,
              vat_amount: line.Vat,
              
              source: 'bork-api' as const,
              external_id: ticket.Key, // Bork ticket key
              raw_api: { ticket, order, line }, // Preserve full context
              
              imported_at: new Date(),
            };
            
            records.push(normalized);
          }
        }
      }
    }
    
    if (records.length > 0) {
      await db.collection('test-bork-sales-unified').insertMany(records);
    }
    
    return records;
  }
}
```

### Step 3: Reconcile CSV vs API (Like Eitje!)

```typescript
// app/lib/services/sync/borkSnapshotReconciliationService.ts

export class BorkSnapshotReconciliationService {
  
  async reconcileBorkData(date: string, location_id: ObjectId) {
    // Get CSV totals (if exists)
    const csvData = await db.collection('test-bork-sales-unified')
      .find({ date: new Date(date), location_id, source: 'bork-csv' })
      .toArray();
    
    const csvTotal = csvData.reduce((sum, r) => sum + r.total_revenue, 0);
    
    // Get API totals (if exists)
    const apiData = await db.collection('test-bork-sales-unified')
      .find({ date: new Date(date), location_id, source: 'bork-api' })
      .toArray();
    
    const apiTotal = apiData.reduce((sum, r) => sum + r.total_revenue, 0);
    
    // Compare
    const variance = Math.abs(csvTotal - apiTotal) / Math.max(csvTotal, apiTotal);
    
    const reconciliation = {
      date,
      location_id,
      csv: {
        records: csvData.length,
        revenue_total: csvTotal,
      },
      api: {
        records: apiData.length,
        revenue_total: apiTotal,
      },
      validation: {
        matches: variance < 0.01,
        variance: variance,
        status: variance < 0.01 ? 'PASS' : 'FAIL',
      },
    };
    
    // Store reconciliation
    await db.collection('bork_reconciliation').insertOne(reconciliation);
    
    return reconciliation;
  }
}
```

### Step 4: Merge Into Final Aggregation

```typescript
// The existing dailyOpsAggregationService already works!
// Just need to query test-bork-sales-unified instead

export class DailyOpsAggregationService {
  async buildDailyAggregation(date: string, location_id: string) {
    // Fetch Bork sales (now includes CSV + API, same format!)
    const borkSales = await db.collection('test-bork-sales-unified')
      .find({
        date: new Date(date),
        location_id: new ObjectId(location_id),
      })
      .toArray();
    
    // Continue with existing logic
    const revenue = this.calculateRevenue(borkSales);
    // ...
  }
}
```

---

## Full Data Flow: Bork API + CSV + Eitje

```
┌─────────────────────────────────────────────────────────────┐
│ DATA SOURCES                                                │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│ Email Snapshots (08:00, 15:00, 19:00, 23:00)             │
│ └─ eitje-financien.csv → test-eitje-finance-summary       │
│ └─ bork-basis.csv → test-bork-basis-rapport               │
│                                                             │
│ Bork API (Every hour: 00-23)                              │
│ └─ /ticket/day.json/{YYYYMMDD}                            │
│    → borkAPIImportService                                  │
│    → test-bork-sales-unified                              │
│                                                             │
│ Eitje API (Every hour: 00-23)                             │
│ └─ /time_registration_shifts                              │
│    → eitjeAPIImportService                                 │
│    → test-eitje-hours                                      │
│                                                             │
└─────────────────────────────┬───────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│ LAYER 1: UNIFIED RAW COLLECTIONS                            │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│ test-eitje-hours                                           │
│ ├─ source: eitje-csv | eitje-api                           │
│ ├─ member_id, location_id, team_id                         │
│ └─ hours, labor_cost, hourly_rate                          │
│                                                             │
│ test-bork-sales-unified ← ✅ NEW!                          │
│ ├─ source: bork-csv | bork-api                             │
│ ├─ location_id, product_code                               │
│ ├─ quantity, total_revenue, cogs                           │
│ ├─ raw_csv | raw_api (preserved)                           │
│ └─ date, transaction_id, external_id                       │
│                                                             │
│ test-bork-basis-rapport (from email CSV)                   │
│ ├─ Product breakdown with margins                          │
│ └─ For verification only                                   │
│                                                             │
└─────────────────────────────┬───────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│ LAYER 2: VALIDATION & RECONCILIATION                        │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│ Eitje Reconciliation                                       │
│ ├─ Compare email snapshot (15:00) vs API (14:00, 15:00)   │
│ └─ Store in snapshot_reconciliation                        │
│                                                             │
│ Bork Reconciliation ← ✅ NEW!                              │
│ ├─ Compare email CSV vs API data (same date)              │
│ ├─ Check variance in revenue totals                        │
│ └─ Store in bork_reconciliation                            │
│                                                             │
│ Validation Status:                                         │
│ ├─ eitje: PASS/FAIL                                        │
│ ├─ bork: PASS/FAIL                                         │
│ └─ Stored in data_quality_alerts                           │
│                                                             │
└─────────────────────────────┬───────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│ LAYER 3: AGGREGATED DAILY DOCUMENTS                         │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│ v2_daily_ops_dashboard_aggregated                          │
│ {                                                          │
│   date: "2026-01-29",                                      │
│   location_id: ObjectId,                                   │
│   location: { name, address, ... },                        │
│                                                             │
│   revenue: {                                               │
│     total: 5000,                                           │
│     byProduct: [                                           │
│       {                                                    │
│         productName: "Burger",                             │
│         quantity: 45,                                      │
│         revenue: 1200,                                     │
│         source: "bork-api",  ← ✅ Tracking source         │
│         cogs: 450,                                         │
│         margin: 0.625                                      │
│       }                                                    │
│     ],                                                     │
│     sources: {                                             │
│       bork: {                                              │
│         csv_records: 50,                                   │
│         api_records: 120,                                  │
│         csv_verified: true,                                │
│         api_verified: true,                                │
│         variance: 0.02                                     │
│       }                                                    │
│     }                                                      │
│   },                                                       │
│                                                             │
│   labor: { ... },  ← From Eitje                            │
│   products: { ... },                                       │
│   kpis: { ... },                                           │
│   sources: { eitje, bork, ... }                            │
│ }                                                          │
│                                                             │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│ DAILY OPS DASHBOARD                                         │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│ - Revenue by product (with source tracking)                │
│ - Labor metrics                                            │
│ - Product profitability                                    │
│ - Data quality status                                      │
│ - Sync health (CSV vs API matches)                         │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## Sync Schedule With Bork API

```
TIME    EMAIL SNAPSHOT    API CALLS           RECONCILIATION
─────   ──────────────    ──────────────────  ──────────────────────
08:00   ✅ Eitje Email    
        + Bork CSV                            → Compare with API @08:00
        
08:00                     🔄 Bork API
                          🔄 Eitje API
                          
09:00                     🔄 Bork API
                          🔄 Eitje API
        
10:00                     🔄 Bork API
                          🔄 Eitje API
        
...
        
15:00   ✅ Eitje Email                       → Compare with API @14:00 & @15:00
        + Bork CSV         🔄 Bork API
                          🔄 Eitje API
        
16:00                     🔄 Bork API
                          🔄 Eitje API
        
...
        
19:00   ✅ Eitje Email                       → Compare with API @18:00 & @19:00
        + Bork CSV         🔄 Bork API
                          🔄 Eitje API
        
...
        
23:00   ✅ Eitje Email                       → Compare with API @22:00 & @23:00
        + Bork CSV         🔄 Bork API
                          🔄 Eitje API
        
23:10   Daily Aggregation Runs
        └─ Merges eitje + bork snapshots
           Produces v2_daily_ops_dashboard_aggregated
```

---

## Implementation Checklist

- [ ] **Create `test-bork-sales-unified` collection**
  - Same schema for CSV + API data
  - Index on: date, location_id, source

- [ ] **Create `BorkCSVImportService`**
  - Parse CSV rows → Unified format
  - Store in test-bork-sales-unified

- [ ] **Create `BorkAPIImportService`**
  - Parse API tickets (flatten OrderLines)
  - Store in test-bork-sales-unified
  - Update existing cron to use this

- [ ] **Create `BorkSnapshotReconciliationService`**
  - Compare CSV totals vs API totals
  - Flag variance
  - Store in bork_reconciliation

- [ ] **Update `DailyOpsAggregationService`**
  - Query test-bork-sales-unified instead
  - Include source tracking in output
  - Add bork reconciliation status to dashboard

- [ ] **Update Email Snapshot Collector**
  - Also collect Bork CSV basis report
  - Trigger reconciliation at 08:00, 15:00, 19:00, 23:00

- [ ] **Create Dashboard Health Status**
  - Show Bork CSV vs API sync health
  - Display variance if any
  - Show confidence level

---

## Key Benefit: Everything Converges

✅ **Eitje CSV + Eitje API** → Same test-eitje-hours collection  
✅ **Bork CSV + Bork API** → Same test-bork-sales-unified collection  
✅ **Both reconcile** → Compare CSV snapshots vs API hourly calls  
✅ **One aggregation** → Merges everything into final dashboard  
✅ **No duplicate logic** → Same transform, validate, reconcile pattern

---

## Collections Summary

```
Raw Data Layer:
├─ test-eitje-hours (Eitje CSV + API)
├─ test-eitje-contracts (Eitje CSV + API)
├─ test-eitje-finance-summary (Eitje CSV only - verification)
├─ test-bork-sales-unified (Bork CSV + API) ← ✅ NEW!
└─ test-bork-basis-rapport (Bork CSV only - verification)

Snapshot Collections:
├─ snapshots_email (4/day: Eitje finance + Bork basis)
├─ snapshots_api (24/day: Eitje + Bork API)
├─ snapshot_reconciliation (Eitje)
└─ bork_reconciliation (Bork) ← ✅ NEW!

Quality & Metadata:
├─ data_quality_alerts
└─ bork_cron_jobs (already exists)

Final:
└─ v2_daily_ops_dashboard_aggregated
```
