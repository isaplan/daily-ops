# Daily Ops Complete Architecture: Full Stack Plan

**Combining:** V2 Pattern + Unified Data Integration + API Support

---

## Part 1: The 3-Layer Architecture (Foundation)

### Layer 1: Raw Data Collections (Flat, One Doc Per Row)

**Data Sources:**
```
CSV Files (Eitje):
├─ eitje-werknemer-contract-v2.csv → Employee master data
├─ eitje-gewerkte-uren.csv → Labor transactions
└─ eitje-financien.csv → Daily labor summaries (for verification)

API Sources (Future):
├─ Eitje API → Hours, contracts, users
├─ Bork API → Sales transactions, product breakdown

Collections Created:
├─ test-eitje-hours
├─ test-eitje-contracts
├─ test-eitje-finance-summary
├─ test-bork-sales
├─ test-bork-product-mix
├─ test-bork-food-beverage
├─ test-bork-basis-rapport
└─ product-master (system generated from all sources)
```

**Key Principle:** Each collection stores one document per row/transaction—flat, no nesting, with raw API responses preserved.

---

### Layer 2: Enrichment + Validation (Transform + Verify)

**Services Created:**

#### 2a. Master Data Import Service
```typescript
// app/lib/services/data-sources/masterDataImportService.ts

Responsibilities:
├─ Parse CSV files (Eitje contracts, hours, finance)
├─ Parse API responses (Eitje API, Bork API)
├─ Map external IDs to Daily Work entities (Member, Team, Location)
├─ Store enriched records in raw collections
└─ Track import metadata (source, timestamp, record count)

Key Methods:
├─ syncEmployeeContractsFromCSV(csvData)
│  └─ Maps: CSV name → Member.name, uurloon → Member.hourly_rate
│
├─ syncLaborHoursFromCSV(csvData)
│  └─ Enriches: date, member_id, location_id, team_id, hours, cost
│
├─ syncFinancialSummaryFromCSV(csvData)
│  └─ Stores: location totals for CSV verification (hours, cost, revenue)
│
├─ syncFromEitjeAPI(date)
│  └─ Calls Eitje API → stores raw response in test-eitje-hours
│
└─ syncFromBorkAPI(date)
   └─ Calls Bork API → stores raw response in test-bork-sales, etc.
```

#### 2b. Data Validation Service
```typescript
// app/lib/services/enrichment/dataValidationService.ts

Responsibilities:
├─ Compare CSV totals vs raw records (data quality gate)
├─ Detect discrepancies (flag mismatches)
├─ Verify API responses are complete
└─ Generate validation reports

Key Methods:
├─ validateLaborTotals(date, location_id)
│  └─ CSV eitje-financien.csv (total hours/cost)
│     vs test-eitje-hours.sum (raw records sum)
│
├─ validateBorkTotals(date, location_id)
│  └─ Bork API total revenue
│     vs test-bork-sales.sum (raw transaction sum)
│
└─ generateValidationReport(date, location_id)
   └─ Summary: matched ✅, mismatched ⚠️, missing ❌
```

#### 2c. Daily Work Enrichment Service
```typescript
// app/lib/services/enrichment/dailyWorkEnrichmentService.ts

Responsibilities:
├─ Join raw data with Member, Team, Location entities
├─ Add role-based permissions
├─ Calculate member-level aggregates
└─ Build cross-reference lookups

Key Methods:
├─ enrichMemberFromEitjeCSV(member)
│  └─ Adds: total_hours_worked, total_labor_cost, hourly_rate
│
├─ enrichTeamWithMetrics(team)
│  └─ Adds: member_count, total_hours, total_cost
│
└─ enrichLocationWithMetrics(location)
   └─ Adds: team_count, member_count, revenue, labor_cost
```

---

### Layer 3: Aggregated Daily Documents (Ready for Dashboard)

**Collection:** `v2_daily_ops_dashboard_aggregated`

