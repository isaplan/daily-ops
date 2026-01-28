# 📊 INBOX FEATURE - VISUAL REFERENCE & FLOWCHARTS

---

## 🔄 SYSTEM FLOW DIAGRAMS

### Flow 1: Automated Email Fetch & Processing

```
┌─────────────────────────────────────────────────────────────┐
│                    EXTERNAL SYSTEM                          │
│              (sends email to Gmail address)                 │
└────────────────────────────┬────────────────────────────────┘
                             │
                             ▼
                    ┌─────────────────┐
                    │ Gmail Inbox     │
                    │ (Gmail servers) │
                    └────────┬────────┘
                             │
                             ▼
                    ┌─────────────────────┐
                    │ POST /api/inbox/sync│
                    │ (CronJob triggers)  │
                    └────────┬────────────┘
                             │
        ┌────────────────────┼────────────────────┐
        │                    │                    │
        ▼                    ▼                    ▼
   ┌─────────────┐   ┌──────────────┐    ┌──────────────┐
   │ Gmail Auth  │   │ Fetch Emails │    │ Extract Meta │
   │ (OAuth2)    │   │ (list + read)│    │ (from,date)  │
   └────┬────────┘   └──────┬───────┘    └───────┬──────┘
        │                   │                    │
        └───────────────────┼────────────────────┘
                            │
                            ▼
                ┌───────────────────────┐
                │ Download Attachments  │
                │ (base64 decode)       │
                └────────┬──────────────┘
                         │
                         ▼
        ┌────────────────────────────────────┐
        │ Create InboxEmail + Attachment     │
        │ Records (status: "received")       │
        └────────┬───────────────────────────┘
                 │
                 ▼
        ┌─────────────────────────────────┐
        │ POST /api/inbox/process         │
        │ (trigger parsing)               │
        └────────┬────────────────────────┘
                 │
        ┌────────┴─────────────┐
        │                      │
        ▼                      ▼
   ┌─────────────┐      ┌────────────────┐
   │ Auto-Detect │      │ Route to Parser│
   │ Doc Type    │──────│ (CSV/XLS/PDF)  │
   └─────────────┘      └────────┬───────┘
                                 │
                    ┌────────────┼────────────┐
                    │            │            │
                    ▼            ▼            ▼
              ┌──────────┐ ┌────────────┐ ┌─────────┐
              │Parse CSV │ │Parse Excel │ │Parse PDF│
              │(PapaParse│ │(xlsx lib)  │ │(pdfjs)  │
              └────┬─────┘ └──────┬─────┘ └────┬────┘
                   │             │             │
                   └─────────┬───┴────────┬────┘
                             │            │
                             ▼            ▼
                      ┌────────────────────────┐
                      │ Detect Document Type   │
                      │ (Hours, Sales, etc)    │
                      └──────────┬─────────────┘
                                 │
                                 ▼
                      ┌────────────────────────┐
                      │ Map Columns → Fields   │
                      │ (normalize data)       │
                      └──────────┬─────────────┘
                                 │
                                 ▼
                      ┌────────────────────────┐
                      │ Store to Destination   │
                      │ Collection             │
                      │ (eitje_hours, etc)     │
                      └──────────┬─────────────┘
                                 │
                                 ▼
                      ┌────────────────────────┐
                      │ Create ParsedData      │
                      │ Record + Log Result    │
                      └──────────┬─────────────┘
                                 │
                                 ▼
                      ┌────────────────────────┐
                      │ Update Status to       │
                      │ "completed" or "failed"│
                      └────────────────────────┘
```

---

### Flow 2: Manual File Upload

```
┌─────────────────────────────────────────────┐
│ User navigates to /daily-ops/inbox/upload   │
└────────────────┬────────────────────────────┘
                 │
                 ▼
        ┌────────────────────────┐
        │ DragDrop Upload Zone   │
        │ (FileUploadZone.tsx)   │
        └────────┬───────────────┘
                 │
    ┌────────────┼─────────────┐
    │            │             │
    ▼            ▼             ▼
 ┌────────┐ ┌────────┐   ┌────────────┐
 │ CSV    │ │ Excel  │   │ PDF File   │
 │ File   │ │ File   │   │            │
 └────┬───┘ └───┬────┘   └─────┬──────┘
      │         │              │
      └─────────┼──────────────┘
                │
                ▼
       ┌───────────────────────┐
       │ Validate File:        │
       │ • Size limit          │
       │ • MIME type           │
       │ • Format              │
       └────────┬──────────────┘
                │
                ▼
       ┌──────────────────────────┐
       │ POST /api/inbox/upload   │
       │ (multipart/form-data)    │
       └────────┬─────────────────┘
                │
                ▼
       ┌──────────────────────────┐
       │ Store temp file          │
       │ Create InboxEmail        │
       │ (source: 'manual_upload')│
       └────────┬─────────────────┘
                │
                ▼
       ┌──────────────────────────┐
       │ POST /api/inbox/process  │
       │ (trigger parsing)        │
       └────────┬─────────────────┘
                │
         [Same as auto flow →]
                │
                ▼
       ┌──────────────────────────┐
       │ Display Results on UI    │
       │ • Parsed rows            │
       │ • Validation errors      │
       │ • Success message        │
       └──────────────────────────┘
```

