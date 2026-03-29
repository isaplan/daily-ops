/**
 * Self-contained PDF document: HTML + CSS only (hex colors, no Tailwind/oklch).
 * Used in an iframe so the main app keeps Tailwind; PDF has no global styles.
 */

import type { NoteBlock } from '~/types/noteBlock'

export const NOTE_PDF_CSS = `/* PDF-only. Hex only for html2canvas. */
*{box-sizing:border-box}
body{font-family:ui-sans-serif,system-ui,sans-serif;font-size:14px;line-height:1.5;color:#111827;background:#fff;margin:0;padding:24px}
.pdf-title{font-size:24px;font-weight:700;margin:0 0 24px;padding-bottom:8px;border-bottom:1px solid #e5e7eb}
.pdf-block{margin-bottom:24px}
.pdf-block-title{font-size:18px;font-weight:600;margin:0 0 8px;padding-bottom:4px;border-bottom:1px solid #d1d5db}
.pdf-body p{margin:0 0 .25em}
.pdf-body p:last-child{margin-bottom:0}
.pdf-body h1{font-size:20px;font-weight:700;margin:8px 0 4px}
.pdf-body h2{font-size:18px;font-weight:700;margin:8px 0 4px}
.pdf-body h3{font-size:16px;font-weight:700;margin:8px 0 4px}
.pdf-body ul,.pdf-body ol{padding-left:24px;margin:4px 0}
.pdf-body li{margin:2px 0}
.pdf-body hr{border:none;border-top:1px solid #e5e7eb;margin:8px 0}
.pdf-body a{color:#2563eb}
.pdf-body blockquote{border-left:4px solid #d1d5db;margin:8px 0;padding-left:16px;color:#374151}
.pdf-body code{background:#f3f4f6;border:1px solid #e5e7eb;padding:2px 6px;font-size:13px;border-radius:4px}
.pdf-list{margin:8px 0 8px 8px;padding-left:12px;border-left:2px solid #d1d5db;font-size:13px}
.pdf-list-item{margin:4px 0;display:flex;align-items:flex-start;gap:6px}
.pdf-list-item .pdf-icon{flex-shrink:0;width:14px;height:14px;margin-top:2px}
.pdf-todo-done{color:#6b7280;text-decoration:line-through}
`

function escapeHtml(text: string): string {
  const div = document.createElement('div')
  div.textContent = text
  return div.innerHTML
}

/* Inline SVGs so they print (no icon font). */
const SVG_CHECKBOX = '<svg class="pdf-icon" viewBox="0 0 24 24" fill="none" stroke="#6b7280" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/></svg>'
const SVG_CHECKBOX_CHECKED = '<svg class="pdf-icon" viewBox="0 0 24 24" fill="none" stroke="#6b7280" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2" fill="#e5e7eb"/><path d="M9 12l2 2 4-4"/></svg>'
const SVG_HANDSHAKE = '<svg class="pdf-icon" viewBox="0 0 24 24" fill="none" stroke="#6b7280" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 17h2a1 1 0 001-1v-1h1a1 1 0 001-1v-1a1 1 0 00-2 0v1h-1a1 1 0 01-1-1v-1a1 1 0 00-2 0v1a1 1 0 01-1 1H9a1 1 0 01-1-1v-1a1 1 0 00-2 0v1a1 1 0 001 1h1a1 1 0 001-1v-1a1 1 0 012 0v1a1 1 0 001 1z"/></svg>'

export function buildNotePdfDocument(
  title: string,
  blocks: NoteBlock[],
  legacyContent?: string
): string {
  let body = `<h1 class="pdf-title">${escapeHtml(title)}</h1>`
  if (blocks?.length) {
    for (const block of blocks) {
      body += '<div class="pdf-block">'
      if (block.title?.trim()) {
        body += `<div class="pdf-block-title">${escapeHtml(block.title)}</div>`
      }
      if (block.content) {
        body += `<div class="pdf-body">${block.content}</div>`
      }
      if (block.todos?.length) {
        body += '<div class="pdf-list pdf-todos">'
        for (const todo of block.todos) {
          const icon = todo.checked ? SVG_CHECKBOX_CHECKED : SVG_CHECKBOX
          body += `<div class="pdf-list-item">${icon}<span class="${todo.checked ? 'pdf-todo-done' : ''}">${escapeHtml(todo.text)}</span></div>`
        }
        body += '</div>'
      }
      if (block.agrees?.length) {
        body += '<div class="pdf-list">'
        for (const agree of block.agrees) {
          body += `<div class="pdf-list-item">${SVG_HANDSHAKE}<span>${escapeHtml(agree.text)}</span></div>`
        }
        body += '</div>'
      }
      body += '</div>'
    }
  } else if (legacyContent) {
    body += `<div class="pdf-body">${legacyContent}</div>`
  }
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><style>${NOTE_PDF_CSS}</style></head><body>${body}</body></html>`
}

/** Same as buildNotePdfDocument but injects a script that triggers window.print() on load. */
export function buildNotePdfDocumentForPrint(
  title: string,
  blocks: NoteBlock[],
  legacyContent?: string
): string {
  const doc = buildNotePdfDocument(title, blocks, legacyContent)
  const printScript = '<script>window.onload=function(){window.print()}<' + '/script>'
  return doc.replace('</body>', printScript + '</body>')
}
