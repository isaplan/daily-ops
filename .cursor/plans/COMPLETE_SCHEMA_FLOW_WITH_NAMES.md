# Complete Schema Flow: Data Passing Through All 3 Layers

## Your Insight: Start from Final View, Work Backwards

```
Your Approach (worked great!):
  Final View (no lookups, all names+IDs)
      ↑
  What fields do we need?
      ↑
  Design that into raw data
      ↑
  Build collection structure

My Initial Approach (caused lookups):
  Store minimal (IDs only)
      ↑
  Query needs name? LOOKUP!
      ↑
  Performance issues

Better Approach (combining both):
  Store flat with IDs ✅
  Include names at each layer ✅
  Zero lookups needed ✅
```

---

## Final View: What the Dashboard Needs (No Lookups)

```typescript
// v2_daily_ops_dashboard_aggregated
// This is the CONTRACT - what must be in this document

interface FinalDashboardDocument {
  _id: ObjectId
  date: string                    // "2026-01-29"
  location_id: ObjectId
  
  // ═══════════════════════════════════════════════════════════
  // REVENUE SECTION (Complete, zero lookups needed)
  // ═══════════════════════════════════════════════════════════
  revenue: {
    total: number
    
    byProduct: [
      {
        product_id: ObjectId        // ← ID
        product_name: string        // ← NAME (no lookup!)
        product_code: string        // ← CODE
        category: string            // ← CATEGORY (no lookup!)
        category_id: ObjectId       // ← ID
        
        quantity: number
        revenue: number
        
        cogs: number
        margin: number
        
        source: 'bork-csv' | 'bork-api'
      }
    ]
    
    byCategory: [
      {
        category_id: ObjectId
        category_name: string       // ← NAME (no lookup!)
        revenue: number
        qty: number
      }
    ]
    
    byTeam: [
      {
        team_id: ObjectId
        team_name: string           // ← NAME (no lookup!)
        location_id: ObjectId
        location_name: string       // ← NAME (no lookup!)
        revenue: number
        staff_count: number
      }
    ]
  }
  
  // ═══════════════════════════════════════════════════════════
  // LABOR SECTION (Complete, zero lookups needed)
  // ═══════════════════════════════════════════════════════════
  labor: {
    total_hours: number
    total_cost: number
    
    byTeam: [
      {
        team_id: ObjectId
        team_name: string           // ← NAME (no lookup!)
        location_id: ObjectId
        location_name: string       // ← NAME (no lookup!)
        
        hours: number
        cost: number
        
        members: [
          {
            member_id: ObjectId
            member_name: string     // ← NAME (no lookup!)
            role: string            // ← ROLE (no lookup!)
            hours: number
            cost: number
            hourly_rate: number
            cost_per_hour: number
            productivity: number    // revenue/hours
            
            contract_type: string   // "uren contract", "zzp", etc.
          }
        ]
      }
    ]
    
    source: 'eitje-csv' | 'eitje-api'
    csv_verified: boolean
    api_verified: boolean
  }
  
  // ═══════════════════════════════════════════════════════════
  // PRODUCTS SECTION (Complete, zero lookups needed)
  // ═══════════════════════════════════════════════════════════
  products: {
    topSellers: [
      {
        product_id: ObjectId
        product_name: string       // ← NAME
        category: string           // ← NAME
        quantity: number
        revenue: number
      }
    ]
    
    bestCombination: {
      products: [
        {
          product_id: ObjectId
          product_name: string     // ← NAME
          quantity: number
        }
      ]
      frequency: number
      profit_margin: number
    }
  }
  
  // ═══════════════════════════════════════════════════════════
  // METADATA (Complete)
  // ═══════════════════════════════════════════════════════════
  sources: {
    eitje: { csv_verified, api_verified, variance }
    bork: { csv_verified, api_verified, variance }
  }
}
```

---

## Layer 3 to Layer 2: What We Need to Build Aggregation

Working backwards from final view...

