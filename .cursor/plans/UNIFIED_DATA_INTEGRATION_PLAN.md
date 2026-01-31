# Unified Data Integration: Daily Ops + Daily Work

## Overview: The Bridge Between Two Systems

**Current State:**
- ✅ **Daily Work:** Members, Teams, Locations (User/Team Management)
- ✅ **Daily Ops:** Raw data collections (test-eitje-*, test-bork-*)
- ❌ **Missing:** Connection between them

**Goal:** Build a unified data layer that connects:
1. Daily Work entities (Member, Team, Location)
2. CSV/API data (Eitje contracts, hours, Bork sales, basis reports)
3. Daily Ops dashboards (revenue, labor, productivity)

---

## CSV Data Structure Analysis

### Eitje CSV Files (Master Data Source)

#### 1. **eitje-werknemer-contract-v2.csv** (Employee Master)
```
Columns: naam, contracttype, uurloon, contactvestiging, gerealiseerde arbeidsproductiviteit, ...

Key Fields:
  - naam => Matches Member.name
  - uurloon => Matches Member.hourly_rate
  - contractvestiging => Maps to Location.name (Bar Bea, Van Kinsbergen, L'amour Toujours)
  - contracttype => uren contract | zzp | nul uren
  - vloer ID, Nmbrs ID => External IDs for mapping
  - Loonkosten per uur => Actual labor cost per hour
```

#### 2. **eitje-gewerkte-uren.csv** (Labor Transactions)
```
Columns: datum, naam, naam van vestiging, team naam, type, uren, gerealiseerde loonkosten, ...

Key Fields:
  - datum => Date (YYYY-MM-DD)
  - naam => Member.name
  - naam van vestiging => Location.name
  - team naam => Team.name (Bediening, Keuken, Management, Afwas, etc.)
  - uren => Hours worked
  - gerealiseerde loonkosten => Actual labor cost
  - Loonkosten per uur => Cost per hour
```

#### 3. **eitje-financien.csv** (Labor Totals per Location/Team/Date)
```
Columns: datum, naam van vestiging, omzetgroep naam, gerealiseerde arbeidsproductiviteit, gerealiseerde loonkosten, ...

Key Fields:
  - datum => Date
  - naam van vestiging => Location.name
  - omzetgroep naam => Team category (Bar & Bediening, Keuken)
  - gerealiseerde omzet => Revenue
  - gerealiseerde loonkosten => Total labor cost for period
  - gerealiseerde loonkosten percentage => Labor cost %
  - gewerkte uren => Total hours
```

### Bork Data (Transaction Level)

From test-bork-* collections:
```
Each row has:
  - date
  - productName / productCode
  - quantity
  - revenue / revenueExVat / revenueIncVat
  - team (implied from context)
  - location (implied from context)
```

---

## Integration Architecture

### Layer 1: Master Data Collection Service

**Goal:** Import CSV data into master collections (one-time or periodic sync)

