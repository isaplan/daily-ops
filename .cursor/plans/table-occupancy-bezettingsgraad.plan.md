---
name: table-occupancy-bezettingsgraad
overview: "ADR-013 occupancy — sealed in dashboard-bundle (daily→yearly), multi-grain series chart on Daily Ops dashboard, weekly/monthly digests already carry tableOccupancy."
todos:
  - id: cache-only-kpi
    content: KPI + bundle GET return sealed tableOccupancy (no live snapshot agg on GET)
    status: completed
  - id: series-grains
    content: Seal series for day/DOW/week/WoM/month/MoY/year + avgMonthlyOccupancyPct on yearly
    status: completed
  - id: dashboard-chart
    content: DailyOpsOccupancySection between venue strip and revenue (grain tabs)
    status: completed
  - id: monthly-ui
    content: Monthly/weekly overview Bezettingsgraad card (digest.tableOccupancy)
    status: completed
isProject: false
---

# Table occupancy (Bezettingsgraad) — done shape

**Graph location:** `/daily-ops` — **below Profit by Time of Day** (`DailyOpsOccupancySection` in `DailyOpsRevenueMetricsSection`). Grain follows **top period nav** (no local selector): day→hour · week→day · month→week · year→month.

**Cache:** `daily_ops_read_cache` · `dashboard-bundle` · `tableOccupancy` (+ `series`, yearly `avgMonthlyOccupancyPct`). Rebuild cascade to refresh sealed JSON.

**Reports:** Weekly + monthly digests already include `tableOccupancy`; overview card shows %.
