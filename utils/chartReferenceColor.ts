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

/** Lighten a #rgb / #rrggbb hex toward white by fraction (0.4 = 40% lighter). */
export function lightenHexColor(hex: string, amount: number): string {
  const raw = hex.replace('#', '').trim()
  const full =
    raw.length === 3 ? raw.split('').map((c) => c + c).join('') : raw
  if (full.length !== 6 || !/^[0-9a-fA-F]{6}$/.test(full)) return hex

  const clamp = (n: number) => Math.min(255, Math.max(0, Math.round(n)))
  const mix = Math.min(Math.max(amount, 0), 1)
  const r = clamp(parseInt(full.slice(0, 2), 16) + (255 - parseInt(full.slice(0, 2), 16)) * mix)
  const g = clamp(parseInt(full.slice(2, 4), 16) + (255 - parseInt(full.slice(2, 4), 16)) * mix)
  const b = clamp(parseInt(full.slice(4, 6), 16) + (255 - parseInt(full.slice(4, 6), 16)) * mix)
  const p = (n: number) => n.toString(16).padStart(2, '0')
  return `#${p(r)}${p(g)}${p(b)}`
}

/** Trend = solid; median = dashed; rolling = dotted (dash keyed by average type, not € metric). */
export const REFERENCE_LINE_STYLES = {
  trend: { darken: 0.05, dashArray: undefined as string | undefined, strokeWidth: 2.5, strokeLinecap: 'round' as const },
  median: { darken: 0.35, dashArray: '10,6', strokeWidth: 2 },
  rolling: { darken: 0.5, dashArray: '2,3', strokeWidth: 2, strokeLinecap: 'round' as const },
  revenue: { lighten: 0.4, dashArray: undefined as string | undefined, strokeWidth: 3.5, strokeLinecap: 'round' as const },
  costs: { lighten: 0.4, dashArray: undefined as string | undefined, strokeWidth: 3.5, strokeLinecap: 'round' as const },
} as const

export type ReferenceAverageLayer = 'trend' | 'median' | 'rolling'
export type ReferenceEuroLayer = 'revenue' | 'costs'

export function referenceLineStyleForAverage(avg: ReferenceAverageLayer) {
  return REFERENCE_LINE_STYLES[avg]
}

export function referenceLineColorForOverlay(
  baseColor: string,
  opts: { euro?: ReferenceEuroLayer; average: ReferenceAverageLayer },
): string {
  if (opts.euro) {
    const euroStyle = REFERENCE_LINE_STYLES[opts.euro]
    const tinted = lightenHexColor(baseColor, euroStyle.lighten ?? 0.4)
    return opts.average === 'median'
      ? darkenHexColor(tinted, 0.12)
      : opts.average === 'rolling'
        ? darkenHexColor(tinted, 0.22)
        : tinted
  }
  return referenceLineColor(baseColor, opts.average)
}

export function referenceLineColor(
  baseColor: string,
  layer: keyof typeof REFERENCE_LINE_STYLES,
): string {
  const style = REFERENCE_LINE_STYLES[layer]
  if ('lighten' in style && style.lighten != null) {
    return lightenHexColor(baseColor, style.lighten)
  }
  return darkenHexColor(baseColor, style.darken ?? 0)
}
