/**
 * @registry-id: BorkBasisReportPage
 * @created: 2026-01-28T00:00:00.000Z
 * @last-modified: 2026-01-28T00:00:00.000Z
 * @description: Bork basis report data page - displays basis report data from inbox attachments
 * @last-fix: [2026-01-28] Initial implementation
 */

'use client'

import { BasisReportDataView } from '@/components/test-data/BasisReportDataView'

export default function BorkBasisReportPage() {
  return (
    <div className="container mx-auto p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Basis Report</h1>
        <p className="text-muted-foreground">
          Raw basis report data from inbox attachments - exact copy, no transformations
        </p>
      </div>

      <BasisReportDataView />
    </div>
  )
}
