# Daily Ops Architecture: V2 Pattern Applied

## Overview

This applies the **proven V2 architecture** to daily-ops, leveraging:
- ✅ **Eitje API** (labor, hours, contracts, costs)
- ✅ **Bork API** (sales, products, revenue, basis reports)
- ✅ **CSV uploads** (fallback/manual data)
- ✅ **Multi-source aggregation** into single daily documents

---

## Architecture Layers

### Layer 1: Raw Data (Flat, One Document Per Row)
**Collections:**
```
test-eitje-hours          ← Eitje API: worker hours/day
test-eitje-contracts      ← Eitje API: contract rates
test-eitje-finance        ← Eitje CSV: financial data

test-bork-sales           ← Bork API: transaction/row
test-bork-product-mix     ← Bork API: product combinations
test-bork-food-beverage   ← Bork API: category breakdown
test-bork-basis-rapport   ← Bork API: revenue per product/category

unified-users             ← Master data: employee profiles (Eitje ID ↔ Bork ID)
unified-teams             ← Master data: team definitions
unified-locations         ← Master data: location/cost-center mappings
product-master            ← Master data: product codes ↔ names, COGS, margins
contract-master           ← Master data: contract types, rates
```

**Key:** No nesting. Fast lookups. Raw API response stored as-is in `sourceData` field.

---

### Layer 2: Enriched Raw Data (Add Missing Fields)
**Action:** During aggregation, join raw rows with master data

```typescript
// Example: Enrich Bork Basis Report row
{
  ...rawBasisRow,        // From test-bork-basis-rapport
  productName: await ProductMaster.findOne({ code: rawBasisRow.productCode }),
  productCategory: "food",
  costOfGoodsSold: 12.50,
  productMargin: 0.35,
  teamName: await UnifiedTeam.findOne({ borkTeamCode: rawBasisRow.teamCode }),
  locationName: await UnifiedLocation.findOne({ borkCostCenter: rawBasisRow.costCenter }),
}
```

---

### Layer 3: Aggregated Daily Documents (Ready for Dashboard)
**Collection:** `v2_daily_ops_dashboard_aggregated`

```typescript
interface DailyOpsDashboard {
  _id: ObjectId;
  date: "2026-01-29";
  location: "Amsterdam";
  
  // Revenue Aggregates
  revenue: {
    total: 5000,
    byProduct: [
      { product: "Burger", revenue: 1200, qty: 45, margin: 0.35 },
      { product: "Pizza", revenue: 2100, qty: 60, margin: 0.40 }
    ],
    byCategory: { food: 3500, beverage: 1500 },
    byTeam: { kitchen: 3500, service: 1500 },
    // Pre-calculated metrics
    mostSoldProduct: "Pizza",
    mostProfitableProduct: "Burger",
    avgTransactionValue: 50,
  };
  
  // Labor Aggregates (from Eitje API)
  labor: {
    totalHours: 40,
    totalCost: 800,
    costPercentage: (800/5000)*100, // 16%
    revenuePerHour: 125,
    byTeam: [
      { 
        teamName: "Kitchen",
        hours: 24,
        cost: 480,
        staff: 3,
        productivity: 145.83 // revenue/hours
      },
      { 
        teamName: "Service",
        hours: 16,
        cost: 320,
        staff: 2,
        productivity: 93.75
      }
    ],
    byEmployee: [
      { 
        name: "John",
        hours: 8,
        cost: 160,
        productivity: 625 // revenue/hours
      }
    ],
  };
  
  // Product Mix Analysis (from Bork Basis Report)
  products: {
    bestCombination: {
      items: ["Burger", "Beer"],
      frequency: 45,
      totalRevenue: 1800,
      profitMargin: 0.42,
    },
    byProductLine: [
      { name: "Burger", revenue: 1200, qty: 45, costOfGoodsSold: 562.50, margin: 0.53 },
      { name: "Pizza", revenue: 2100, qty: 60, costOfGoodsSold: 750, margin: 0.64 },
    ]
  };
  
  // KPIs (calculated from all sources)
  kpis: {
    laborCostPercentage: 16,
    foodCostPercentage: 28,
    profitPercentage: 56,
    revenuePerLabourHour: 125,
    transactionsPerHour: 3.5,
    avgTicketSize: 50,
  };
  
  // Source tracking (for audit)
  sources: {
    borkSales: { count: 120, lastSync: "2026-01-29T23:00:00Z" },
    borkBasisReport: { count: 30, lastSync: "2026-01-29T23:00:00Z" },
    eitjeHours: { count: 40, lastSync: "2026-01-29T23:00:00Z" },
    eitjeContracts: { count: 5, lastSync: "2026-01-29T08:00:00Z" },
  };
}
```

