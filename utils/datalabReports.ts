/**
 * @registry-id: datalabReports
 * @created: 2026-06-03T19:50:00.000Z
 * @last-modified: 2026-06-03T19:50:00.000Z
 * @description: Bork Datalab public report links per restaurant
 * 
 * @exports-to:
 * ✓ pages/daily-ops/datalab.vue
 * ✓ pages/daily-ops/datalab/view.vue
 */

export interface DatalabReport {
  id: string
  name: string
  url: string
}

export const DATALAB_REPORTS: DatalabReport[] = [
  {
    id: 'haagsenieuwe',
    name: 'HaagseNieuwe',
    url: 'https://app.borkdatalab.com/public/reports/NEmc7R5k642bRKDN?refresh=1',
  },
  {
    id: 'kinsbergen',
    name: 'Kinsbergen',
    url: 'https://app.borkdatalab.com/public/reports/gNPJVWjVqucbHbV7?refresh=1',
  },
  {
    id: 'bar-bea',
    name: 'Bar Bea',
    url: 'https://app.borkdatalab.com/public/reports/q6tmeLHphsYKgEDR?refresh=1',
  },
  {
    id: 'lamour-toujours',
    name: "l'AMour Toujours",
    url: 'https://app.borkdatalab.com/public/reports/rPx3ZohR6mHZkf4d?refresh=1',
  },
]

export function findDatalabReportById(id: string): DatalabReport | undefined {
  return DATALAB_REPORTS.find((report) => report.id === id)
}
