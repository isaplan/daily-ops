// Reprocess all emails (reset parseStatus and reparse) - dev/testing only
export default defineEventHandler(async () => {
  try {
    const { getDb } = await import('../../utils/db')
    const { processEmailAttachments } = await import('../../services/inboxProcessService')
    
    const db = await getDb()
    
    // Find ALL basis_report attachments (completed or not)
    const attachments = await db.collection('emailattachments')
      .find({ documentType: 'basis_report' })
      .toArray()
    
    console.log(`[reprocess-all] Found ${attachments.length} basis_report attachments`)
    
    let reprocessed = 0
    let failed = 0
    
    // Reset all to parseStatus: null and reprocess
    for (const att of attachments) {
      try {
        await db.collection('emailattachments').updateOne(
          { _id: att._id },
          { $set: { parseStatus: null, parseError: null } }
        )
        
        const emailId = String(att.emailId)
        const result = await processEmailAttachments(emailId)
        
        if (result.attachmentsProcessed > 0) {
          reprocessed++
        } else {
          failed++
        }
      } catch (err) {
        failed++
        console.error(`[reprocess-all] Failed for attachment ${att._id}:`, err)
      }
    }
    
    return {
      success: true,
      reprocessed,
      failed,
      total: attachments.length,
      message: `Reprocessed ${reprocessed} attachments, ${failed} failed`
    }
  } catch (err) {
    return { error: err instanceof Error ? err.message : String(err) }
  }
})
