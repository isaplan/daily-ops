# 📁 INBOX FEATURE - COMPLETE FILE STRUCTURE

## Directory Tree

```
daily-ops/
├── app/
│   ├── api/
│   │   └── inbox/                          [NEW DIRECTORY]
│   │       ├── sync/
│   │       │   └── route.ts                [NEW] POST - Fetch emails from Gmail
│   │       ├── list/
│   │       │   └── route.ts                [NEW] GET - List emails with pagination
│   │       ├── [id]/
│   │       │   └── route.ts                [NEW] GET - Single email detail
│   │       ├── process/
│   │       │   └── route.ts                [NEW] POST - Process email & parse
│   │       ├── upload/
│   │       │   └── route.ts                [NEW] POST - Manual file upload
│   │       └── parse/
│   │           └── route.ts                [NEW] POST - Parse single file
│   │
│   ├── daily-ops/
│   │   └── inbox/                          [NEW DIRECTORY]
│   │       ├── page.tsx                    [NEW] Dashboard view
│   │       ├── emails/
│   │       │   └── page.tsx                [NEW] Email list view
│   │       ├── [emailId]/
│   │       │   └── page.tsx                [NEW] Email detail view
│   │       └── upload/
│   │           └── page.tsx                [NEW] Manual upload page
│   │
│   ├── components/
│   │   ├── SidebarWrapper.tsx              [MODIFY] (already exists)
│   │   ├── DailyOpsSidebar.tsx             [MODIFY] Add Inbox link
│   │   ├── InboxEmailList.tsx              [NEW] Email list component
│   │   ├── InboxEmailDetail.tsx            [NEW] Email detail display
│   │   ├── EmailAttachmentPreview.tsx      [NEW] Attachment info + preview
│   │   ├── ProcessingStatusBadge.tsx       [NEW] Status indicator
│   │   ├── FileUploadZone.tsx              [NEW] Dropzone for uploads
│   │   └── ParsedDataTable.tsx             [NEW] Display parsed rows
│   │
│   ├── lib/
│   │   ├── services/
│   │   │   ├── inboxService.ts             [NEW] Email CRUD + queries
│   │   │   ├── gmailApiService.ts          [NEW] Gmail OAuth2 + fetch
│   │   │   ├── emailProcessorService.ts    [NEW] Email validation + extraction
│   │   │   ├── documentParserService.ts    [NEW] Route to correct parser
│   │   │   ├── dataMappingService.ts       [NEW] Data → collection mapping
│   │   │   └── base.ts                     [EXISTS] Base service pattern
│   │   │
│   │   ├── types/
│   │   │   └── inbox.types.ts              [NEW] All type definitions
│   │   │
│   │   ├── utils/
│   │   │   ├── csv-parser.ts               [NEW] Parse CSV files
│   │   │   ├── excel-parser.ts             [NEW] Parse XLSX files
│   │   │   ├── pdf-parser.ts               [NEW] Parse PDF files
│   │   │   ├── data-mapper.ts              [NEW] Column → field mapping
│   │   │   └── document-classifier.ts      [NEW] Detect document type
│   │   │
│   │   └── mongodb/
│   │       └── inbox-collections.ts        [NEW] Collection initialization
│   │
│   └── models/
│       ├── InboxEmail.ts                   [NEW] Mongoose schema
│       ├── EmailAttachment.ts              [NEW] Mongoose schema
│       ├── ParsedData.ts                   [NEW] Mongoose schema
│       └── ProcessingLog.ts                [NEW] Mongoose schema
│
├── function-registry.json                  [MODIFY] Add inbox entries
├── package.json                            [MODIFY] Add dependencies
└── .cursor/
    └── plans/
        ├── INBOX_FEATURE_BUILD_PLAN.md    [NEW] ✓ (Created)
        ├── INBOX_QUICK_SUMMARY.md         [NEW] ✓ (Created)
        └── INBOX_FILE_STRUCTURE.md        [NEW] ✓ (This file)
```

---

## File-by-File Breakdown

### 🆕 NEW FILES TO CREATE (30 files)

#### 1. Type Definitions
```
app/lib/types/inbox.types.ts (150-200 lines)
├── Interfaces
│   ├── InboxEmail
│   ├── EmailAttachment
│   ├── ParsedData
│   ├── ProcessingLog
│   ├── DocumentMapping
│   └── ParseResult
└── Enums
    ├── DocumentType
    ├── ProcessStatus
    └── EventType
```

#### 2. Mongoose Models (app/models/)
```
InboxEmail.ts (40-50 lines)
├── messageId: string (unique)
├── from: string
├── subject: string
├── receivedAt: Date
├── status: enum
├── retryCount: number
└── metadata: object

EmailAttachment.ts (40-50 lines)
├── emailId: ObjectId
├── fileName: string
├── mimeType: string
├── documentType: enum
├── parseStatus: enum
└── metadata: object

ParsedData.ts (50-60 lines)
├── attachmentId: ObjectId
├── documentType: string
├── rowsProcessed: number
├── data: object
├── mapping: object
└── validationErrors: array

ProcessingLog.ts (30-40 lines)
├── emailId: ObjectId
├── eventType: enum
├── status: enum
├── message: string
└── timestamp: Date
```

