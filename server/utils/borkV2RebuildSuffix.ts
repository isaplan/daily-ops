/**
 * Resolves which collection suffix V2 **rebuild** scripts should write to.
 *
 * Preferred variables:
 * - reads:  `BORK_AGG_VERSION_SUFFIX` (default `_v2`)
 * - writes: `BORK_AGG_REBUILD_SUFFIX` (default `_v2`)
 *
 * Backward compatibility:
 * - reads:  `BORK_AGG_V2_SUFFIX`
 * - writes: `BORK_AGG_V2_REBUILD_SUFFIX`
 */
export function resolveV2RebuildCollectionSuffix(): string {
  const inherit =
    process.env.BORK_AGG_REBUILD_USE_READ_SUFFIX === '1' ||
    process.env.BORK_AGG_REBUILD_USE_READ_SUFFIX === 'yes' ||
    process.env.BORK_AGG_V2_REBUILD_USE_READ_SUFFIX === '1' ||
    process.env.BORK_AGG_V2_REBUILD_USE_READ_SUFFIX === 'yes'
  if (inherit) {
    return process.env.BORK_AGG_VERSION_SUFFIX ?? process.env.BORK_AGG_V2_SUFFIX ?? '_v2'
  }
  return (
    process.env.BORK_AGG_REBUILD_SUFFIX ??
    process.env.BORK_AGG_V2_REBUILD_SUFFIX ??
    process.env.BORK_AGG_VERSION_SUFFIX ??
    '_v2'
  )
}
