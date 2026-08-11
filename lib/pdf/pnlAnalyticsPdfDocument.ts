/**
 * Self-contained PDF for Finance P&L analytics (hex colors only).
 */

import type { AccountingPnlAnalyticsDto } from '~/types/accounting-pnl-analytics'
import { formatAccountingPnlCompact } from '~/utils/accountingPnlFormat'

export const PNL_ANALYTICS_PDF_CSS = `/* PDF-only. Hex only. */
*{box-sizing:border-box}
body{font-family:ui-sans-serif,system-ui,sans-serif;font-size:14px;line-height:1.5;color:#111827;background:#fff;margin:0;padding:24px}
.pdf-title{font-size:22px;font-weight:700;margin:0 0 4px}
.pdf-meta{font-size:13px;color:#6b7280;margin:0 0 20px}
.pdf-section{margin-bottom:20px;border:1px solid #e5e7eb;border-radius:8px;padding:16px}
.pdf-section h2{font-size:15px;font-weight:700;margin:0 0 10px;border-bottom:1px solid #e5e7eb;padding-bottom:6px}
.pdf-bullets{margin:8px 0 0;padding-left:18px}
.pdf-bullets li{margin:4px 0;font-size:13px}
.pdf-chart{overflow:hidden;margin-top:8px}
.pdf-chart svg{max-width:100%;height:auto}
.pdf-table{width:100%;border-collapse:collapse;font-size:11px}
.pdf-table th,.pdf-table td{padding:4px 6px;border-bottom:1px solid #f3f4f6;text-align:right}
.pdf-table th:first-child,.pdf-table td:first-child{text-align:left}
`

function escapeHtml (text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

export function buildPnlAnalyticsPdfDocument (
  data: AccountingPnlAnalyticsDto,
  chartSvgHtml: string | null,
): string {
  const venueLabel = data.venue === 'combined' ? 'All venues' : data.venue.toUpperCase()
  let body = `<h1 class="pdf-title">P&amp;L Analytics — ${escapeHtml(venueLabel)}</h1>`
  body += `<p class="pdf-meta">${escapeHtml(data.range_label)} · ${data.month_count} sealed months · accounting_pnl_benchmark</p>`

  body += `<div class="pdf-section"><h2>Story</h2>`
  body += `<p><strong>${escapeHtml(data.verdict.headline)}</strong></p>`
  if (data.verdict.bullets.length) {
    body += `<ul class="pdf-bullets">`
    for (const b of data.verdict.bullets) body += `<li>${escapeHtml(b)}</li>`
    body += `</ul>`
  }
  body += `</div>`

  if (data.seasonal.length) {
    body += `<div class="pdf-section"><h2>Seasonal (same month YoY)</h2><ul class="pdf-bullets">`
    for (const s of data.seasonal) body += `<li>${escapeHtml(s.note)}</li>`
    body += `</ul></div>`
  }

  if (chartSvgHtml) {
    body += `<div class="pdf-section"><h2>Full history chart</h2><div class="pdf-chart">${chartSvgHtml}</div></div>`
  }

  body += `<div class="pdf-section"><h2>Monthly series</h2><table class="pdf-table"><thead><tr>`
  body += `<th>Month</th><th>Revenue</th><th>Staff</th><th>COGS</th><th>Fixed</th><th>Net</th><th>Staff %</th>`
  body += `</tr></thead><tbody>`
  for (const row of data.series) {
    body += `<tr>`
    body += `<td>${escapeHtml(row.label)}</td>`
    body += `<td>${escapeHtml(formatAccountingPnlCompact(row.revenue))}</td>`
    body += `<td>${escapeHtml(formatAccountingPnlCompact(row.labor))}</td>`
    body += `<td>${escapeHtml(formatAccountingPnlCompact(row.cogs))}</td>`
    body += `<td>${escapeHtml(formatAccountingPnlCompact(row.fixed))}</td>`
    body += `<td>${escapeHtml(formatAccountingPnlCompact(row.result))}</td>`
    body += `<td>${row.labor_pct != null ? `${row.labor_pct.toFixed(0)}%` : '—'}</td>`
    body += `</tr>`
  }
  body += `</tbody></table></div>`

  return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>P&L Analytics</title><style>${PNL_ANALYTICS_PDF_CSS}</style></head><body>${body}</body></html>`
}

export function buildPnlAnalyticsPdfDocumentForPrint (
  data: AccountingPnlAnalyticsDto,
  chartSvgHtml: string | null,
): string {
  const doc = buildPnlAnalyticsPdfDocument(data, chartSvgHtml)
  const printScript = '<script>window.onload=function(){window.print()}<' + '/script>'
  return doc.replace('</body>', `${printScript}</body>`)
}