#### 3. MongoDB Setup
```
app/lib/mongodb/inbox-collections.ts (80-100 lines)
├── createIndexes()
├── ensureCollections()
└── Connection pool management
```

#### 4. Services (app/lib/services/)
```
inboxService.ts (100 lines) ⭐ METADATA HEADER
├── createEmail()
├── listEmails(skip, limit)
├── getEmail(id)
├── updateStatus()
├── addAttachment()
└── deleteOldEmails()

gmailApiService.ts (120-150 lines) ⭐ METADATA HEADER
├── authenticateOAuth2()
├── fetchEmails(maxResults)
├── downloadAttachment()
├── listLabels()
└── markAsRead()

emailProcessorService.ts (100-120 lines) ⭐ METADATA HEADER
├── extractEmailData()
├── validateEmail()
├── sanitizeContent()
└── generateSummary()

documentParserService.ts (80-100 lines) ⭐ METADATA HEADER
├── autoDetectFormat()
├── parseDocument()
├── routeToParser()
└── validateStructure()

dataMappingService.ts (100-120 lines) ⭐ METADATA HEADER
├── detectDocumentType()
├── mapToCollection()
├── validateMapping()
├── storeToDatabase()
└── generateMappingReport()
```

#### 5. Utility Functions (app/lib/utils/)
```
csv-parser.ts (60-80 lines)
├── parseCSV()
├── detectDelimiter()
├── validateRows()
└── normalizeCsv()

excel-parser.ts (80-100 lines)
├── parseExcel()
├── getSheetNames()
├── extractSheet()
├── validateExcel()
└── normalizeExcel()

pdf-parser.ts (70-90 lines)
├── parsePDF()
├── extractText()
├── findTables()
└── validatePdf()

data-mapper.ts (80-100 lines)
├── matchColumns()
├── normalizeValues()
├── applyValidation()
└── generateMapping()

document-classifier.ts (60-80 lines)
├── classifyByFilename()
├── classifyByContent()
├── classifyByStructure()
└── confidence scores
```

#### 6. API Routes (app/api/inbox/)
```
sync/route.ts (60-80 lines)
├── POST handler
├── Fetch from Gmail
├── Store emails + attachments
└── Trigger parsing

list/route.ts (70-90 lines)
├── GET handler
├── Query params: skip, limit, status, type
├── Pagination logic
└── Response formatting

[id]/route.ts (50-70 lines)
├── GET handler
├── Fetch email + attachments
├── Include parse results
└── Error handling

process/route.ts (80-100 lines)
├── POST handler
├── Parse attachments
├── Store to destination
├── Update status
└── Log result

upload/route.ts (90-120 lines)
├── POST multipart handler
├── File validation
├── Store temp file
├── Create email record
└── Trigger parsing

parse/route.ts (70-90 lines)
├── POST handler
├── Accept file upload
├── Parse directly
├── Return results
└── No storage
```

#### 7. UI Pages (app/daily-ops/inbox/)
```
page.tsx (100-120 lines)
├── Dashboard overview
├── Recent emails (5)
├── Processing summary
├── Action buttons
└── Suspense boundaries

emails/page.tsx (120-150 lines)
├── Email list view
├── Search/filter UI
├── Pagination controls
├── Status badges
└── Load more button

[emailId]/page.tsx (150-180 lines)
├── Email detail header
├── Attachment list
├── Parse status display
├── Data preview
├── Action buttons

upload/page.tsx (100-130 lines)
├── File dropzone
├── Upload progress
├── Parse results
├── Error display
└── Success confirmation
```

#### 8. React Components (app/components/)
```
InboxEmailList.tsx (120-150 lines)
├── Table or card list
├── Row actions (view, reparse, retry)
├── Empty state
└── Sorting/filtering

InboxEmailDetail.tsx (100-130 lines)
├── Email header
├── Attachment section
├── Metadata display
└── Related actions

EmailAttachmentPreview.tsx (80-100 lines)
├── File info card
├── Parse status
├── Data sample
└── Action buttons

ProcessingStatusBadge.tsx (40-60 lines)
├── Status indicator
├── Color coding
├── Tooltip on hover
└── Loading animation

FileUploadZone.tsx (90-120 lines)
├── Dropzone UI
├── Drag-n-drop
├── File type validation
├── Size validation

ParsedDataTable.tsx (100-130 lines)
├── Paginated table
├── Column headers
├── Data rows
├── Export option
└── Error rows section
```

#### 9. Sidebar Modification
```
DailyOpsSidebar.tsx (modified)
├── Add Inbox nav item
├── Add badge with count
└── Link to /daily-ops/inbox
```

---

