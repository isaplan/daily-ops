/**
 * Registers Gmail push watch on server startup when env is configured.
 * Disable locally with GMAIL_AUTO_WATCH_ON_START=0 if you do not want API calls on every dev boot.
 */
import { ensureGmailWatchIfNeeded } from '../utils/inbox/gmailWatchAutostart'

export default defineNitroPlugin((nitroApp) => {
  nitroApp.hooks.hook('ready', () => {
    void ensureGmailWatchIfNeeded().then((r) => {
      if (r.action === 'started') {
        nitroApp.logger?.info(
          `[gmail-watch] users.watch started; expires=${r.expiration} topic=${r.topicName}`,
        )
      } else if (r.action === 'skipped') {
        nitroApp.logger?.info(`[gmail-watch] skipped: ${r.reason}`)
      } else {
        nitroApp.logger?.error(`[gmail-watch] autostart failed: ${r.message}`)
      }
    })
  })
})
