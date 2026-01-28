# 📧 INBOX FEATURE - FINAL CORRECTED PLAN

**Date:** 2026-01-26  
**Status:** ✅ **CORRECTED & READY TO BUILD**

---

## ✅ **FINAL CONFIRMATIONS**

### 1. **Gmail API Fetching** ✅ **INCLUDED**
- **Build:** Gmail API service with OAuth2
- **Function:** Automatically fetch emails from `inboxhaagsenieuwehorecagroep@gmail.com`
- **Trigger:** `POST /api/inbox/sync` (CronJob or manual)
- **Package:** `googleapis` (required)

### 2. **Excel Multi-Sheet (Eitje Format)** ✅ **SPECIAL HANDLING**
- **Eitje sends 2 sheets:**
  - **Sheet 1:** Data (hours, contracts, etc.) → Parse and store to collections
  - **Sheet 2:** Metadata + User info → Store as `EmailAttachment.metadata.userInfo`
- **Implementation:**
  - Parse both sheets separately
  - Data sheet → ParsedData → MongoDB collections
  - Metadata sheet → Stored in attachment metadata
  - UI shows both: data preview + user info

### 3. **Soft Archiving** ✅ **KEEP DATA, MARK ARCHIVED**
- **Policy:** Keep all data indefinitely, but mark old emails as archived
- **Fields:** `archived: boolean`, `archivedAt: Date`
- **Behavior:**
  - Default query: `archived: false` (show active emails)
  - User can toggle filter to see archived emails
  - Data never deleted, always retrievable
  - Archive after configurable period (e.g., 90 days)

---

## 📊 **FINAL ARCHITECTURE**

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
└──────────┬──────────────────────────────┘
           │
           ▼
┌─────────────────────────────────────────┐
│ Create InboxEmail Records               │
│ • Store email metadata                  │
│ • Store attachments                     │
│ • Status: 'received'                    │
└──────────┬──────────────────────────────┘
           │
           ▼
┌─────────────────────────────────────────┐
│ Document Parsers                        │
│ • CSV (auto-detect delimiter)           │
│ • Excel (Data + Metadata sheets)       │
│ • PDF (text extraction)                 │
└──────────┬──────────────────────────────┘
           │
           ▼
┌─────────────────────────────────────────┐
│ Data Mapping → MongoDB                  │
│ • Eitje Hours, Contracts, Finance       │
│ • Bork Sales, Registry                  │
│ • Power-BI                              │
│ • Formitabele/Pasy: "Coming Soon"       │
└──────────┬──────────────────────────────┘
           │
           ▼
