/**
 * @registry-id: BorkSalesPage
 * @created: 2026-01-28T00:00:00.000Z
 * @last-modified: 2026-01-28T00:00:00.000Z
 * @description: Bork sales data page - displays sales data from inbox attachments
 * @last-fix: [2026-01-28] Initial implementation
 */

'use client'

import { SalesDataView } from '@/components/test-data/SalesDataView'

export default function BorkSalesPage() {
  return (
    <div className="container mx-auto p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Sales</h1>
        <p className="text-muted-foreground">
          Raw sales data from inbox attachments - exact copy, no transformations
        </p>
      </div>

      <SalesDataView />
    </div>
  )
}