```typescript
interface DailyOpsDashboard {
  // Identity
  _id: ObjectId
  date: "2026-01-29"
  location_id: ObjectId
  location: {
    _id: ObjectId
    name: "Amsterdam"
    address: string
    city: string
  }
  
  // ═══════════════════════════════════════════════════════════════
  // REVENUE SECTION (from Bork sales + basis report)
  // ═══════════════════════════════════════════════════════════════
  revenue: {
    // Totals
    total: 5000,
    totalExVat: 4545,
    totalIncVat: 5000,
    vatAmount: 455,
    
    // By Product
    byProduct: [
      {
        productId: ObjectId
        productName: "Burger",
        productCode: "BUR-001",
        quantity: 45,
        revenue: 1200,
        revenueExVat: 1091,
        costOfGoodsSold: 450,
        margin: 0.625, // (1200-450)/1200
        profitability: "high",
      },
      { productName: "Beer", quantity: 80, revenue: 800, ... }
    ],
    
    // By Category
    byCategory: [
      { category: "Food", revenue: 3500, qty: 125 },
      { category: "Beverage", revenue: 1500, qty: 300 }
    ],
    
    // By Team (who served/prepared)
    byTeam: [
      {
        teamId: ObjectId
        teamName: "Kitchen",
        revenue: 3500,
        percentOfTotal: 70,
        staffCount: 3,
      },
      { teamName: "Service", revenue: 1500, staffCount: 2 }
    ],
    
    // Metrics
    averageTransactionValue: 50,
    transactionCount: 100,
    
    // Top performers
    bestCombination: {
      products: ["Burger", "Beer"],
      frequency: 45,
      totalRevenue: 1800,
      profitMargin: 0.42,
    },
    mostSoldProduct: { name: "Pizza", quantity: 60, revenue: 2100 },
    mostProfitableProduct: { name: "Burger", margin: 0.625, revenue: 1200 },
  }
  
  // ═══════════════════════════════════════════════════════════════
  // LABOR SECTION (from Eitje hours + contracts + CSV totals)
  // ═══════════════════════════════════════════════════════════════
  labor: {
    // Totals
    totalHours: 160,
    totalCost: 3200,
    totalStaff: 10,
    
    // Percentages & Ratios
    laborCostPercentage: (3200/5000)*100, // 64%
    revenuePerHour: 5000/160, // 31.25
    costPerHour: 3200/160, // 20
    
    // By Team
    byTeam: [
      {
        teamId: ObjectId
        teamName: "Kitchen",
        hours: 80,
        cost: 1600,
        costPercentage: 32,
        staffCount: 3,
        revenuePerHour: 43.75,
        productivity: "excellent",
        
        members: [
          {
            memberId: ObjectId
            memberName: "Chef John",
            role: "kitchen_staff",
            hours: 8,
            cost: 200,
            hourlyRate: 25,
            productivity: 437.5, // revenue/hours (if trackable per member)
            costPercentageOfRevenue: 4,
          }
        ]
      },
      { teamName: "Service", hours: 80, cost: 1600, ... }
    ],
    
    // By Member (individual performance)
    byMember: [
      {
        memberId: ObjectId
        memberName: "Chef John",
        team: "Kitchen",
        hours: 8,
        cost: 200,
        hourlyRate: 25,
        contractType: "uren contract",
        
        // Historical context from Daily Work
        roles: ["kitchen_staff", "manager"],
        permissions: ["view_team_data", "edit_schedules"],
      }
    ],
    
    // Aggregates
    averageHourlyRate: 20,
    mostProductiveTeam: "Kitchen",
    leastProductiveTeam: "Service",
    
    // CSV Verification
    csvVerification: {
      csvTotalHours: 160,
      csvTotalCost: 3200,
      rawDataTotalHours: 160,
      rawDataTotalCost: 3200,
      matches: true,
      lastVerified: "2026-01-29T23:00:00Z",
    }
  }
  
  // ═══════════════════════════════════════════════════════════════
  // PRODUCT ANALYSIS (from Bork basis report)
  // ═══════════════════════════════════════════════════════════════
  products: {
    // Rankings
    topSellers: [
      { name: "Pizza", quantity: 60, revenue: 2100, percentOfTotal: 42 }
    ],
    topProfitable: [
      { name: "Burger", margin: 0.625, revenue: 1200, cogs: 450 }
    ],
    
    // Product Details
    byProduct: [
      {
        productId: ObjectId
        productName: "Burger",
        productCode: "BUR-001",
        category: "Food",
        subcategory: "Main Course",
        
        quantity: 45,
        revenue: 1200,
        averagePrice: 26.67,
        
        costOfGoodsSold: 450,
        costPerUnit: 10,
        margin: 0.625,
        profitability: "high",
        
        // Trend (if historical data)
        quantityLastDay: 50,
        quantityTrend: "down",
      }
    ],
    
    // Combinations
    bestCombination: {
      products: ["Burger", "Beer"],
      frequency: 45,
      revenue: 1800,
      profitMargin: 0.42,
      recommendation: "Bundle these items",
    }
  }
  
  // ═══════════════════════════════════════════════════════════════
  // KPIs (Calculated from all above)
  // ═══════════════════════════════════════════════════════════════
  kpis: {
    // Financial
    revenue: 5000,
    laborCost: 3200,
    foodCost: 1400,
    grossProfit: 5000 - 3200 - 1400, // 400
    profitMargin: ((5000 - 3200 - 1400) / 5000) * 100, // 8%
    
    // Efficiency
    laborCostPercentage: 64,
    foodCostPercentage: 28,
    profitPercentage: 8,
    revenuePerHour: 31.25,
    revenuePerStaff: 500,
    
    // Productivity
    productivity: {
      perTeam: [
        { team: "Kitchen", revenuePerHour: 43.75 },
        { team: "Service", revenuePerHour: 18.75 }
      ],
      perMember: [
        { member: "Chef John", revenuePerHour: 437.5 }
      ],
      overallScore: 7.5, // Out of 10
    },
    
    // Volume
    transactions: 100,
    averageTicketSize: 50,
    staffCount: 10,
    
    // Health Scores
    health: {
      revenue: "green",     // ✅ On target
      laborCost: "yellow",  // ⚠️ 64% is high (target: 30-35%)
      foodCost: "green",    // ✅ 28% is good
      overall: "yellow",    // ⚠️ Watch labor costs
    },
    
    // Recommendations
    recommendations: [
      "Labor costs are 64% of revenue (target: 30-35%). Consider reducing hours or increasing pricing.",
      "Kitchen is outperforming Service. Consider analyzing service workflow.",
      "Burger+Beer combination is very popular (45x). Create bundle offer.",
    ]
  }
  
  // ═══════════════════════════════════════════════════════════════
  // SOURCE TRACKING (Data lineage & audit)
  // ═══════════════════════════════════════════════════════════════
  sources: {
    eitje: {
      type: "csv",
      hoursRecords: 40,
      contractRecords: 10,
      financeSummary: {
        totalHours: 160,
        totalCost: 3200,
        csvVerified: true,
      },
      lastSync: "2026-01-29T23:00:00Z",
      syncStatus: "success",
    },
    bork: {
      type: "api",
      salesRecords: 100,
      basisReportRecords: 30,
      totalRevenue: 5000,
      lastSync: "2026-01-29T22:30:00Z",
      syncStatus: "success",
    },
    validation: {
      eitjeVsCsv: { matches: true, variance: 0 },
      borkVsCsv: { matches: true, variance: 5 }, // Allow small variance
      lastValidated: "2026-01-29T23:05:00Z",
    }
  }
  
  // ═══════════════════════════════════════════════════════════════
  // METADATA
  // ═══════════════════════════════════════════════════════════════
  metadata: {
    createdAt: "2026-01-29T23:10:00Z",
    updatedAt: "2026-01-29T23:10:00Z",
    version: 1,
    dataQuality: "high",
  }
}
```

