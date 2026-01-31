# API vs CSV Data: Unified Storage Strategy

## The Problem: Different Data Formats

### CSV Data Structure
```
File: eitje-gewerkte-uren.csv
┌─────────────────────────────────────────────────────────┐
│ datum, naam, vestiging, team, type, uren, kosten, ... │
├─────────────────────────────────────────────────────────┤
│ 01/01/2026, André Rozhok, Bar Bea, Bediening, ... │
│ 01/01/2026, Koen Van Den Bos, Bar Bea, Bediening, ... │
│ 02/01/2026, Sophie Van Eijk, L'amour Toujours, Mgmt, ... │
└─────────────────────────────────────────────────────────┘

Format: Flat rows (easy to parse), ~600 rows per month
Structure: Name, Location, Team, Hours, Cost (columns)
```

### API Data Structure (Eitje Example)
```typescript
// Eitje API Response
GET /time_registration_shifts?date=2026-01-29

{
  "data": [
    {
      "id": "12345",
      "employee": {
        "id": "emp-001",
        "name": "André Rozhok",
        "email": "andrerozhok@gmail.com"
      },
      "shift": {
        "date": "2026-01-29",
        "startTime": "10:00",
        "endTime": "18:00",
        "duration": 8,  // hours
        "breakTime": 0.5
      },
      "location": {
        "id": "loc-001",
        "name": "Bar Bea",
        "costCenter": "BC-001"
      },
      "team": {
        "id": "team-001",
        "name": "Bediening"
      },
      "labor": {
        "hourlyRate": 16.36,
        "totalCost": 130.88,
        "costPerHour": 16.36
      },
      "status": "approved",
      "notes": ""
    }
  ],
  "meta": {
    "total": 150,
    "page": 1,
    "perPage": 100
  }
}
```

Format: Nested JSON (hierarchical), 100-200 per page with pagination
Structure: Objects with relationships (employee, shift, location, team, labor)

---

## The Solution: Normalized Storage Layer

### Key Insight: **Normalize Before Storing**

Both CSV and API data get transformed to the **same flat structure** before storage:

```typescript
// BOTH CSV and API transform to this unified structure
interface UnifiedLaborRecord {
  _id: ObjectId
  
  // Identity
  date: Date                    // '2026-01-29'
  member_id: ObjectId          // Link to Member in Daily Work
  location_id: ObjectId        // Link to Location
  team_id: ObjectId            // Link to Team
  
  // Denormalized for speed (avoids lookups)
  member_name: string          // 'André Rozhok'
  location_name: string        // 'Bar Bea'
  team_name: string            // 'Bediening'
  
  // Labor data
  hours: number                // 8.0
  labor_cost: number           // 130.88
  cost_per_hour: number        // 16.36
  hourly_rate: number          // 16.36
  contract_type: string        // 'uren contract'
  work_type: string            // 'gewerkte uren', 'verlof', etc.
  
  // Source tracking
  source: 'eitje-csv' | 'eitje-api'
  external_id?: string         // API ID: '12345'
  support_id?: string          // CSV support ID
  
  // Raw data preservation
  raw_csv?: Record<string, any>     // Original CSV row
  raw_api?: Record<string, any>     // Original API response
  
  // Metadata
  imported_at: Date
  updated_at: Date
}
```

---

## Data Transformation: CSV → Unified Format

### CSV Input
```csv
01/01/2026,André Rozhok,Bar Bea,Bediening,gewerkte uren,04:00,€89,€22,25,uren contract,€16,36,24586933
```

### Transformation Process
```typescript
// Step 1: Parse CSV row
const csvRow = {
  datum: '01/01/2026',
  naam: 'André Rozhok',
  vestiging: 'Bar Bea',
  team: 'Bediening',
  uren: '04:00',
  kosten: '€89',
  // ...
};

// Step 2: Lookup Daily Work entities
const member = await Member.findOne({ name: 'André Rozhok' });
const location = await Location.findOne({ name: 'Bar Bea' });
const team = await Team.findOne({ name: 'Bediening', location_id: location._id });

// Step 3: Transform to unified format
const unifiedRecord = {
  date: new Date('2026-01-01'),
  member_id: member._id,
  location_id: location._id,
  team_id: team._id,
  
  member_name: 'André Rozhok',
  location_name: 'Bar Bea',
  team_name: 'Bediening',
  
  hours: 4.0,  // parseHours('04:00')
  labor_cost: 89,  // parseFloat('€89')
  cost_per_hour: 22.25,  // parseFloat('€22,25')
  hourly_rate: 16.36,
  contract_type: 'uren contract',
  work_type: 'gewerkte uren',
  
  source: 'eitje-csv',
  support_id: '24586933',
  raw_csv: csvRow,
  
  imported_at: new Date(),
};

// Step 4: Store in test-eitje-hours
await db.collection('test-eitje-hours').insertOne(unifiedRecord);
```

