# 📧 INBOX FEATURE - PLAN UPDATES (Based on User Feedback)

**Date:** 2026-01-26  
**Status:** ✅ **UPDATED - READY TO BUILD**

---

## 🔄 KEY CHANGES TO ORIGINAL PLAN

### ✅ **CONFIRMED: Gmail API Fetching (Phase 3)**
**Original:** Build Gmail API service with OAuth2 to fetch emails  
**Updated:** **KEEP Gmail API fetching** - Automatically fetch emails from Gmail inbox  
**Impact:** 
- ✅ Keep `gmailApiService.ts` (OAuth2 + fetch emails)
- ✅ Keep `googleapis` package dependency
- ✅ Add `POST /api/inbox/sync` endpoint (trigger email fetch)
- ✅ CronJob or manual trigger to sync emails periodically

**Flow:**
```
CronJob/Manual → POST /api/inbox/sync → Gmail API → Fetch emails → Parse attachments → Store
```

---

### ✅ **ADDED: Auto-Detect CSV Delimiter**
**Original:** Assume comma delimiter  
**Updated:** **Auto-detect delimiter** (comma, semicolon, pipe, tab)  
**Implementation:**
- Use PapaParse's auto-detection feature
- Try common delimiters: `,`, `;`, `|`, `\t`
- Store detected delimiter in metadata

---

### ✅ **UPDATED: Excel Multi-Sheet Support (Eitje Format)**
**Original:** Single sheet assumption  
**Updated:** **Handle Eitje format: Data sheet + Metadata sheet**  
**Implementation:**
- Eitje sends 2 sheets:
  - **Sheet 1:** Data (hours, contracts, etc.) → Parse and store
  - **Sheet 2:** Metadata + User info → Store separately as metadata
- Parse both sheets
- Store data sheet as ParsedData record
- Store metadata sheet as EmailAttachment.metadata.userInfo
- UI shows both: data preview + metadata info
- Metadata includes: `sheets: ['Data', 'Metadata'], userInfo: {...}`

---

### ✅ **CONFIRMED: PDF Text Extraction Only**
**Original:** Text extraction + optional OCR  
**Updated:** **Text extraction is enough** (no OCR)  
**Implementation:**
- Use `pdfjs-dist` for text extraction only
- No OCR libraries needed
- Extract text from PDF tables where possible

---

### ✅ **UPDATED: Soft Archive (Keep Data, Mark Archived)**
**Original:** Optional archiving  
**Updated:** **Soft archive** - Keep all data but mark as archived (user can retrieve)  
**Implementation:**
- Add `archived: boolean` field to InboxEmail
- Add `archivedAt: Date` field
- Archive old emails (configurable: e.g., >90 days)
- Archived emails still queryable (filter: `archived: false` by default)
- User can view archived emails via filter toggle
- Data never deleted, just hidden from default view
- Indexes include `archived` field for performance

---

### ✅ **DEFERRED: Formitabele & Pasy**
**Original:** Build parsers for all document types  
**Updated:** **Mark as "Coming Soon"** - Don't build yet  
**Implementation:**
- Add placeholder in document type enum: `'formitabele' | 'pasy' | 'coming_soon'`
- UI shows "Coming Soon" badge for these types
- Parser returns graceful error: "Format not yet supported"
- Easy to add later when format is known

---

## 📊 UPDATED ARCHITECTURE

### **Updated Flow:**
```
┌─────────────────────────────────────────┐
│ Gmail Inbox                             │
│ (inboxhaagsenieuwehorecagroep@gmail.com)│
└──────────────┬──────────────────────────┘
               │
               ▼
┌─────────────────────────────────────────┐
│ POST /api/inbox/sync                    │
│ (CronJob or manual trigger)             │
│ • Gmail API OAuth2 authentication       │
│ • Fetch latest emails                   │
│ • Download attachments                  │
│ • Create InboxEmail records             │
└──────────┬──────────────────────────────┘
           │
           ▼
┌─────────────────────────────────────────┐
│ Document Parsers                        │
│ • CSV (auto-detect delimiter)           │
│ • Excel (Data sheet + Metadata sheet)  │
│ • PDF (text extraction only)            │
└──────────┬──────────────────────────────┘
           │
           ▼
┌─────────────────────────────────────────┐
│ Data Mapping → MongoDB                  │
│ • Eitje Hours, Contracts, Finance       │
│ • Bork Sales, Registry                  │
│ • Power-BI                              │
│ • Formitabele/Pasy: "Coming Soon"       │
└─────────────────────────────────────────┘
           │
           ▼
┌─────────────────────────────────────────┐
│ Soft Archive (after 90 days)            │
│ • Mark archived: true                    │
│ • Keep all data (retrievable)          │
│ • Filter by archived: false (default)   │
└─────────────────────────────────────────┘
```

---

## 🔧 UPDATED IMPLEMENTATION PHASES

### **Phase 3: Gmail API Service** ✅ **RESTORED**
**Files:**
- `app/lib/services/gmailApiService.ts` (OAuth2 + fetch)
- `app/lib/services/emailProcessorService.ts` (process fetched emails)
- `app/api/inbox/sync/route.ts` (trigger sync endpoint)

**What:**
- Gmail API OAuth2 authentication
- Fetch emails from inbox
- Download attachments
- Create InboxEmail records
- Trigger parsing pipeline
- Returns sync status

---

## 📋 UPDATED FILE LIST

### **RESTORED Files:**
- ✅ `app/lib/services/gmailApiService.ts` → Gmail API OAuth2 + fetch
- ✅ `app/lib/services/emailProcessorService.ts` → Process fetched emails
- ✅ `app/api/inbox/sync/route.ts` → Trigger email sync

