# PERMANENT FIX: "Yesterday" Business Date Bug (Commit c7112dd)

## Problem
The recurring bug: **Daily Report Sales Yesterday** (e.g. from 25/05/2026) was stored with `business_date=2026-05-25` instead of the correct `2026-05-24`.

### Root Cause
The email subject contains "**Yesterday**" as an authoritative semantic signal that the report is for the previous calendar day. However, the code ignored this signal and used generic `calendarToBusinessDay()` logic based on `cron_hour` alone:

```typescript
// OLD (WRONG)
const { businessDate, businessHour } = calendarToBusinessDay(dateStr, cronHour)
// ^ Would set business_date = same day if cron_hour >= 8
```

This logic only respects `cron_hour >= 8` → same day, `cron_hour < 8` → previous day. But "Yesterday" reports could have ANY cron_hour (7, 8, 9, etc.), leading to wrong business_date assignments.

## Solution: Email Subject as SSOT

Email subject "Yesterday" is now the **Single Source of Truth** for previous-day business_date, overriding generic logic:

```typescript
// NEW (FIXED)
const hasYesterdayInSubject = subject?.includes('Yesterday') ?? false
const { businessDate, businessHour } = hasYesterdayInSubject
  ? { businessDate: addCalendarDaysISO(dateStr, -1), businessHour: cronHour }
  : calendarToBusinessDay(dateStr, cronHour)
```

## Files Changed

### 1. `server/utils/inbox/basis-report-mapper.ts` (PRIMARY FIX)
- **Lines 264-272**: Check `subject.includes('Yesterday')` before `calendarToBusinessDay()`
- **Metadata updated**: `@last-fix: [2026-05-25] PERMANENT FIX...`, `@adr-ref: ADR-004`
- **Why here**: This is where email parsing → MongoDB `inbox-bork-basis-report` storage happens

### 2. `server/utils/dailyOpsSnapshot/resolveSources.ts` (SOURCE SELECTION FIX)
- **Lines 68-72**: Use `pickBasisReportByCronPriority()` SSOT instead of raw `cron_hour` sorting
- **Before**: `.sort({ cron_hour: -1 })` would incorrectly pick intraday `cron_hour=23` over morning `cron_hour=8`
- **After**: Respects priority 3=morning (7|8), 2=23:00, 1=18:00
- **Why this matters**: Snapshot fingerprints now pick the correct authoritative report for daily reads

### 3. `scripts/migrate-basis-reports-add-business-date.ts` (BACKFILL)
- **Lines 63-67**: Apply same "Yesterday" semantic to historical records
- **Looks for**: `doc.metadata?.email_subject?.includes('Yesterday')`
- **Why needed**: Existing inbox records with wrong business_date must be corrected for consistency

## Regression Prevention

### Permanent Markers
1. **Email subject check is explicit**: Code clearly documents "Yesterday" is SSOT
2. **Metadata headers document intent**: `@last-fix: [2026-05-25]` + `@adr-ref: ADR-004` link to decision
3. **Priority logic is centralized**: `pickBasisReportByCronPriority` (lines 656-674 in mapper) is the ONLY place cron priority is defined

### How to Prevent Re-regression
If someone tries to "optimize" and reverts this logic:
- ❌ **Search for**: `calendarToBusinessDay(dateStr, cronHour)` without "Yesterday" check → **RED FLAG**
- ✅ **Correct pattern**: Always check `hasYesterdayInSubject` first
- ✅ **Run validation**: Test reports with "Daily Report Sales Yesterday ... 25/05/2026" must produce `business_date=2026-05-24`

## Testing

### Manual Test Case
```javascript
// Inbox email:
subject: "Daily Report Sales Yesterday 25/05/2026 van Kinsbergen"
received_at: 2026-05-25T08:15:00Z
date: "2026-05-25"  // parsed from subject as ISO
cron_hour: 8

// BEFORE FIX (WRONG):
business_date: "2026-05-25"  // ❌ Same day

// AFTER FIX (CORRECT):
business_date: "2026-05-24"  // ✅ Previous day (Yesterday)
```

### Run Migration
```bash
# Backfill all inbox + test records
node --experimental-strip-types scripts/migrate-basis-reports-add-business-date.ts
```

### Snapshot Rebuild
```bash
# Force full snapshot rebuild after migration
node scripts/rebuild-daily-ops-snapshot-full.ts --date 2026-05-24
```

## Related ADRs & Docs
- **ADR-004**: Daily Ops GET = snapshot only (no live Bork/inbox on reads)
- **`DECISIONS.md`**: Links to ADR-004 + ADR-006 (retention tiers)
- **`.cursor/rules/agent-rules.mdc`**: Cron priority documented in rules

## Commit Hash
`c7112dd` — "fix: PERMANENT FIX for recurring 'Yesterday' business_date assignment bug (ADR-004)"

---

**Last Updated**: 2026-05-25 12:24 UTC  
**Author**: System  
**Status**: ✅ FIXED (3 files, 1 commit)