---

## Data Transformation: API → Unified Format

### API Input
```json
{
  "id": "12345",
  "employee": { "id": "emp-001", "name": "André Rozhok" },
  "shift": { "date": "2026-01-01", "duration": 4 },
  "location": { "id": "loc-001", "name": "Bar Bea", "costCenter": "BC-001" },
  "team": { "id": "team-001", "name": "Bediening" },
  "labor": { "hourlyRate": 16.36, "totalCost": 130.88 }
}
```

### Transformation Process
```typescript
// Step 1: Extract from nested API response
const apiData = response.data[0]; // One shift

// Step 2: Lookup Daily Work entities (same as CSV!)
const member = await Member.findOne({ name: apiData.employee.name });
const location = await Location.findOne({ name: apiData.location.name });
const team = await Team.findOne({ name: apiData.team.name, location_id: location._id });

// Step 3: Transform to SAME unified format
const unifiedRecord = {
  date: new Date(apiData.shift.date),
  member_id: member._id,
  location_id: location._id,
  team_id: team._id,
  
  member_name: apiData.employee.name,
  location_name: apiData.location.name,
  team_name: apiData.team.name,
  
  hours: apiData.shift.duration,  // Already a number
  labor_cost: apiData.labor.totalCost,  // Already a number
  cost_per_hour: apiData.labor.hourlyRate,
  hourly_rate: apiData.labor.hourlyRate,
  contract_type: 'uren contract',  // From member profile
  work_type: 'gewerkte uren',  // From shift status
  
  source: 'eitje-api',
  external_id: apiData.id,  // API ID instead of support_id
  raw_api: apiData,
  
  imported_at: new Date(),
};

// Step 4: Store in test-eitje-hours (SAME collection!)
await db.collection('test-eitje-hours').insertOne(unifiedRecord);
```

---

## The Beautiful Part: Query is Identical

### Query ANY data (CSV or API, doesn't matter!)

```typescript
// Get all labor for 2026-01-01 at Bar Bea
const records = await db.collection('test-eitje-hours')
  .find({
    date: new Date('2026-01-01'),
    location_id: baBeaLocationId,
  })
  .toArray();

// records includes:
// ✅ André Rozhok (from CSV)
// ✅ Sophie Van Eijk (from API)
// ✅ Casper Schul (from API)
// Both stored in same format, same collection!

// Total hours today:
const totalHours = records.reduce((sum, r) => sum + r.hours, 0);

// Revenue per hour:
const revenuePerHour = totalRevenue / totalHours;

// Best performers:
const ranking = records
  .sort((a, b) => (b.hours * b.cost_per_hour) - (a.hours * a.cost_per_hour))
  .slice(0, 5);
```

---

## Implementation: The Unified Import Service

