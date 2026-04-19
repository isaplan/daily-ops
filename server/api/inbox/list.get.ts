import { ensureInboxCollections, ensureInboxIndexes } from '../../utils/inbox/collections'
import * as inboxRepo from '../../services/inboxRepository'
import type { InboxEmailFilters } from '~/types/inbox'

export default defineEventHandler(async (event) => {
  try {
    await ensureInboxCollections()
    await ensureInboxIndexes()

    const q = getQuery(event)
    const page = Math.max(1, parseInt(String(q.page || '1'), 10))
    const limit = Math.min(100, Math.max(1, parseInt(String(q.limit || '20'), 10)))

    const filters: InboxEmailFilters = {}
    if (q.status) filters.status = q.status as InboxEmailFilters['status']
    if (q.from) filters.from = String(q.from)
    if (q.archived !== undefined) filters.archived = q.archived === 'true'

    if (q.dateFrom || q.dateTo) {
      filters.dateFrom = q.dateFrom ? new Date(String(q.dateFrom)) : undefined
      filters.dateTo = q.dateTo ? new Date(String(q.dateTo)) : undefined
    }

    const data = await inboxRepo.listEmails(page, limit, filters)

    return { success: true, data }
  } catch (error) {
    throw createError({
      statusCode: 500,
      statusMessage: error instanceof Error ? error.message : 'Failed to list emails',
    })
  }
})
