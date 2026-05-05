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
  gmailOAuthToken: 'gmail_oauth_tokens',
} as const

/** Target collections created by ensureInboxCollections (from next-js-old inbox-collections) */
export const INBOX_TARGET_COLLECTIONS = [
  'inbox-eitje-hours',
  'inbox-eitje-contracts',
  'inbox-eitje-finance',
  'inbox-bork-sales',
  'inbox-bork-food-beverage',
  'inbox-bork-product-mix',
  'inbox-bork-basis-report',
  'bork_sales',
  'power_bi_exports',
  'other_documents',
] as const