```typescript
// Layer 2 Input: Enriched raw records (must have names!)

interface EnrichedLaborRecord {
  date: Date
  
  // Links to master data
  member_id: ObjectId
  member_name: string           // ← PASSED UP (no lookup!)
  member_role: string           // ← PASSED UP
  
  location_id: ObjectId
  location_name: string         // ← PASSED UP
  
  team_id: ObjectId
  team_name: string             // ← PASSED UP
  
  // Labor data
  hours: number
  cost: number
  hourly_rate: number
  
  // Metadata
  contract_type: string
  source: 'eitje-csv' | 'eitje-api'
}

interface EnrichedSalesRecord {
  date: Date
  
  // Links to master data
  product_id: ObjectId
  product_name: string          // ← PASSED UP
  product_code: string
  
  category_id: ObjectId
  category_name: string         // ← PASSED UP
  
  location_id: ObjectId
  location_name: string         // ← PASSED UP
  
  team_id: ObjectId
  team_name: string             // ← PASSED UP
  
  // Sales data
  quantity: number
  revenue: number
  cogs: number
  
  // Metadata
  source: 'bork-csv' | 'bork-api'
  transaction_id: string
}

// Then aggregation just GROUPS & SUMS, no lookups!
```

---

## Layer 2 to Layer 1: Enrichment Flow

Working backwards again...

```typescript
// Layer 1: Raw Data (minimal, before enrichment)

interface RawLaborRecord {
  date: Date
  
  // Only IDs from CSV/API
  member_id: ObjectId    // Looked up during import
  location_id: ObjectId  // Looked up during import
  team_id: ObjectId      // Looked up during import
  
  // Raw data
  hours: number
  cost: number
  hourly_rate: number
  
  // For audit
  source: 'eitje-csv' | 'eitje-api'
  raw_csv?: Record<string, any>
  raw_api?: Record<string, any>
}

// ↓ ENRICHMENT SERVICE ↓
// Fetches member, location, team names ONE TIME
// Adds them to record
// Returns EnrichedLaborRecord (with names)

interface RawSalesRecord {
  date: Date
  
  // Only IDs from CSV/API
  product_id: ObjectId   // Looked up during import
  category_id: ObjectId  // Looked up during import
  location_id: ObjectId  // Looked up during import
  team_id: ObjectId      // Looked up during import
  
  // Raw data
  quantity: number
  revenue: number
  cogs: number
  
  // For audit
  source: 'bork-csv' | 'bork-api'
  raw_csv?: Record<string, any>
  raw_api?: Record<string, any>
}

// ↓ ENRICHMENT SERVICE ↓
// Fetches product, category, location, team names ONE TIME
// Adds them to record
// Returns EnrichedSalesRecord (with names)
```

---

## Complete Data Flow Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│ LAYER 0: MASTER DATA (Dimension Tables - Cached)               │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│ Collections (Loaded once into memory for enrichment):          │
│                                                                 │
│ Member Collection:                                             │
│ ├─ _id: ObjectId                                               │
│ ├─ name: string                                                │
│ ├─ role: string                                                │
│ ├─ hourly_rate: number                                         │
│ └─ contract_type: string                                       │
│                                                                 │
│ Location Collection:                                           │
│ ├─ _id: ObjectId                                               │
│ ├─ name: string                                                │
│ └─ address: string                                             │
│                                                                 │
│ Team Collection:                                               │
│ ├─ _id: ObjectId                                               │
│ ├─ name: string                                                │
│ ├─ location_id: ObjectId                                       │
│ └─ type: string                                                │
│                                                                 │
│ Product Collection:                                            │
│ ├─ _id: ObjectId                                               │
│ ├─ name: string                                                │
│ ├─ code: string                                                │
│ ├─ category_id: ObjectId                                       │
│ ├─ cogs: number                                                │
│ └─ margin: number                                              │
│                                                                 │
│ Category Collection:                                           │
│ ├─ _id: ObjectId                                               │
│ └─ name: string                                                │
│                                                                 │
└─────────────────┬───────────────────────────────────────────────┘
                  │
                  │ (Cache during enrichment)
                  ▼
