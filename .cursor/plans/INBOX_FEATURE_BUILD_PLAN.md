# 📧 INBOX FEATURE - COMPREHENSIVE BUILD PLAN
**Daily Ops Enhancement | Email Document Processing System**

---

## 🎯 EXECUTIVE SUMMARY

### Business Requirements
Build an email inbox system that:
1. **Fetches emails** from `inboxhaagsenieuwehorecagroep@gmail.com` via Gmail API
2. **Parses attachments** (CSV, Excel, PDF) for structured data:
   - Eitje Hours, Contracts, Finance
   - Bork Registry (Revenue & Sales)
   - Pasy, Formitabele, Power-BI documents
3. **Stores parsed data** in MongoDB with proper mapping
4. **Displays UI** in Daily Ops sidebar with email/attachment overview
5. **Tracks processing status** (success/failure indicators)
6. **Supports manual upload** as fallback mechanism

### Timeline: 10-phase implementation (token-efficient, small commits)

---

## 📊 ARCHITECTURE OVERVIEW

```
┌─────────────────────────────────────────────────────────────┐
│                    EXTERNAL SYSTEMS                          │
├─────────────────────────────────────────────────────────────┤
│  Gmail API         | External Tools    | Manual Upload       │
│  (OAuth2)          | (send emails)     | (UI fallback)       │
└──────────┬──────────┬────────────────────┬──────────────────┘
           │          │                    │
           └──────────┴────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────────┐
│           API Layer (app/api/inbox/*)                        │
├─────────────────────────────────────────────────────────────┤
│  Route Handlers (Next.js 15):                               │
│  • POST /api/inbox/sync       → Fetch & store emails        │
│  • GET  /api/inbox/list       → List emails with filters    │
│  • GET  /api/inbox/[id]       → Get email + attachments     │
│  • POST /api/inbox/process    → Parse & extract data        │
│  • POST /api/inbox/upload     → Manual file upload          │
│  • POST /api/inbox/parse      → Parse attachment content    │
└──────────┬────────────────────────────────────────────────┘
           │
           ▼
┌─────────────────────────────────────────────────────────────┐
│        Service Layer (app/lib/services/*)                   │
├─────────────────────────────────────────────────────────────┤
│  • inboxService.ts            → Email CRUD + Gmail API calls│
│  • documentParserService.ts   → CSV/Excel/PDF parsing       │
│  • emailProcessorService.ts   → Email validation + extraction│
│  • attachmentExtractorService.ts → Download & parse files   │
└──────────┬────────────────────────────────────────────────┘
           │
           ▼
┌─────────────────────────────────────────────────────────────┐
│        MongoDB Collections (app/models/*)                   │
├─────────────────────────────────────────────────────────────┤
│  • InboxEmail         → Email metadata + status             │
│  • EmailAttachment    → File info + parsing results         │
│  • ParsedData         → Document type + extracted values    │
│  • ProcessingLog      → Audit trail (success/failure)       │
└──────────┬────────────────────────────────────────────────┘
           │
           ▼
┌─────────────────────────────────────────────────────────────┐
│        UI Components (app/daily-ops/inbox/*)                │
├─────────────────────────────────────────────────────────────┤
│  Sidebar: InboxNavItem (new menu item)                      │
│  Pages:                                                      │
│  • /daily-ops/inbox              → Inbox overview           │
│  • /daily-ops/inbox/emails       → Email list with filters  │
│  • /daily-ops/inbox/[emailId]    → Email detail view        │
│  • /daily-ops/inbox/upload       → Manual upload interface  │
│  • /daily-ops/inbox/processed    → Parsed data review       │
└─────────────────────────────────────────────────────────────┘
```

---

## 🗄️ DATABASE SCHEMA DESIGN

### Collection 1: `inbox_emails`
```typescript
interface InboxEmail {
  _id: ObjectId;
  messageId: string;                    // Gmail message ID (unique)
  from: string;                         // Sender email
  subject: string;                      // Email subject
  receivedAt: Date;                     // Gmail date
  storedAt: Date;                       // Storage timestamp
  status: 'received' | 'processing' | 'completed' | 'failed';
  hasAttachments: boolean;
  attachmentCount: number;
  summary?: string;                     // First 500 chars of body
  errorMessage?: string;                // If status = failed
  processedAt?: Date;
  lastAttempt?: Date;
  retryCount: number;
  archived: boolean;                     // Soft archive flag
  archivedAt?: Date;                     // When archived
  metadata: {
    labels?: string[];                  // Gmail labels
    threadId?: string;
  };
}
```