```typescript
// app/lib/services/data-sources/unifiedImportService.ts

export class UnifiedImportService {
  
  // ─────────────────────────────────────────────────────────────
  // CSV IMPORT (Normalize & Store)
  // ─────────────────────────────────────────────────────────────
  
  async importFromEitjeCSV(csvText: string, fileType: 'hours' | 'contracts' | 'finance') {
    const rows = parseCSV(csvText);
    const results = [];
    
    for (const row of rows) {
      // Lookup Daily Work entities
      const member = await Member.findOne({ name: row.naam });
      const location = await Location.findOne({ name: row.vestiging });
      const team = await Team.findOne({ 
        name: row.team, 
        location_id: location?._id 
      });
      
      // Normalize to unified format
      const normalized = {
        date: new Date(row.datum),
        member_id: member?._id,
        location_id: location?._id,
        team_id: team?._id,
        
        member_name: row.naam,
        location_name: row.vestiging,
        team_name: row.team,
        
        hours: this.parseHours(row.uren),
        labor_cost: this.parseCurrency(row.kosten),
        cost_per_hour: this.parseCurrency(row.kostenperhour),
        hourly_rate: this.parseCurrency(row.uurloon),
        contract_type: row.contracttype,
        work_type: row.type,
        
        source: 'eitje-csv' as const,
        support_id: row['support ID'],
        raw_csv: row,  // Preserve original
        
        imported_at: new Date(),
      };
      
      // Store in unified collection
      const result = await db.collection('test-eitje-hours').insertOne(normalized);
      results.push(result.insertedId);
    }
    
    return { success: true, imported: results.length, records: results };
  }
  
  // ─────────────────────────────────────────────────────────────
  // API IMPORT (Normalize & Store to SAME Collection!)
  // ─────────────────────────────────────────────────────────────
  
  async importFromEitjeAPI(
    startDate: string,
    endDate: string,
    location_id: string
  ) {
    const location = await Location.findById(location_id);
    
    // Call Eitje API
    const apiResponse = await this.eitjeApiClient.getHoursByDateRange(
      startDate,
      endDate,
      location.name
    );
    
    const results = [];
    
    for (const shift of apiResponse.data) {
      // Lookup Daily Work entities (same as CSV!)
      const member = await Member.findOne({ name: shift.employee.name });
      const team = await Team.findOne({ 
        name: shift.team.name,
        location_id: location._id
      });
      
      // Normalize to SAME unified format
      const normalized = {
        date: new Date(shift.shift.date),
        member_id: member?._id,
        location_id: location._id,
        team_id: team?._id,
        
        member_name: shift.employee.name,
        location_name: location.name,
        team_name: shift.team.name,
        
        hours: shift.shift.duration,
        labor_cost: shift.labor.totalCost,
        cost_per_hour: shift.labor.hourlyRate,
        hourly_rate: shift.labor.hourlyRate,
        contract_type: 'uren contract',  // From member
        work_type: shift.status,
        
        source: 'eitje-api' as const,
        external_id: shift.id,  // API ID
        raw_api: shift,  // Preserve original
        
        imported_at: new Date(),
      };
      
      // Store in SAME collection!
      const result = await db.collection('test-eitje-hours').insertOne(normalized);
      results.push(result.insertedId);
    }
    
    return { success: true, imported: results.length, records: results };
  }
  
  // ─────────────────────────────────────────────────────────────
  // HELPER: Check if data already exists (avoid duplicates)
  // ─────────────────────────────────────────────────────────────
  
  async isDuplicate(
    date: Date,
    member_id: ObjectId,
    location_id: ObjectId,
    hours: number,
    source: 'eitje-csv' | 'eitje-api'
  ): Promise<boolean> {
    const existing = await db.collection('test-eitje-hours').findOne({
      date,
      member_id,
      location_id,
      hours,
      source,
    });
    
    return !!existing;
  }
  
  // ─────────────────────────────────────────────────────────────
  // HELPER: Merge CSV + API data
  // ─────────────────────────────────────────────────────────────
  
  async mergeCSVandAPIdata(date: string, location_id: string) {
    const records = await db.collection('test-eitje-hours')
      .find({
        date: new Date(date),
        location_id,
      })
      .toArray();
    
    // Group by source
    const byCsv = records.filter(r => r.source === 'eitje-csv');
    const byApi = records.filter(r => r.source === 'eitje-api');
    
    // Find duplicates (same member, same hours, same date)
    const duplicates = [];
    for (const csvRecord of byCsv) {
      const apiMatch = byApi.find(a => 
        a.member_id === csvRecord.member_id &&
        a.hours === csvRecord.hours &&
        a.date.getTime() === csvRecord.date.getTime()
      );
      
      if (apiMatch) {
        duplicates.push({
          csv_id: csvRecord._id,
          api_id: apiMatch._id,
          member: csvRecord.member_name,
          hours: csvRecord.hours,
          date: csvRecord.date,
        });
      }
    }
    
    return {
      total_csv: byCsv.length,
      total_api: byApi.length,
      duplicates: duplicates.length,
      records: { csv: byCsv, api: byApi, duplicates },
    };
  }
}
```

---

## Comparison Table: CSV vs API

| Aspect | CSV | API | Unified Storage |
|--------|-----|-----|-----------------|
| **Format** | Flat rows (strings) | Nested JSON (objects) | Flat objects (normalized) |
| **Parsing** | Split by delimiter | JSON.parse() | Both → same structure |
| **Date format** | DD/MM/YYYY | ISO 8601 | Always Date object |
| **Numbers** | Strings with € | Already numbers | Always numbers |
| **Locations** | Text: "Bar Bea" | Text: "Bar Bea" | ObjectId reference |
| **Collections** | Different | Different | **SAME collection** |
| **Deduplication** | Manual compare | Manual compare | Compare by date+member+hours |
| **Query** | Different | Different | **SAME query works for both** |