┌─────────────────────────────────────────────────────────────────┐
│ LAYER 1: RAW DATA (Flat, IDs only, preservation)               │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│ Collections (One document per row/transaction):                │
│                                                                 │
│ test-eitje-hours:                                              │
│ {                                                              │
│   _id: ObjectId,                                               │
│   date: Date,                                                  │
│                                                                 │
│   member_id: ObjectId,         ← ID only                       │
│   location_id: ObjectId,       ← ID only                       │
│   team_id: ObjectId,           ← ID only                       │
│                                                                 │
│   hours: 8,                    ← Raw data                      │
│   cost: 160,                   ← Raw data                      │
│   hourly_rate: 20,             ← Raw data                      │
│                                                                 │
│   source: 'eitje-csv',         ← Source tracking               │
│   raw_csv: { ... },            ← Preservation                  │
│   imported_at: Date            ← Metadata                      │
│ }                                                              │
│                                                                 │
│ test-bork-sales-unified:                                       │
│ {                                                              │
│   _id: ObjectId,                                               │
│   date: Date,                                                  │
│                                                                 │
│   product_id: ObjectId,        ← ID only                       │
│   category_id: ObjectId,       ← ID only                       │
│   location_id: ObjectId,       ← ID only                       │
│   team_id: ObjectId,           ← ID only                       │
│                                                                 │
│   quantity: 2,                 ← Raw data                      │
│   revenue: 53,                 ← Raw data                      │
│   cogs: 20,                    ← Raw data                      │
│                                                                 │
│   source: 'bork-api',          ← Source tracking               │
│   raw_api: { ... },            ← Preservation                  │
│   imported_at: Date            ← Metadata                      │
│ }                                                              │
│                                                                 │
└─────────────────┬───────────────────────────────────────────────┘
                  │
    ┌─────────────┴─────────────┐
    │                           │
    ▼                           ▼
┌──────────────────┐    ┌──────────────────┐
│ ENRICHMENT       │    │ ENRICHMENT       │
│ Labor Service    │    │ Sales Service    │
│ ────────────     │    │ ────────────     │
│ For each record: │    │ For each record: │
│                  │    │                  │
│ 1. Load member   │    │ 1. Load product  │
│    → add name    │    │    → add name    │
│ 2. Load location │    │ 2. Load category │
│    → add name    │    │    → add name    │
│ 3. Load team     │    │ 3. Load location │
│    → add name    │    │    → add name    │
│                  │    │ 4. Load team     │
│                  │    │    → add name    │
│                  │    │                  │
│ Output: IDs +    │    │ Output: IDs +    │
│ NAMES (no future │    │ NAMES (no future │
│ lookups needed!) │    │ lookups needed!) │
└──────────────────┘    └──────────────────┘
    │                           │
    └─────────────┬─────────────┘
                  │
                  ▼
┌─────────────────────────────────────────────────────────────────┐
│ LAYER 2: ENRICHED RAW DATA (IDs + Names, ready for agg)        │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│ Enriched Labor Records (in memory, temporary):                 │
│ {                                                              │
│   date: Date,                                                  │
│                                                                 │
│   member_id: ObjectId,                                         │
│   member_name: "André Rozhok",    ✅ NAME (no lookup!)         │
│   member_role: "kitchen_staff",   ✅ ROLE (no lookup!)         │
│                                                                 │
│   location_id: ObjectId,                                       │
│   location_name: "Bar Bea",       ✅ NAME (no lookup!)         │
│                                                                 │
│   team_id: ObjectId,                                           │
│   team_name: "Keuken",            ✅ NAME (no lookup!)         │
│                                                                 │
│   hours: 8,                                                    │
│   cost: 160,                                                   │
│   hourly_rate: 20,                                             │
│   contract_type: "uren contract"                               │
│ }                                                              │
│                                                                 │
│ Enriched Sales Records (in memory, temporary):                 │
│ {                                                              │
│   date: Date,                                                  │
│                                                                 │
│   product_id: ObjectId,                                        │
│   product_name: "Burger",         ✅ NAME (no lookup!)         │
│   product_code: "BUR-001",                                     │
│                                                                 │
│   category_id: ObjectId,                                       │
│   category_name: "Food",          ✅ NAME (no lookup!)         │
│                                                                 │
│   location_id: ObjectId,                                       │
│   location_name: "Bar Bea",       ✅ NAME (no lookup!)         │
│                                                                 │
│   team_id: ObjectId,                                           │
│   team_name: "Bediening",         ✅ NAME (no lookup!)         │
│                                                                 │
│   quantity: 2,                                                 │
│   revenue: 53,                                                 │
│   cogs: 20                                                     │
│ }                                                              │
│                                                                 │
└─────────────────┬───────────────────────────────────────────────┘
                  │
                  │ GROUP & SUM (no lookups, just grouping!)
                  ▼
