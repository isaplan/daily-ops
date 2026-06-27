/**
 * Per-worker lines for venue-strip KPI drawers (Keuken / Bediening / Overig; Afwas 50/50 per person).
 * @last-fix: [2026-06-23] dedupeWorkerLines + collapseAfwasSplitLinesForDisplay (drawer UX)
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

export function normWorkerName (name: string): string {
  return String(name ?? '').replace(/\u00a0/g, ' ').trim().toLowerCase()
}

function normTeam (teamName: string): string {
  return (teamName ?? '').trim().toLowerCase()
}

export function isAfwasTeamName (teamName: string): boolean {
  return normTeam(teamName).includes('afwas')
}

function afwasPersonKey (userId: string, userName: string): string {
  return `${userId}|${normWorkerName(userName)}`
}

function lineDedupeKey (w: VenueStripWorkerLineDto): string {
  return `${w.userId}|${normWorkerName(w.userName)}|${normTeam(w.teamName)}`
}

function isOperationalTeam (teamName: string): boolean {
  const n = normTeam(teamName)
  return n === 'keuken' || n === 'bediening' || n === 'afwas'
}

/** Remove duplicate rows (snapshot + live overlay); keep highest hours per person/team/shift. */
export function dedupeWorkerLines (lines: VenueStripWorkerLineDto[]): VenueStripWorkerLineDto[] {
  const afwasByPerson = new Map<string, Map<VenueStripWorkerLineDto['bucket'], VenueStripWorkerLineDto>>()
  const other = new Map<string, VenueStripWorkerLineDto>()

  for (const w of lines) {
    if (isAfwasTeamName(w.teamName)) {
      const pk = afwasPersonKey(w.userId, w.userName)
      const bucketMap = afwasByPerson.get(pk) ?? new Map()
      const prev = bucketMap.get(w.bucket)
      if (!prev || w.hours > prev.hours) bucketMap.set(w.bucket, w)
      afwasByPerson.set(pk, bucketMap)
      continue
    }
    const key = lineDedupeKey(w)
    const prev = other.get(key)
    if (!prev || w.hours > prev.hours) other.set(key, w)
  }

  const merged: VenueStripWorkerLineDto[] = [...other.values()]
  for (const bucketMap of afwasByPerson.values()) {
    merged.push(...bucketMap.values())
  }
  return sortWorkerLines(merged)
}

/** Drawer display: one Afwas row per person (50/50 split stays in labor totals only). */
export { collapseAfwasSplitLinesForDisplay } from '~/utils/dailyOpsVenueStripWorkerDisplay'

export function hasAfwasPersonLines (lines: VenueStripWorkerLineDto[], userId: string, userName: string): boolean {
  const pk = afwasPersonKey(userId, userName)
  return lines.some((w) => isAfwasTeamName(w.teamName) && afwasPersonKey(w.userId, w.userName) === pk)
}

export type EitjeShiftRowLike = {
  locationId: string
  userId: string
  userName: string
  teamName: string
  hours: number
  shiftType?: string
}

/** Add Eitje shift rows missing from snapshot (e.g. Sanno/Dario before snapshot rebuild). */
export function mergeMissingWorkersFromEitjeShifts (
  workers: VenueStripWorkerLineDto[],
  eitjeRows: EitjeShiftRowLike[] | undefined,
  locationId: string,
  costPerHourFor: (userId: string, userName: string) => number,
): VenueStripWorkerLineDto[] {
  if (!eitjeRows?.length) return workers

  const out = [...workers]
  const seen = new Set(out.map(lineDedupeKey))

  for (const row of eitjeRows) {
    if (row.locationId !== locationId) continue
    if (row.hours <= 0) continue
    const shiftType = String(row.shiftType ?? '').toLowerCase()
    if (shiftType && !shiftType.includes('gewerkte')) continue
    const team = String(row.teamName ?? '').trim()
    if (!team) continue
    if (normTeam(team) === 'afwas' && hasAfwasPersonLines(out, row.userId, row.userName)) continue

    const cph = costPerHourFor(row.userId, row.userName)
    const loaded = cph > 0 ? round2(row.hours * cph) : 0
    const probe = expandWorkerLineForTeam(
      row.userId,
      row.userName,
      team,
      row.hours,
      loaded,
      isOperationalTeam(team),
    )
    for (const line of probe) {
      const key = lineDedupeKey(line)
      if (seen.has(key)) continue
      out.push(line)
      seen.add(key)
    }
  }

  return sortWorkerLines(out)
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
