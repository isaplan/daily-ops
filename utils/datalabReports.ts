/**
 * @registry-id: datalabReports
 * @created: 2026-06-03T19:50:00.000Z
 * @last-modified: 2026-06-03T19:50:00.000Z
 * @description: Bork Datalab public report links per restaurant
 * 
 * @exports-to:
 * ✓ pages/daily-ops/datalab.vue
 */

export interface DatalabReport {
  name: string
  url: string
}

export const DATALAB_REPORTS: DatalabReport[] = [
  {
    name: 'HaagseNieuwe',
    url: 'https://app.borkdatalab.com/public/reports/NEmc7R5k642bRKDN?refresh=1',
  },
  {
    name: 'Kinsbergen',
    url: 'https://app.borkdatalab.com/public/reports/gNPJVWjVqucbHbV7?refresh=1',
  },
  {
    name: 'Bar Bea',
    url: 'https://app.borkdatalab.com/public/reports/q6tmeLHphsYKgEDR?refresh=1',
  },
  {
    name: "l'AMour Toujours",
    url: 'https://app.borkdatalab.com/public/reports/rPx3ZohR6mHZkf4d?refresh=1',
  },
]