---

## Part 2: Service Layer Implementation

### Service 1: Master Data Import Service

```typescript
// app/lib/services/data-sources/masterDataImportService.ts

export class MasterDataImportService {
  constructor(
    private eitjeApiClient: EitjeApiClient,
    private borkApiClient: BorkApiClient,
  ) {}

  // ─────────────────────────────────────────────────────────────
  // CSV IMPORTS
  // ─────────────────────────────────────────────────────────────

  /**
   * Import employee contracts from eitje-werknemer-contract-v2.csv
   * Creates/updates Member records with external IDs
   */
  async syncEmployeeContractsFromCSV(csvData: string) {
    const records = parseCSV(csvData);
    const imported = [];
    const failed = [];

    for (const record of records) {
      try {
        // Find or create location
        const location = await Location.findOne({
          name: record['contractvestiging']
        });
        if (!location) throw new Error(`Location not found: ${record['contractvestiging']}`);

        // Parse hourly rate
        const hourlyRate = parseFloat(record['uurloon'].replace('€', '').replace(',', '.'));

        // Upsert member with external IDs
        const member = await Member.findOneAndUpdate(
          { email: record['e-mailadres'] },
          {
            name: record['naam'],
            email: record['e-mailadres'],
            hourly_rate: hourlyRate,
            external_ids: {
              eitje: {
                vloer_id: record['vloer ID'],
                nmbrs_id: record['Nmbrs ID'],
              }
            },
          },
          { upsert: true, new: true }
        );

        // Store contract details in raw collection
        await db.collection('test-eitje-contracts').updateOne(
          { member_id: member._id },
          {
            $set: {
              member_id: member._id,
              member_name: record['naam'],
              location_id: location._id,
              location_name: location.name,
              contract_type: record['contracttype'],
              hourly_rate: hourlyRate,
              weekly_hours: parseFloat(record['wekelijkse contracturen'] || '0'),
              monthly_hours: parseFloat(record['maandelijkse contracturen'] || '0'),
              total_worked_days: parseInt(record['* totaal gewerkte dagen'] || '0'),
              total_worked_hours: parseHours(record['* totaal gewerkte uren']),
              sick_hours: parseHours(record['* ziekteuren']),
              vacation_hours: parseHours(record['* bijzonder verlofuren']),
              external_ids: {
                vloer_id: record['vloer ID'],
                nmbrs_id: record['Nmbrs ID'],
              },
              birthday: record['verjaardag'],
              email: record['e-mailadres'],
              source: 'eitje-csv',
              imported_at: new Date(),
            }
          },
          { upsert: true }
        );

        imported.push({
          member_id: member._id,
          name: record['naam'],
        });
      } catch (error) {
        failed.push({
          row: record['naam'],
          error: error.message,
        });
      }
    }

    return {
      success: failed.length === 0,
      imported: imported.length,
      failed: failed.length,
      records: imported,
      errors: failed,
    };
  }

  /**
   * Import labor hours from eitje-gewerkte-uren.csv
   * Stores raw transactions with Daily Work cross-references
   */
  async syncLaborHoursFromCSV(csvData: string) {
    const records = parseCSV(csvData);
    const imported = [];
    const failed = [];

    for (const record of records) {
      try {
        // Lookup Daily Work entities
        const member = await Member.findOne({ name: record['naam'] });
        const location = await Location.findOne({ name: record['naam van vestiging'] });
        const team = await Team.findOne({
          name: record['team naam'],
          location_id: location?._id,
        });

        if (!member || !location || !team) {
          throw new Error(`Missing reference: member=${!!member}, location=${!!location}, team=${!!team}`);
        }

        // Parse values
        const hours = parseHours(record['uren']);
        const laborCost = parseFloat(record['gerealiseerde loonkosten'].replace('€', '').replace(',', '.'));
        const costPerHour = parseFloat(record['Loonkosten per uur'].replace('€', '').replace(',', '.'));
        const hourlyRate = parseFloat(record['uurloon'].replace('€', '').replace(',', '.'));

        // Insert into raw collection
        const result = await db.collection('test-eitje-hours').insertOne({
          date: new Date(record['datum']),
          member_id: member._id,
          member_name: record['naam'],
          location_id: location._id,
          location_name: record['naam van vestiging'],
          team_id: team._id,
          team_name: record['team naam'],
          hours,
          labor_cost: laborCost,
          cost_per_hour: costPerHour,
          hourly_rate: hourlyRate,
          contract_type: record['contracttype'],
          work_type: record['type'], // 'gewerkte uren', 'verlof', etc.
          support_id: record['support ID'],
          source: 'eitje-csv',
          imported_at: new Date(),
        });

        imported.push({
          date: record['datum'],
          member: record['naam'],
          hours: hours,
          cost: laborCost,
        });
      } catch (error) {
        failed.push({
          row: record['naam'],
          date: record['datum'],
          error: error.message,
        });
      }
    }

    return {
      success: failed.length === 0,
      imported: imported.length,
      failed: failed.length,
      records: imported,
      errors: failed,
    };
  }

  /**
   * Import financial summary from eitje-financien.csv
   * Stores for verification purposes (CSV totals for validation)
   */
  async syncFinancialSummaryFromCSV(csvData: string) {
    const records = parseCSV(csvData);
    const imported = [];
    const failed = [];

    for (const record of records) {
      try {
        const location = await Location.findOne({
          name: record['naam van vestiging']
        });
        if (!location) throw new Error(`Location not found: ${record['naam van vestiging']}`);

        const result = await db.collection('test-eitje-finance-summary').insertOne({
          date: new Date(record['datum']),
          location_id: location._id,
          location_name: record['naam van vestiging'],
          team_category: record['omzetgroep naam'],
          revenue: parseFloat(record['gerealiseerde omzet'].replace('€', '').replace(',', '.')),
          labor_cost: parseFloat(record['gerealiseerde loonkosten'].replace('€', '').replace(',', '.')),
          labor_cost_percentage: parseFloat(record['gerealiseerde loonkosten percentage'].replace('%', '')),
          hours_worked: parseHours(record['gewerkte uren']),
          productivity: parseFloat(record['gerealiseerde arbeidsproductiviteit'].replace('€', '').replace(',', '.')),
          support_id: record['support ID'],
          source: 'eitje-csv',
          imported_at: new Date(),
        });

        imported.push({
          date: record['datum'],
          location: record['naam van vestiging'],
          revenue: parseFloat(record['gerealiseerde omzet'].replace('€', '')),
        });
      } catch (error) {
        failed.push({
          row: record['datum'],
          location: record['naam van vestiging'],
          error: error.message,
        });
      }
    }

    return {
      success: failed.length === 0,
      imported: imported.length,
      failed: failed.length,
      records: imported,
      errors: failed,
    };
  }

  // ─────────────────────────────────────────────────────────────
  // API SYNCS
  // ─────────────────────────────────────────────────────────────

  /**
   * Sync hours from Eitje API
   */
  async syncFromEitjeAPI(date: string, location_id: string) {
    try {
      const location = await Location.findById(location_id);
      if (!location) throw new Error('Location not found');

      // Call Eitje API
      const eitjeResponse = await this.eitjeApiClient.getHoursByDate(date, location.name);

      // Transform and store
      const imported = [];
      for (const record of eitjeResponse.data) {
        const member = await Member.findOne({ name: record.employee_name });
        const team = await Team.findOne({
          name: record.team_name,
          location_id: location._id,
        });

        const doc = await db.collection('test-eitje-hours').insertOne({
          date: new Date(date),
          member_id: member?._id,
          member_name: record.employee_name,
          location_id: location._id,
          location_name: location.name,
          team_id: team?._id,
          team_name: record.team_name,
          hours: record.hours,
          labor_cost: record.labor_cost,
          cost_per_hour: record.cost_per_hour,
          hourly_rate: record.hourly_rate,
          contract_type: record.contract_type,
          raw_api_response: record, // Store original API response
          source: 'eitje-api',
          imported_at: new Date(),
        });
        imported.push(doc.insertedId);
      }

      return {
        success: true,
        imported: imported.length,
        date,
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
        date,
      };
    }
  }

  /**
   * Sync sales from Bork API
   */
  async syncFromBorkAPI(date: string, location_id: string) {
    try {
      const location = await Location.findById(location_id);
      if (!location) throw new Error('Location not found');

      // Call Bork API
      const borkResponse = await this.borkApiClient.getSalesByDate(date, location.name);

      // Transform and store
      const imported = [];
      for (const transaction of borkResponse.transactions) {
        for (const item of transaction.items) {
          const doc = await db.collection('test-bork-sales').insertOne({
            date: new Date(date),
            location_id: location._id,
            location_name: location.name,
            transaction_id: transaction.id,
            product_name: item.name,
            product_code: item.code,
            quantity: item.quantity,
            revenue: item.price_inc_vat,
            revenue_ex_vat: item.price_ex_vat,
            vat_amount: item.vat,
            cost_of_goods: item.cogs,
            raw_api_response: item,
            source: 'bork-api',
            imported_at: new Date(),
          });
          imported.push(doc.insertedId);
        }
      }

      return {
        success: true,
        imported: imported.length,
        date,
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
        date,
      };
    }
  }
}
```

