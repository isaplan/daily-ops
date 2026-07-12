/**
 * @registry-id: useDailyOpsRevenueExport
 * @last-modified: 2026-07-02T00:00:00.000Z
 * @description: Client CSV export helper for revenue tables
 * @last-fix: [2026-07-02] ADR-013 read-cache metadata
 * @adr-ref: ADR-013
 * @data-source: none
 * @read-cache-json: none
 */
export function useDailyOpsRevenueExport() {
  function downloadCsv(filename: string, headers: string[], rows: (string | number)[][]) {
    const escape = (v: string | number) => {
      const s = String(v)
      return s.includes(',') || s.includes('"') ? `"${s.replace(/"/g, '""')}"` : s
    }
    const lines = [headers.map(escape).join(','), ...rows.map((r) => r.map(escape).join(','))]
    const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    a.click()
    URL.revokeObjectURL(url)
  }

  return { downloadCsv }
}
