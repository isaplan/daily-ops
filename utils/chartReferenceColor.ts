/** Darken a #rgb / #rrggbb hex toward black by fraction (0.1 = 10% darker). */
export function darkenHexColor(hex: string, amount: number): string {
  const raw = hex.replace('#', '').trim()
  const full =
    raw.length === 3 ? raw.split('').map((c) => c + c).join('') : raw
  if (full.length !== 6 || !/^[0-9a-fA-F]{6}$/.test(full)) return hex

  const clamp = (n: number) => Math.min(255, Math.max(0, Math.round(n)))
  const factor = 1 - Math.min(Math.max(amount, 0), 0.95)
  const r = clamp(parseInt(full.slice(0, 2), 16) * factor)
  const g = clamp(parseInt(full.slice(2, 4), 16) * factor)
  const b = clamp(parseInt(full.slice(4, 6), 16) * factor)
  const p = (n: number) => n.toString(16).padStart(2, '0')
  return `#${p(r)}${p(g)}${p(b)}`
}

export const REFERENCE_LINE_STYLES = {
  median: { darken: 0.1, dashArray: '8,5', strokeWidth: 2 },
  trend: { darken: 0.2, dashArray: undefined as string | undefined, strokeWidth: 2.5 },
  rolling: { darken: 0.3, dashArray: '2,4', strokeWidth: 2 },
} as const

export function referenceLineColor(
  baseColor: string,
  layer: keyof typeof REFERENCE_LINE_STYLES,
): string {
  return darkenHexColor(baseColor, REFERENCE_LINE_STYLES[layer].darken)
}