┌─────────────────────────────────────────────────────────────────┐
│ LAYER 3: AGGREGATED DASHBOARD DOCUMENT                          │
├─────────────────────────────────────────────────────────────────┤
│ (Stored in MongoDB - ready for query)                           │
│                                                                 │
│ v2_daily_ops_dashboard_aggregated:                              │
│ {                                                              │
│   _id: ObjectId,                                               │
│   date: "2026-01-29",                                          │
│   location_id: ObjectId,                                       │
│                                                                 │
│   revenue: {                                                   │
│     total: 5000,                                               │
│                                                                 │
│     byProduct: [                                               │
│       {                                                        │
│         product_id: ObjectId,                                  │
│         product_name: "Burger",        ✅ Embedded (no lookup!)│
│         category_id: ObjectId,                                 │
│         category_name: "Food",         ✅ Embedded (no lookup!)│
│         quantity: 45,                                          │
│         revenue: 1200,                                         │
│         cogs: 450,                                             │
│         margin: 0.625                                          │
│       }                                                        │
│     ],                                                         │
│                                                                 │
│     byTeam: [                                                  │
│       {                                                        │
│         team_id: ObjectId,                                     │
│         team_name: "Bediening",        ✅ Embedded (no lookup!)│
│         location_id: ObjectId,                                 │
│         location_name: "Bar Bea",      ✅ Embedded (no lookup!)│
│         revenue: 1500,                                         │
│         staff_count: 2                                         │
│       }                                                        │
│     ]                                                          │
│   },                                                           │
│                                                                 │
│   labor: {                                                     │
│     total_hours: 160,                                          │
│     total_cost: 3200,                                          │
│                                                                 │
│     byTeam: [                                                  │
│       {                                                        │
│         team_id: ObjectId,                                     │
│         team_name: "Keuken",           ✅ Embedded (no lookup!)│
│         location_name: "Bar Bea",      ✅ Embedded (no lookup!)│
│         hours: 80,                                             │
│         cost: 1600,                                            │
│                                                                 │
│         members: [                                             │
│           {                                                    │
│             member_id: ObjectId,                               │
│             member_name: "André",      ✅ Embedded (no lookup!)│
│             role: "kitchen_staff",     ✅ Embedded (no lookup!)│
│             hours: 8,                                          │
│             cost: 160,                                         │
│             productivity: 625                                  │
│           }                                                    │
│         ]                                                      │
│       }                                                        │
│     ]                                                          │
│   },                                                           │
│                                                                 │
│   kpis: { ... }                                                │
│ }                                                              │
│                                                                 │
│ ✅ ONE QUERY = EVERYTHING!                                     │
│ ✅ ZERO LOOKUPS NEEDED!                                        │
│ ✅ ALL NAMES/IDs EMBEDDED!                                     │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────────────────────────────┐
│ FRONTEND: React Components                                      │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│ const { data } = useQuery({                                    │
│   queryKey: ['dashboard', date, location],                     │
│   queryFn: () => getDailyDashboard(date, location)             │
│ });                                                            │
│                                                                 │
│ // data.revenue.byTeam.map(team => (                           │
│ //   <TeamCard                                                 │
│ //     team_id={team.team_id}                                  │
│ //     team_name={team.team_name}    ← Already have name!      │
│ //     revenue={team.revenue}                                  │
│ //   />                                                        │
│ // ))                                                          │
│                                                                 │
│ ✅ INSTANT RENDERING!                                          │
│ ✅ NO API CALLS FOR NAMES!                                     │
│ ✅ PERFECT UX!                                                 │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## Implementation: Service Layer Code

### Step 1: Master Data Cache (Layer 0)

