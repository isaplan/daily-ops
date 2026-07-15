/**
 * Self-contained PDF for weekly report documents (hex colors only).
 */

import type { WeeklyReportDocument } from '~/types/weeklyReportDocument'
import { classifyWeatherWeek } from '~/utils/dailyOpsWeatherDisplay'

export const WEEKLY_REPORT_PDF_CSS = `/* PDF-only. Hex only. */
*{box-sizing:border-box}
body{font-family:ui-sans-serif,system-ui,sans-serif;font-size:14px;line-height:1.5;color:#111827;background:#fff;margin:0;padding:24px}
.pdf-title{font-size:24px;font-weight:700;margin:0 0 8px}
.pdf-meta{font-size:13px;color:#6b7280;margin:0 0 24px}
.pdf-section{margin-bottom:24px;border:1px solid #e5e7eb;border-radius:8px;padding:16px}
.pdf-section h2{font-size:16px;font-weight:700;margin:0 0 12px;border-bottom:1px solid #e5e7eb;padding-bottom:6px}
.pdf-kpi{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin-bottom:12px}
.pdf-kpi div{background:#f9fafb;padding:8px;border-radius:4px}
.pdf-kpi label{font-size:10px;text-transform:uppercase;color:#6b7280;display:block}
.pdf-kpi strong{font-size:16px}
.pdf-notes{margin-top:12px;padding-top:12px;border-top:1px dashed #d1d5db;font-size:13px;white-space:pre-wrap}
.pdf-todo,.pdf-agree{margin:4px 0;font-size:13px}
.pdf-weather table,.pdf-events ul{font-size:12px;width:100%}
.pdf-weather td,.pdf-weather th{padding:4px;text-align:left;border-bottom:1px solid #f3f4f6}
`

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

const SECTION_TITLES: Record<string, string> = {
  kpi: 'KPI',
  staff: 'Staff',
  productSales: 'Product Sales',
  labor: 'Labor Productivity',
  revenuePnl: 'Revenue + COGS + Results',
}

export function buildWeeklyReportPdfDocument(doc: WeeklyReportDocument): string {
  const d = doc.digest
  let body = `<h1 class="pdf-title">${escapeHtml(doc.locationName)} — ${escapeHtml(d.label)}</h1>`
  body += `<p class="pdf-meta">${escapeHtml(d.startDate)} → ${escapeHtml(d.endDate)}${doc.frozenAt ? ' · Frozen' : ''}</p>`

  body += `<div class="pdf-section pdf-weather"><h2>Weather (Den Haag)</h2>`
  const wk = classifyWeatherWeek(doc.weather)
  if (wk) {
    body += `<p><strong>${wk.label}</strong></p>`
  }
  body += `<p>Avg ${doc.weather.summary.avgTempMinC ?? '—'}° – ${doc.weather.summary.avgTempMaxC ?? '—'}°C · `
  body += `${doc.weather.summary.totalPrecipMm ?? '—'} mm rain</p></div>`

  if (doc.events.length) {
    body += `<div class="pdf-section pdf-events"><h2>Events</h2><ul>`
    for (const ev of doc.events) {
      const tvt = ev.labels?.includes('tvt') ? ' · tvt' : ''
      body += `<li>${escapeHtml(ev.title)}${tvt} (${escapeHtml(ev.startDate)}${ev.endDate !== ev.startDate ? ` – ${escapeHtml(ev.endDate)}` : ''})</li>`
    }
    body += `</ul></div>`
  }

  body += `<div class="pdf-section"><h2>KPI summary</h2><div class="pdf-kpi">`
  body += `<div><label>Revenue</label><strong>€${d.totals.revenue.toLocaleString('nl-NL')}</strong></div>`
  body += `<div><label>Labor %</label><strong>${d.totals.laborCostPct ?? '—'}%</strong></div>`
  body += `<div><label>P&amp;L %</label><strong>${d.totals.pnlPct ?? '—'}%</strong></div>`
  body += `<div><label>Staff</label><strong>${d.totals.staffCount}</strong></div></div></div>`

  for (const [key, section] of Object.entries(doc.sections)) {
    const title = SECTION_TITLES[key] ?? key
    body += `<div class="pdf-section"><h2>${escapeHtml(title)}</h2>`
    if (section.text.trim()) {
      body += `<div class="pdf-notes">${escapeHtml(section.text)}</div>`
    }
    for (const todo of section.todos) {
      body += `<div class="pdf-todo">☐ ${escapeHtml(todo.text)}</div>`
    }
    for (const agree of section.agrees) {
      body += `<div class="pdf-agree">🤝 ${escapeHtml(agree.text)}</div>`
    }
    body += `</div>`
  }

  return `<!DOCTYPE html><html><head><meta charset="utf-8"><style>${WEEKLY_REPORT_PDF_CSS}</style></head><body>${body}</body></html>`
}

export function buildWeeklyReportPdfDocumentForPrint(doc: WeeklyReportDocument): string {
  const html = buildWeeklyReportPdfDocument(doc)
  const printScript = '<script>window.onload=function(){window.print()}<' + '/script>'
  return html.replace('</body>', printScript + '</body>')
}
