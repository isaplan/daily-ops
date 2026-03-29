/**
 * @registry-id: TestDataTableComponent
 * @created: 2026-01-27T00:00:00.000Z
 * @last-modified: 2026-01-27T00:00:00.000Z
 * @description: Test data table component - displays raw test data rows in a table with pagination
 * @last-fix: [2026-01-27] Initial implementation
 * 
 * @imports-from:
 *   - app/components/ui/table.tsx => Table components
 *   - app/components/ui/button.tsx => Button component
 *   - app/lib/viewmodels/useTestDataViewModel.ts => TestDataRow type
 * 
 * @exports-to:
 *   ✓ app/components/test-data/** => Shows test data in tables
 *   ✓ app/daily-ops/inbox/test-data/page.tsx => Displays test data
 */

'use client'

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import type { TestDataRow } from '@/lib/viewmodels/useTestDataViewModel'
import { ChevronLeft, ChevronRight } from 'lucide-react'

interface TestDataTableProps {
  rows: TestDataRow[]
  columns: string[]
  currentPage: number
  totalPages: number
  total: number
  onPageChange: (page: number) => void
  pageSize?: number
}

// Metadata fields to exclude from display
const METADATA_FIELDS = [
  '_id',
  'sourceEmailId',
  'sourceAttachmentId',
  'sourceFileName',
  'fileFormat',
  'parsedAt',
  'created_at',
  'updated_at',
  '__v',
]

export function TestDataTable({
  rows,
  columns,
  currentPage,
  totalPages,
  total,
  onPageChange,
  pageSize = 50,
}: TestDataTableProps) {
  // Filter out metadata columns for display
  const displayColumns = columns.filter((col) => !METADATA_FIELDS.includes(col))
  
  // If no display columns, show all columns except metadata
  const finalColumns = displayColumns.length > 0 ? displayColumns : columns.filter((col) => !METADATA_FIELDS.includes(col))

  const startIndex = (currentPage - 1) * pageSize
  const endIndex = Math.min(startIndex + pageSize, total)

  const formatValue = (value: unknown): string => {
    if (value === null || value === undefined) return '-'
    if (typeof value === 'object') {
      try {
        return JSON.stringify(value)
      } catch {
        return String(value)
      }
    }
    return String(value)
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="text-sm text-muted-foreground">
          Showing {startIndex + 1}-{endIndex} of {total} rows
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => onPageChange(Math.max(1, currentPage - 1))}
            disabled={currentPage === 1}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-sm text-muted-foreground">
            Page {currentPage} of {totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => onPageChange(Math.min(totalPages, currentPage + 1))}
            disabled={currentPage === totalPages}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="border rounded-md overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              {finalColumns.map((column) => (
                <TableHead key={column} className="whitespace-nowrap">
                  {column}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={finalColumns.length} className="text-center py-8">
                  No data available
                </TableCell>
              </TableRow>
            ) : (
              rows.map((row, index) => (
                <TableRow key={row._id || index}>
                  {finalColumns.map((column) => (
                    <TableCell key={column} className="max-w-xs truncate" title={formatValue(row[column])}>
                      {formatValue(row[column])}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
