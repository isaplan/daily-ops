/**
 * @registry-id: salesAggregatedV2Api
 * @created: 2026-04-13T00:00:00.000Z
 * @last-modified: 2026-05-07T12:00:00.000Z
 * @description: Alias of `/api/sales-aggregated` — same V2-backed handler (integrations / bookmarks)
 * @last-fix: [2026-05-07] Delegate to unified sales-aggregated handler
 *
 * @exports-to:
 * (external tools only)
 */
export { default } from './sales-aggregated.get'