### Service 2: Data Validation Service

```typescript
// app/lib/services/enrichment/dataValidationService.ts

export class DataValidationService {
  /**
   * Validate that CSV labor totals match raw records sum
   */
  async validateLaborTotals(date: string, location_id: string) {
    // Get CSV summary from eitje-financien
    const csvSummary = await db.collection('test-eitje-finance-summary')
      .findOne({ date: new Date(date), location_id });

    // Get raw records from test-eitje-hours
    const rawRecords = await db.collection('test-eitje-hours')
      .find({ date: new Date(date), location_id })
      .toArray();

    // Calculate sums
    const rawSum = {
      total_hours: rawRecords.reduce((sum, r) => sum + r.hours, 0),
      total_cost: rawRecords.reduce((sum, r) => sum + r.labor_cost, 0),
      record_count: rawRecords.length,
    };

    // Compare
    const matches = {
      hours: Math.abs(csvSummary.hours_worked - rawSum.total_hours) < 0.01,
      cost: Math.abs(csvSummary.labor_cost - rawSum.total_cost) < 0.01,
    };

    return {
      csv: {
        hours: csvSummary.hours_worked,
        cost: csvSummary.labor_cost,
        revenue: csvSummary.revenue,
      },
      raw: rawSum,
      validation: {
        hours_match: matches.hours,
        cost_match: matches.cost,
        all_match: matches.hours && matches.cost,
        status: matches.hours && matches.cost ? 'PASS' : 'FAIL',
      },
      variance: {
        hours_diff: csvSummary.hours_worked - rawSum.total_hours,
        cost_diff: csvSummary.labor_cost - rawSum.total_cost,
      },
    };
  }

  /**
   * Validate Bork sales totals
   */
  async validateBorkTotals(date: string, location_id: string) {
    // Get Bork sales sum
    const borkSales = await db.collection('test-bork-sales')
      .find({ date: new Date(date), location_id })
      .toArray();

    const borkSum = borkSales.reduce((sum, r) => sum + r.revenue, 0);

    // Compare with Eitje finance (if available)
    const eitjeFinance = await db.collection('test-eitje-finance-summary')
      .findOne({ date: new Date(date), location_id });

    return {
      bork: {
        revenue: borkSum,
        transaction_count: borkSales.length,
      },
      eitje_csv: {
        revenue: eitjeFinance?.revenue,
      },
      validation: {
        matches: Math.abs(borkSum - eitjeFinance?.revenue) < 1, // Allow 1€ variance
        status: Math.abs(borkSum - eitjeFinance?.revenue) < 1 ? 'PASS' : 'FAIL',
      },
      variance: borkSum - eitjeFinance?.revenue,
    };
  }

  /**
   * Generate full validation report for a day
   */
  async generateValidationReport(date: string, location_id: string) {
    const laborValidation = await this.validateLaborTotals(date, location_id);
    const borkValidation = await this.validateBorkTotals(date, location_id);

    const allPassed = laborValidation.validation.all_match && borkValidation.validation.matches;

    return {
      date,
      location_id,
      summary: {
        labor: laborValidation.validation.status,
        sales: borkValidation.validation.status,
        overall: allPassed ? 'PASS' : 'FAIL',
      },
      details: {
        labor: laborValidation,
        sales: borkValidation,
      },
      recommendations: [
        ...(!laborValidation.validation.all_match ? [
          `Labor discrepancy detected: ${laborValidation.variance.hours_diff.toFixed(2)} hours, €${laborValidation.variance.cost_diff.toFixed(2)}`
        ] : []),
        ...(!borkValidation.validation.matches ? [
          `Sales discrepancy detected: €${borkValidation.variance.toFixed(2)}`
        ] : []),
      ],
    };
  }
}
```