```typescript
// app/lib/services/enrichment/masterDataCacheService.ts

export class MasterDataCacheService {
  private memberCache: Map<string, any> = new Map();
  private locationCache: Map<string, any> = new Map();
  private teamCache: Map<string, any> = new Map();
  private productCache: Map<string, any> = new Map();
  private categoryCache: Map<string, any> = new Map();

  /**
   * Load all master data into memory ONCE
   * Called at start of enrichment process
   */
  async loadAllMasterData() {
    console.log('[MasterDataCache] Loading all master data...');

    const [members, locations, teams, products, categories] = await Promise.all([
      db.collection('members').find({}).toArray(),
      db.collection('locations').find({}).toArray(),
      db.collection('teams').find({}).toArray(),
      db.collection('products').find({}).toArray(),
      db.collection('categories').find({}).toArray(),
    ]);

    // Index by _id for O(1) lookup
    members.forEach(m => this.memberCache.set(m._id.toString(), m));
    locations.forEach(l => this.locationCache.set(l._id.toString(), l));
    teams.forEach(t => this.teamCache.set(t._id.toString(), t));
    products.forEach(p => this.productCache.set(p._id.toString(), p));
    categories.forEach(c => this.categoryCache.set(c._id.toString(), c));

    console.log(`[MasterDataCache] Loaded: ${members.length} members, ${locations.length} locations, ${teams.length} teams, ${products.length} products, ${categories.length} categories`);
  }

  getMember(memberId: ObjectId) {
    return this.memberCache.get(memberId.toString());
  }

  getLocation(locationId: ObjectId) {
    return this.locationCache.get(locationId.toString());
  }

  getTeam(teamId: ObjectId) {
    return this.teamCache.get(teamId.toString());
  }

  getProduct(productId: ObjectId) {
    return this.productCache.get(productId.toString());
  }

  getCategory(categoryId: ObjectId) {
    return this.categoryCache.get(categoryId.toString());
  }
}
```

### Step 2: Enrichment Service (Layer 1 → Layer 2)

```typescript
// app/lib/services/enrichment/laborEnrichmentService.ts

export class LaborEnrichmentService {
  constructor(private masterDataCache: MasterDataCacheService) {}

  /**
   * Enrich raw labor record with names
   * One record at a time (batched)
   */
  enrichLaborRecord(rawRecord: any) {
    // Get master data from cache (O(1) lookup)
    const member = this.masterDataCache.getMember(rawRecord.member_id);
    const location = this.masterDataCache.getLocation(rawRecord.location_id);
    const team = this.masterDataCache.getTeam(rawRecord.team_id);

    if (!member || !location || !team) {
      console.warn('⚠️ Missing master data for record:', rawRecord);
      return null; // Skip orphaned records
    }

    // Return enriched record (IDs + NAMES)
    return {
      date: rawRecord.date,

      // IDs
      member_id: rawRecord.member_id,
      location_id: rawRecord.location_id,
      team_id: rawRecord.team_id,

      // NAMES (added here!)
      member_name: member.name,
      member_role: member.roles?.[0]?.role || 'staff',
      location_name: location.name,
      team_name: team.name,

      // Raw data
      hours: rawRecord.hours,
      cost: rawRecord.cost,
      hourly_rate: rawRecord.hourly_rate,
      contract_type: rawRecord.contract_type,

      // Metadata
      source: rawRecord.source,
    };
  }

  /**
   * Enrich batch of raw records
   * Loads master data once, then enriches all
   */
  async enrichLaborBatch(rawRecords: any[]) {
    // Load master data ONCE (expensive, but only once!)
    await this.masterDataCache.loadAllMasterData();

    // Enrich each record (now just cache lookups, O(1) per record)
    const enriched = rawRecords
      .map(r => this.enrichLaborRecord(r))
      .filter(r => r !== null);

    console.log(`[LaborEnrichment] Enriched ${enriched.length}/${rawRecords.length} records`);

    return enriched;
  }
}

// Usage:
// const cache = new MasterDataCacheService();
// const enricher = new LaborEnrichmentService(cache);
// const enrichedRecords = await enricher.enrichLaborBatch(rawLaborRecords);
// → enrichedRecords now have member_name, location_name, team_name!
// → NO LOOKUPS needed later!
```

### Step 3: Sales Enrichment (Same Pattern)

