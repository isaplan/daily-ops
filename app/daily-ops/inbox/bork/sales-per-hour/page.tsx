/**
 * @registry-id: BorkSalesPerHourPage
 * @created: 2026-01-28T00:00:00.000Z
 * @last-modified: 2026-01-28T00:00:00.000Z
 * @description: Bork sales per hour data page - displays sales per hour data from inbox attachments
 * @last-fix: [2026-01-28] Initial implementation
 */

'use client'

import { ProductSalesPerHourDataView } from '@/components/test-data/ProductSalesPerHourDataView'

export default function BorkSalesPerHourPage() {
  return (
    <div className="container mx-auto p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Sales Per Hour</h1>
        <p className="text-muted-foreground">
          Raw sales per hour data from inbox attachments - exact copy, no transformations
        </p>
      </div>

      <ProductSalesPerHourDataView />
    </div>
  )
}