```typescript
// app/lib/services/master-data/masterDataImportService.ts

export class MasterDataImportService {
  /**
   * Import from eitje-werknemer-contract-v2.csv
   * Creates/updates Member records
   */
  async syncEmployeeContractsFromCSV(csvData: string) {
    const records = parse(csvData);
    
    for (const record of records) {
      // Map CSV row to Member
      const memberData = {
        name: record['naam'],
        email: `${record['vloer ID']}@eitje.local`, // Generate email from ID
        hourly_rate: parseFloat(record['uurloon'].replace('€', '')),
        external_ids: {
          eitje: {
            vloer_id: record['vloer ID'],
            nmbrs_id: record['Nmbrs ID'],
          }
        },
        contractType: record['contracttype'],
        location_name: record['contactvestiging'], // Look up location_id
      };
      
      // Upsert: Find by external ID, or create
      await Member.findOneAndUpdate(
        { 'external_ids.eitje.vloer_id': record['vloer ID'] },
        memberData,
        { upsert: true }
      );
    }
  }
  
  /**
   * Import from eitje-gewerkte-uren.csv
   * Stores as raw labor transactions (becomes test-eitje-hours)
   */
  async syncLaborHoursFromCSV(csvData: string) {
    const records = parse(csvData);
    
    for (const record of records) {
      // Look up member, location, team
      const member = await Member.findOne({ name: record['naam'] });
      const location = await Location.findOne({ name: record['naam van vestiging'] });
      const team = await Team.findOne({ 
        name: record['team naam'],
        location_id: location?._id
      });
      
      // Store as raw labor record
      await db.collection('test-eitje-hours').insertOne({
        date: new Date(record['datum']),
        member_id: member?._id,
        member_name: record['naam'],
        location_id: location?._id,
        location_name: record['naam van vestiging'],
        team_id: team?._id,
        team_name: record['team naam'],
        hours: parseHours(record['uren']),
        labor_cost: parseFloat(record['gerealiseerde loonkosten'].replace('€', '')),
        cost_per_hour: parseFloat(record['Loonkosten per uur'].replace('€', '')),
        hourly_rate: parseFloat(record['uurloon'].replace('€', '')),
        contract_type: record['contracttype'],
        type: record['type'], // gewerkte uren, verlof, etc.
        support_id: record['support ID'],
        source: 'eitje-csv',
        importedAt: new Date(),
      });
    }
  }
  
  /**
   * Import from eitje-financien.csv
   * Stores as aggregated financial summary (verification data)
   */
  async syncFinancialSummaryFromCSV(csvData: string) {
    const records = parse(csvData);
    
    for (const record of records) {
      const location = await Location.findOne({ name: record['naam van vestiging'] });
      
      await db.collection('test-eitje-finance-summary').insertOne({
        date: new Date(record['datum']),
        location_id: location?._id,
        location_name: record['naam van vestiging'],
        team_category: record['omzetgroep naam'],
        revenue: parseFloat(record['gerealiseerde omzet'].replace('€', '')),
        labor_cost: parseFloat(record['gerealiseerde loonkosten'].replace('€', '')),
        labor_cost_percentage: parseFloat(record['gerealiseerde loonkosten percentage'].replace('%', '')),
        hours_worked: parseHours(record['gewerkte uren']),
        productivity: parseFloat(record['gerealiseerde arbeidsproductiviteit'].replace('€', '')),
        support_id: record['support ID'],
        source: 'eitje-csv',
      });
    }
  }
}
```

### Layer 2: Member/Team/Location Enrichment

**Goal:** Map external IDs to existing Daily Work entities

```typescript
// app/lib/services/master-data/dailyWorkEnrichmentService.ts

export class DailyWorkEnrichmentService {
  /**
   * Enrich Member with Eitje external IDs and CSV totals
   */
  async enrichMemberFromEitjeCSV(member: IMember) {
    // Get all Eitje hours for this member
    const hours = await db.collection('test-eitje-hours')
      .find({ member_id: member._id })
      .toArray();
    
    // Get contract info
    const contract = await db.collection('test-eitje-contracts')
      .findOne({ member_id: member._id });
    
    return {
      ...member.toObject(),
      eitje_data: {
        vloer_id: contract?.external_ids?.eitje?.vloer_id,
        nmbrs_id: contract?.external_ids?.eitje?.nmbrs_id,
        contract_type: contract?.contractType,
        hourly_rate: contract?.hourly_rate,
      },
      aggregates: {
        total_hours_worked: hours.reduce((sum, h) => sum + h.hours, 0),
        total_labor_cost: hours.reduce((sum, h) => sum + h.labor_cost, 0),
        average_cost_per_hour: hours.length > 0 
          ? hours.reduce((sum, h) => sum + h.labor_cost, 0) / hours.reduce((sum, h) => sum + h.hours, 0)
          : 0,
      }
    };
  }
  
  /**
   * Enrich Team with location and member count
   */
  async enrichTeamWithMetrics(team: ITeam) {
    // Get all members in this team
    const associations = await db.collection('MemberTeamAssociation')
      .find({ team_id: team._id, is_active: true })
      .toArray();
    
    // Get labor totals for this team
    const laborRecords = await db.collection('test-eitje-hours')
      .find({ team_id: team._id })
      .toArray();
    
    return {
      ...team.toObject(),
      member_count: associations.length,
      labor_metrics: {
        total_hours: laborRecords.reduce((sum, r) => sum + r.hours, 0),
        total_cost: laborRecords.reduce((sum, r) => sum + r.labor_cost, 0),
        unique_members: new Set(laborRecords.map(r => r.member_id)).size,
      }
    };
  }
  
  /**
   * Enrich Location with teams and member breakdown
   */
  async enrichLocationWithMetrics(location: ILocation) {
    // Get all teams at this location
    const teams = await db.collection('Team')
      .find({ location_id: location._id, is_active: true })
      .toArray();
    
    // Get all members at this location
    const members = await db.collection('MemberLocationAssociation')
      .find({ location_id: location._id, is_active: true })
      .toArray();
    
    // Get labor totals
    const laborRecords = await db.collection('test-eitje-hours')
      .find({ location_id: location._id })
      .toArray();
    
    // Get sales totals (from Bork)
    const salesRecords = await db.collection('test-bork-sales')
      .find({ location_id: location._id })
      .toArray();
    
    return {
      ...location.toObject(),
      summary: {
        total_teams: teams.length,
        total_members: members.length,
        total_labor_hours: laborRecords.reduce((sum, r) => sum + r.hours, 0),
        total_labor_cost: laborRecords.reduce((sum, r) => sum + r.labor_cost, 0),
        total_revenue: salesRecords.reduce((sum, r) => sum + (r.revenue || 0), 0),
      }
    };
  }
}
```

