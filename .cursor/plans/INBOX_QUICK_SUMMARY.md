# 📧 INBOX FEATURE - QUICK SUMMARY & NEXT STEPS

## 🎯 What We're Building

**Email-driven document processing system** that:
1. Fetches emails from Gmail inbox (OAuth2)
2. Parses attachments (CSV, Excel, PDF)
3. Extracts structured data → MongoDB
4. Displays inbox with processing status
5. Supports manual file upload fallback

---

## 🏗️ System Architecture

```
Gmail API ─→ API Routes ─→ Services ─→ MongoDB ─→ React Components
   (OAuth2)   (6 routes)   (5 services) (4 collections) (9 components)
```

### Core Components
- **5 Services:** Gmail, Parser, Inbox CRUD, Data Mapping, Email Processor
- **6 API Routes:** sync, list, detail, process, upload, parse
- **4 Collections:** InboxEmail, EmailAttachment, ParsedData, ProcessingLog
- **9 UI Components:** Dashboard, List, Detail, Upload, Badges, Previews

---

## 📋 Priority Document Types (in order)

1. **Eitje Hours** (CSV) → eitje_hours ✓ (EXISTING)
2. **Eitje Contracts** (XLSX) → eitje_contracts ✓ (EXISTING)
3. **Eitje Finance** (PDF) → eitje_finance ✓ (EXISTING)
4. **Bork Sales** (CSV/XLSX) → bork_sales 🆕
5. **Bork Registry** (XLSX) → bork_registry 🆕
6. **Pasy** (Flexible) → payroll ❓
7. **Formitabele** (Unknown) → ? ❓
8. **Power-BI** (CSV export) → power_bi ✓

---

## 🗄️ Database Design

### 4 New Collections

**inbox_emails**
```
{
  messageId, from, subject, receivedAt,
  status: 'received|processing|completed|failed',
  attachmentCount, errorMessage, retryCount
}
```

**email_attachments**
```
{
  emailId, fileName, mimeType, fileSize,
  documentType: 'hours|contracts|finance|sales|payroll|bi|other',
  parseStatus: 'pending|parsing|success|failed',
  parsedDataRef
}
```

**parsed_data**
```
{
  attachmentId, emailId, documentType,
  rowsProcessed, rowsValid, rowsFailed,
  data: { headers, rows },
  mapping: { mappedToCollection, matchedRecords, createdRecords }
}
```

**inbox_processing_log**
```
{
  emailId, attachmentId, eventType, status,
  message, timestamp, duration
}
```

---

## 🛠️ Tech Stack

### New Packages (5)
- `xlsx` — Excel parsing
- `pdfjs-dist` — PDF text extraction
- `googleapis` — Gmail API
- `multer` — File upload
- `mime-types` — MIME detection

### Existing (Already Available)
- `papaparse` — CSV ✓
- `mongoose` — MongoDB ✓
- `next` — Framework ✓

---

## 📊 10-Phase Implementation

| Phase | What | Files | Est. Time |
|-------|------|-------|-----------|
| 1 | Types & Models | 5 | 1h |
| 2 | DB Collections | 1 | 30m |
| 3 | Gmail API Service | 2 | 2h |
| 4 | Document Parsers | 5 | 3h |
| 5 | Inbox Service (CRUD) | 1 | 1.5h |
| 6 | Data Mapping | 2 | 1.5h |
| 7 | API Routes | 6 | 2h |
| 8 | DB Mappings Config | - | 1h |
| 9 | UI Components | 7 | 3h |
| 10 | Sidebar Integration | 1 | 30m |
| **TOTAL** | **30 files** | **~15.5h** |

### Compliance Guarantee ✅
- ✅ RULE #1: Registry checks before editing
- ✅ RULE #11: Metadata headers on all services
- ✅ RULE #7: DB fetches only in API routes
- ✅ RULE #8: Pagination on all list endpoints
- ✅ RULE #10: Small commits per phase

---

## 📌 Critical Files to Create

**Types & Models**
- `app/lib/types/inbox.types.ts`
- `app/models/InboxEmail.ts`, `EmailAttachment.ts`, `ParsedData.ts`

**Services** (with metadata headers)
- `app/lib/services/inboxService.ts`
- `app/lib/services/gmailApiService.ts`
- `app/lib/services/documentParserService.ts`
- `app/lib/services/emailProcessorService.ts`
- `app/lib/services/dataMappingService.ts`