### Service 3: Aggregation Service

```typescript
// app/lib/services/aggregation/dailyOpsAggregationService.ts

export class DailyOpsAggregationService {
  constructor(
    private validationService: DataValidationService,
  ) {}

  /**
   * Build complete Daily Ops Dashboard aggregation
   */
  async buildDailyAggregation(date: string, location_id: string) {
    // 1. Validate data first
    const validation = await this.validationService.generateValidationReport(date, location_id);
    if (validation.summary.overall === 'FAIL') {
      console.warn(`⚠️ Validation failed for ${date}, ${location_id}. Proceeding anyway.`);
    }

    // 2. Fetch all raw data
    const [eitjeHours, borkSales, borkBasis, location] = await Promise.all([
      db.collection('test-eitje-hours')
        .find({ date: new Date(date), location_id })
        .toArray(),
      db.collection('test-bork-sales')
        .find({ date: new Date(date), location_id })
        .toArray(),
      db.collection('test-bork-basis-rapport')
        .find({ date: new Date(date), location_id })
        .toArray(),
      Location.findById(location_id).lean(),
    ]);

    // 3. ENRICH with Daily Work entities
    const enrichedHours = await Promise.all(
      eitjeHours.map(async (hour) => ({
        ...hour,
        member: await Member.findById(hour.member_id).lean(),
        team: await Team.findById(hour.team_id).lean(),
      }))
    );

    // 4. Calculate REVENUE metrics
    const revenue = this.calculateRevenue(borkSales);

    // 5. Calculate LABOR metrics
    const labor = this.calculateLabor(enrichedHours);

    // 6. Calculate PRODUCTS metrics
    const products = this.analyzeProducts(borkBasis);

    // 7. Calculate KPIs
    const kpis = this.calculateKPIs(revenue, labor, products);

    // 8. Build aggregated document
    const dashboard = new DailyOpsDashboard({
      date: new Date(date),
      location_id,
      location,
      revenue,
      labor,
      products,
      kpis,
      sources: {
        eitje: {
          hoursRecords: eitjeHours.length,
          csvVerified: validation.summary.labor === 'PASS',
        },
        bork: {
          salesRecords: borkSales.length,
          basisReportRecords: borkBasis.length,
          csvVerified: validation.summary.sales === 'PASS',
        },
        validation: validation.summary,
      },
    });

    await dashboard.save();
    return dashboard;
  }

  // ─────────────────────────────────────────────────────────────
  // Calculation Methods
  // ─────────────────────────────────────────────────────────────

  private calculateRevenue(sales: any[]) {
    // Group by product, category, team
    // Calculate totals, margins, recommendations
    // ...
  }

  private calculateLabor(enrichedHours: any[]) {
    // Group by team, member
    // Calculate costs, productivity, trends
    // ...
  }

  private analyzeProducts(basisReport: any[]) {
    // Find best combinations, rankings
    // Calculate margins, profitability
    // ...
  }

  private calculateKPIs(revenue: any, labor: any, products: any) {
    // Derive health scores, recommendations
    // ...
  }
}
```