### **UPDATED Files:**
- ✅ `app/lib/utils/csv-parser.ts` → Add auto-delimiter detection
- ✅ `app/lib/utils/excel-parser.ts` → Handle Data sheet + Metadata sheet (Eitje format)
- ✅ `app/lib/services/documentParserService.ts` → Handle "coming soon" types
- ✅ `app/lib/types/inbox.types.ts` → Add "coming_soon" to DocumentType, add `archived` field
- ✅ `app/models/InboxEmail.ts` → Add `archived: boolean`, `archivedAt: Date` fields

---

## 📦 UPDATED DEPENDENCIES

### **KEPT (All Required):**
- ✅ `googleapis` → Gmail API client (OAuth2 + fetch)

### **ALSO KEPT:**
- ✅ `xlsx` → Excel parsing
- ✅ `pdfjs-dist` → PDF text extraction
- ✅ `multer` → File upload (for manual upload)
- ✅ `mime-types` → MIME detection
- ✅ `papaparse` → CSV parsing (already in package.json)

---

## 🎯 UPDATED DOCUMENT TYPE PRIORITIES

### **Tier 1: Build Now** ✅
1. **Eitje Hours** → CSV → eitje_hours
2. **Eitje Contracts** → XLSX → eitje_contracts
3. **Eitje Finance** → PDF → eitje_finance
4. **Bork Sales** → CSV/XLSX → bork_sales 🆕
5. **Bork Registry** → XLSX → bork_registry 🆕
6. **Power-BI** → CSV export → power_bi

### **Tier 2: Coming Soon** 🚧
7. **Formitabele** → Format unknown → "Coming Soon" badge
8. **Pasy** → Format unknown → "Coming Soon" badge

**UI Behavior:**
- Show "Coming Soon" badge in UI
- Parser returns: `{ status: 'coming_soon', message: 'Format not yet supported' }`
- Easy to add when format is known

---

## 🔄 UPDATED WORKFLOW

### **Scenario 1: Email Received (Your System)**
```
1. External system receives email to Gmail inbox
2. Your system extracts email metadata + attachments
3. POST /api/inbox/process
   Body: {
     email: { from, subject, receivedAt, ... },
     attachments: [{ fileName, mimeType, data: base64 }, ...]
   }
4. Service creates InboxEmail record
5. For each attachment:
   - Auto-detect format (CSV/Excel/PDF)
   - Auto-detect CSV delimiter (if CSV)
   - Parse (handle multi-sheet if Excel)
   - Detect document type
   - Map to collection
   - Store result
6. Return processing status
```

### **Scenario 2: Manual Upload (Unchanged)**
```
1. User: /daily-ops/inbox/upload
2. Drag CSV/Excel/PDF
3. POST /api/inbox/upload
4. Parse + display results
```

---

## ✅ UPDATED FEATURES

### **What We're Building:**
✅ Gmail API fetching (OAuth2 + automatic sync)  
✅ Auto-detect CSV delimiter (comma, semicolon, pipe, tab)  
✅ Excel multi-sheet support (Data sheet + Metadata sheet for Eitje)  
✅ PDF text extraction (no OCR)  
✅ Manual file upload  
✅ Inbox UI dashboard  
✅ Status tracking  
✅ Soft archiving (keep data, mark archived, retrievable)  
✅ "Coming Soon" badges for Formitabele/Pasy  

### **What We're NOT Building:**
❌ Formitabele parser (deferred - coming soon)  
❌ Pasy parser (deferred - coming soon)  
❌ Hard delete (data always kept, just archived)  

---

## 📊 UPDATED EFFORT ESTIMATE

| Phase | Original | Updated | Change |
|-------|----------|---------|--------|
| 1 | Types & Models | 1h | 1h | Same |
| 2 | DB Collections | 30m | 30m | Same |
| 3 | Gmail API | 2h | 2h | **RESTORED** |
| 4 | Document Parsers | 3h | 4h | **+1h** (Eitje metadata sheet handling) |
| 5 | Inbox Service | 1.5h | 1.5h | Same |
| 6 | Data Mapping | 1.5h | 1.5h | Same |
| 7 | API Routes | 2h | 2h | Same |
| 8 | DB Mappings | 1h | 1h | Same |
| 9 | UI Components | 3h | 3h | Same |
| 10 | Sidebar | 30m | 30m | Same |
| **TOTAL** | **~15.5h** | **~16.5h** | **+1h** |

**Net Result:** **+1 hour** (Gmail API + Eitje metadata sheet handling)

---

## 🎯 UPDATED SUCCESS CRITERIA

After implementation, you'll have:

✅ Gmail API automatic email fetching (OAuth2)  
✅ Auto-detection of CSV delimiter  
✅ Excel parsing (Data sheet + Metadata sheet for Eitje)  
✅ PDF text extraction  
✅ Data mapped to MongoDB collections  
✅ Processing status visible in UI  
✅ Manual upload option  
✅ Soft archiving (keep data, mark archived, retrievable)  
✅ "Coming Soon" placeholders for Formitabele/Pasy  
✅ Complete audit trail  
✅ Integrated into Daily Ops sidebar  

---

## 🚀 READY TO BUILD?

**Updated Status:** ✅ **PLAN UPDATED - READY FOR APPROVAL**

**Changes Summary:**
- ✅ **RESTORED** Gmail API fetching (OAuth2 + automatic sync)
- ✅ Added auto-delimiter detection for CSV
- ✅ Added Excel multi-sheet support (Data + Metadata sheets for Eitje)
- ✅ Confirmed PDF text extraction only
- ✅ Updated to soft archiving (keep data, mark archived, retrievable)
- ✅ Deferred Formitabele/Pasy (coming soon badges)

**Next Step:** Reply **"Go ahead"** to start Phase 1!

---

**Questions? Ask before we start building!**