**API Routes**
- `app/api/inbox/sync/route.ts`
- `app/api/inbox/list/route.ts`
- `app/api/inbox/[id]/route.ts`
- `app/api/inbox/process/route.ts`
- `app/api/inbox/upload/route.ts`
- `app/api/inbox/parse/route.ts`

**UI Pages & Components**
- `app/daily-ops/inbox/page.tsx`
- `app/daily-ops/inbox/emails/page.tsx`
- `app/daily-ops/inbox/[emailId]/page.tsx`
- `app/daily-ops/inbox/upload/page.tsx`
- Various UI components (list, detail, badges, previews)

**Sidebar Integration**
- Modify `app/components/DailyOpsSidebar.tsx` (add inbox link)

---

## 🔐 Architecture Principles (Agent-Rules Compliant)

### SSR-First ✅
- API routes handle all DB operations
- Components use Suspense + server-side data fetch
- NO client-side secrets

### Type-Safe ✅
- Full TypeScript for all types
- NO `any` types
- Zod validation on inputs

### Modular Services ✅
- Each service: <100 lines
- Clear separation of concerns
- Easy to test/maintain

### Pagination Always ✅
- List endpoints: `skip=0&limit=20`
- Default 20 items/page
- Never fetch all

### Metadata Headers ✅
- Services document @exports-to dependencies
- Easy to track changes
- Prevents broken imports

---

## 🚀 Workflow When Live

### Automated (CronJob or Scheduled)
```
1. External tool sends email to Gmail
2. CronJob: POST /api/inbox/sync
3. Gmail API fetches latest emails
4. Service downloads attachments
5. Parser detects type (Hours, Sales, etc)
6. Data mapper stores to destination collection
7. ProcessingLog records success/failure
```

### Manual Upload (Fallback)
```
1. User: /daily-ops/inbox/upload
2. Drag CSV/Excel/PDF
3. POST /api/inbox/upload
4. Parse & display results
```

### User Views Email
```
1. /daily-ops/inbox/emails → email list
2. Click email → /daily-ops/inbox/[emailId]
3. See attachments + parse status
4. View extracted data (if success)
5. Manual re-parse if needed
```

---

## ⚠️ Key Decisions Made

### 1. **Document Parser Strategy**
- ✅ CSV: PapaParse (already in package.json)
- ✅ Excel: `xlsx` library (simple, fast)
- ✅ PDF: `pdfjs-dist` for text extraction (text-only, no OCR)

### 2. **Data Storage**
- Store raw + parsed data separately
- Keep audit trail in ProcessingLog
- Support retry on parse failure

### 3. **UI Location**
- Add Inbox to Daily Ops sidebar
- New menu item: `/daily-ops/inbox`
- Dashboard view with email overview

### 4. **Error Handling**
- Graceful degradation on parse errors
- Retry mechanism (with exponential backoff)
- User-visible error messages

### 5. **Gmail Authentication**
- OAuth2 (user grants permission)
- Store refresh tokens in env
- Secure secret management

---

## ❓ Questions to Confirm

1. **Formitabele format?** (CSV/Excel/PDF/Other?)
2. **CSV delimiter?** (Comma, semicolon, pipe?)
3. **Excel sheets?** (Single or multiple per file?)
4. **PDF extraction:** Text only OK? Or need OCR?
5. **Sync frequency?** (Every 30 min? Hourly? Manual?)
6. **Retention policy?** (Keep all emails or archive?)
7. **Real-time UI updates?** (WebSocket/polling or page refresh?)
8. **Pasy format confirmation?** (Expected structure?)

---

## ✅ Next Steps

### For User:
1. **Review & Approve** this plan
2. **Confirm document types** and Formitabele format
3. **Provide Gmail OAuth2 credentials**
4. **Decide:** Start immediately or gather more info?

### For Haiku:
1. Create Phase 1 (Types & Models)
2. Get approval before each phase
3. 1 commit per phase
4. Update registry.json after each phase
5. Test as we go

---

## 📌 Files Created (Prep Work)

✅ `.cursor/plans/INBOX_FEATURE_BUILD_PLAN.md` — Detailed technical plan  
✅ `.cursor/plans/INBOX_QUICK_SUMMARY.md` — This summary document

**Status:** 🟡 AWAITING YOUR APPROVAL TO PROCEED

---

**Questions? Concerns? Ready to build?**

Just reply with:
- ✅ "Go ahead" → Start Phase 1 immediately
- 🤔 "Wait, I have questions..." → Ask anything
- 📋 "Show me the details" → Full plan at `.cursor/plans/INBOX_FEATURE_BUILD_PLAN.md`