---

## Part 3: Data Flow Pipeline

### Complete Data Pipeline

```
┌──────────────────────────────────────────────────────────────────┐
│ DATA INPUT SOURCES                                               │
├──────────────────────────────────────────────────────────────────┤
│                                                                  │
│  CSV Files (Eitje):                                             │
│  ├─ eitje-werknemer-contract-v2.csv                             │
│  ├─ eitje-gewerkte-uren.csv                                     │
│  └─ eitje-financien.csv                                         │
│                                                                  │
│  API Sources (Future):                                          │
│  ├─ Eitje API → Hours, Contracts                                │
│  └─ Bork API → Sales, Products                                  │
│                                                                  │
└──────────────┬───────────────────────────────────────────────────┘
               │
               ▼
┌──────────────────────────────────────────────────────────────────┐
│ LAYER 1: MASTER DATA IMPORT                                      │
│ (MasterDataImportService)                                        │
├──────────────────────────────────────────────────────────────────┤
│                                                                  │
│ 1. Parse CSV or API data                                        │
│ 2. Lookup Daily Work entities (Member, Team, Location)          │
│ 3. Enrich raw data with IDs                                     │
│ 4. Store in test-eitje-* and test-bork-* collections            │
│ 5. Track import metadata                                        │
│                                                                  │
│ Output Collections:                                             │
│ ├─ test-eitje-hours                (40 records)                 │
│ ├─ test-eitje-contracts            (10 records)                 │
│ ├─ test-eitje-finance-summary      (3 records per location)     │
│ ├─ test-bork-sales                 (100 records)                │
│ ├─ test-bork-basis-rapport         (30 records)                 │
│ └─ product-master                  (generated)                  │
│                                                                  │
└──────────────┬───────────────────────────────────────────────────┘
               │
               ▼
┌──────────────────────────────────────────────────────────────────┐
│ LAYER 2a: DATA VALIDATION                                        │
│ (DataValidationService)                                          │
├──────────────────────────────────────────────────────────────────┤
│                                                                  │
│ 1. Compare CSV totals vs raw records                            │
│    - Eitje-financien.csv total hours    vs test-eitje-hours sum │
│    - Eitje-financien.csv total cost     vs test-eitje-hours sum │
│    - Bork total revenue                 vs test-bork-sales sum  │
│                                                                  │
│ 2. Detect discrepancies                                         │
│    - Flag mismatches (PASS / FAIL)                              │
│    - Generate variance report                                   │
│                                                                  │
│ 3. Store validation results                                     │
│    - Allow dashboard to display confidence level                │
│                                                                  │
│ Output: Validation Report                                       │
│ {                                                               │
│   labor: { csv_hours, raw_hours, match: true/false }           │
│   sales: { csv_revenue, raw_revenue, match: true/false }       │
│   overall: "PASS" / "FAIL"                                      │
│ }                                                               │
│                                                                  │
└──────────────┬───────────────────────────────────────────────────┘
               │
               ▼
┌──────────────────────────────────────────────────────────────────┐
│ LAYER 2b: DAILY WORK ENRICHMENT                                  │
│ (DailyWorkEnrichmentService)                                     │
├──────────────────────────────────────────────────────────────────┤
│                                                                  │
│ 1. Join raw records with Daily Work entities                    │
│    - Each labor record gets member object (name, role, etc.)    │
│    - Each sales record gets product object (cogs, margin, etc.) │
│    - Each record gets location context                          │
│                                                                  │
│ 2. Enrich with Daily Work metadata                              │
│    - Add member roles & permissions                             │
│    - Add team descriptions                                      │
│    - Add location addresses                                     │
│                                                                  │
│ 3. Calculate member/team aggregates                             │
│    - Total hours per member                                     │
│    - Total hours per team                                       │
│    - Cost per team                                              │
│                                                                  │
│ Output: Enriched Records (in memory)                            │
│ ├─ Labor records with member & team context                     │
│ ├─ Sales records with product & team context                    │
│ └─ All grouped by location                                      │
│                                                                  │
└──────────────┬───────────────────────────────────────────────────┘
               │
               ▼
┌──────────────────────────────────────────────────────────────────┐
│ LAYER 3: AGGREGATION & CALCULATION                               │
│ (DailyOpsAggregationService)                                     │
├──────────────────────────────────────────────────────────────────┤
│                                                                  │
│ 1. Calculate REVENUE Metrics                                    │
│    ├─ By product: quantity, revenue, margin                     │
│    ├─ By category: food, beverage totals                        │
│    ├─ By team: which team generated revenue                     │
│    └─ Best combinations: products often sold together           │
│                                                                  │
│ 2. Calculate LABOR Metrics                                      │
│    ├─ By team: hours, cost, productivity                        │
│    ├─ By member: hours, cost, rate, productivity                │
│    ├─ Percentages: labor% of revenue                            │
│    └─ Productivity: revenue per hour                            │
│                                                                  │
│ 3. Analyze PRODUCTS                                             │
│    ├─ Top sellers: quantity sold                                │
│    ├─ Most profitable: margin %                                 │
│    └─ Best combinations: frequently paired products             │
│                                                                  │
│ 4. Calculate KPIs                                               │
│    ├─ Financial: revenue, costs, profit, margins                │
│    ├─ Efficiency: cost percentages, revenue/hour                │
│    ├─ Health scores: green/yellow/red per metric                │
│    └─ Recommendations: actionable insights                      │
│                                                                  │
│ Output: Single Aggregated Document                              │
│ v2_daily_ops_dashboard_aggregated {                             │
│   date, location_id,                                            │
│   revenue { ... },                                              │
│   labor { ... },                                                │
│   products { ... },                                             │
│   kpis { ... },                                                 │
│   sources { ... }                                               │
│ }                                                               │
│                                                                  │
└──────────────┬───────────────────────────────────────────────────┘
               │
               ▼
┌──────────────────────────────────────────────────────────────────┐
│ DAILY OPS DASHBOARD (Query Layer)                                │
├──────────────────────────────────────────────────────────────────┤
│                                                                  │
│ Query v2_daily_ops_dashboard_aggregated for a single date/loc  │
│                                                                  │
│ Returns ALL metrics in one query:                               │
│ - Revenue breakdown (by product, category, team)                │
│ - Labor metrics (by team, member)                               │
│ - Product analysis (top sellers, most profitable)               │
│ - KPIs (health scores, recommendations)                         │
│ - Data quality (validation status)                              │
│                                                                  │
│ ✅ 1 database query = complete dashboard                        │
│                                                                  │
└──────────────┬───────────────────────────────────────────────────┘
               │
               ▼
┌──────────────────────────────────────────────────────────────────┐
│ UI COMPONENTS (React Pages)                                      │
├──────────────────────────────────────────────────────────────────┤
│                                                                  │
│ /daily-ops                                                      │
│ ├─ Revenue Card                                                 │
│ │  ├─ Total: €5,000                                             │
│ │  ├─ By Product: Pizza €2,100, Burger €1,200, ...             │
│ │  └─ By Team: Kitchen €3,500, Service €1,500                  │
│ │                                                              │
│ ├─ Labor Card                                                  │
│ │  ├─ Total: €3,200 (64% of revenue)                           │
│ │  ├─ By Team: Kitchen €1,600/80h, Service €1,600/80h          │
│ │  └─ By Member: Chef John 8h @ €25/h, ...                    │
│ │                                                              │
│ ├─ Products Card                                               │
│ │  ├─ Top Sellers: Pizza (60x), Burger (45x)                   │
│ │  ├─ Most Profitable: Burger (62.5% margin)                   │
│ │  └─ Best Combination: Burger + Beer (45x)                    │
│ │                                                              │
│ ├─ KPI Grid                                                    │
│ │  ├─ Labor Cost %: 64% ⚠️ (high - target 30-35%)              │
│ │  ├─ Food Cost %: 28% ✅ (good)                               │
│ │  ├─ Profit: 8% ✅ (healthy)                                  │
│ │  └─ Revenue/Hour: €31.25 ✅ (on target)                      │
│ │                                                              │
│ └─ Validation Status                                           │
│    └─ ✅ Data verified against Eitje CSV                        │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘
```

