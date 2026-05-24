/**
 * Per-worker lines for venue-strip KPI drawers (Keuken / Bediening / Overig; Afwas 50/50 per person).
 */

import type { VenueStripWorkerLineDto } from '../../types/daily-ops-dashboard'
import type { DailyOpsSnapshotLaborSection } from '../../types/daily-ops-snapshot'
import {
  aggRowsUseLegacyGewerktSchema,
  resolveRowGewerktSlice,
} from './eitjeVenueLaborRollup'

function round2 (n: number): number {
  return Math.round(n * 100) / 100
}

function normTeam (teamName: string): string {
  return (teamName ?? '').trim().toLowerCase()
}

function isOperationalTeam (teamName: string): boolean {
  const n = normTeam(teamName)
  return n === 'keuken' || n === 'bediening' || n === 'afwas'
}

/** Expand one person+team into drawer lines (Afwas → ½ Keuken + ½ Bediening). */
/** `laborCost` = loaded employer cost (Eitje-style), stored in DTO `wages` for display. */
export function expandWorkerLineForTeam (
  userId: string,
  userName: string,
  teamName: string,
  hours: number,
  laborCost: number,
  operational: boolean,
): VenueStripWorkerLineDto[] {
  const uid = userId || ''
  const name = userName.trim() || '—'
  const h = round2(hours)
  const w = round2(laborCost)
  if (h <= 0 && w <= 0) return []

  if (operational) {
    const n = normTeam(teamName)
    if (n === 'afwas') {
      const halfH = round2(h / 2)
      const halfW = round2(w / 2)
      return [
        { userId: uid, userName: name, teamName: 'Afwas (½ Keuken)', bucket: 'keuken', hours: halfH, wages: halfW },
        { userId: uid, userName: name, teamName: 'Afwas (½ Bediening)', bucket: 'bediening', hours: halfH, wages: halfW },
      ]
    }
    if (n === 'keuken') {
      return [{ userId: uid, userName: name, teamName, bucket: 'keuken', hours: h, wages: w }]
    }
    if (n === 'bediening') {
      return [{ userId: uid, userName: name, teamName, bucket: 'bediening', hours: h, wages: w }]
    }
    return []
  }

  return [{ userId: uid, userName: name, teamName, bucket: 'overig', hours: h, wages: w }]
}

export function workersFromEitjeAggRows (rows: Record<string, unknown>[]): VenueStripWorkerLineDto[] {
  const legacyGewerkt = aggRowsUseLegacyGewerktSchema(rows)
  const lines: VenueStripWorkerLineDto[] = []

  for (const r of rows) {
    const teamName = String(r.team_name ?? '')
    const uid = String(r.userId ?? '')
    const userName = String(r.user_name ?? '')
    const gewSlice = resolveRowGewerktSlice(r, legacyGewerkt)
    if (gewSlice && gewSlice.hours > 0) {
      lines.push(
        ...expandWorkerLineForTeam(uid, userName, teamName, gewSlice.hours, gewSlice.wages, true),
      )
    } else {
      const h = Number(r.total_hours ?? 0)
      const w = Number(r.total_cost ?? 0)
      if (h > 0 || w > 0) {
        lines.push(...expandWorkerLineForTeam(uid, userName, teamName, h, w, false))
      }
    }
  }

  return sortWorkerLines(lines)
}

export function workersFromSnapshot (doc: DailyOpsSnapshotLaborSection | null): VenueStripWorkerLineDto[] {
  if (!doc) return []
  const lines: VenueStripWorkerLineDto[] = []

  for (const w of doc.workers ?? []) {
    const teamName = String(w.teamName ?? '')
    const hours = Number(w.hours ?? 0)
    const loaded = Number(w.loaded_cost ?? 0)
    lines.push(
      ...expandWorkerLineForTeam(
        String(w.userId ?? ''),
        String(w.userName ?? ''),
        teamName,
        hours,
        loaded,
        isOperationalTeam(teamName),
      ),
    )
  }

  return sortWorkerLines(lines)
}

function sortWorkerLines (lines: VenueStripWorkerLineDto[]): VenueStripWorkerLineDto[] {
  return [...lines].sort((a, b) => b.wages - a.wages || b.hours - a.hours || a.userName.localeCompare(b.userName))
}
