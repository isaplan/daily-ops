const NON_FLOOR_SHIFT_TYPES = new Set(['ziek', 'verlof', 'vakantie'])

/** Sick, leave, and vacation registrations are not counted as on-the-floor active staff. */
export function isExcludedFromFloorActive(teamName: string, shiftType: string): boolean {
  const team = teamName.trim().toLowerCase()
  const type = shiftType.trim().toLowerCase()
  if (team === 'ziek') return true
  return NON_FLOOR_SHIFT_TYPES.has(type)
}
