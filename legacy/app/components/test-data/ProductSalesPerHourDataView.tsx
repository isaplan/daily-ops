/**
 * @registry-id: ProductSalesPerHourDataViewComponent
 * @created: 2026-01-27T00:00:00.000Z
 * @last-modified: 2026-01-27T00:00:00.000Z
 * @description: Product Sales Per Hour data view component - displays raw product sales per hour data in a table
 * @last-fix: [2026-01-27] Initial implementation
 * 
 * @imports-from:
 *   - app/components/TestDataTable.tsx => TestDataTable component
 *   - app/lib/viewmodels/useTestDataViewModel.ts => useTestDataViewModel hook
 * 
 * @exports-to:
 *   ✓ app/daily-ops/inbox/test-data/page.tsx => Shows product sales per hour data
 */

'use client'

import { useEffect } from 'react'
import { useTestDataViewModel } from '@/lib/viewmodels/useTestDataViewModel'
import { TestDataTable } from '@/components/TestDataTable'

export function ProductSalesPerHourDataView() {
  const {
    state,
    currentPage,
    totalPages,
    total,
    columns,
    loadData,
    goToPage,
  } = useTestDataViewModel()

  useEffect(() => {
    loadData('product_sales_per_hour', 1, 50)
  }, [loadData])

  if (state.loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <p className="text-sm text-muted-foreground">Loading product sales per hour data...</p>
      </div>
    )
  }

  if (state.error) {
    return (
      <div className="flex items-center justify-center py-12">
        <p className="text-sm text-destructive">Error: {state.error}</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold">Product Sales Per Hour Data</h2>
        <p className="text-sm text-muted-foreground">
          Raw product sales per hour data from inbox attachments (no transformations)
        </p>
      </div>
      <TestDataTable
        rows={state.data}
        columns={columns}
        currentPage={currentPage}
        totalPages={totalPages}
        total={total}
        onPageChange={goToPage}
      />
    </div>
  )
}