```typescript
// app/lib/services/enrichment/salesEnrichmentService.ts

export class SalesEnrichmentService {
  constructor(private masterDataCache: MasterDataCacheService) {}

  enrichSalesRecord(rawRecord: any) {
    const product = this.masterDataCache.getProduct(rawRecord.product_id);
    const category = this.masterDataCache.getCategory(rawRecord.category_id);
    const location = this.masterDataCache.getLocation(rawRecord.location_id);
    const team = this.masterDataCache.getTeam(rawRecord.team_id);

    if (!product || !category || !location || !team) {
      console.warn('⚠️ Missing master data for sales record:', rawRecord);
      return null;
    }

    return {
      date: rawRecord.date,

      // IDs
      product_id: rawRecord.product_id,
      category_id: rawRecord.category_id,
      location_id: rawRecord.location_id,
      team_id: rawRecord.team_id,

      // NAMES (added here!)
      product_name: product.name,
      product_code: product.code,
      category_name: category.name,
      location_name: location.name,
      team_name: team.name,

      // Raw data
      quantity: rawRecord.quantity,
      revenue: rawRecord.revenue,
      cogs: product.cogs,
      margin: (rawRecord.revenue - product.cogs) / rawRecord.revenue,

      // Metadata
      source: rawRecord.source,
      transaction_id: rawRecord.transaction_id,
    };
  }

  async enrichSalesBatch(rawRecords: any[]) {
    await this.masterDataCache.loadAllMasterData();

    const enriched = rawRecords
      .map(r => this.enrichSalesRecord(r))
      .filter(r => r !== null);

    console.log(`[SalesEnrichment] Enriched ${enriched.length}/${rawRecords.length} records`);

    return enriched;
  }
}
```

### Step 4: Aggregation (Layer 2 → Layer 3)

```typescript
// app/lib/services/aggregation/dailyOpsAggregationService.ts

export class DailyOpsAggregationService {
  /**
   * Build aggregated document
   * Uses enriched records (already have names!)
   * Just groups and sums, NO LOOKUPS!
   */
  async buildDailyAggregation(
    date: string,
    location_id: string,
    enrichedLaborRecords: any[],
    enrichedSalesRecords: any[]
  ) {
    // ══════════════════════════════════════════════════════════
    // REVENUE AGGREGATION (from enriched records)
    // ══════════════════════════════════════════════════════════

    const revenueByProduct = new Map<string, any>();
    const revenueByTeam = new Map<string, any>();

    for (const record of enrichedSalesRecords) {
      // By Product
      const productKey = record.product_id.toString();
      if (!revenueByProduct.has(productKey)) {
        revenueByProduct.set(productKey, {
          product_id: record.product_id,
          product_name: record.product_name,  // ← Already have it!
          product_code: record.product_code,
          category_id: record.category_id,
          category_name: record.category_name,  // ← Already have it!
          quantity: 0,
          revenue: 0,
        });
      }
      const prod = revenueByProduct.get(productKey);
      prod.quantity += record.quantity;
      prod.revenue += record.revenue;

      // By Team
      const teamKey = record.team_id.toString();
      if (!revenueByTeam.has(teamKey)) {
        revenueByTeam.set(teamKey, {
          team_id: record.team_id,
          team_name: record.team_name,         // ← Already have it!
          location_id: record.location_id,
          location_name: record.location_name, // ← Already have it!
          revenue: 0,
          staff_count: 0,
        });
      }
      const team = revenueByTeam.get(teamKey);
      team.revenue += record.revenue;
    }

    // ══════════════════════════════════════════════════════════
    // LABOR AGGREGATION (from enriched records)
    // ══════════════════════════════════════════════════════════

    const laborByTeam = new Map<string, any>();
    const membersByTeam = new Map<string, any>();

    for (const record of enrichedLaborRecords) {
      const teamKey = record.team_id.toString();

      if (!laborByTeam.has(teamKey)) {
        laborByTeam.set(teamKey, {
          team_id: record.team_id,
          team_name: record.team_name,         // ← Already have it!
          location_id: record.location_id,
          location_name: record.location_name, // ← Already have it!
          hours: 0,
          cost: 0,
          members: [],
        });
      }

      const team = laborByTeam.get(teamKey);
      team.hours += record.hours;
      team.cost += record.cost;

      // By Member (nested in team)
      const memberKey = record.member_id.toString();
      if (!membersByTeam.has(memberKey)) {
        membersByTeam.set(memberKey, {
          member_id: record.member_id,
          member_name: record.member_name,     // ← Already have it!
          member_role: record.member_role,     // ← Already have it!
          hours: 0,
          cost: 0,
        });
      }
      const member = membersByTeam.get(memberKey);
      member.hours += record.hours;
      member.cost += record.cost;
    }

    // ══════════════════════════════════════════════════════════
    // BUILD FINAL DOCUMENT (All names embedded!)
    // ══════════════════════════════════════════════════════════

    const dashboard = {
      _id: new ObjectId(),
      date,
      location_id: new ObjectId(location_id),

      revenue: {
        total: Array.from(revenueByProduct.values()).reduce((sum, p) => sum + p.revenue, 0),
        byProduct: Array.from(revenueByProduct.values()),
        byTeam: Array.from(revenueByTeam.values()),
      },

      labor: {
        total_hours: Array.from(laborByTeam.values()).reduce((sum, t) => sum + t.hours, 0),
        total_cost: Array.from(laborByTeam.values()).reduce((sum, t) => sum + t.cost, 0),
        byTeam: Array.from(laborByTeam.values()).map(team => ({
          ...team,
          members: Array.from(membersByTeam.values())
            .filter(m => /* belongs to this team */)
            .map(m => ({
              member_id: m.member_id,
              member_name: m.member_name,       // ← Embedded!
              member_role: m.member_role,       // ← Embedded!
              hours: m.hours,
              cost: m.cost,
            })),
        })),
      },

      kpis: {
        labor_cost_percentage: (
          (Array.from(laborByTeam.values()).reduce((sum, t) => sum + t.cost, 0) /
            Array.from(revenueByProduct.values()).reduce((sum, p) => sum + p.revenue, 0)) *
          100
        ).toFixed(1),
      },
    };

    // Save to MongoDB
    await db.collection('v2_daily_ops_dashboard_aggregated').insertOne(dashboard);

    return dashboard;
  }
}
```

