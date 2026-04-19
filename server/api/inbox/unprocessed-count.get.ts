import { ensureInboxCollections } from '../../utils/inbox/collections'
import * as inboxRepo from '../../services/inboxRepository'

export default defineEventHandler(async () => {
  await ensureInboxCollections()
  const count = await inboxRepo.countUnprocessedAttachments()
  return { success: true, data: { count } }
})
