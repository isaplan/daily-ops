/**
 * @registry-id: weeklyReportDocumentMerge
 * @created: 2026-07-14T21:00:00.000Z
 * @last-modified: 2026-07-14T21:00:00.000Z
 * @description: Merge computed weekly report data while preserving user sections
 * @adr-ref: ADR-015
 *
 * @exports-to:
 * ✓ server/utils/weeklyReportDocument/upsertWeeklyReportDocument.ts
 */

import type { WeeklyReportDocument, WeeklyReportSectionKey } from '~/types/weeklyReportDocument'
import { emptyWeeklyReportSections } from '~/types/weeklyReportDocument'

export function mergeWeeklyReportUserContent(
  computed: Omit<WeeklyReportDocument, 'sections' | 'frozenAt'> & { frozenAt?: string | null },
  existing?: WeeklyReportDocument | null,
  frozenAt?: string | null,
): WeeklyReportDocument {
  const sections = existing?.sections ?? emptyWeeklyReportSections()
  const mergedSections = { ...sections }
  if (existing?.sections) {
    for (const key of Object.keys(existing.sections) as WeeklyReportSectionKey[]) {
      mergedSections[key] = existing.sections[key]
    }
  }
  return {
    ...computed,
    sections: mergedSections,
    frozenAt: frozenAt ?? existing?.frozenAt ?? null,
  }
}