---

### Flow 3: User Views Email Detail

```
┌────────────────────────────────────────┐
│ Click email in /daily-ops/inbox/emails │
└────────────┬─────────────────────────────┘
             │
             ▼
┌──────────────────────────────────────┐
│ Navigate to                          │
│ /daily-ops/inbox/[emailId]           │
└────────┬───────────────────────────────┘
         │
         ▼
┌──────────────────────────────────┐
│ GET /api/inbox/[emailId]         │
│ (server component fetch)         │
└────────┬───────────────────────────┘
         │
    ┌────┴──────┬────────┐
    │            │        │
    ▼            ▼        ▼
┌────────┐ ┌──────────┐ ┌──────────────┐
│Fetch   │ │Fetch all │ │Fetch Parsing │
│Email   │ │Attach-   │ │Results       │
│Record  │ │ments     │ │              │
└───┬────┘ └────┬─────┘ └────┬─────────┘
    │           │            │
    └───────────┼────────────┘
                │
                ▼
    ┌────────────────────────┐
    │ Format for Display:    │
    │ • Email metadata       │
    │ • Attachments list     │
    │ • Parse status badges  │
    └────────┬───────────────┘
             │
             ▼
    ┌────────────────────────┐
    │ Render <EmailDetail>   │
    │ • From/Subject/Date    │
    │ • Attachments          │
    │ • Parse results        │
    │ • Action buttons       │
    └────────────────────────┘
```

---

## 📊 DATA FLOW (MongoDB Collections)

```
┌─────────────────────┐
│   inbox_emails      │  
├─────────────────────┤
│ _id                 │
│ messageId* (unique) │─────────┐
│ from                │         │
│ subject             │         │
│ status              │         │
│ retryCount          │         │
│ metadata            │         │
└─────────────────────┘         │
                                │
                    ┌───────────┼──────────┐
                    │           │          │
                    ▼           │          ▼
        ┌─────────────────────┐ │  ┌──────────────────┐
        │email_attachments    │ │  │  parsed_data     │
        ├─────────────────────┤ │  ├──────────────────┤
        │ _id                 │ │  │ _id              │
        │ emailId*┌───────────┘ │  │ attachmentId*───┐│
        │ fileName            │ │  │ documentType   │ │
        │ parseStatus         │ │  │ data           │ │
        │ parsedDataRef───────┼──┐ │ mapping        │ │
        │ metadata            │ │ │ validationErrors││
        └─────────────────────┘ │ │                │ │
                                │ │ • Stored to    │ │
                                │ │   destination  │ │
                                │ │   collection   │ │
                                │ │   (eitje_hours)│ │
                                │ └────────────────┘ │
                    ┌───────────┼────────┐          │
                    │           │        │          │
                    ▼           │        ▼          │
    ┌─────────────────────────────────────────────┐ │
    │ inbox_processing_log                      │ │
    ├────────────────────────────────────────────┤ │
    │ _id                                        │ │
    │ emailId*────────────────────────────────────┼─┘
    │ attachmentId*                              │
    │ eventType: 'fetch|parse|validate|store'    │
    │ status: 'success|warning|error'            │
    │ message                                    │
    │ timestamp                                  │
    │ duration                                   │
    └────────────────────────────────────────────┘
```

---

## 🎯 DOCUMENT TYPE DETECTION