### Collection 2: `email_attachments`
```typescript
interface EmailAttachment {
  _id: ObjectId;
  emailId: ObjectId;                    // Ref to InboxEmail
  fileName: string;
  mimeType: string;                     // application/pdf, text/csv, etc
  fileSize: number;
  googleAttachmentId: string;
  downloadedAt: Date;
  storedLocally: boolean;               // For fallback retrieval
  documentType: 'hours' | 'contracts' | 'finance' | 'sales' | 'payroll' | 'bi' | 'other';
  parseStatus: 'pending' | 'parsing' | 'success' | 'failed';
  parseError?: string;
  parsedDataRef?: ObjectId;             // Ref to ParsedData
  metadata: {
    format: 'csv' | 'xlsx' | 'pdf' | 'unknown';
    sheets?: string[];                  // For Excel: ['Data', 'Metadata']
    rowCount?: number;
    columnCount?: number;
    userInfo?: Record<string, unknown>; // Eitje metadata sheet data
    delimiter?: string;                 // CSV delimiter (auto-detected)
  };
}
```

### Collection 3: `parsed_data`
```typescript
interface ParsedData {
  _id: ObjectId;
  attachmentId: ObjectId;               // Ref to EmailAttachment
  emailId: ObjectId;                    // Ref to InboxEmail
  documentType: string;
  extractedAt: Date;
  format: string;
  rowsProcessed: number;
  rowsValid: number;
  rowsFailed: number;
  data: {
    headers: string[];
    rows: Record<string, unknown>[];    // Flexible structure
    metadata?: Record<string, unknown>;
  };
  mapping: {
    mappedToCollection?: string;        // e.g., 'eitje_hours', 'bork_sales'
    matchedRecords?: number;
    createdRecords?: number;
    updatedRecords?: number;
  };
  validationErrors?: Array<{
    row: number;
    column: string;
    error: string;
  }>;
}
```

### Collection 4: `inbox_processing_log`
```typescript
interface ProcessingLog {
  _id: ObjectId;
  emailId?: ObjectId;
  attachmentId?: ObjectId;
  eventType: 'fetch' | 'parse' | 'validate' | 'store' | 'error';
  status: 'success' | 'warning' | 'error';
  message: string;
  timestamp: Date;
  duration?: number;                    // ms
  details?: Record<string, unknown>;
}
```

---

## 📋 IMPLEMENTATION PHASES (10 Steps)

### PHASE 1: Type Definitions & Models
**Files:** 
- `app/lib/types/inbox.types.ts` (new)
- `app/models/InboxEmail.ts` (new)
- `app/models/EmailAttachment.ts` (new)
- `app/models/ParsedData.ts` (new)

