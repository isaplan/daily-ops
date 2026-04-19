/**
 * Mongoose default collection names (next-js-old models) so native driver uses the same DB collections.
 *
 * @exports-to:
 * ✓ server/services/inboxRepository.ts
 * ✓ server/utils/inbox/collections.ts
 */

export const INBOX_COLLECTIONS = {
  inboxEmail: 'inboxemails',
  emailAttachment: 'emailattachments',
  parsedData: 'parseddatas',
  processingLog: 'processinglogs',
} as const

/** Target collections created by ensureInboxCollections (from next-js-old inbox-collections) */
export const INBOX_TARGET_COLLECTIONS = [
  'test-eitje-hours',
  'test-eitje-contracts',
  'test-eitje-finance',
  'test-bork-sales',
  'test-bork-food-beverage',
  'test-bork-product-mix',
  'test-bork-basis-rapport',
  'test-basis-report',
  'bork_sales',
  'power_bi_exports',
  'other_documents',
] as const
