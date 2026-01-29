/**
 * @registry-id: ParsedDataTableComponent
 * @created: 2026-01-26T00:00:00.000Z
 * @last-modified: 2026-01-26T00:00:00.000Z
 * @description: Parsed data table component - displays parsed rows in a table with pagination
 * @last-fix: [2026-01-26] Initial implementation
 * 
 * @imports-from:
 *   - app/components/ui/table.tsx => Table components
 *   - app/components/ui/button.tsx => Button component
 *   - app/lib/types/inbox.types.ts => ParsedData type
 * 
 * @exports-to:
 *   ✓ app/components/InboxEmailDetail.tsx => Shows parsed data preview
 */

'use client'

import { useState } from 'react'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import type { ParsedData } from '@/lib/types/inbox.types'
import { ChevronLeft, ChevronRight } from 'lucide-react'

interface ParsedDataTableProps {
  parsedData: ParsedData
  pageSize?: number
}

export function ParsedDataTable({ parsedData, pageSize = 20 }: ParsedDataTableProps) {
  const [currentPage, setCurrentPage] = useState(1)

  const rows = parsedData?.data?.rows
  const headers = parsedData?.data?.headers ?? []

  if (!Array.isArray(rows)) {
    return (
      <div className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">
        No parsed data to display. Data may not be loaded yet.
      </div>
    )
  }

  const totalPages = Math.max(1, Math.ceil(rows.length / pageSize))
  const startIndex = (currentPage - 1) * pageSize
  const endIndex = startIndex + pageSize
  const currentRows = rows.slice(startIndex, endIndex)

  const formatValue = (value: unknown): string => {
    if (value === null || value === undefined) return '-'
    if (typeof value === 'object') return JSON.stringify(value)
    return String(value)
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="text-sm text-muted-foreground">
          Showing {startIndex + 1}-{Math.min(endIndex, rows.length)} of{' '}
          {rows.length} rows
          {parsedData?.mapping?.mappedToCollection && (
            <>
              {' • '}
              <span className="font-medium">Mapped to:</span> {parsedData.mapping.mappedToCollection}
            </>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
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
            onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
            disabled={currentPage === totalPages}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="border rounded-md">
        <Table>
          <TableHeader>
            <TableRow>
              {headers.map((header) => (
                <TableHead key={header}>{header}</TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {currentRows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={headers.length || 1} className="text-center py-8">
                  No data available
                </TableCell>
              </TableRow>
            ) : (
              currentRows.map((row, index) => (
                <TableRow key={startIndex + index}>
                  {headers.map((header) => (
                    <TableCell key={header} className="max-w-xs truncate">
                      {formatValue(row[header])}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {parsedData?.validationErrors && parsedData.validationErrors.length > 0 && (
        <div className="bg-yellow-50 border border-yellow-200 rounded p-3">
          <p className="text-sm font-medium text-yellow-800 mb-2">Validation Errors:</p>
          <div className="space-y-1">
            {parsedData.validationErrors.slice(0, 5).map((error, idx) => (
              <p key={idx} className="text-xs text-yellow-700">
                Row {error.row}, {error.column}: {error.error}
              </p>
            ))}
            {parsedData.validationErrors.length > 5 && (
              <p className="text-xs text-yellow-700">
                ... and {parsedData.validationErrors.length - 5} more errors
              </p>
            )}
          </div>
        </div>
      )}

      {parsedData?.mapping?.createdRecords !== undefined && (
        <div className="flex items-center gap-4 text-sm">
          <Badge variant="outline" className="bg-green-50 text-green-800">
            Created: {parsedData.mapping.createdRecords}
          </Badge>
          {parsedData?.mapping?.updatedRecords !== undefined && parsedData.mapping.updatedRecords > 0 && (
            <Badge variant="outline" className="bg-blue-50 text-blue-800">
              Updated: {parsedData.mapping.updatedRecords}
            </Badge>
          )}
          {parsedData?.rowsFailed != null && parsedData.rowsFailed > 0 && (
            <Badge variant="outline" className="bg-red-50 text-red-800">
              Failed: {parsedData.rowsFailed}
            </Badge>
          )}
        </div>
      )}
    </div>
  )
}
