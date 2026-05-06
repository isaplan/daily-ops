// Manual endpoint to bypass broken processAllUnprocessed for testing
export default defineEventHandler(async () => {
  try {
    const { getDb } = await import('../../utils/db')
    const { processEmailAttachments } = await import('../../services/inboxProcessService')
    
    const db = await getDb()
    
    // Find an email with basis_report attachments
    const email = await db.collection('inboxemails').findOne({ from: /trivecgroup/ })
    if (!email) return { error: 'No email found' }
    
    console.log('[manual-process-basis] Processing email:', email._id)
    
    // Call processEmailAttachments directly
    const result = await processEmailAttachments(String(email._id))
    
    return {
      success: true,
      emailId: String(email._id),
      subject: email.subject,
      attachmentsProcessed: result.attachmentsProcessed,
      attachmentsFailed: result.attachmentsFailed,
    }
  } catch (err) {
    return { error: err instanceof Error ? err.message : String(err) }
  }
})
