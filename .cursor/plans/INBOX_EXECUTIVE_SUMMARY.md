# 📧 INBOX FEATURE - EXECUTIVE SUMMARY

**Date:** Monday, January 26, 2026  
**Status:** 🟡 PLAN COMPLETE - AWAITING APPROVAL  
**Total Effort:** ~15.5 hours | ~33 files | ~4000 LOC

---

## 🎯 WHAT YOU'RE GETTING

An **email-driven document processing system** that automatically:

1. ✉️ **Fetches emails** from Gmail (OAuth2) to `inboxhaagsenieuwehorecagroep@gmail.com`
2. 📎 **Parses attachments** (CSV, Excel, PDF) for structured data
3. 🗂️ **Stores extracted data** in MongoDB with smart mapping
4. 📊 **Displays inbox UI** in Daily Ops sidebar with overview + email details
5. ✅ **Tracks status** (success/failure/retry) for each email
6. 📤 **Supports manual upload** as fallback mechanism

---

## 📊 QUICK FACTS

| Aspect | Details |
|--------|---------|
| **Architecture** | Next.js 15 + React 18 + MongoDB (fully modular) |
| **Services** | 5 domain services (Gmail, Parser, Inbox, Mapper, Processor) |
| **API Endpoints** | 6 routes (sync, list, detail, process, upload, parse) |
| **Database Collections** | 4 new collections (Email, Attachment, ParsedData, Log) |
| **UI Components** | 9 React components + 4 pages |
| **File Imports** | CSV (PapaParse ✓), Excel (xlsx 🆕), PDF (pdfjs 🆕) |
| **Dependencies** | 5 new packages (gmail, excel, pdf, upload, mime) |
| **Agent-Rules** | ✅ 100% Compliant (metadata, registry, SSR, types, etc) |

---

## 🏗️ SYSTEM ARCHITECTURE (Visual)

```
┌──────────────┐
│ Gmail API    │
└──────┬───────┘
       │
       ▼
┌──────────────────────────────┐
│ API Layer (6 Routes)         │
│ sync, list, detail, process  │
│ upload, parse                │
└──────┬───────────────────────┘
       │
       ▼
┌──────────────────────────────┐
│ Services (5 Modules)         │
│ Gmail, Email, Parser, Data,  │
│ Mapping                      │
└──────┬───────────────────────┘
       │
       ▼
┌──────────────────────────────┐
│ MongoDB (4 Collections)      │
│ Email, Attachment, Parsed,   │
│ ProcessingLog                │
└──────┬───────────────────────┘
       │
       ▼
┌──────────────────────────────┐
│ React UI (9 Components)      │
│ Inbox Dashboard, Email List, │
│ Detail, Upload, Badges       │
└──────────────────────────────┘
```

---

## 📋 DOCUMENT TYPES (Processing Priority)

### **Tier 1: Eitje Suite** (Already have collections ✓)
- **Eitje Hours** → CSV → eitje_hours
- **Eitje Contracts** → XLSX → eitje_contracts  
- **Eitje Finance** → PDF → eitje_finance

### **Tier 2: Bork Suite** (Need to create 🆕)
- **Bork Sales** → CSV/XLSX → bork_sales
- **Bork Registry** → XLSX → bork_registry

### **Tier 3: Other Systems** (Flexible support)
- **Pasy** → Flexible format → payroll
- **Formitabele** → ? (NEED CONFIRMATION)
- **Power-BI** → CSV export → power_bi

---

## 🗄️ DATABASE DESIGN (4 Collections)

### **inbox_emails**
Stores email metadata from Gmail
```
messageId, from, subject, receivedAt, status, 
attachmentCount, errorMessage, retryCount
```

### **email_attachments**
Tracks each attachment + parse results
```
emailId, fileName, mimeType, documentType,
parseStatus, parsedDataRef, metadata
```

### **parsed_data**
Stores extracted structured data
```
attachmentId, documentType, rowsProcessed,
data { headers, rows }, mapping { collection, created }
```

### **inbox_processing_log**
Audit trail of all operations
```
emailId, attachmentId, eventType, status,
message, timestamp, duration
```

---

## 🔧 IMPLEMENTATION PHASES (10 Steps)