**What:**
- Define all TypeScript interfaces
- Create Mongoose schemas
- Add metadata headers (RULE #11 compliance)

**Why:** Foundation for type safety across all layers

---

### PHASE 2: Database Connection & Collections Init
**Files:**
- `app/lib/mongodb/inbox-collections.ts` (new)

**What:**
- Initialize MongoDB collections with indexes
- Create unique index on `inbox_emails.messageId`
- Create index on `parsed_data.documentType`
- Add indexes for queries

**Why:** Prevent duplicates, optimize query performance

---

### PHASE 3: Gmail API Service Layer
**Files:**
- `app/lib/services/gmailApiService.ts` (new)
- `app/lib/services/emailProcessorService.ts` (new)

**What:**
- Implement Gmail API OAuth2 flow
- Fetch emails with attachments
- Download attachment files (base64)
- Store credentials securely (env vars)
- Error handling + retry logic

**Why:** Core email fetching mechanism

---

### PHASE 4: Document Parser Service (Multi-Format)
**Files:**
- `app/lib/services/documentParserService.ts` (new)
- `app/lib/utils/csv-parser.ts` (new)
- `app/lib/utils/excel-parser.ts` (new)
- `app/lib/utils/pdf-parser.ts` (new)

**What:**
- Parse CSV files (PapaParse already in package.json)
- Parse Excel files (add `xlsx` package)
- Parse PDF text extraction (add `pdfjs-dist` package)
- Detect document type from filename/content
- Validate data structure
- Return normalized format

**Why:** Handle 3 file formats, normalize to JSON

---

### PHASE 5: Inbox Service (CRUD)
**Files:**
- `app/lib/services/inboxService.ts` (new) — metadata header required

**What:**
- Create email record
- Store attachments
- Update processing status
- Fetch with pagination (RULE #8)
- Delete old emails (optional archiving)
- Query by status/date/sender

**Why:** Central business logic for inbox operations

---

### PHASE 6: Data Mapping & Storage Layer
**Files:**
- `app/lib/services/dataMappingService.ts` (new)
- `app/lib/utils/data-mapper.ts` (new)

**What:**
- Map parsed CSV columns → existing collections
- Detect document type (Eitje Hours, Bork Sales, etc.)
- Handle missing/invalid fields
- Store to appropriate MongoDB collection
- Create audit log

**Why:** Connect email data to application collections

---

### PHASE 7: API Routes (Server Functions)
**Files:**
- `app/api/inbox/sync/route.ts` (new)
- `app/api/inbox/list/route.ts` (new)
- `app/api/inbox/[id]/route.ts` (new)
- `app/api/inbox/process/route.ts` (new)
- `app/api/inbox/upload/route.ts` (new)
- `app/api/inbox/parse/route.ts` (new)

**What:**
- GET /api/inbox/sync → Trigger email fetch (POST)
- GET /api/inbox/list → List emails with filters (pagination)
- GET /api/inbox/[id] → Get single email + attachments
- POST /api/inbox/process → Process email & parse attachments
- POST /api/inbox/upload → Manual file upload
- POST /api/inbox/parse → Parse uploaded file

**Why:** HTTP endpoints for client communication (RULE #7)

---

### PHASE 8: Database Models & Mapping
**Files:**
- Create example mappings for:
  - Eitje Hours → eitje_hours collection
  - Bork Sales → bork_sales collection

**What:**
- Document mapping rules per document type
- Field matching logic
- Validation rules

**Why:** Ensure correct data import

---

### PHASE 9: UI Components & Pages
**Files:**
- `app/daily-ops/inbox/page.tsx` (new)
- `app/daily-ops/inbox/emails/page.tsx` (new)
- `app/daily-ops/inbox/[emailId]/page.tsx` (new)
- `app/daily-ops/inbox/upload/page.tsx` (new)
- `app/components/InboxEmailList.tsx` (new)
- `app/components/InboxEmailDetail.tsx` (new)
- `app/components/EmailAttachmentPreview.tsx` (new)
- `app/components/ProcessingStatusBadge.tsx` (new)
- `app/components/FileUploadZone.tsx` (new)

**What:**
- Inbox dashboard (overview of latest emails)
- Email list with search/filter
- Email detail view
- Attachment viewer + parse status
- Manual upload dropzone
- Processing status indicators

**Why:** User interface for inbox management

---

### PHASE 10: Sidebar Navigation & Integration
**Files:**
- Modify `app/components/DailyOpsSidebar.tsx`
- Add Inbox menu item

**What:**
- Add "Inbox" link to Daily Ops sidebar
- Show unprocessed email count badge

**Why:** Make feature discoverable in UI

---

## 🔐 COMPLIANCE WITH AGENT RULES

### ✅ RULE #1: Registry Check
- **Action:** Create entries in `function-registry.json` for each service
- **Tracking:** Before writing, grep for existing entries

### ✅ RULE #2: Protected Files
- **Non-critical:** New files only → no touch_again issues
- **Critical:** Services have metadata headers

### ✅ RULE #11: Metadata Headers
- **Applied to:**
  - `inboxService.ts` → exports-to: API routes + UI components
  - `documentParserService.ts` → exports-to: inboxService
  - `gmailApiService.ts` → exports-to: emailProcessorService
  - `dataMappingService.ts` → exports-to: API routes

### ✅ RULE #4: Size Limits
- **Max 100 lines per file:** Split into focused services
- **Services:** Parsers, Gmail API, Data mapping → separate files

### ✅ RULE #5: No `any`
- **Policy:** Full TypeScript types for all responses
- **Types file:** `app/lib/types/inbox.types.ts`

### ✅ RULE #6: SSR First
- **API routes:** Server-side only (no client secrets)
- **Components:** Suspense boundaries for async data

### ✅ RULE #7: No DB in UI
- **Data fetching:** Exclusively via API routes
- **Pattern:** Suspense + server component data fetch

### ✅ RULE #8: Pagination Always
- **List endpoints:** skip/limit query params
- **Default:** 20 items per page

### ✅ RULE #9: No console.log
- **Production code:** Silent operation
- **Error tracking:** ProcessingLog collection

### ✅ RULE #10: Small Commits
- **Per phase:** 1-3 commits
- **Example:** "feat: add inbox service with email CRUD"

---

## 🛠️ TECH STACK & DEPENDENCIES

### New Packages to Install
```json
{
  "xlsx": "^0.18.5",              // Excel parsing
  "pdfjs-dist": "^4.0.0",         // PDF text extraction
  "googleapis": "^132.0.0",       // Gmail API client
  "multer": "^1.4.5",             // File upload handling
  "mime-types": "^2.1.35"         // MIME type detection
}
```

### Existing Dependencies (Already Available)
- `papaparse` - CSV parsing ✓
- `mongoose` - MongoDB ORM ✓
- `next` - Framework ✓
- `zod` - Type validation ✓

---

## 📌 DOCUMENT TYPE MAPPING (Priority Order)

### 1. Eitje Hours (CSV)
```
Columns: [Date, Employee, Location, Hours, ProjectCode]
Destination: eitje_hours collection
Status: EXISTING
```

### 2. Eitje Contracts (XLSX)
```
Columns: [EmployeeID, Name, ContractType, StartDate, EndDate]
Destination: eitje_contracts collection
Status: EXISTING
```

### 3. Eitje Finance (PDF → Extract Tables)
```
Content: Financial reports, invoices
Destination: eitje_finance collection
Status: EXISTING
```

### 4. Bork Sales (CSV/XLSX)
```
Columns: [Date, Product, Quantity, Revenue, Salesperson]
Destination: bork_sales collection
Status: NEW - Create mapping
```

### 5. Bork Registry (XLSX)
```
Columns: [ItemID, Name, Category, Cost, Revenue]
Destination: bork_registry collection
Status: NEW - Create mapping
```

### 6. Pasy (Payroll System)
```
Format: Flexible (CSV/PDF)
Destination: payroll collection
Status: DEPENDS ON FORMAT
```

### 7. Formitabele (Unknown Format)
```
Format: To be determined
Status: INVESTIGATE
```

### 8. Power-BI (Export Format)
```
Format: CSV export
Destination: power_bi_exports collection
Status: NEW
```

---

## 🔄 WORKFLOW FLOW

### Scenario 1: Periodic Email Fetch (Automated)
```
1. External system sends email to Gmail address
2. CronJob or manual API call: POST /api/inbox/sync
3. Service calls Gmail API → fetch latest emails
4. For each email:
   - Create InboxEmail record (status: received)
   - Download attachments
   - Create EmailAttachment records
5. Trigger POST /api/inbox/process
6. Parser detects document type
7. Extract data → Create ParsedData record
8. Data mapper stores to appropriate collection
9. Update status to 'completed' or 'failed'
10. Log processing result
```

### Scenario 2: Manual Upload (Fallback)
```
1. User navigates to /daily-ops/inbox/upload
2. Drags CSV/Excel/PDF file
3. Frontend: POST /api/inbox/upload (multipart/form-data)
4. API: receives file, validates MIME type
5. Stores temp file, creates InboxEmail record (source: 'manual_upload')
6. Triggers parse flow
7. Results displayed in UI
```

### Scenario 3: View Email Detail
```
1. User clicks email in /daily-ops/inbox/emails
2. Navigate to /daily-ops/inbox/[emailId]
3. GET /api/inbox/[emailId] → fetch email + attachments
4. Display:
   - Email metadata (from, subject, date)
   - Attachment list with parse status
   - Parsed data (if successful) or error message
   - Manual re-parse button
```

---

## ✨ UI MOCKUP (Text)

### Inbox Dashboard (`/daily-ops/inbox`)
```
┌─────────────────────────────────────────────────────┐
│ 📧 Inbox                                            │
├─────────────────────────────────────────────────────┤
│  Recent Activity                                    │
│  ✓ 3 emails processed today                        │
│  ⏳ 1 email processing                             │
│  ✗ 2 emails failed (retry available)               │
├─────────────────────────────────────────────────────┤
│  Last 5 Emails:                                     │
│  ┌─────────────────────────────────────────────┐  │
│  │ From: external@tool.com                     │  │
│  │ Subject: Eitje Hours Report                 │  │
│  │ Date: 2026-01-26 10:30 AM                   │  │
│  │ Attachments: 1 file (✓ Parsed)              │  │
│  │ Status: ✓ COMPLETED                         │  │
│  └─────────────────────────────────────────────┘  │
│  ... more emails ...                              │
├─────────────────────────────────────────────────────┤
│ [View All Emails] [Manual Upload] [Sync Now]      │
└─────────────────────────────────────────────────────┘
```

### Email Detail View (`/daily-ops/inbox/[emailId]`)
```
┌─────────────────────────────────────────────────────┐
│ ← Back  📧 Email Detail                            │
├─────────────────────────────────────────────────────┤
│ From: external@tool.com                             │
│ Subject: Eitje Hours Report                         │
│ Date: 2026-01-26 10:30 AM                           │
│ Status: ✓ COMPLETED                                │
├─────────────────────────────────────────────────────┤
│ Attachments:                                        │
│ 1. eitje-hours-jan2026.csv (45 KB)                 │
│    ├─ Format: CSV                                  │
│    ├─ Type: Eitje Hours                            │
│    ├─ Status: ✓ PARSED                            │
│    ├─ Rows: 1,245 | Valid: 1,240 | Failed: 5     │
│    └─ [View Data] [Re-parse] [Export]              │
├─────────────────────────────────────────────────────┤
│ Parsed Data Preview:                               │
│ ┌─────────────────────────────────────────────┐   │
│ │ Date       | Employee  | Location | Hours   │   │
│ │ 2026-01-26 | John Doe  | HQ       | 8       │   │
│ │ 2026-01-26 | Jane Doe  | Branch   | 8       │   │
│ │ ... 1,238 more rows ...                     │   │
│ └─────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────┘
```

---

## 🎬 EXECUTION STRATEGY

### Step 1: Approval & Environment Setup
1. **Get approval** on this plan
2. **Create .env vars** for Gmail credentials:
   ```
   GMAIL_API_KEY=xxx
   GMAIL_CLIENT_ID=xxx
   GMAIL_CLIENT_SECRET=xxx
   GMAIL_INBOX_ADDRESS=inboxhaagsenieuwehorecagroep@gmail.com
   ```

### Step 2: Dependency Installation
```bash
npm install xlsx pdfjs-dist googleapis multer mime-types
```

### Step 3: Phase-by-Phase Implementation
- 1 phase = 1 commit minimum
- Small, reviewable chunks
- Registry entries before code changes

### Step 4: Testing Strategy
- Unit tests for parsers (CSV, Excel, PDF)
- Integration tests for API routes
- Manual testing of UI components

### Step 5: Rollout
- Feature flag for `/daily-ops/inbox` (optional)
- Monitor error logs
- Gradual email sync increase (start manual)

---

## 🚀 NEXT STEPS FOR APPROVAL

### Before Starting:
1. ✅ Confirm document types & mapping requirements
2. ✅ Provide Gmail OAuth2 credentials
3. ✅ Confirm Formitabele format
4. ✅ Approve PDF extraction strategy (text only vs OCR)
5. ✅ Confirm preferred parsing library versions

### Questions:
- **CSV delimiter:** Comma? Semicolon?
- **Excel sheets:** Multiple sheets per file? How to identify?
- **PDF format:** Text extraction sufficient? Or need OCR?
- **Manual upload location:** Same upload endpoint or separate UI?
- **Real-time sync:** CronJob interval? (Recommend: every 30 minutes)

---

## 📊 ESTIMATED EFFORT

| Phase | Task | Effort | Files |
|-------|------|--------|-------|
| 1 | Types & Models | 1h | 5 |
| 2 | DB Collections | 30m | 1 |
| 3 | Gmail API | 2h | 2 |
| 4 | Parser Services | 3h | 5 |
| 5 | Inbox Service | 1.5h | 1 |
| 6 | Data Mapping | 1.5h | 2 |
| 7 | API Routes | 2h | 6 |
| 8 | DB Mappings | 1h | - |
| 9 | UI Components | 3h | 7 |
| 10 | Sidebar Integration | 30m | 1 |
| **Total** | **Complete Feature** | **~15.5h** | **~30** |

---

## 🔗 RELATED FILES

- `.cursor/rules/agent-rules.mdc` — Rule compliance checklist
- `app/lib/services/base.ts` — Base service pattern to follow
- `app/models/Member.ts` — Example Mongoose model
- `app/components/DailyOpsSidebar.tsx` — Sidebar navigation pattern

---

## ✅ FINAL CHECKLIST

Before Implementation:
- [ ] User approves overall architecture
- [ ] User confirms document types & mappings
- [ ] Gmail OAuth2 credentials obtained
- [ ] Package.json updated with new dependencies
- [ ] Database collections initialized
- [ ] Registry entries created
- [ ] Metadata headers approved

---

**STATUS:** 🟡 AWAITING APPROVAL

**PREPARED BY:** Haiku Assistant  
**DATE:** 2026-01-26  
**VERSION:** 1.0 - Initial Build Plan