## 🔧 MODIFIED FILES (2 files)

### 1. function-registry.json
Add entries for:
```json
[
  {
    "registry-id": "inboxService",
    "type": "service",
    "file": "app/lib/services/inboxService.ts",
    "touch_again": false,
    "status": "pending"
  },
  {
    "registry-id": "gmailApiService",
    "type": "service",
    "file": "app/lib/services/gmailApiService.ts",
    "touch_again": false,
    "status": "pending"
  },
  // ... more entries for each service and component
]
```

### 2. package.json
Add dependencies:
```json
{
  "dependencies": {
    "xlsx": "^0.18.5",
    "pdfjs-dist": "^4.0.0",
    "googleapis": "^132.0.0",
    "multer": "^1.4.5",
    "mime-types": "^2.1.35"
  }
}
```

### 3. app/components/DailyOpsSidebar.tsx
- Add Inbox link with badge
- Show unprocessed email count

---

## 📋 Creation Order (Dependency Graph)

### Phase 1: Foundation
1. `app/lib/types/inbox.types.ts` ← All others depend on this
2. `app/models/*.ts` (4 files) ← Use types
3. `app/lib/mongodb/inbox-collections.ts` ← Initialize collections

### Phase 2: Services
4. `app/lib/services/gmailApiService.ts` ← Independent
5. `app/lib/services/emailProcessorService.ts` ← Uses gmail service
6. `app/lib/utils/*-parser.ts` (3 files) ← Independent parsers
7. `app/lib/services/documentParserService.ts` ← Routes to parsers
8. `app/lib/utils/data-mapper.ts` ← Independent
9. `app/lib/services/dataMappingService.ts` ← Uses mapper
10. `app/lib/services/inboxService.ts` ← CRUD layer

### Phase 3: API Routes
11. `app/api/inbox/*/route.ts` (6 files) ← Use services

### Phase 4: UI
12. `app/components/*.tsx` (7 files) ← Use services
13. `app/daily-ops/inbox/*.tsx` (4 files) ← Use components
14. Modify `app/components/DailyOpsSidebar.tsx`

### Phase 5: Configuration
15. Update `function-registry.json`
16. Update `package.json`

---

## 💾 LOC Estimates

| Category | Files | Total LOC | Avg per File |
|----------|-------|----------|--------------|
| Types | 1 | 200 | 200 |
| Models | 4 | 180 | 45 |
| DB Setup | 1 | 100 | 100 |
| Services | 5 | 550 | 110 |
| Utils | 5 | 420 | 84 |
| API Routes | 6 | 540 | 90 |
| Pages | 4 | 500 | 125 |
| Components | 7 | 820 | 117 |
| **TOTAL** | **33** | **3,910** | **~118** |

**Average:** ~4000 lines of code across 33 files

---

## 🔐 Metadata Header Pattern (Required for Services)

Each service gets this header:
```typescript
/**
 * @registry-id: inboxService
 * @created: 2026-01-26T00:00:00.000Z
 * @last-modified: 2026-01-26T00:00:00.000Z
 * @description: Service for email CRUD operations, attachment management, status tracking
 * @last-fix: [2026-01-26] Initial implementation
 * 
 * @exports-to:
 *   ✓ app/api/inbox/sync/route.ts => createEmail(), addAttachment()
 *   ✓ app/api/inbox/list/route.ts => listEmails()
 *   ✓ app/daily-ops/inbox/page.tsx => getUnprocessedCount()
 *   ✓ app/lib/services/dataMappingService.ts => updateStatus()
 */
```

---

## 🧪 Testing Strategy

### Unit Tests
```
app/lib/utils/__tests__/
├── csv-parser.test.ts
├── excel-parser.test.ts
├── pdf-parser.test.ts
└── data-mapper.test.ts
```

### Integration Tests
```
app/api/inbox/__tests__/
├── sync.integration.test.ts
├── process.integration.test.ts
└── upload.integration.test.ts
```

### E2E Tests (Optional)
```
e2e/
├── inbox-flow.spec.ts
└── manual-upload.spec.ts
```

---

## 📦 Dependencies Added

```bash
npm install \
  xlsx@^0.18.5 \
  pdfjs-dist@^4.0.0 \
  googleapis@^132.0.0 \
  multer@^1.4.5 \
  mime-types@^2.1.35
```

---

## 🚀 Deployment Checklist

- [ ] Environment variables set (Gmail OAuth)
- [ ] MongoDB collections initialized
- [ ] Dependencies installed
- [ ] Tests passing
- [ ] Code reviewed
- [ ] Registry updated
- [ ] Sidebar updated
- [ ] Feature flag enabled (optional)
- [ ] Email sync started
- [ ] Monitoring enabled

---

**READY TO START BUILDING!**

✅ Complete file structure documented  
✅ Dependencies identified  
✅ Implementation order defined  
✅ Metadata headers specified  
✅ Testing strategy outlined  

**Next: User approval → Phase 1 begins**