| Phase | Deliverable | Files | Time |
|-------|-------------|-------|------|
| 1️⃣ | Types + Models | 5 | 1h |
| 2️⃣ | DB Collections | 1 | 30m |
| 3️⃣ | Gmail API Service | 2 | 2h |
| 4️⃣ | Document Parsers | 5 | 3h |
| 5️⃣ | Inbox Service (CRUD) | 1 | 1.5h |
| 6️⃣ | Data Mapping Service | 2 | 1.5h |
| 7️⃣ | API Routes | 6 | 2h |
| 8️⃣ | DB Mappings Config | — | 1h |
| 9️⃣ | UI Components + Pages | 11 | 3h |
| 🔟 | Sidebar Integration | 1 | 30m |
| **TOTAL** | **Complete Feature** | **~33** | **~15.5h** |

---

## ✅ AGENT-RULES COMPLIANCE (100%)

✅ **RULE #1 (Registry):** Each service registered before creation  
✅ **RULE #11 (Metadata):** All services include @exports-to headers  
✅ **RULE #7 (DB in API):** Database calls ONLY in /api routes  
✅ **RULE #6 (SSR):** Components use Suspense + server fetch  
✅ **RULE #8 (Pagination):** All list endpoints: skip/limit  
✅ **RULE #5 (TypeScript):** No `any` — full type safety  
✅ **RULE #10 (Small commits):** 1 commit per phase  
✅ **RULE #4 (Size limits):** Services max ~100 lines each  
✅ **RULE #9 (No console.log):** Silent operation + ProcessingLog  
✅ **RULE #0 (Workflow):** Plan → Approval → Execute → Result

---

## 📦 DEPENDENCIES

### **New Packages (5)**
```bash
npm install xlsx pdfjs-dist googleapis multer mime-types
```

### **Existing (Already in package.json ✓)**
- papaparse → CSV parsing ✓
- mongoose → MongoDB ORM ✓
- next@15 → Framework ✓
- react@18 → Component library ✓

---

## 🚀 WORKFLOW (When Live)

### **Automated Flow**
```
1. External tool sends email → Gmail inbox
2. CronJob or manual API call: POST /api/inbox/sync
3. Gmail API fetches latest (with OAuth2)
4. Download attachments + create records
5. Auto-detect document type
6. Parse (CSV/Excel/PDF)
7. Map columns → destination collection
8. Store result + log status (success/failed)
```

### **Manual Upload Flow**
```
1. User: /daily-ops/inbox/upload
2. Drag & drop CSV/Excel/PDF
3. POST /api/inbox/upload (multipart form)
4. Parse immediately + display results
5. User confirms data import
```

### **User Reviews Email**
```
1. /daily-ops/inbox → Dashboard (latest 5 emails)
2. Click email → /daily-ops/inbox/[emailId]
3. View attachment parsing status
4. See extracted data preview (if successful)
5. Option to re-parse or download data
```

---

## 📁 FILE STRUCTURE (33 Files)

### **Types & Models** (5 files)
- `app/lib/types/inbox.types.ts`
- `app/models/InboxEmail.ts`
- `app/models/EmailAttachment.ts`
- `app/models/ParsedData.ts`
- `app/models/ProcessingLog.ts`

### **Services** (5 files)
- `app/lib/services/inboxService.ts` ⭐ metadata header
- `app/lib/services/gmailApiService.ts` ⭐ metadata header
- `app/lib/services/emailProcessorService.ts` ⭐ metadata header
- `app/lib/services/documentParserService.ts` ⭐ metadata header
- `app/lib/services/dataMappingService.ts` ⭐ metadata header

### **Utilities** (5 files)
- `app/lib/utils/csv-parser.ts`
- `app/lib/utils/excel-parser.ts`
- `app/lib/utils/pdf-parser.ts`
- `app/lib/utils/data-mapper.ts`
- `app/lib/utils/document-classifier.ts`

### **API Routes** (6 files)
- `app/api/inbox/sync/route.ts`
- `app/api/inbox/list/route.ts`
- `app/api/inbox/[id]/route.ts`
- `app/api/inbox/process/route.ts`
- `app/api/inbox/upload/route.ts`
- `app/api/inbox/parse/route.ts`

### **UI Pages** (4 files)
- `app/daily-ops/inbox/page.tsx`
- `app/daily-ops/inbox/emails/page.tsx`
- `app/daily-ops/inbox/[emailId]/page.tsx`
- `app/daily-ops/inbox/upload/page.tsx`

### **UI Components** (7 files)
- `app/components/InboxEmailList.tsx`
- `app/components/InboxEmailDetail.tsx`
- `app/components/EmailAttachmentPreview.tsx`
- `app/components/ProcessingStatusBadge.tsx`
- `app/components/FileUploadZone.tsx`
- `app/components/ParsedDataTable.tsx`
- `app/components/DailyOpsSidebar.tsx` (modified)