### Layer 3: CSV + API Check Service

**Goal:** Validate that CSV totals match API aggregates

```typescript
// app/lib/services/master-data/dataValidationService.ts

export class DataValidationService {
  /**
   * Verify CSV labor totals against raw records
   */
  async validateLaborTotals(date: string, location_id: string) {
    // Get CSV summary
    const csvSummary = await db.collection('test-eitje-finance-summary')
      .findOne({ date: new Date(date), location_id });
    
    // Get raw records sum
    const rawRecords = await db.collection('test-eitje-hours')
      .find({ 
        date: new Date(date),
        location_id 
      })
      .toArray();
    
    const rawSum = {
      labor_cost: rawRecords.reduce((sum, r) => sum + r.labor_cost, 0),
      hours_worked: rawRecords.reduce((sum, r) => sum + r.hours, 0),
    };
    
    // Compare
    const variance = {
      labor_cost_diff: Math.abs(csvSummary.labor_cost - rawSum.labor_cost),
      hours_diff: Math.abs(csvSummary.hours_worked - rawSum.hours_worked),
      matches: csvSummary.labor_cost === rawSum.labor_cost && 
               csvSummary.hours_worked === rawSum.hours_worked,
    };
    
    return {
      csv_data: csvSummary,
      raw_data: rawSum,
      validation: variance,
    };
  }
  
  /**
   * Verify Bork basis report totals
   */
  async validateBorkTotals(date: string, location_id: string) {
    // Get CSV summary (eitje-financien: revenue per location/team)
    const csvRevenue = await db.collection('test-eitje-finance-summary')
      .findOne({ date: new Date(date), location_id });
    
    // Get Bork sales sum
    const borkSales = await db.collection('test-bork-sales')
      .find({ date: new Date(date), location_id })
      .toArray();
    
    const borkSum = borkSales.reduce((sum, r) => sum + (r.revenue || 0), 0);
    
    return {
      csv_revenue: csvRevenue.revenue,
      bork_revenue: borkSum,
      matches: Math.abs(csvRevenue.revenue - borkSum) < 1, // Allow 1€ variance
      variance: Math.abs(csvRevenue.revenue - borkSum),
    };
  }
}
```

---

## Daily Ops Aggregation with Unified Data

### Updated Aggregation Service