```
Input: File (CSV/XLSX/PDF)
           │
           ▼
┌──────────────────────────────┐
│ CLASSIFY BY FILENAME         │
├──────────────────────────────┤
│ if contains "hours"  → HOURS │
│ if contains "contract" → CONTRACT
│ if contains "sales"  → SALES │
│ if contains "finance" → FINANCE
│ Confidence: HIGH ✓✓✓        │
└──────────────────────────────┘
           │
           ├─ Found? → DONE ✓
           │
           ▼ Not found
┌──────────────────────────────┐
│ CLASSIFY BY CONTENT HEADER   │
├──────────────────────────────┤
│ CSV columns: [Date, Employee,│
│  Hours, Location]            │
│  → Eitje Hours               │
│                              │
│ Excel sheets: [Employee,     │
│  ContractType, StartDate]    │
│  → Eitje Contracts           │
│                              │
│ Confidence: MEDIUM ✓✓       │
└──────────────────────────────┘
           │
           ├─ Found? → DONE ✓
           │
           ▼ Not found
┌──────────────────────────────┐
│ CLASSIFY BY ROW STRUCTURE    │
├──────────────────────────────┤
│ Analyze first 5 rows:        │
│ • Column count               │
│ • Data types                 │
│ • Value patterns             │
│                              │
│ Confidence: LOW ✓           │
│ → Mark as 'unknown'          │
└──────────────────────────────┘
           │
           ▼
      Return Type + Confidence
```

---

## 🎨 UI COMPONENT HIERARCHY

```
DailyOpsSidebar (Modified)
├── InboxNavItem
│   └── Link to /daily-ops/inbox
│       └── Badge(unprocessedCount)
│
InboxLayout
├── Page 1: /daily-ops/inbox
│   ├── InboxDashboard
│   │   ├── RecentActivitySummary
│   │   ├── InboxEmailList (last 5)
│   │   └── ActionButtons
│   │       ├── [View All Emails]
│   │       ├── [Manual Upload]
│   │       └── [Sync Now]
│
├── Page 2: /daily-ops/inbox/emails
│   ├── EmailListView
│   │   ├── SearchBar
│   │   ├── FilterButtons
│   │   │   ├── [All]
│   │   │   ├── [Success]
│   │   │   ├── [Pending]
│   │   │   └── [Failed]
│   │   ├── InboxEmailList
│   │   │   └── EmailRow (repeating)
│   │   │       ├── From / Subject / Date
│   │   │       ├── ProcessingStatusBadge
│   │   │       └── ActionMenu
│   │   └── PaginationControls
│
├── Page 3: /daily-ops/inbox/[emailId]
│   ├── EmailDetailView
│   │   ├── EmailHeader
│   │   │   ├── From / Subject / Date
│   │   │   └── Status Badge
│   │   ├── AttachmentList
│   │   │   └── EmailAttachmentPreview (repeating)
│   │   │       ├── FileName
│   │   │       ├── FileSize
│   │   │       ├── ProcessingStatusBadge
│   │   │       └── [View] [Re-parse] [Download]
│   │   └── DataPreviewSection
│   │       └── ParsedDataTable
│   │           ├── Column Headers
│   │           ├── Data Rows (paginated)
│   │           └── ErrorRows (if any)
│
└── Page 4: /daily-ops/inbox/upload
    ├── UploadInterface
    │   ├── FileUploadZone (Dropzone)
    │   │   ├── Icon + Text
    │   │   ├── "Drag here or click"
    │   │   └── Accepted formats
    │   ├── UploadProgress (if uploading)
    │   └── ResultsDisplay
    │       ├── ParseResultsSummary
    │       ├── ParsedDataTable
    │       └── ActionButtons
    │           ├── [Confirm Import]
    │           ├── [Download CSV]
    │           └── [Try Again]
```

---

## 📈 API ENDPOINT FLOWCHART

```
┌─────────────────────────────┐
│  API ENDPOINTS              │
├─────────────────────────────┤
│                             │
├─→ POST /api/inbox/sync      │
│   └─ Description: Fetch     │
│      emails from Gmail      │
│      Returns: { created,    │
│      failed, total }        │
│                             │
├─→ GET /api/inbox/list       │
│   └─ Params: skip, limit,   │
│      status, type, sender   │
│      Returns: { emails[],   │
│      total, hasMore }       │
│                             │
├─→ GET /api/inbox/[id]       │
│   └─ Returns: Full email    │
│      + attachments +        │
│      parse results          │
│                             │
├─→ POST /api/inbox/process   │
│   └─ Params: emailId        │
│      Action: Parse all      │
│      attachments            │
│      Returns: Results per   │
│      attachment             │
│                             │
├─→ POST /api/inbox/upload    │
│   └─ Params: multipart file │
│      Action: Upload + parse │
│      Returns: parseResults  │
│                             │
└─→ POST /api/inbox/parse     │
    └─ Params: file buffer    │
       Action: Parse only     │
       (no storage)           │
       Returns: { format,     │
       rows, headers,         │
       validated }            │
```

---

## 🔑 SERVICE DEPENDENCIES

