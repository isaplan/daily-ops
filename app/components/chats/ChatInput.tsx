/**
 * Simple native chat input with markdown, mentions, hashtags, and media uploads
 * Layout: Header (styling icons) | Content (textarea) | Footer (media uploads)
 */

'use client'

import { useRef, useState, useCallback, useEffect } from 'react'
import { useMentionDataViewModel } from '@/lib/viewmodels/useMentionDataViewModel'
import { uploadChatFile, validateFile, type UploadResult } from '@/lib/utils/chatUpload'
import { parseMarkdown } from '@/lib/utils/markdown'
import { Bold, Italic, Code, List, Link as LinkIcon, Image as ImageIcon, Video, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { Separator } from '@/components/ui/separator'
import '../chats/ChatInput.css'

interface ChatInputProps {
  content?: string
  onChange?: (html: string, plainText: string, attachments?: UploadResult[]) => void
  onSubmit?: (html: string, plainText: string, attachments?: UploadResult[]) => void
  placeholder?: string
  disabled?: boolean
}

export default function ChatInput({
  content = '',
  onChange,
  onSubmit,
  placeholder = 'Type a message... Use **bold**, *italic*, `code`, @mentions, #hashtags',
  disabled = false,
}: ChatInputProps) {
  const { getMentionItems } = useMentionDataViewModel()
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const imageInputRef = useRef<HTMLInputElement>(null)
  const videoInputRef = useRef<HTMLInputElement>(null)
  const [text, setText] = useState(content)
  const [attachments, setAttachments] = useState<UploadResult[]>([])
  const [uploading, setUploading] = useState(false)
  const [mentionQuery, setMentionQuery] = useState('')
  const [mentionSuggestions, setMentionSuggestions] = useState<Array<{ id: string; title: string }>>([])
  const [showMentions, setShowMentions] = useState(false)
  const [mentionPosition, setMentionPosition] = useState({ top: 0, left: 0 })
  const [cursorPosition, setCursorPosition] = useState(0)
  const [selectionStart, setSelectionStart] = useState(0)
  const [selectionEnd, setSelectionEnd] = useState(0)
  const mentionDropdownRef = useRef<HTMLDivElement>(null)

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 200)}px`
    }
  }, [text])

  // Insert text at cursor
  const insertText = useCallback((before: string, after: string = '') => {
    if (!textareaRef.current) return
    
    const start = selectionStart
    const end = selectionEnd
    const selectedText = text.substring(start, end)
    const newText = text.substring(0, start) + before + selectedText + after + text.substring(end)
    
    setText(newText)
    handleTextChange(newText)
    
    // Restore cursor position
    setTimeout(() => {
      if (textareaRef.current) {
        const newPos = start + before.length + selectedText.length + after.length
        textareaRef.current.setSelectionRange(newPos, newPos)
        textareaRef.current.focus()
      }
    }, 0)
  }, [text, selectionStart, selectionEnd])

  // Handle mention autocomplete
  const handleTextChange = useCallback(
    (value: string) => {
      setText(value)
      
      // Check for @ mention
      const cursorPos = textareaRef.current?.selectionStart || 0
      const textBeforeCursor = value.substring(0, cursorPos)
      const mentionMatch = textBeforeCursor.match(/@(\w*)$/)
      
      if (mentionMatch) {
        const query = mentionMatch[1]
        setMentionQuery(query)
        setCursorPosition(cursorPos)
        
        // Get suggestions
        getMentionItems(query).then((items) => {
          setMentionSuggestions(items)
          setShowMentions(items.length > 0)
          
          // Position mention dropdown - above if not enough space below
          requestAnimationFrame(() => {
            if (textareaRef.current) {
              const rect = textareaRef.current.getBoundingClientRect()
              const estimatedDropdownHeight = Math.min(items.length * 40 + 16, 300) // ~40px per item + padding
              const spaceBelow = window.innerHeight - rect.bottom
              const spaceAbove = rect.top
              
              // Position above if not enough space below, or if more space above
              if (spaceBelow < estimatedDropdownHeight && spaceAbove > spaceBelow) {
                setMentionPosition({
                  top: Math.max(8, rect.top - estimatedDropdownHeight), // At least 8px from top
                  left: rect.left,
                })
              } else {
                setMentionPosition({
                  top: rect.bottom + 4, // 4px gap below textarea
                  left: rect.left,
                })
              }
            }
          })
        })
      } else {
        setShowMentions(false)
      }

      // Parse markdown and notify parent
      const parsed = parseMarkdown(value)
      onChange?.(parsed.html, parsed.plainText, attachments)
    },
    [onChange, attachments, getMentionItems]
  )

  // Insert mention
  const insertMention = useCallback(
    (mention: { id: string; title: string }) => {
      const cursorPos = cursorPosition
      const textBefore = text.substring(0, cursorPos)
      const textAfter = text.substring(cursorPos)
      const beforeMention = textBefore.replace(/@\w*$/, '')
      const newText = `${beforeMention}@${mention.title} ${textAfter}`
      
      setText(newText)
      setShowMentions(false)
      onChange?.(parseMarkdown(newText).html, parseMarkdown(newText).plainText, attachments)
      
      // Focus back on textarea
      setTimeout(() => {
        textareaRef.current?.focus()
        const newPos = beforeMention.length + mention.title.length + 2
        textareaRef.current?.setSelectionRange(newPos, newPos)
      }, 0)
    },
    [text, cursorPosition, attachments, onChange]
  )

  // Handle file upload
  const handleFileSelect = async (file: File, type: 'image' | 'video') => {
    const validation = validateFile(file)
    if (!validation.valid) {
      alert(validation.error || 'Invalid file')
      return
    }

    try {
      setUploading(true)
      const result = await uploadChatFile(file)
      setAttachments((prev) => [...prev, result])
      
      // Insert markdown image/video reference
      if (result.type === 'image') {
        const imageMarkdown = `![${result.filename}](${result.url})\n`
        const newText = text + imageMarkdown
        setText(newText)
        handleTextChange(newText)
      } else if (result.type === 'video') {
        const videoMarkdown = `<video src="${result.url}" controls></video>\n`
        const newText = text + videoMarkdown
        setText(newText)
        handleTextChange(newText)
      }
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Upload failed')
    } finally {
      setUploading(false)
      if (imageInputRef.current) imageInputRef.current.value = ''
      if (videoInputRef.current) videoInputRef.current.value = ''
    }
  }

  // Handle drag and drop
  const handleDrop = useCallback(
    async (e: React.DragEvent) => {
      e.preventDefault()
      const file = e.dataTransfer.files[0]
      if (!file) return

      const type = file.type.startsWith('image/') ? 'image' : file.type.startsWith('video/') ? 'video' : null
      if (!type) {
        alert('Please upload an image or video')
        return
      }

      await handleFileSelect(file, type)
    },
    [text, handleTextChange]
  )

  // Handle paste image
  const handlePaste = useCallback(
    async (e: React.ClipboardEvent) => {
      const items = e.clipboardData.items
      for (let i = 0; i < items.length; i++) {
        const item = items[i]
        if (item.type.indexOf('image') !== -1) {
          e.preventDefault()
          const file = item.getAsFile()
          if (!file) continue

          await handleFileSelect(file, 'image')
        }
      }
    },
    [text, handleTextChange]
  )

  // Handle submit
  const handleSubmit = () => {
    if (disabled || !text.trim() && attachments.length === 0) return
    
    const parsed = parseMarkdown(text)
    onSubmit?.(parsed.html, parsed.plainText, attachments)
    setText('')
    setAttachments([])
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
    }
  }

  // Handle keyboard shortcuts
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // Submit on Cmd/Ctrl + Enter
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
      e.preventDefault()
      handleSubmit()
      return
    }

    // Handle mention selection
    if (showMentions && mentionSuggestions.length > 0) {
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp' || e.key === 'Enter') {
        e.preventDefault()
        if (e.key === 'Enter') {
          insertMention(mentionSuggestions[0])
        }
        return
      }
    }

    // Update cursor position
    setCursorPosition(e.currentTarget.selectionStart || 0)
    setSelectionStart(e.currentTarget.selectionStart || 0)
    setSelectionEnd(e.currentTarget.selectionEnd || 0)
  }

  // Sync content prop - only accept plain text, strip HTML if provided
  useEffect(() => {
    if (content !== undefined) {
      // Strip HTML tags if content is HTML (fallback for backwards compatibility)
      const plainText = content.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').trim()
      if (plainText !== text) {
        setText(plainText)
      }
    }
  }, [content, text])

  return (
    <TooltipProvider>
      <div className="chat-input-wrapper">
        {/* HEADER: Styling Icons */}
        <div className="chat-input-header">
          <div className="flex items-center gap-1">
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  onClick={() => insertText('**', '**')}
                  disabled={disabled}
                  className="chat-format-button"
                  aria-label="Bold"
                >
                  <Bold className="w-4 h-4" />
                </button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Bold (Cmd+B)</p>
              </TooltipContent>
            </Tooltip>
            
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  onClick={() => insertText('*', '*')}
                  disabled={disabled}
                  className="chat-format-button"
                  aria-label="Italic"
                >
                  <Italic className="w-4 h-4" />
                </button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Italic (Cmd+I)</p>
              </TooltipContent>
            </Tooltip>
            
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  onClick={() => insertText('`', '`')}
                  disabled={disabled}
                  className="chat-format-button"
                  aria-label="Code"
                >
                  <Code className="w-4 h-4" />
                </button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Inline Code</p>
              </TooltipContent>
            </Tooltip>
            
            <Separator orientation="vertical" className="h-4 mx-1" />
            
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  onClick={() => insertText('- ', '')}
                  disabled={disabled}
                  className="chat-format-button"
                  aria-label="List"
                >
                  <List className="w-4 h-4" />
                </button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Bullet List</p>
              </TooltipContent>
            </Tooltip>
            
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  onClick={() => {
                    const url = prompt('Enter URL:')
                    if (url) insertText(`[`, `](${url})`)
                  }}
                  disabled={disabled}
                  className="chat-format-button"
                  aria-label="Link"
                >
                  <LinkIcon className="w-4 h-4" />
                </button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Insert Link</p>
              </TooltipContent>
            </Tooltip>
          </div>
        </div>

        {/* CONTENT: Textarea */}
        <div
          className="chat-input-content"
          onDrop={handleDrop}
          onDragOver={(e) => e.preventDefault()}
        >
          <textarea
            ref={textareaRef}
            value={text}
            onChange={(e) => handleTextChange(e.target.value)}
            onKeyDown={handleKeyDown}
            onPaste={handlePaste}
            onSelect={(e) => {
              setCursorPosition(e.currentTarget.selectionStart || 0)
              setSelectionStart(e.currentTarget.selectionStart || 0)
              setSelectionEnd(e.currentTarget.selectionEnd || 0)
            }}
            placeholder={placeholder}
            disabled={disabled}
            className="chat-textarea"
            rows={3}
          />
        </div>

        {/* FOOTER: Media Uploads */}
        <div className="chat-input-footer">
          <div className="flex items-center gap-2">
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  onClick={() => imageInputRef.current?.click()}
                  disabled={disabled || uploading}
                  className="chat-media-button"
                  aria-label="Upload image"
                >
                  <ImageIcon className="w-4 h-4" />
                  <span className="text-xs ml-1">Image</span>
                </button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Upload Image (or drag & drop, paste)</p>
              </TooltipContent>
            </Tooltip>
            
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  onClick={() => videoInputRef.current?.click()}
                  disabled={disabled || uploading}
                  className="chat-media-button"
                  aria-label="Upload video"
                >
                  <Video className="w-4 h-4" />
                  <span className="text-xs ml-1">Video</span>
                </button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Upload Video</p>
              </TooltipContent>
            </Tooltip>
          </div>
          
          {/* Attachment previews */}
          {attachments.length > 0 && (
            <div className="flex items-center gap-2 flex-wrap">
              {attachments.map((att) => (
                <div
                  key={att.id}
                  className="flex items-center gap-1 px-2 py-1 bg-muted rounded text-xs"
                >
                  {att.type === 'image' && <ImageIcon className="w-3 h-3" />}
                  {att.type === 'video' && <Video className="w-3 h-3" />}
                  <span className="max-w-[100px] truncate">{att.filename}</span>
                  <button
                    type="button"
                    onClick={() => {
                      setAttachments((prev) => prev.filter((a) => a.id !== att.id))
                    }}
                    className="ml-1 hover:text-destructive"
                    aria-label={`Remove ${att.filename}`}
                    title={`Remove ${att.filename}`}
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Hidden file inputs */}
        <label htmlFor="chat-image-upload" className="sr-only">
          Upload image
        </label>
        <input
          id="chat-image-upload"
          ref={imageInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0]
            if (file) handleFileSelect(file, 'image')
          }}
          aria-label="Upload image"
        />
        
        <label htmlFor="chat-video-upload" className="sr-only">
          Upload video
        </label>
        <input
          id="chat-video-upload"
          ref={videoInputRef}
          type="file"
          accept="video/*"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0]
            if (file) handleFileSelect(file, 'video')
          }}
          aria-label="Upload video"
        />

        {/* Mention suggestions - Fixed positioning with high z-index */}
        {showMentions && mentionSuggestions.length > 0 && typeof window !== 'undefined' && (
          <div
            ref={mentionDropdownRef}
            className="mention-suggestions-dropdown"
            style={{
              position: 'fixed',
              top: `${mentionPosition.top}px`,
              left: `${mentionPosition.left}px`,
              zIndex: 9999,
            }}
          >
            <ul className="mention-list">
              {mentionSuggestions.map((item) => (
                <li
                  key={item.id}
                  className="mention-item"
                  onClick={() => insertMention(item)}
                >
                  {item.title}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </TooltipProvider>
  )
}