---

## Real Example: One Day's Data (Mixed Sources)

### Data In
```
CSV Row 1:  01/01/2026, André Rozhok, Bar Bea, Bediening, 04:00, €89
CSV Row 2:  01/01/2026, Koen Van Den Bos, Bar Bea, Bediening, 02:40, €71
API Call 1: 2026-01-01, André Rozhok, shift 08:00, €130
API Call 2: 2026-01-01, Sophie Van Eijk, shift 06:00, €154
```

### Stored Unified Format
```javascript
Collection: test-eitje-hours

// From CSV
{ 
  _id: ObjectId("aaa..."),
  date: 2026-01-01,
  member_id: ObjectId("mem-andré"),
  member_name: "André Rozhok",
  hours: 4,
  labor_cost: 89,
  source: "eitje-csv",
  support_id: "24586933",
  raw_csv: { ... }
}

// From CSV
{
  _id: ObjectId("bbb..."),
  date: 2026-01-01,
  member_id: ObjectId("mem-koen"),
  member_name: "Koen Van Den Bos",
  hours: 2.67,
  labor_cost: 71,
  source: "eitje-csv",
  support_id: "24597202",
  raw_csv: { ... }
}

// From API
{
  _id: ObjectId("ccc..."),
  date: 2026-01-01,
  member_id: ObjectId("mem-andré"),
  member_name: "André Rozhok",
  hours: 8,
  labor_cost: 130,
  source: "eitje-api",
  external_id: "shift-12345",
  raw_api: { ... }
}

// From API
{
  _id: ObjectId("ddd..."),
  date: 2026-01-01,
  member_id: ObjectId("mem-sophie"),
  member_name: "Sophie Van Eijk",
  hours: 6,
  labor_cost: 154,
  source: "eitje-api",
  external_id: "shift-12346",
  raw_api: { ... }
}
```

### Query Results (Identical for Both)
```typescript
const dayData = await db.collection('test-eitje-hours')
  .find({ date: '2026-01-01', location_id })
  .toArray();

// dayData includes:
// ✅ André (CSV 4h) + André (API 8h) = 12 hours total
// ✅ Koen (CSV 2.67h)
// ✅ Sophie (API 6h)

const summary = {
  totalHours: 20.67,
  totalCost: 444,
  costPerHour: 21.48,
  staff: 3,
  sources: ['eitje-csv', 'eitje-api'],
};

// Can do analytics on both sources together!
const andreProbability = dayData.filter(r => r.member_id === andréId).length; // 2
```

---

## Why This Works

✅ **Single Query Logic:** Same query works for CSV, API, or mix  
✅ **No Duplicates:** Can detect if same data from both sources  
✅ **Audit Trail:** `source` field shows where data came from  
✅ **Raw Preservation:** Keep original CSV/API for debugging  
✅ **Flexible:** Easy to add Bork API, PowerBI, or other sources  
✅ **Validation:** Compare CSV totals vs API totals at a glance  

---

## Implementation Flow

```
CSV File (eitje-gewerkte-uren.csv)     API Call (Eitje /shifts)
         │                                       │
         └───────────┬───────────────────────────┘
                     │
                     ▼
          Unified Import Service
                     │
         ┌───────────┴───────────┐
         │                       │
    Transform             Transform
   CSV Row          →     API Response
         │                       │
         └───────────┬───────────┘
                     │
                     ▼
          Normalized Record
          {
            date,
            member_id,
            location_id,
            hours,
            labor_cost,
            source,
            raw_csv / raw_api
          }
         │
         ▼
  test-eitje-hours Collection
  (Same format, same queries work!)
         │
         ▼
  Dashboard Query
  (Returns mix of CSV + API data)
         │
         ▼
  Daily Ops Dashboard 🎯
```

---

## Key Takeaway

**You don't store CSV and API data separately.**

Instead:
1. Parse CSV → Extract fields
2. Call API → Extract fields
3. Transform both to same structure
4. Store in same collection
5. Query as one unified dataset

The `source` field tells you where it came from if needed, but queries don't care!
