/**
 * Resolve DB collection suffixes for versioned Bork aggregates.
 *
 * Defaults to `_v2` so V2 reads/writes target versioned collections.
 * Backward compatible fallbacks:
 * - reads: BORK_AGG_V2_SUFFIX
 * - rebuild writes: BORK_AGG_V2_REBUILD_SUFFIX
 */
export function resolveBorkAggReadSuffix(): string {
  const cfg = useRuntimeConfig()
  const fromCfg =
    typeof cfg.borkAggVersionSuffix === 'string'
      ? cfg.borkAggVersionSuffix
      : typeof cfg.borkAggV2Suffix === 'string'
        ? cfg.borkAggV2Suffix
        : ''
  if (fromCfg !== '') return fromCfg
  return process.env.BORK_AGG_VERSION_SUFFIX ?? process.env.BORK_AGG_V2_SUFFIX ?? '_v2'
}

export function resolveBorkAggRebuildSuffix(): string {
  const inherit =
    process.env.BORK_AGG_REBUILD_USE_READ_SUFFIX === '1' ||
    process.env.BORK_AGG_REBUILD_USE_READ_SUFFIX === 'yes' ||
    process.env.BORK_AGG_V2_REBUILD_USE_READ_SUFFIX === '1' ||
    process.env.BORK_AGG_V2_REBUILD_USE_READ_SUFFIX === 'yes'

  if (inherit) return resolveBorkAggReadSuffix()

  return (
    process.env.BORK_AGG_REBUILD_SUFFIX ??
    process.env.BORK_AGG_V2_REBUILD_SUFFIX ??
    process.env.BORK_AGG_VERSION_SUFFIX ??
    '_v2'
  )
}