```typescript
// app/lib/services/aggregation/dailyOpsAggregationService.ts

export class DailyOpsAggregationService {
  async buildDailyAggregation(date: string, location_id: string) {
    // 1. Fetch raw data (CSV + API)
    const eitjeHours = await db.collection('test-eitje-hours')
      .find({ date: new Date(date), location_id })
      .toArray();
    
    const borkSales = await db.collection('test-bork-sales')
      .find({ date: new Date(date), location_id })
      .toArray();
    
    const borkBasisReport = await db.collection('test-bork-basis-rapport')
      .find({ date: new Date(date), location_id })
      .toArray();
    
    // 2. ENRICH with Daily Work entities
    const enrichedHours = await Promise.all(
      eitjeHours.map(async (hour) => ({
        ...hour,
        // Add member profile from Daily Work
        member: await Member.findById(hour.member_id).lean(),
        // Add team details from Daily Work
        team: await Team.findById(hour.team_id).lean(),
        // Add location details from Daily Work
        location: await Location.findById(hour.location_id).lean(),
      }))
    );
    
    const enrichedSales = await Promise.all(
      borkSales.map(async (sale) => {
        const product = await db.collection('ProductMaster')
          .findOne({ code: sale.productCode });
        
        return {
          ...sale,
          productName: product?.name,
          cogs: product?.costOfGoodsSold,
          margin: product?.margin,
        };
      })
    );
    
    // 3. Calculate aggregates
    const labor = {
      total_hours: enrichedHours.reduce((sum, h) => sum + h.hours, 0),
      total_cost: enrichedHours.reduce((sum, h) => sum + h.labor_cost, 0),
      by_team: groupBy(enrichedHours, 'team._id').map(([teamId, records]) => ({
        team_id: teamId,
        team_name: records[0].team.name,
        hours: records.reduce((sum, r) => sum + r.hours, 0),
        cost: records.reduce((sum, r) => sum + r.labor_cost, 0),
        members: records.map(r => r.member._id),
        productivity: 0, // Will add revenue/hours
      })),
      by_member: enrichedHours.map(h => ({
        member_id: h.member_id,
        member_name: h.member.name,
        team_name: h.team.name,
        hours: h.hours,
        cost: h.labor_cost,
        hourly_rate: h.hourly_rate,
      })),
    };
    
    const revenue = {
      total: enrichedSales.reduce((sum, s) => sum + s.revenue, 0),
      by_product: groupBy(enrichedSales, 'productName').map(([product, records]) => ({
        product,
        revenue: records.reduce((sum, r) => sum + r.revenue, 0),
        qty: records.reduce((sum, r) => sum + r.quantity, 0),
      })),
    };
    
    // 4. Calculate KPIs
    const kpis = {
      labor_cost_percentage: (labor.total_cost / revenue.total) * 100,
      revenue_per_hour: revenue.total / labor.total_hours,
      productivity_by_team: labor.by_team.map(t => ({
        ...t,
        productivity: revenue.total / t.hours, // Simplified; would be team-specific
      })),
    };
    
    // 5. Add source metadata
    const doc = new DailyOpsDashboard({
      date: new Date(date),
      location_id,
      location: await Location.findById(location_id),
      
      labor: {
        ...labor,
        csv_verified: true, // Did we validate against eitje-financien.csv?
      },
      
      revenue,
      
      kpis,
      
      sources: {
        eitje_csv: {
          hours_count: eitjeHours.length,
          csv_summary_verified: true,
        },
        bork_api: {
          sales_count: borkSales.length,
          basis_report_count: borkBasisReport.length,
        },
      },
    });
    
    await doc.save();
    return doc;
  }
}
```

---

## Data Flow: End-to-End