---

## Part 4: Cron Job & Integration

### Daily Aggregation Cron

```typescript
// app/api/cron/daily-aggregation/route.ts

export async function POST(req: Request) {
  try {
    // Yesterday's date
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const dateStr = yesterday.toISOString().split('T')[0];

    // Get all active locations
    const locations = await Location.find({ is_active: true }).lean();

    // Build aggregation for each location
    const results = await Promise.all(
      locations.map(loc =>
        dailyOpsAggregationService.buildDailyAggregation(
          dateStr,
          loc._id.toString()
        ).catch(err => ({
          location_id: loc._id,
          error: err.message,
          success: false,
        }))
      )
    );

    const successful = results.filter(r => r.success !== false).length;
    const failed = results.filter(r => r.success === false).length;

    // Notify dashboard (WebSocket or email)
    if (failed > 0) {
      await notificationService.alertAdmins(
        `Daily aggregation completed with ${failed} failures`,
        results.filter(r => r.error)
      );
    }

    return Response.json({
      success: true,
      date: dateStr,
      locations_processed: successful,
      locations_failed: failed,
      timestamp: new Date(),
    });
  } catch (error) {
    console.error('[daily-aggregation] Error:', error);
    return Response.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
```

### CSV Upload Endpoint

```typescript
// app/api/data/import/eitje-csv/route.ts

export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    const file = formData.get('file') as File;
    const type = formData.get('type') as string; // 'contracts', 'hours', 'finance'

    const csvText = await file.text();

    let result;
    switch (type) {
      case 'contracts':
        result = await masterDataImportService.syncEmployeeContractsFromCSV(csvText);
        break;
      case 'hours':
        result = await masterDataImportService.syncLaborHoursFromCSV(csvText);
        break;
      case 'finance':
        result = await masterDataImportService.syncFinancialSummaryFromCSV(csvText);
        break;
      default:
        throw new Error(`Unknown type: ${type}`);
    }

    // Validate if finance data
    if (type === 'finance') {
      const validation = await dataValidationService.generateValidationReport(
        new Date().toISOString().split('T')[0],
        null // Check all locations
      );

      return Response.json({
        ...result,
        validation: validation.summary,
      });
    }

    return Response.json(result);
  } catch (error) {
    return Response.json(
      { success: false, error: error.message },
      { status: 400 }
    );
  }
}
```