### **DB Setup** (1 file)
- `app/lib/mongodb/inbox-collections.ts`

### **Configuration** (2 files modified)
- `function-registry.json` (add entries)
- `package.json` (add dependencies)

---

## ⚙️ TECHNICAL DECISIONS

### **1. Document Parser Strategy**
- ✅ CSV: `papaparse` (already in project)
- ✅ Excel: `xlsx` (lightweight, fast)
- ✅ PDF: `pdfjs-dist` (text extraction, no OCR)

### **2. Gmail Integration**
- ✅ OAuth2 (user grants permission)
- ✅ Refresh tokens stored in `.env`
- ✅ Secure secret management

### **3. Data Storage**
- ✅ Normalize all formats to JSON
- ✅ Store raw + parsed separately
- ✅ Keep audit trail in ProcessingLog

### **4. UI Strategy**
- ✅ Sidebar navigation item
- ✅ Badge showing pending emails
- ✅ Detail view with preview

### **5. Error Handling**
- ✅ Graceful degradation on parse errors
- ✅ Retry mechanism (exponential backoff)
- ✅ User-visible error messages

---

## ❓ QUESTIONS WE NEED ANSWERED

Before starting Phase 1, please confirm:

1. **Formitabele format?** (CSV/Excel/PDF/Unknown?)
2. **CSV delimiter?** (Comma, semicolon, pipe, tab?)
3. **Excel structure?** (Single sheet or multiple sheets per file?)
4. **PDF parsing:** Text extraction OK? Or need OCR?
5. **Sync frequency:** Every 30 min? Hourly? Manual only?
6. **Real-time UI:** WebSocket updates or page refresh?
7. **Data retention:** Keep all emails or archive old ones?

---

## 📋 DOCUMENTATION CREATED

✅ `.cursor/plans/INBOX_FEATURE_BUILD_PLAN.md` — **30-page technical deep-dive**
- Full architecture breakdown
- Database schema details
- Phase-by-phase implementation guide
- Workflow diagrams
- Compliance checklist

✅ `.cursor/plans/INBOX_QUICK_SUMMARY.md` — **Quick reference (this document)**
- High-level overview
- Key decisions
- File structure
- Next steps

✅ `.cursor/plans/INBOX_FILE_STRUCTURE.md` — **Directory tree**
- Complete file list
- Creation order (dependency graph)
- LOC estimates
- Testing strategy

---

## 🎬 NEXT STEPS (Your Action)

### **Option 1: APPROVE & START NOW ✅**
Reply: "Go ahead" or "Proceed"
→ Haiku starts Phase 1 immediately

### **Option 2: ASK QUESTIONS 🤔**
Reply with any questions about the plan
→ Haiku provides clarification

### **Option 3: REVIEW DETAILS 📋**
Ask: "Show me the full plan" or "Details on Phase X"
→ Haiku provides specifics

### **Option 4: MAKE CHANGES 🔧**
Tell Haiku what to modify
→ Haiku updates plan accordingly

---

## ✨ WHY THIS PLAN IS SOLID

1. **Complete.** Every file, service, and component documented
2. **Modular.** 5 focused services, easy to test individually
3. **Scalable.** Adding new document types = 1 new mapping rule
4. **Compliant.** 100% follows Daily Ops agent-rules
5. **Practical.** Uses existing tools (PapaParse ✓) + proven libraries
6. **Auditable.** ProcessingLog tracks every operation
7. **User-Friendly.** Manual upload fallback + clear error messages
8. **Maintainable.** Metadata headers + small commits + tests

---

## 🎯 SUCCESS CRITERIA

After implementation, you'll have:

✅ Emails automatically fetched from Gmail  
✅ CSV/Excel/PDF files parsed automatically  
✅ Data mapped to appropriate MongoDB collections  
✅ Processing status visible in UI  
✅ Manual upload option available  
✅ Complete audit trail in logs  
✅ Integrated into Daily Ops sidebar  
✅ Production-ready code (tested, typed, documented)  

---

## 💬 READY?

**🟡 Status: AWAITING YOUR APPROVAL**

Just reply with your answer and we'll start building!

---

**Questions? Want to see the full technical plan?**

👉 Open `.cursor/plans/INBOX_FEATURE_BUILD_PLAN.md` for complete details  
👉 Open `.cursor/plans/INBOX_FILE_STRUCTURE.md` for file-by-file breakdown

**OR just say "Go ahead" and we'll begin Phase 1! 🚀**
