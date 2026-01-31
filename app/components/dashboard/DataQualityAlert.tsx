/**
 * @registry-id: DataQualityAlert
 * @created: 2026-01-30T00:00:00.000Z
 * @last-modified: 2026-01-30T00:00:00.000Z
 * @description: Alert when validation or data quality issues exist
 * @last-fix: [2026-01-30] Initial implementation
 *
 * @exports-to:
 *   ✓ app/daily-ops/page.tsx
 */

'use client';

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import type { DashboardSources } from '@/lib/types/dashboard.types';

interface DataQualityAlertProps {
  sources: DashboardSources | null;
}

export function DataQualityAlert({ sources }: DataQualityAlertProps) {
  if (!sources?.validation) return null;

  const eitjeMismatch = sources.validation.eitje_vs_csv && !sources.validation.eitje_vs_csv.matches;
  const borkMismatch = sources.validation.bork_vs_csv && !sources.validation.bork_vs_csv.matches;

  if (!eitjeMismatch && !borkMismatch) return null;

  const messages: string[] = [];
  if (eitjeMismatch) {
    const v = sources.validation.eitje_vs_csv?.variance;
    messages.push(`Eitje vs CSV variance${v != null ? `: ${v.toFixed(2)}%` : ''}`);
  }
  if (borkMismatch) {
    const v = sources.validation.bork_vs_csv?.variance;
    messages.push(`Bork vs CSV variance${v != null ? `: ${v.toFixed(2)}%` : ''}`);
  }

  return (
    <Alert variant="destructive">
      <AlertTitle>Data quality</AlertTitle>
      <AlertDescription>{messages.join(' · ')}</AlertDescription>
    </Alert>
  );
}
