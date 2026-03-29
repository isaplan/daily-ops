/**
 * @registry-id: FileUploadZoneComponent
 * @created: 2026-01-26T00:00:00.000Z
 * @last-modified: 2026-01-26T00:00:00.000Z
 * @description: File upload zone component - drag and drop file upload with validation
 * @last-fix: [2026-01-26] Initial implementation
 * 
 * @imports-from:
 *   - app/components/ui/card.tsx => Card components
 *   - app/components/ui/button.tsx => Button component
 *   - app/components/ui/input.tsx => Input component
 * 
 * @exports-to:
 *   ✓ app/daily-ops/inbox/upload/page.tsx => File upload interface
 */

'use client'

import { useCallback, useState } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Upload, FileText, X } from 'lucide-react'

interface FileUploadZoneProps {
  onFileSelect: (file: File) => void
  acceptedFormats?: string[]
  maxSize?: number // in MB
}

export function FileUploadZone({
  onFileSelect,
  acceptedFormats = ['.csv', '.xlsx', '.xls', '.pdf'],
  maxSize = 10,
}: FileUploadZoneProps) {
  const [isDragging, setIsDragging] = useState(false)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [error, setError] = useState<string | null>(null)

  const validateFile = (file: File): string | null => {
    // Check size
    if (file.size > maxSize * 1024 * 1024) {
      return `File size exceeds ${maxSize}MB limit`
    }

    // Check format
    const fileExtension = '.' + file.name.split('.').pop()?.toLowerCase()
    if (!acceptedFormats.some((format) => fileExtension === format.toLowerCase())) {
      return `File format not supported. Accepted: ${acceptedFormats.join(', ')}`
    }

    return null
  }

  const handleFile = useCallback(
    (file: File) => {
      const validationError = validateFile(file)
      if (validationError) {
        setError(validationError)
        setSelectedFile(null)
        return
      }

      setError(null)
      setSelectedFile(file)
      onFileSelect(file)
    },
    [onFileSelect, maxSize, acceptedFormats]
  )

  const handleDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault()
      setIsDragging(false)

      const file = e.dataTransfer.files[0]
      if (file) {
        handleFile(file)
      }
    },
    [handleFile]
  )

  const handleDragOver = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    setIsDragging(true)
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    setIsDragging(false)
  }, [])

  const handleFileInput = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0]
      if (file) {
        handleFile(file)
      }
    },
    [handleFile]
  )

  return (
    <Card
      className={`border-2 border-dashed transition-colors ${
        isDragging ? 'border-primary bg-primary/5' : 'border-muted-foreground/25'
      }`}
      onDrop={handleDrop}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
    >
      <CardContent className="p-8">
        <div className="flex flex-col items-center justify-center text-center space-y-4">
          <Upload className={`h-12 w-12 ${isDragging ? 'text-primary' : 'text-muted-foreground'}`} />
          <div>
            <p className="text-sm font-medium">
              {selectedFile ? selectedFile.name : 'Drag and drop a file here'}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              or click to browse • Max {maxSize}MB • {acceptedFormats.join(', ')}
            </p>
          </div>
          {selectedFile && (
            <div className="flex items-center gap-2 bg-muted p-2 rounded">
              <FileText className="h-4 w-4" />
              <span className="text-sm">{selectedFile.name}</span>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setSelectedFile(null)
                  setError(null)
                }}
                className="h-4 w-4 p-0"
              >
                <X className="h-3 w-3" />
              </Button>
            </div>
          )}
          {error && (
            <div className="bg-red-50 border border-red-200 rounded p-2 text-sm text-red-800">
              {error}
            </div>
          )}
          <Button variant="outline" onClick={() => document.getElementById('file-input')?.click()}>
            Select File
          </Button>
          <input
            id="file-input"
            type="file"
            className="hidden"
            accept={acceptedFormats.join(',')}
            onChange={handleFileInput}
          />
        </div>
      </CardContent>
    </Card>
  )
}
