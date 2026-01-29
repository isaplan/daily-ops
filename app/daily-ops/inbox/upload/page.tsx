/**
 * @registry-id: InboxUploadPage
 * @created: 2026-01-26T00:00:00.000Z
 * @last-modified: 2026-01-26T00:00:00.000Z
 * @description: Inbox upload page - manual file upload interface
 * @last-fix: [2026-01-26] Initial implementation
 * 
 * @imports-from:
 *   - app/components/FileUploadZone.tsx => File upload component
 *   - app/components/ParsedDataTable.tsx => Parsed data table
 *   - app/components/ui/card.tsx => Card components
 *   - app/components/ui/button.tsx => Button component
 * 
 * @exports-to:
 *   ✓ app/daily-ops/inbox/page.tsx => Navigation link
 */

'use client'

import { useState } from 'react'
import { FileUploadZone } from '@/components/FileUploadZone'
import { ParsedDataTable } from '@/components/ParsedDataTable'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { ProcessingStatusBadge } from '@/components/ProcessingStatusBadge'
import type { ParseResult } from '@/lib/types/inbox.types'
import { Upload, CheckCircle2, XCircle } from 'lucide-react'
import { useRouter } from 'next/navigation'

export default function InboxUploadPage() {
  const router = useRouter()
  const [uploading, setUploading] = useState(false)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [parseResult, setParseResult] = useState<ParseResult | null>(null)
  const [uploadResult, setUploadResult] = useState<{
    emailId: string
    attachmentId: string
    mappingSuccess?: boolean
    mappingError?: string
    parseFailed?: boolean
  } | null>(null)
  const [uploadError, setUploadError] = useState<string | null>(null)

  const handleFileSelect = async (file: File) => {
    setUploading(true)
    setParseResult(null)
    setUploadResult(null)
    setUploadError(null)
    setSelectedFile(file)

    try {
      // First, parse to preview
      const formData = new FormData()
      formData.append('file', file)

      const parseResponse = await fetch('/api/inbox/parse', {
        method: 'POST',
        body: formData,
      })

      const parseText = await parseResponse.text()
      let parseData: { success?: boolean; data?: ParseResult; error?: string }
      try {
        parseData = parseText.startsWith('<') ? {} : JSON.parse(parseText)
      } catch {
        setParseResult({
          success: false,
          format: 'unknown',
          headers: [],
          rows: [],
          rowCount: 0,
          error: parseResponse.ok ? 'Invalid response from server' : `Server error ${parseResponse.status}. Check the console or try again.`,
        })
        return
      }
      if (parseData.success && parseData.data) {
        setParseResult(parseData.data)
      } else {
        setParseResult({
          success: false,
          format: 'unknown',
          headers: [],
          rows: [],
          rowCount: 0,
          error: parseData.error || 'Failed to parse file',
        })
      }
    } catch (error) {
      setParseResult({
        success: false,
        format: 'unknown',
        headers: [],
        rows: [],
        rowCount: 0,
        error: error instanceof Error ? error.message : 'Failed to parse file',
      })
    } finally {
      setUploading(false)
    }
  }

  const handleUpload = async () => {
    if (!parseResult || !parseResult.success) return
    if (!selectedFile) {
      setUploadError('No file to upload. Please select a file again.')
      return
    }

    setUploading(true)
    setUploadError(null)
    try {
      const formData = new FormData()
      formData.append('file', selectedFile)

      const response = await fetch('/api/inbox/upload', {
        method: 'POST',
        body: formData,
      })

      const text = await response.text()
      let data: { success?: boolean; data?: { email?: { _id: string }; mappingResult?: { success?: boolean; errors?: Array<{ error: string }>; mappedToCollection?: string }; parseFailed?: boolean; error?: string }; error?: string }
      try {
        data = text.startsWith('<') ? {} : JSON.parse(text)
      } catch {
        setUploadError(response.ok ? 'Invalid response from server' : `Server error ${response.status}. Check the console or try again.`)
        return
      }
      if (data.success && data.data) {
        const mapping = data.data.mappingResult
        const parseFailed = data.data.parseFailed === true
        setUploadResult({
          emailId: data.data.email._id,
          attachmentId: data.data.attachment._id,
          mappingSuccess: parseFailed ? false : (mapping == null || mapping.success),
          mappingError: parseFailed
            ? (data.data.error ?? 'Parse failed')
            : mapping && !mapping.success
              ? (mapping.errors?.[0]?.error ?? `Failed to store in ${mapping.mappedToCollection}`)
              : undefined,
          parseFailed,
        })
      } else {
        setUploadError(data.error || 'Upload failed')
      }
    } catch (error) {
      setUploadError(error instanceof Error ? error.message : 'Upload failed')
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Manual Upload</h1>
        <p className="text-muted-foreground">Upload and parse documents manually</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Upload className="h-5 w-5" />
            Upload File
          </CardTitle>
        </CardHeader>
        <CardContent>
          <FileUploadZone onFileSelect={handleFileSelect} />
        </CardContent>
      </Card>

      {uploading && (
        <Card>
          <CardContent className="py-8">
            <div className="flex items-center justify-center gap-2">
              <Skeleton className="h-4 w-4 rounded-full animate-spin" />
              <span className="text-sm text-muted-foreground">Processing...</span>
            </div>
          </CardContent>
        </Card>
      )}

      {parseResult && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Parse Results</CardTitle>
              <ProcessingStatusBadge
                status={parseResult.success ? 'success' : 'failed'}
              />
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {parseResult.success ? (
              <>
                <div className="grid grid-cols-3 gap-4 text-sm">
                  <div>
                    <span className="font-medium">Format:</span> {parseResult.format.toUpperCase()}
                  </div>
                  <div>
                    <span className="font-medium">Rows:</span> {parseResult.rowCount}
                  </div>
                  <div>
                    <span className="font-medium">Columns:</span> {parseResult.headers.length}
                  </div>
                </div>
                {parseResult.documentType && (
                  <div>
                    <span className="font-medium">Document Type:</span>{' '}
                    {parseResult.documentType}
                  </div>
                )}
                {parseResult.rows.length > 0 && (
                  <div>
                    <ParsedDataTable
                      parsedData={{
                        _id: '',
                        attachmentId: '',
                        emailId: '',
                        documentType: parseResult.documentType || 'other',
                        extractedAt: new Date(),
                        format: parseResult.format,
                        rowsProcessed: parseResult.rowCount,
                        rowsValid: parseResult.rowCount,
                        rowsFailed: 0,
                        data: {
                          headers: parseResult.headers,
                          rows: parseResult.rows,
                          metadata: parseResult.metadata,
                        },
                        mapping: {},
                      }}
                    />
                  </div>
                )}
                {uploadError && (
                  <div className="bg-red-50 border border-red-200 rounded p-3 text-sm text-red-800">
                    {uploadError}
                  </div>
                )}
                {!uploadResult && (
                  <Button onClick={handleUpload} disabled={uploading} className="w-full">
                    Upload and Store
                  </Button>
                )}
              </>
            ) : (
              <div className="bg-red-50 border border-red-200 rounded p-3">
                <p className="text-sm text-red-800">{parseResult.error}</p>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {uploadResult && (
        <Card className={uploadResult.mappingSuccess !== false ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}>
          <CardContent className="py-6">
            <div className="flex items-center gap-3">
              {uploadResult.mappingSuccess !== false ? (
                <CheckCircle2 className="h-6 w-6 text-green-600" />
              ) : (
                <XCircle className="h-6 w-6 text-red-600" />
              )}
              <div className="flex-1">
                <p className={`font-medium ${uploadResult.mappingSuccess !== false ? 'text-green-800' : 'text-red-800'}`}>
                  {uploadResult.mappingSuccess !== false ? 'File uploaded and stored successfully.' : 'Upload failed: data was not stored.'}
                </p>
                <p className={`text-sm ${uploadResult.mappingSuccess !== false ? 'text-green-700' : 'text-red-700'}`}>
                  {uploadResult.parseFailed
                    ? `Parse failed: ${uploadResult.mappingError ?? 'unknown'}. Open the email and click Re-parse to try again.`
                    : uploadResult.mappingSuccess !== false
                      ? 'Data has been parsed and stored in the database.'
                      : uploadResult.mappingError ?? 'Missing required field or mapping error. You can still view the email.'}
                </p>
              </div>
              <Button
                variant="outline"
                onClick={() => router.push(`/daily-ops/inbox/${uploadResult.emailId}`)}
              >
                View Email
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
