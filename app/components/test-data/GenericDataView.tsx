/**
 * @registry-id: GenericDataViewComponent
 * @created: 2026-01-27T00:00:00.000Z
 * @last-modified: 2026-01-27T00:00:00.000Z
 * @description: Generic data view component - displays raw data in a table for any data type
 * @last-fix: [2026-01-27] Initial implementation
 * 
 * @imports-from:
 *   - app/components/TestDataTable.tsx => TestDataTable component
 *   - app/lib/viewmodels/useTestDataViewModel.ts => useTestDataViewModel hook
 * 
 * @exports-to:
 *   ✓ app/daily-ops/inbox/test-data/page.tsx => Shows generic data
 */

'use client'

import { useEffect } from 'react'
import { useTestDataViewModel, type TestDataType } from '@/lib/viewmodels/useTestDataViewModel'
import { TestDataTable } from '@/components/TestDataTable'

interface GenericDataViewProps {
  type: TestDataType | 'hours' | 'contracts' | 'finance' | 'bi'
  label: string
}

export function GenericDataView({ type, label }: GenericDataViewProps) {
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
    loadData(type as TestDataType, 1, 50)
  }, [loadData, type])

  if (state.loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <p className="text-sm text-muted-foreground">Loading {label.toLowerCase()} data...</p>
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
        <h2 className="text-lg font-semibold">{label} Data</h2>
        <p className="text-sm text-muted-foreground">
          Raw {label.toLowerCase()} data from inbox attachments (no transformations)
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
