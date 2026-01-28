/**
 * @registry-id: PowerBIReportsPage
 * @created: 2026-01-28T00:00:00.000Z
 * @last-modified: 2026-01-28T00:00:00.000Z
 * @description: Power-BI reports data page - displays Power-BI reports from inbox attachments
 * @last-fix: [2026-01-28] Initial implementation
 */

'use client'

import { GenericDataView } from '@/components/test-data/GenericDataView'

export default function PowerBIReportsPage() {
  return (
    <div className="container mx-auto p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Reports</h1>
        <p className="text-muted-foreground">
          Raw Power-BI reports from inbox attachments - exact copy, no transformations
        </p>
      </div>

      <GenericDataView type="bi" label="Power-BI" />
    </div>
  )
}