### Step 5: Query Usage (Zero Lookups!)

```typescript
// app/actions/daily-ops.ts
'use server'

export async function getDailyDashboard(date: string, locationId: string) {
  const dashboard = await db.collection('v2_daily_ops_dashboard_aggregated')
    .findOne({
      date,
      location_id: new ObjectId(locationId),
    });

  // dashboard.revenue.byTeam[0] looks like:
  // {
  //   team_id: ObjectId("..."),
  //   team_name: "Keuken",           ← Have it! No lookup needed!
  //   location_name: "Bar Bea",      ← Have it! No lookup needed!
  //   revenue: 3500
  // }

  return dashboard;
}

// Frontend - zero lookups!
```

---

## Schema Comparison

### Before (Lookups Needed)

```typescript
// Layer 3 had only IDs
byTeam: [
  {
    team_id: ObjectId,        // ← Only have ID
    revenue: 3500
    // Missing team_name! Need lookup!
  }
]

// Component must do:
const team = await loadTeam(team_id);  // ❌ Extra API call!
```

### After (Everything Embedded)

```typescript
// Layer 3 has IDs + NAMES
byTeam: [
  {
    team_id: ObjectId,
    team_name: "Keuken",       // ← Have name! No lookup!
    location_name: "Bar Bea",  // ← Have name! No lookup!
    revenue: 3500
    // All data embedded!
  }
]

// Component can render directly:
{team.team_name}               // ✅ No lookups!
```

---

## Performance Comparison

```
OLD APPROACH (Lookups):
Query → Get 50 records → For each record, lookup team → 50 API calls! ❌

NEW APPROACH (Embedded):
Query → Get 50 records → Render directly ✅

Load Time:
  Old: Query (50ms) + 50 lookups (2500ms) = 2550ms
  New: Query (50ms) = 50ms

50x FASTER! 🚀
```

---

## Key Principles

✅ **Master data loaded ONCE** (expensive, but only once)  
✅ **Names added during enrichment** (cheap O(1) cache lookups)  
✅ **Final document fully embedded** (zero lookups needed)  
✅ **Small document per record** (fast to process)  
✅ **Grouped at aggregation** (final document has pre-grouped data)  
✅ **Frontend renders instantly** (no extra API calls)  

This is the best of both worlds:
- Your approach: Final view optimized (no lookups, all names)
- My approach: Built from flat pieces (efficient aggregation)
