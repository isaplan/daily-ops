import type { VenueStripWorkerLineDto } from '~/types/daily-ops-dashboard'

function round2 (n: number): number {
  return Math.round(n * 100) / 100
}

function normWorkerName (name: string): string {
  return String(name ?? '').replace(/\u00a0/g, ' ').trim().toLowerCase()
}

function afwasPersonKey (userId: string, userName: string): string {
  return `${userId}|${normWorkerName(userName)}`
}

function isAfwasSplitLine (teamName: string): boolean {
  return teamName.includes('Afwas (½')
}

/** Drawer: one Afwas row per person (50/50 split stays in labor KPI totals only). */
export function collapseAfwasSplitLinesForDisplay (
  lines: VenueStripWorkerLineDto[],
): VenueStripWorkerLineDto[] {
  const splitByPerson = new Map<string, { keuken?: VenueStripWorkerLineDto; bediening?: VenueStripWorkerLineDto }>()
  const passthrough: VenueStripWorkerLineDto[] = []

  for (const w of lines) {
    if (isAfwasSplitLine(w.teamName)) {
      const pk = afwasPersonKey(w.userId, w.userName)
      const g = splitByPerson.get(pk) ?? {}
      if (w.bucket === 'keuken') g.keuken = w
      else if (w.bucket === 'bediening') g.bediening = w
      splitByPerson.set(pk, g)
    } else {
      passthrough.push(w)
    }
  }

  for (const g of splitByPerson.values()) {
    if (g.keuken && g.bediening) {
      passthrough.push({
        userId: g.keuken.userId,
        userName: g.keuken.userName,
        teamName: 'Afwas',
        bucket: 'keuken',
        hours: round2(g.keuken.hours + g.bediening.hours),
        wages: round2(g.keuken.wages + g.bediening.wages),
        startLabel: g.keuken.startLabel ?? g.bediening.startLabel,
        endLabel: g.keuken.endLabel ?? g.bediening.endLabel,
      })
    } else {
      if (g.keuken) passthrough.push({ ...g.keuken, teamName: 'Afwas' })
      if (g.bediening) passthrough.push({ ...g.bediening, teamName: 'Afwas' })
    }
  }

  return passthrough
}

export function formatVenueStripWorkerTeamLabel (teamName: string): string {
  if (isAfwasSplitLine(teamName)) return 'Afwas'
  return teamName
}
