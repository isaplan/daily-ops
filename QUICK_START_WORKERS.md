# Quick Reference: Worker Management

## 📧 Send Invitations Now

**Location of CSV file:**
```
/Users/alviniomolina/Documents/GitHub/daily-ops/exports/active-workers-2026-03-30.csv
```

Contains: 55 active workers with names, emails, contract types, and hourly rates.

---

## 🌐 View in App

Navigate to your app at: `/workers/active`

Features:
- View all 55 active workers
- See their contract details
- Download CSV for email campaigns
- Copy email addresses
- View breakdown by contract type

---

## 🔌 API Endpoints

### Get Active Workers Only
```
GET /api/workers/active
```

Response: Array of 55 workers ready to invite

### Get All Workers (with filter)
```
GET /api/workers              # All with email
GET /api/workers?active=true  # Only active
GET /api/workers?active=false # Only inactive
```

---

## 🛠️ Useful Commands

### Re-run Import (from newer CSV)
```bash
cd /Users/alviniomolina/Documents/GitHub/daily-ops
npx ts-node scripts/import-worker-data-from-csv.ts
```

### Export Active Workers Again
```bash
npx ts-node scripts/export-active-workers.ts
```

---

## 📊 Key Stats

- **Active workers:** 55 (ready to invite)
- **With emails:** 99 out of 101
- **Contract types:** nul uren (34), uren contract (18), zzp (3)
- **All data:** names, emails, contracts, rates, contact info

---

## ✅ What's Included

1. **Imported Data** - All 101 workers from CSV into MongoDB
2. **API Endpoints** - Query workers via HTTP
3. **UI Page** - View and manage active workers
4. **Export Scripts** - Generate CSVs for email campaigns
5. **Database** - Fully populated with correct active/inactive status

---

## 🎯 Your Next Action

1. Open the CSV: `exports/active-workers-2026-03-30.csv`
2. Use it to send invitations to all 55 active workers
3. Workers will create accounts when they visit the app
4. Track their progress in the /workers/active page

---

## 📚 Full Documentation

For complete details, see: `WORKER_IMPORT_SUMMARY.md`