```
┌─────────────────────────────────────────────────────────────────┐
│ DAILY WORK (Member/Team/Location Management)                    │
│ - Members: Name, Email, Roles, Hourly Rate                      │
│ - Teams: Name, Location, Description                            │
│ - Locations: Name, Address, City, Country                       │
└─────────────┬───────────────────────────────────────────────────┘
              │
              ▼
┌─────────────────────────────────────────────────────────────────┐
│ CSV DATA IMPORT (One-time or Periodic)                          │
│ eitje-werknemer-contract-v2.csv  ──┐                           │
│ eitje-gewerkte-uren.csv           ├─→ Master Data Import Service │
│ eitje-financien.csv               ├─→ Enrich Members/Teams      │
│ (+ Bork CSV if available)         ─┘   with external IDs        │
└──────────────┬──────────────────────────────────────────────────┘
               │
               ▼
┌─────────────────────────────────────────────────────────────────┐
│ RAW DATA COLLECTIONS (Normalized, One Doc Per Row)              │
│ test-eitje-hours            (member_id, team_id, location_id)   │
│ test-eitje-finance-summary  (location_id summary totals)        │
│ test-bork-sales             (location_id, team context)         │
│ test-bork-basis-rapport     (product-level breakdown)           │
│                                                                  │
│ ✅ Each row has Daily Work IDs (member_id, team_id, location_id)
│ ✅ CSV totals stored for verification                            │
└──────────────┬──────────────────────────────────────────────────┘
               │
               ▼
┌─────────────────────────────────────────────────────────────────┐
│ VALIDATION (Compare CSV Totals ↔ Raw Records)                   │
│ DataValidationService:                                          │
│ - validateLaborTotals()      (CSV eitje-financien vs raw)       │
│ - validateBorkTotals()       (CSV bork totals vs test-bork-*)   │
│ - detectDiscrepancies()      (Flag mismatches)                  │
└──────────────┬──────────────────────────────────────────────────┘
               │
               ▼
┌─────────────────────────────────────────────────────────────────┐
│ ENRICHMENT (Join with Daily Work)                              │
│ DailyWorkEnrichmentService:                                    │
│ - Add member_name, team_name, location_name                    │
│ - Add roles, permissions                                        │
│ - Calculate aggregates                                          │
└──────────────┬──────────────────────────────────────────────────┘
               │
               ▼
┌─────────────────────────────────────────────────────────────────┐
│ AGGREGATION (Build Daily Dashboard)                            │
│ v2_daily_ops_dashboard_aggregated                              │
│ {                                                              │
│   date, location_id, location: {...}                           │
│   labor: { by_team, by_member, total, ... }                    │
│   revenue: { by_product, by_category, total, ... }             │
│   kpis: { labor_cost%, productivity, ... }                     │
│   sources: { eitje_csv_verified, bork_api_count, ... }        │
│ }                                                              │
└──────────────┬──────────────────────────────────────────────────┘
               │
               ▼
┌─────────────────────────────────────────────────────────────────┐
│ DAILY OPS DASHBOARD                                            │
│ /daily-ops page                                                │
│ - Revenue per Team (with member breakdown)                     │
│ - Labor Cost % (with hourly rates from Daily Work)             │
│ - Productivity (revenue/hours/member)                          │
│ - Product Analysis (best sellers, most profitable)             │
│ - Team Comparison (side-by-side metrics)                       │
└─────────────────────────────────────────────────────────────────┘
```

---

## Implementation Roadmap

### Phase 1: Master Data Sync (Week 1)
1. ✅ Create `MasterDataImportService`
2. ✅ Add CSV import routes: `POST /api/data/import/eitje-contracts`, etc.
3. ✅ Update Member model with `external_ids` field
4. ✅ Store imported data in test-eitje-*, test-bork-* collections
5. ✅ Create lookup mappings (CSV external IDs ↔ Daily Work entities)

### Phase 2: Validation Layer (Week 1-2)
1. ✅ Create `DataValidationService`
2. ✅ Add validation endpoints to check CSV totals vs raw records
3. ✅ Create dashboards showing validation status
4. ✅ Flag discrepancies (e.g., "CSV says 40 hours but raw data shows 38")

### Phase 3: Enrichment (Week 2)
1. ✅ Create `DailyWorkEnrichmentService`
2. ✅ Update raw collections to include Daily Work IDs during import
3. ✅ Build cross-reference lookups (member_name → member_id, etc.)
4. ✅ Add post-processing to backfill missing IDs

### Phase 4: Aggregation + Dashboard (Week 2-3)
1. ✅ Update `DailyOpsAggregationService` to enrich with Daily Work data
2. ✅ Build v2_daily_ops_dashboard_aggregated with full context
3. ✅ Create Daily Ops pages that query aggregated collection
4. ✅ Add drill-down (click member → see their hours/productivity)

### Phase 5: Integration (Week 3)
1. ✅ Wire Daily Ops pages to unified data
2. ✅ Add filters (by Team, Member, Date Range)
3. ✅ Add export (CSV/PDF)
4. ✅ Add real-time updates via WebSocket

---

## Key Benefits