---

## Data Pipeline: Aggregation Flow

```
TIME: 11:00 PM (Daily Batch)

1. FETCH RAW DATA
   ├─ Eitje API: Get all hours for day
   ├─ Eitje API: Get all contracts (cached hourly)
   ├─ Bork API: Get all sales transactions
   ├─ Bork API: Get basis report (product breakdown)
   ├─ DB: Query test-eitje-* and test-bork-* collections
   └─ Result: 5 separate raw datasets

2. ENRICH WITH MASTER DATA
   ├─ Lookup ProductMaster for each product row
   ├─ Lookup UnifiedTeam for each team code
   ├─ Lookup UnifiedUser for employee IDs
   ├─ Add COGS, margins, contract rates
   └─ Result: All raw data now has full context

3. TRANSFORM TO AGGREGATES
   ├─ Group by date/location
   ├─ Sum revenue by product, category, team
   ├─ Calculate labor metrics (hours, cost %)
   ├─ Find product combinations
   ├─ Rank by profitability/sales volume
   ├─ Calculate all KPIs
   └─ Result: Single rich document per location

4. SAVE TO DASHBOARD COLLECTION
   └─ Insert into v2_daily_ops_dashboard_aggregated
   
5. CACHE & NOTIFY
   ├─ Clear Redis cache (if using)
   └─ Notify dashboard pages via WebSocket (real-time update)
```

---

## Service Layer Architecture

### 1. **Data Source Services** (Raw Data)
```typescript
// app/lib/services/data-sources/eitjeDataSourceService.ts
export class EitjeDataSourceService {
  async fetchHoursForDay(date: string) { /* Query test-eitje-hours */ }
  async fetchContractsForLocation(locationId: string) { /* Query test-eitje-contracts */ }
  async syncFromEitjeAPI(date: string) { /* Call Eitje API, store in test-eitje-* */ }
}

// app/lib/services/data-sources/borkDataSourceService.ts
export class BorkDataSourceService {
  async fetchSalesForDay(date: string) { /* Query test-bork-sales */ }
  async fetchBasisReportForDay(date: string) { /* Query test-bork-basis-rapport */ }
  async syncFromBorkAPI(date: string) { /* Call Bork API, store in test-bork-* */ }
}
```

### 2. **Master Data / Enrichment Service**
```typescript
// app/lib/services/enrichment/masterDataEnrichmentService.ts
export class MasterDataEnrichmentService {
  async enrichProductRow(row: any) { 
    return {
      ...row,
      productName: await ProductMaster.findOne({ code: row.productCode }),
      cogs: /* from master */,
      margin: /* calculated */,
    }
  }
  
  async enrichTeamRow(row: any) { 
    return {
      ...row,
      teamName: await UnifiedTeam.findOne({ borkCode: row.teamCode }),
      teamType: "kitchen" | "service",
    }
  }
  
  async enrichEmployeeRow(row: any) {
    return {
      ...row,
      employeeName: await UnifiedUser.findOne({ eitjeId: row.employeeId }),
      contractType: /* from master */,
      hourlyRate: /* from contract */,
    }
  }
}
```

### 3. **Aggregation Service** (Core Business Logic)
```typescript
// app/lib/services/aggregation/dailyOpsAggregationService.ts
export class DailyOpsAggregationService {
  async buildDailyAggregation(date: string, locationId: string) {
    // 1. Fetch all raw data
    const [eitjeHours, borkSales, borkBasisReport] = await Promise.all([
      this.eitjeService.fetchHoursForDay(date),
      this.borkService.fetchSalesForDay(date),
      this.borkService.fetchBasisReportForDay(date),
    ]);
    
    // 2. Enrich with master data
    const enrichedHours = await Promise.all(
      eitjeHours.map(h => this.enrichmentService.enrichEmployeeRow(h))
    );
    const enrichedSales = await Promise.all(
      borkSales.map(s => this.enrichmentService.enrichProductRow(s))
    );
    const enrichedBasis = await Promise.all(
      borkBasisReport.map(b => this.enrichmentService.enrichProductRow(b))
    );
    
    // 3. Calculate aggregates
    const revenue = this.calculateRevenue(enrichedSales, enrichedBasis);
    const labor = this.calculateLabor(enrichedHours);
    const products = this.analyzeProducts(enrichedBasis);
    const kpis = this.calculateKPIs(revenue, labor, products);
    
    // 4. Save to aggregated collection
    const doc = new DailyOpsDashboard({
      date,
      location: locationId,
      revenue,
      labor,
      products,
      kpis,
      sources: { /* metadata */ },
    });
    await doc.save();
    
    return doc;
  }
  
  private calculateRevenue(sales: any[], basis: any[]) {
    // Group sales by product, calculate totals, margins, etc.
  }
  
  private calculateLabor(hours: any[]) {
    // Group by team/employee, calculate costs, productivity, etc.
  }
  
  private analyzeProducts(basisReport: any[]) {
    // Find best combinations, rankings, etc.
  }
  
  private calculateKPIs(revenue: any, labor: any, products: any) {
    // Derive all dashboard metrics
  }
}
```

