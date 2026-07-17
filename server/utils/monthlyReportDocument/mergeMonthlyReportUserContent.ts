/**
 * @registry-id: monthlyReportDocumentMerge
 * @created: 2026-07-17T00:00:00.000Z
 * @last-modified: 2026-07-17T00:00:00.000Z
 * @description: Merge computed monthly report data while preserving user sections
 * @adr-ref: ADR-015
 *
 * @exports-to:
 * ✓ server/utils/monthlyReportDocument/upsertMonthlyReportDocument.ts
 */

import type { MonthlyReportDocument, MonthlyReportSectionKey } from '~/types/monthlyReportDocument'
import { emptyMonthlyReportSections } from '~/types/monthlyReportDocument'

export function mergeMonthlyReportUserContent(
  computed: Omit<MonthlyReportDocument, 'sections' | 'frozenAt' | 'lockedManually'> & {
    frozenAt?: string | null
    lockedManually?: boolean
  },
  existing?: MonthlyReportDocument | null,
  frozenAt?: string | null,
  lockedManually?: boolean,
): MonthlyReportDocument {
  const sections = existing?.sections ?? emptyMonthlyReportSections()
  const mergedSections = { ...sections }
  if (existing?.sections) {
    for (const key of Object.keys(existing.sections) as MonthlyReportSectionKey[]) {
      mergedSections[key] = existing.sections[key]
    }
  }
  return {
    ...computed,
    sections: mergedSections,
    frozenAt: frozenAt !== undefined ? frozenAt : (existing?.frozenAt ?? null),
    lockedManually: lockedManually ?? existing?.lockedManually ?? false,
  }
}
