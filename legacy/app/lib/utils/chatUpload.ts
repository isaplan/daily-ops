/**
 * Chat upload utility - Related to ChatInput component
 * Handles file uploads for chat attachments (images, videos, files)
 */

export interface UploadResult {
  id: string
  url: string
  filename: string
  mimeType: string
  size: number
  type: 'image' | 'video' | 'file'
}

export async function uploadChatFile(file: File): Promise<UploadResult> {
  const formData = new FormData()
  formData.append('file', file)

  const response = await fetch('/api/files/upload', {
    method: 'POST',
    body: formData,
  })

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Upload failed' }))
    throw new Error(error.error || 'Failed to upload file')
  }

  const data = await response.json()
  if (!data.success || !data.data) {
    throw new Error(data.error || 'Upload failed')
  }

  const uploadData = data.data
  const mimeType = uploadData.mimeType || file.type
  const type: 'image' | 'video' | 'file' = mimeType.startsWith('image/')
    ? 'image'
    : mimeType.startsWith('video/')
    ? 'video'
    : 'file'

  return {
    id: uploadData.id || crypto.randomUUID(),
    url: uploadData.url,
    filename: uploadData.filename || file.name,
    mimeType,
    size: uploadData.size || file.size,
    type,
  }
}

export function validateFile(file: File): { valid: boolean; error?: string } {
  const MAX_SIZE = 10 * 1024 * 1024 // 10MB
  const ALLOWED_TYPES = [
    'image/jpeg',
    'image/png',
    'image/gif',
    'image/webp',
    'video/mp4',
    'video/webm',
    'video/ogg',
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  ]

  if (file.size > MAX_SIZE) {
    return { valid: false, error: 'File size exceeds 10MB limit' }
  }

  if (!ALLOWED_TYPES.includes(file.type)) {
    return { valid: false, error: 'File type not allowed' }
  }

  return { valid: true }
}
