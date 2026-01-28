/**
 * @registry-id: OtherAllTestDataPage
 * @created: 2026-01-28T00:00:00.000Z
 * @last-modified: 2026-01-28T00:00:00.000Z
 * @description: Other all test data page - displays all test data from inbox attachments
 * @last-fix: [2026-01-28] Initial implementation
 */

'use client'

import { GenericDataView } from '@/components/test-data/GenericDataView'

export default function OtherAllTestDataPage() {
  return (
    <div className="container mx-auto p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">All Test Data</h1>
        <p className="text-muted-foreground">
          Raw test data from inbox attachments - exact copy, no transformations
        </p>
      </div>

      <GenericDataView type="sales" label="All Test Data" />
    </div>
  )
}