┌─────────────────────────────────────────┐
│ Soft Archive (after 90 days)           │
│ • Set archived: true                    │
│ • Set archivedAt: Date                  │
│ • Keep all data (retrievable)           │
└─────────────────────────────────────────┘
```

---

## 🗄️ **UPDATED DATABASE SCHEMA**

### **InboxEmail Collection**
```typescript
interface InboxEmail {
  _id: ObjectId;
  messageId: string;                    // Gmail message ID (unique)
  from: string;
  subject: string;
  receivedAt: Date;
  storedAt: Date;
  status: 'received' | 'processing' | 'completed' | 'failed';
  hasAttachments: boolean;
  attachmentCount: number;
  summary?: string;
  errorMessage?: string;
  processedAt?: Date;
  lastAttempt?: Date;
  retryCount: number;
  archived: boolean;                     // ✅ NEW: Soft archive flag
  archivedAt?: Date;                     // ✅ NEW: Archive timestamp
  metadata: {
    labels?: string[];
    threadId?: string;
  };
}
```

### **EmailAttachment Collection**
```typescript
interface EmailAttachment {
  _id: ObjectId;
  emailId: ObjectId;
  fileName: string;
  mimeType: string;
  fileSize: number;
  googleAttachmentId: string;
  downloadedAt: Date;
  documentType: 'hours' | 'contracts' | 'finance' | 'sales' | 'payroll' | 'bi' | 'other';
  parseStatus: 'pending' | 'parsing' | 'success' | 'failed';
  parseError?: string;
  parsedDataRef?: ObjectId;
  metadata: {
    format: 'csv' | 'xlsx' | 'pdf' | 'unknown';
    sheets?: string[];                  // ✅ For Excel: ['Data', 'Metadata']
    rowCount?: number;
    columnCount?: number;
    userInfo?: Record<string, unknown>; // ✅ NEW: Eitje metadata sheet data
    delimiter?: string;                 // ✅ NEW: CSV delimiter (auto-detected)
  };
}
```

---

## 📋 **FINAL IMPLEMENTATION PHASES**

| Phase | What | Time | Files |
|-------|------|------|-------|
| 1 | Types & Models | 1h | 5 |
| 2 | DB Collections | 30m | 1 |
| 3 | **Gmail API Service** | **2h** | **2** |
| 4 | **Document Parsers** | **4h** | **5** (includes Eitje metadata) |
| 5 | Inbox Service | 1.5h | 1 |
| 6 | Data Mapping | 1.5h | 2 |
| 7 | API Routes | 2h | 6 |
| 8 | DB Mappings | 1h | - |
| 9 | UI Components | 3h | 7 |
| 10 | Sidebar Integration | 30m | 1 |
| **TOTAL** | **~16.5h** | **~30** |

---

## 🔧 **KEY FEATURES**

### **Gmail Integration** ✅
- OAuth2 authentication
- Fetch emails automatically
- Download attachments
- Sync endpoint: `POST /api/inbox/sync`
- CronJob support (optional)

### **Excel Eitje Format** ✅
- Parse Data sheet → Store to collections
- Parse Metadata sheet → Store as `userInfo`
- UI shows both: data + user info
- Handle both sheets correctly

### **CSV Auto-Detection** ✅
- Auto-detect delimiter: `,`, `;`, `|`, `\t`
- Store detected delimiter in metadata
- Use PapaParse detection

### **Soft Archiving** ✅
- Keep all data indefinitely
- Mark old emails as `archived: true`
- Default filter: `archived: false`
- User can view archived emails
- Never delete data

### **PDF Text Extraction** ✅
- Use `pdfjs-dist` for text extraction
- No OCR needed
- Extract tables where possible

---

## 📦 **DEPENDENCIES**

### **Required Packages:**
```json
{
  "googleapis": "^132.0.0",    // Gmail API (OAuth2 + fetch)
  "xlsx": "^0.18.5",           // Excel parsing
  "pdfjs-dist": "^4.0.0",      // PDF text extraction
  "multer": "^1.4.5",          // File upload
  "mime-types": "^2.1.35"      // MIME detection
}
```

### **Already Available:**
- `papaparse` → CSV parsing ✓
- `mongoose` → MongoDB ✓
- `next@15` → Framework ✓

---

## 🎯 **SUCCESS CRITERIA**

After implementation:

✅ Gmail API automatically fetches emails  
✅ Excel files parsed (Data + Metadata sheets)  
✅ CSV delimiter auto-detected  
✅ PDF text extracted  
✅ Data mapped to MongoDB collections  
✅ Soft archiving (keep data, mark archived)  
✅ Processing status visible in UI  
✅ Manual upload option  
✅ "Coming Soon" badges for Formitabele/Pasy  
✅ Complete audit trail  
✅ Integrated into Daily Ops sidebar  

---

## 🚀 **READY TO BUILD**

**Status:** ✅ **ALL CORRECTIONS APPLIED - READY FOR APPROVAL**

**Final Summary:**
- ✅ Gmail API fetching (OAuth2 + automatic sync)
- ✅ Excel multi-sheet (Data + Metadata for Eitje)
- ✅ CSV auto-delimiter detection
- ✅ PDF text extraction only
- ✅ Soft archiving (keep data, mark archived)
- ✅ Formitabele/Pasy deferred (coming soon)

**Next Step:** Reply **"Go ahead"** to start Phase 1!

---

**Questions? Ask before we start building!**
