/**
 * One-off: mark Gmail OAuth disconnected in Mongo (after confirmed invalid_grant in DO logs).
 * Usage: pnpm inbox:mark-gmail-disconnected
 */

import { markGmailOAuthFailure } from '../server/services/gmailOAuthService'

async function main() {
  await markGmailOAuthFailure(new Error('invalid_grant: Token has been expired or revoked.'))
  console.info('[inbox:mark-gmail-disconnected] Set connected=false on gmail_oauth_tokens')
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
