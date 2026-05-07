/** Register business day hour 0 = 06:00–06:59, … 23 = 05:00–05:59 next morning. */
export function formatRegisterHourLabel(businessHour: number): string {
  const wall = businessHour <= 17 ? 6 + businessHour : businessHour - 18
  return `${String(wall).padStart(2, '0')}:00`
}
