/**
 * @registry-id: inboxParseAPI
 * @created: 2026-01-26T00:00:00.000Z
 * @last-modified: 2026-01-26T00:00:00.000Z
 * @description: Inbox parse API - parse file without storing (preview only)
 * @last-fix: [2026-01-26] Initial implementation
 * 
 * @imports-from:
 *   - app/lib/services/documentParserService.ts => Document parsing
 * 
 * @exports-to:
 *   ✓ app/daily-ops/inbox/upload/page.tsx => Preview parse results
 */

import { NextRequest, NextResponse } from 'next/server'
import { documentParserService } from '@/lib/services/documentParserService'

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const file = formData.get('file') as File

    if (!file) {
      return NextResponse.json(
        { success: false, error: 'No file provided' },
        { status: 400 }
      )
    }

    // Validate file size (max 10MB)
    if (file.size > 10 * 1024 * 1024) {
      return NextResponse.json(
        { success: false, error: 'File size exceeds 10MB limit' },
        { status: 400 }
      )
    }

    // Read file
    const arrayBuffer = await file.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)

    // Parse document (no storage)
    const parseResult = await documentParserService.parseDocument({
      fileName: file.name,
      mimeType: file.type,
      data: file.type.includes('csv') ? buffer.toString('utf-8') : buffer,
      autoDetectType: true,
    })

    return NextResponse.json({
      success: parseResult.success,
      data: parseResult,
    })
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to parse file',
      },
      { status: 500 }
    )
  }
}
