/**
 * @registry-id: eitjeAbsenceTeams
 * @created: 2026-07-09T21:15:00.000Z
 * @last-modified: 2026-07-09T21:15:00.000Z
 * @description: Eitje team_name buckets for ziek vs verlof/vakantie (matches Eitje uren UI)
 * @last-fix: [2026-07-09] SSOT for absence team classification
 *
 * @exports-to:
 * ✓ server/utils/dailyOpsAttendanceKpis.ts
 * ✓ server/utils/dailyOpsWeeklyReport/buildWeeklyAttendance.ts
 */

import { isOperationalTeamName } from './eitjeVenueLaborRollup'

export function normalizeAbsenceTeamName(teamName: string): string {
  return teamName.trim().toLowerCase()
}

export function isZiekTeamName(teamName: string): boolean {
  return normalizeAbsenceTeamName(teamName) === 'ziek'
}

/** Registered uren under Vakantie / Verlof teams (Eitje hours table — not leave_requests). */
export function isVerlofVakantieTeamName(teamName: string): boolean {
  const n = normalizeAbsenceTeamName(teamName)
  if (!n || isZiekTeamName(teamName) || isOperationalTeamName(teamName)) return false
  if (n === 'vakantie' || n === 'verlof') return true
  if (n.includes('vakantie') || n.includes('verlof')) return true
  return false
}

export const EITJE_ZIEK_TEAM_REGEX = /^ziek$/i

export const EITJE_VERLOF_VAKANTIE_TEAM_REGEX = /^(vakantie|verlof)$/i
