export type WeeklyReportNavItem = {
  id: string
  label: string
}

export const WEEKLY_REPORT_NAV_ITEMS: WeeklyReportNavItem[] = [
  { id: 'kpi', label: 'KPI' },
  { id: 'staff-general', label: 'Staff' },
  { id: 'labor', label: 'Labor' },
  { id: 'revenue-pnl', label: 'Revenue & PnL' },
  { id: 'tables', label: 'Tables' },
  { id: 'spaces', label: 'Spaces' },
]