```
┌────────────────────────────────────────┐
│ gmailApiService (Independent)          │
├────────────────────────────────────────┤
│ • authenticateOAuth2()                 │
│ • fetchEmails(maxResults)              │
│ • downloadAttachment(id)               │
│ Depends on: googleapis library         │
└────────────┬──────────────────────────┘
             │
             ▼
┌────────────────────────────────────────┐
│ emailProcessorService                  │
├────────────────────────────────────────┤
│ • extractEmailData()                   │
│ • validateEmail()                      │
│ Depends on: gmailApiService ↑          │
└────────────┬──────────────────────────┘
             │
             ▼
┌────────────────────────────────────────┐
│ inboxService (Data Layer)              │
├────────────────────────────────────────┤
│ • createEmail()                        │
│ • listEmails()                         │
│ • addAttachment()                      │
│ • updateStatus()                       │
│ Depends on: MongoDB models             │
└────────────┬──────────────────────────┘
             │
             ▼
┌────────────────────────────────────────┐
│ documentParserService (Router)         │
├────────────────────────────────────────┤
│ • autoDetectFormat()                   │
│ • parseDocument()                      │
│ Depends on: Individual parsers ↓↓↓    │
└────────────┬──────────────────────────┘
             │
    ┌────────┼────────┐
    ▼        ▼        ▼
┌──────┐ ┌──────┐ ┌─────┐
│CSV   │ │XLSX  │ │PDF  │
│Parser│ │Parser│ │Parser│
│(Papa)│ │(xlsx)│ │(pdf)│
└──────┘ └──────┘ └─────┘
             │
             ▼
┌────────────────────────────────────────┐
│ dataMappingService                     │
├────────────────────────────────────────┤
│ • detectDocumentType()                 │
│ • mapToCollection()                    │
│ • storeToDatabase()                    │
│ Depends on: inboxService ↑             │
└────────────────────────────────────────┘
```

---

## 🔐 Data Security & Privacy

```
┌────────────────────────────────────────┐
│ SECURITY LAYERS                        │
├────────────────────────────────────────┤
│                                        │
│ 1. AUTHENTICATION                      │
│    • OAuth2 for Gmail                  │
│    • Refresh tokens in .env            │
│    • Encrypted storage                 │
│                                        │
│ 2. AUTHORIZATION                       │
│    • Manager/Admin only (via middleware│
│    • Route guards on /daily-ops/inbox  │
│                                        │
│ 3. DATA VALIDATION                     │
│    • Input validation (Zod)            │
│    • File type checking (MIME)         │
│    • Size limits (files)               │
│    • CSV/Excel/PDF parsing errors      │
│                                        │
│ 4. AUDIT TRAIL                         │
│    • ProcessingLog collection          │
│    • Timestamps on all operations      │
│    • User action logging               │
│                                        │
│ 5. PRIVACY                             │
│    • No console.log() in prod          │
│    • Errors logged to DB only          │
│    • PII handling per regulations      │
│    • Data retention policy (TBD)       │
│                                        │
└────────────────────────────────────────┘
```

---

## 📊 ERROR HANDLING STRATEGY

```
Error Source          Handler                    Recovery
─────────────────────────────────────────────────────────
Gmail API Error       Retry with backoff         After 3 retries, mark "failed"
                      (exponential)

Parse Error           Log + continue             Mark attachment "failed"
(malformed CSV)                                  Show error in UI

Validation Error      Log validation errors      Store rows separately
(invalid data)        per row                    User can review/fix

Network Error         Retry immediately          After timeout, queue for later
(connection lost)

File Upload Error     Validate format first      Reject before parse
(wrong MIME type)

Database Error        Rollback transaction       Mark operation "failed"
(insert failed)       Retry once
```

---

## 🎬 STATE MACHINE (Email Processing)

```
                    ┌─────────┐
                    │ created │ (initial state)
                    └────┬────┘
                         │ (email fetched)
                         ▼
                    ┌─────────┐
                    │received │
                    └────┬────┘
                         │ (processing starts)
                         ▼
                    ┌────────────┐
                    │ processing │ ◄──── (retry on error)
                    └────┬───────┘
                         │
        ┌────────────────┼────────────────┐
        │ (parse OK)     │ (parse error)  │
        ▼                ▼                │
   ┌─────────┐      ┌─────────┐          │
   │completed│      │  failed │ ◄────────┘
   └─────────┘      └─────────┘
        │                 │
        └────────┬────────┘
                 │ (user action: "retry")
                 ▼
            ┌──────────┐
            │processing│
            └──────────┘
```

---

**These diagrams provide visual reference for understanding the system flow, data relationships, and component hierarchy.**