### 4. **Dashboard Data Service** (Query Layer)
```typescript
// app/lib/services/dashboard/dailyOpsDataService.ts
export class DailyOpsDataService {
  async getDailyDashboard(date: string, locationId: string) {
    return await DailyOpsDashboard.findOne({ date, location: locationId });
  }
  
  async getDashboardsByDateRange(startDate: string, endDate: string, locationId: string) {
    return await DailyOpsDashboard.find({
      date: { $gte: startDate, $lte: endDate },
      location: locationId
    }).sort({ date: -1 });
  }
  
  async getRevenueBreakdown(date: string, locationId: string) {
    const doc = await this.getDailyDashboard(date, locationId);
    return doc.revenue;
  }
  
  async getLaborMetrics(date: string, locationId: string) {
    const doc = await this.getDailyDashboard(date, locationId);
    return doc.labor;
  }
  
  async getProductAnalysis(date: string, locationId: string) {
    const doc = await this.getDailyDashboard(date, locationId);
    return doc.products;
  }
}
```

---

## Server Actions / API Routes

```typescript
// app/actions/daily-ops.ts
'use server'

import { dailyOpsDataService } from '@/lib/services/dashboard/dailyOpsDataService';

export async function getDailyDashboard(date: string, locationId: string) {
  try {
    const dashboard = await dailyOpsDataService.getDailyDashboard(date, locationId);
    if (!dashboard) {
      return { error: 'No data for this date/location' };
    }
    return { data: dashboard };
  } catch (error) {
    return { error: error.message };
  }
}

export async function getRevenueBreakdown(date: string, locationId: string) {
  return (await getDailyDashboard(date, locationId)).data?.revenue;
}

export async function getLaborMetrics(date: string, locationId: string) {
  return (await getDailyDashboard(date, locationId)).data?.labor;
}
```

---

## Components: Usage Pattern

```typescript
// app/daily-ops/page.tsx
'use client'

import { useQuery } from '@tanstack/react-query';
import { getDailyDashboard, getRevenueBreakdown } from '@/actions/daily-ops';
import { RevenueCard } from '@/components/dashboard/RevenueCard';
import { LaborMetricsCard } from '@/components/dashboard/LaborMetricsCard';

export default function DailyOpsPage() {
  const { data, isLoading } = useQuery({
    queryKey: ['dailyDashboard', '2026-01-29', 'amsterdam'],
    queryFn: () => getDailyDashboard('2026-01-29', 'amsterdam'),
  });

  if (isLoading) return <div>Loading...</div>;
  
  return (
    <div className="grid grid-cols-3 gap-4">
      <RevenueCard revenue={data?.data.revenue} />
      <LaborMetricsCard labor={data?.data.labor} />
      <ProductAnalysisCard products={data?.data.products} />
      <KPIGrid kpis={data?.data.kpis} />
    </div>
  );
}
```

---

## Cron Job: Daily Aggregation

```typescript
// app/api/cron/daily-aggregation/route.ts
import { dailyOpsAggregationService } from '@/lib/services/aggregation/dailyOpsAggregationService';

export async function POST(req: Request) {
  try {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const dateStr = yesterday.toISOString().split('T')[0];

    // Get all locations
    const locations = await UnifiedLocation.find({ isActive: true });

    // Build aggregation for each location
    const results = await Promise.all(
      locations.map(loc => 
        dailyOpsAggregationService.buildDailyAggregation(dateStr, loc._id.toString())
      )
    );

    return Response.json({
      success: true,
      aggregations: results.length,
      date: dateStr,
    });
  } catch (error) {
    console.error('Daily aggregation failed:', error);
    return Response.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
```

