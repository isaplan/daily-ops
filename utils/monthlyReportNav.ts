export type MonthlyReportNavItem = {
  id: string
  label: string
}

export const MONTHLY_REPORT_NAV_ITEMS: MonthlyReportNavItem[] = [
  { id: 'kpi', label: 'KPI' },
  { id: 'staff-general', label: 'Staff' },
  { id: 'product-sales', label: 'Product Sales' },
  { id: 'labor', label: 'Labor' },
  { id: 'revenue-pnl', label: 'Revenue & PnL' },
  { id: 'tables', label: 'Tables' },
  { id: 'spaces', label: 'Spaces' },
]
