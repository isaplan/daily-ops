import { defineEventHandler } from 'file:///Users/alviniomolina/Documents/GitHub/daily-ops/node_modules/h3/dist/index.mjs';

const manualProcessBasis_get = defineEventHandler(async () => {
  try {
    const { getDb } = await import('../../../nitro/nitro.mjs').then(function (n) { return n.ar; });
    const { processEmailAttachments } = await import('../../../_/inboxProcessService.mjs').then(function (n) { return n.i; });
    const db = await getDb();
    const email = await db.collection("inboxemails").findOne({ from: /trivecgroup/ });
    if (!email) return { error: "No email found" };
    console.log("[manual-process-basis] Processing email:", email._id);
    const result = await processEmailAttachments(String(email._id));
    return {
      success: true,
      emailId: String(email._id),
      subject: email.subject,
      attachmentsProcessed: result.attachmentsProcessed,
      attachmentsFailed: result.attachmentsFailed
    };
  } catch (err) {
    return { error: err instanceof Error ? err.message : String(err) };
  }
});

export { manualProcessBasis_get as default };
//# sourceMappingURL=manual-process-basis.get.mjs.map