---

## File Structure

```
app/
├── actions/
│   └── daily-ops.ts                    ← Server actions for dashboard
├── api/
│   ├── cron/
│   │   └── daily-aggregation/route.ts  ← Runs 11 PM daily
│   └── data/
│       └── dashboard/route.ts           ← Alternative API endpoint
└── daily-ops/
    ├── page.tsx                         ← Main dashboard
    ├── revenue/page.tsx
    ├── labor/page.tsx
    └── products/page.tsx

lib/
└── services/
    ├── data-sources/
    │   ├── eitjeDataSourceService.ts    ← Raw Eitje data
    │   └── borkDataSourceService.ts     ← Raw Bork data
    ├── enrichment/
    │   └── masterDataEnrichmentService.ts ← Join with master data
    ├── aggregation/
    │   └── dailyOpsAggregationService.ts  ← Core business logic
    └── dashboard/
        └── dailyOpsDataService.ts       ← Query layer for dashboard

models/
├── DailyOpsDashboard.ts
├── ProductMaster.ts
├── ContractMaster.ts
└── UnifiedLocation.ts
```

---

## Data Flow: End-to-End Example

**Scenario:** User opens Daily Ops page for "2026-01-29, Amsterdam"

```
1. Component mounts
   └─ useQuery({ queryKey: ['dailyDashboard', '2026-01-29', 'amsterdam'] })

2. React Query calls queryFn
   └─ getDailyDashboard('2026-01-29', 'amsterdam')

3. Server action executes
   └─ dailyOpsDataService.getDailyDashboard()

4. Query MongoDB: v2_daily_ops_dashboard_aggregated
   └─ db.collection('v2_daily_ops_dashboard_aggregated').findOne({
        date: '2026-01-29',
        location: 'amsterdam'
      })

5. Return document (with all revenue, labor, products, kpis)
   └─ { revenue: {...}, labor: {...}, products: {...}, kpis: {...} }

6. React Query caches result
   └─ component re-renders with data

7. Display:
   ├─ Revenue card: "Total: €5,000 | By Product: Pizza €2,100, Burger €1,200"
   ├─ Labor card: "Total: €800 (16%) | Per hour: €20 | Kitchen: €480, Service: €320"
   ├─ Products card: "Best combo: Burger + Beer (45x) | Most sold: Pizza (60x)"
   └─ KPIs: "Food cost: 28% | Profit: 56% | Rev/hour: €125"

✅ DONE - 1 query, 1 network round-trip, instant dashboard
```

---

## API Data Integration

### Eitje API Sync
- **Schedule:** Hourly (or on-demand)
- **Action:** Fetch hours/contracts from Eitje API → Store in test-eitje-*
- **Columns extracted:** Employee ID, hours, cost, team, date
- **Enrichment:** Add UnifiedUser mapping, contract type

### Bork API Sync
- **Schedule:** Hourly (or on-demand)
- **Action:** Fetch transactions from Bork API → Store in test-bork-sales
- **Columns extracted:** Product, quantity, revenue, team, date
- **Enrichment:** Add ProductMaster info, COGS, margin

### Daily Aggregation
- **Schedule:** 11:00 PM (or next morning)
- **Action:** Combine all raw data → Calculate → Save to v2_daily_ops_dashboard_aggregated
- **Result:** Ready-to-use dashboard document

---

## Key Advantages

✅ **Simple:** 3 layers, not 7  
✅ **Fast:** One query per dashboard load  
✅ **Maintainable:** Business logic isolated in service layer  
✅ **Scalable:** Easy to add new data sources or metrics  
✅ **Audit-friendly:** Source tracking in each document  
✅ **Real-time capable:** API can be queried on-demand if needed  
✅ **Multi-source:** Easily combines Eitje, Bork, CSV, etc.

---

## Next Steps

1. **Build Master Data:** ProductMaster, ContractMaster, UnifiedUser, UnifiedTeam, UnifiedLocation
2. **Build Data Source Services:** Fetch from Eitje API, Bork API, test collections
3. **Build Enrichment Service:** Join with master data
4. **Build Aggregation Service:** Calculate revenue, labor, products, KPIs
5. **Build Dashboard Collection:** DailyOpsDashboard model
6. **Build Cron Job:** Daily 11 PM aggregation
7. **Build Dashboard Pages:** Use server actions + React Query
8. **Monitor:** Track sync success, data quality, aggregation times
