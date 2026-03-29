/**
 * @registry-id: BorkProductMixPage
 * @created: 2026-01-28T00:00:00.000Z
 * @last-modified: 2026-01-28T00:00:00.000Z
 * @description: Bork product mix data page - displays product mix data from inbox attachments
 * @last-fix: [2026-01-28] Initial implementation
 */

'use client'

import { ProductMixDataView } from '@/components/test-data/ProductMixDataView'

export default function BorkProductMixPage() {
  return (
    <div className="container mx-auto p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Product Mix</h1>
        <p className="text-muted-foreground">
          Raw product mix data from inbox attachments - exact copy, no transformations
        </p>
      </div>

      <ProductMixDataView />
    </div>
  )
}
