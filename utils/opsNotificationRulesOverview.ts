/**
 * Human-readable rules for /ops-notifications — keep in sync with server/utils/opsNotifications/detectors/*
 */

export type OpsNotificationRuleSection = {
  id: string
  title: string
  paragraphs: string[]
  bullets?: string[]
}

export const OPS_NOTIFICATION_RULES_INTRO =
  'This page scans completed register days for VKB, Bar Bea, and l\'Amour. A high count after the first scan is normal — many rows are the same root cause (e.g. missing morning Basis or Bork vs Inbox gap). Fix with snapshot rebuilds or source/cron fixes; architecture items are tracked until we refactor together.'

export const OPS_NOTIFICATION_RULE_SECTIONS: OpsNotificationRuleSection[] = [
  {
    id: 'scope',
    title: 'Scan scope',
    paragraphs: [
      'Default window: last 30 completed register days (yesterday and earlier, Amsterdam register day).',
      'Venues: Van Kinsbergen, Bar Bea, l\'Amour Toujours only.',
      'Badge count uses a 14-day window for speed.',
    ],
  },
  {
    id: 'snapshot',
    title: 'Snapshot (ADR-004)',
    paragraphs: [
      'Daily Ops pages must read daily_ops_snapshot* only — never live Bork or inbox on GET.',
    ],
    bullets: [
      'Missing revenue snapshot — Bork API has sales for that day but no daily_ops_snapshot_section_revenue row.',
      'Revenue snapshot empty — snapshot row exists but headline ex-VAT is €0 while Bork has sales.',
      'Revenue snapshot wrong Basis row — snapshot total ≠ morning Basis email (cron 7 or 8); often caused by picking cron 23 instead of final yesterday.',
      'Missing labor snapshot — Eitje time-registration aggregation has hours but no labor snapshot section.',
      'Missing master snapshot — revenue section exists without daily_ops_snapshot master doc.',
    ],
  },
  {
    id: 'source',
    title: 'Bork API vs Inbox (Basis)',
    paragraphs: [
      'Cross-checks bork_business_days_v2 vs inbox-bork-basis-report. Morning final = cron_hour 7 or 8 (“Yesterday” report).',
      'Large gap = difference ≥ €500 and ≥ 10% of the larger value.',
    ],
    bullets: [
      'Inbox final missing (Bork has sales) — no morning Basis row while Bork day total > €0.',
      'Bork API missing (Inbox has final) — morning Basis has revenue but Bork day total is €0.',
      'Bork vs Inbox gap — both have data but totals diverge beyond thresholds.',
    ],
  },
  {
    id: 'cron',
    title: 'Cron / inbox pipeline',
    paragraphs: [
      'Inbox polls (Amsterdam): 08:05 morning final, 18:05 and 23:05 intraday partials. See server/tasks/inbox/gmail-sync.ts.',
    ],
    bullets: [
      'Morning Basis missing — Bork has sales but no cron 7/8 row for that business_date.',
      'Only intraday partial — rows for cron 18/23 only; no morning final (headline revenue unreliable).',
      'Eitje hours inbox missing — Eitje aggregation has hours but no inbox-eitje-hours row for control.',
    ],
  },
  {
    id: 'integrity',
    title: 'Data integrity',
    bullets: [
      'Unmapped Basis location — inbox row has no location_id (add alias on unified_location, re-parse).',
    ],
    paragraphs: [],
  },
  {
    id: 'architecture',
    title: 'ADR / code health (platform)',
    paragraphs: [
      'These are not venue-day fixes — they stay until we refactor the listed files together.',
    ],
    bullets: [
      'ADR-004 violation — revenue-related GET path still reads bork_raw_data, bork_sales_by_*, or fillHourlyMatrixFromBork (watched files in detectors/architecture.ts).',
      'Monolithic module — file exceeds line budget (e.g. dailyOpsDashboardMetrics.ts > 600 lines).',
    ],
  },
  {
    id: 'basis-pick',
    title: 'Basis revenue pick (SSOT)',
    paragraphs: [
      'When building snapshots, final yesterday revenue = pickBasisReportByCronPriority (cron 7 or 8 wins over 18/23).',
      'Never use “latest cron_hour” for headline totals.',
    ],
  },
  {
    id: 'actions',
    title: 'Actions on this page',
    bullets: [
      'Rebuild snapshot — runs buildDailyOpsSnapshot for one venue-day (snapshot category only).',
      'Fix hint — CLI or ops step shown per row.',
      'Architecture / source / cron rows — fix in code or ops pipeline, not via rebuild button.',
    ],
    paragraphs: [],
  },
]