---

## Part 5: Server Actions & Components

### Server Actions

```typescript
// app/actions/daily-ops.ts
'use server'

import { dailyOpsDataService } from '@/lib/services/dashboard/dailyOpsDataService';

export async function getDailyDashboard(date: string, locationId: string) {
  try {
    const dashboard = await dailyOpsDataService.getDailyDashboard(date, locationId);
    if (!dashboard) {
      return { error: 'No data available for this date/location' };
    }
    return { data: dashboard };
  } catch (error) {
    return { error: error.message };
  }
}

export async function getRevenueBreakdown(date: string, locationId: string) {
  try {
    const dashboard = await getDailyDashboard(date, locationId);
    return dashboard.data?.revenue;
  } catch (error) {
    return { error: error.message };
  }
}

export async function getLaborMetrics(date: string, locationId: string) {
  try {
    const dashboard = await getDailyDashboard(date, locationId);
    return dashboard.data?.labor;
  } catch (error) {
    return { error: error.message };
  }
}

export async function getProductAnalysis(date: string, locationId: string) {
  try {
    const dashboard = await getDailyDashboard(date, locationId);
    return dashboard.data?.products;
  } catch (error) {
    return { error: error.message };
  }
}

export async function getKPIs(date: string, locationId: string) {
  try {
    const dashboard = await getDailyDashboard(date, locationId);
    return dashboard.data?.kpis;
  } catch (error) {
    return { error: error.message };
  }
}
```

### Component Usage

```typescript
// app/daily-ops/page.tsx
'use client'

import { useQuery } from '@tanstack/react-query';
import { getDailyDashboard } from '@/actions/daily-ops';
import { RevenueCard } from '@/components/dashboard/RevenueCard';
import { LaborCard } from '@/components/dashboard/LaborCard';
import { ProductsCard } from '@/components/dashboard/ProductsCard';
import { KPIGrid } from '@/components/dashboard/KPIGrid';

export default function DailyOpsPage() {
  const { data, isLoading } = useQuery({
    queryKey: ['dailyDashboard', '2026-01-29', 'amsterdam'],
    queryFn: () => getDailyDashboard('2026-01-29', 'amsterdam'),
  });

  if (isLoading) return <div>Loading dashboard...</div>;
  if (data?.error) return <div>Error: {data.error}</div>;

  const dashboard = data?.data;

  return (
    <div className="p-6 space-y-6">
      <div className="grid grid-cols-3 gap-6">
        <RevenueCard revenue={dashboard.revenue} />
        <LaborCard labor={dashboard.labor} />
        <ProductsCard products={dashboard.products} />
      </div>
      <KPIGrid kpis={dashboard.kpis} />
      <ValidationStatus sources={dashboard.sources} />
    </div>
  );
}
```

---

## Part 6: Implementation Timeline

### Week 1: Foundation
- [ ] Create test collections (test-eitje-*, test-bork-*)
- [ ] Build MasterDataImportService
- [ ] Parse CSV files & import contracts, hours, finance
- [ ] Add External IDs to Member model
- [ ] Test: Verify 150 records imported correctly

### Week 2: Validation & Enrichment
- [ ] Build DataValidationService
- [ ] Compare CSV totals vs raw records
- [ ] Build DailyWorkEnrichmentService
- [ ] Enrich raw records with member/team/location context
- [ ] Test: Validate data quality ✅

### Week 3: Aggregation
- [ ] Build DailyOpsDashboardAggregated model
- [ ] Implement DailyOpsAggregationService
- [ ] Calculate revenue, labor, products, KPIs
- [ ] Set up daily cron job (11 PM)
- [ ] Test: Run aggregation for 1 day

### Week 4: Dashboard
- [ ] Build server actions
- [ ] Create React components
- [ ] Wire dashboard pages
- [ ] Add filters (date range, location, team)
- [ ] Add drill-down drill-down capabilities
- [ ] Test: E2E dashboard functionality

### Week 5: API Integration & Polish
- [ ] Add Eitje API sync (optional, Phase 2)
- [ ] Add Bork API sync (optional, Phase 2)
- [ ] Add export to CSV/PDF
- [ ] Add role-based access control
- [ ] Performance tuning & indexing
- [ ] Deploy to production

---

## Summary: Complete Data Flow

```
CSV/API Data
   ↓
Import Service (enrich with Daily Work IDs)
   ↓
Raw Collections (test-eitje-*, test-bork-*)
   ↓
Validation Service (verify CSV totals)
   ↓
Enrichment Service (add member/team/location context)
   ↓
Aggregation Service (calculate metrics)
   ↓
Aggregated Collection (v2_daily_ops_dashboard_aggregated)
   ↓
Query Layer (getDailyDashboard)
   ↓
Server Actions (getDailyDashboard, getRevenueBreakdown, etc.)
   ↓
React Components (RevenueCard, LaborCard, KPIGrid)
   ↓
Daily Ops Dashboard 🎯
```

**Key Benefits:**
✅ Single query loads entire dashboard  
✅ CSV verification built-in  
✅ Rich context (member, team, location)  
✅ Drill-down capabilities  
✅ Ready for API data (Eitje, Bork)  
✅ Audit trail (source tracking)  
✅ Role-based access (via Daily Work)