✅ **Single Source of Truth:** Member, Team, Location data in Daily Work; labor/sales data in aggregates  
✅ **CSV Validation:** Verify that imports are accurate (CSV totals ↔ raw records)  
✅ **Rich Context:** Every dashboard metric includes who, when, where, how much  
✅ **Drill-Down:** Click on any metric → see member/team breakdown  
✅ **Historical Tracking:** Keep audit trail of all data imports and validations  
✅ **Real-Time Possible:** Can extend to API data (Eitje, Bork) without changing structure  
✅ **Role-Based Access:** Daily Work roles can control who sees what in Daily Ops

---

## Technical Considerations

### Lookup Performance
- Index on `location_id`, `team_id`, `member_id` in raw collections
- Index on `date` for fast date range queries
- Consider denormalizing team_name, member_name in raw collections for speed

### Data Consistency
- Use transactions when importing CSV data
- Validate all external IDs on import
- Flag orphaned records (member/team deleted but raw data exists)

### Backward Compatibility
- Member model keeps deprecated `location_id` / `team_id` fields
- Gradual migration: new imports use MemberLocationAssociation, old data still works

---

## Example: Complete Daily Ops Query

```typescript
// Get dashboard for 2026-01-29, Amsterdam location

const location = await Location.findOne({ name: 'Amsterdam' });
const dashboard = await DailyOpsDashboard.findOne({
  date: '2026-01-29',
  location_id: location._id,
});

// Result structure:
{
  date: '2026-01-29',
  location: { _id, name: 'Amsterdam', ... },
  
  labor: {
    total_hours: 160,
    total_cost: 3200,
    by_team: [
      {
        team_id, team_name: 'Kitchen',
        hours: 80, cost: 1600,
        members: [ { _id, name: 'Chef John', hours: 8, cost: 200, hourly_rate: 25 }, ... ],
        productivity: 62.5, // €5000 revenue / 80 hours
      },
      { team_name: 'Service', hours: 80, cost: 1600, ... }
    ],
  },
  
  revenue: {
    total: 5000,
    by_product: [
      { product: 'Pasta', revenue: 2000, qty: 100 },
      { product: 'Pizza', revenue: 2000, qty: 80 },
    ],
    by_category: { food: 4000, beverage: 1000 },
  },
  
  kpis: {
    labor_cost_percentage: 64,
    revenue_per_hour: 31.25,
    productivity_by_team: [
      { team: 'Kitchen', productivity: 62.5, revenue: 5000 },
      { team: 'Service', productivity: 31.25, revenue: 2500 },
    ],
  },
  
  sources: {
    eitje_csv: { hours_count: 40, csv_verified: true },
    bork_api: { sales_count: 120, basis_report_count: 30 },
  },
}

// DASHBOARD DISPLAY:
// ┌─────────────────────────────────────────────┐
// │ AMSTERDAM - 2026-01-29                      │
// ├─────────────────────────────────────────────┤
// │                                             │
// │ 💰 Revenue: €5,000                          │
// │    ├─ Food: €4,000 (80%)                    │
// │    └─ Beverage: €1,000 (20%)                │
// │                                             │
// │ 👥 Labor: €3,200 (64% of revenue)           │
// │    ├─ Kitchen: €1,600 / 80 hours            │
// │    │  Staff: Chef John (8h), Maria (8h)...  │
// │    └─ Service: €1,600 / 80 hours            │
// │       Staff: John (8h), Sarah (8h)...       │
// │                                             │
// │ 📊 Productivity:                            │
// │    ├─ Kitchen: €62.5/hour (Best!)           │
// │    └─ Service: €31.25/hour                  │
// │                                             │
// │ 🏆 Top Sellers:                             │
// │    ├─ Pasta: 100 units, €2,000              │
// │    └─ Pizza: 80 units, €2,000               │
// └─────────────────────────────────────────────┘
```

---

## CSV Import API Example

```typescript
// POST /api/data/import/eitje-hours
// Body: { csvData: "...", location: "Amsterdam", type: "labor_hours" }

const result = await masterDataImportService.syncLaborHoursFromCSV(csvData);

// Response:
{
  success: true,
  imported: 150,
  failed: 0,
  validation: {
    csv_summary: { hours: 160, cost: 3200 },
    raw_records: { hours: 160, cost: 3200 },
    matches: true,
  },
  next_steps: "Aggregation will run tonight at 11 PM",
}
```
