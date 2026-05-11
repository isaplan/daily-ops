import { defineEventHandler } from 'file:///Users/alviniomolina/Documents/GitHub/daily-ops/node_modules/h3/dist/index.mjs';

const reprocessAll_post = defineEventHandler(async () => {
  try {
    const { getDb } = await import('../../../nitro/nitro.mjs').then(function (n) { return n.ar; });
    const { processEmailAttachments } = await import('../../../_/inboxProcessService.mjs').then(function (n) { return n.i; });
    const db = await getDb();
    const attachments = await db.collection("emailattachments").find({ documentType: "basis_report" }).toArray();
    console.log(`[reprocess-all] Found ${attachments.length} basis_report attachments`);
    let reprocessed = 0;
    let failed = 0;
    for (const att of attachments) {
      try {
        await db.collection("emailattachments").updateOne(
          { _id: att._id },
          { $set: { parseStatus: null, parseError: null } }
        );
        const emailId = String(att.emailId);
        const result = await processEmailAttachments(emailId);
        if (result.attachmentsProcessed > 0) {
          reprocessed++;
        } else {
          failed++;
        }
      } catch (err) {
        failed++;
        console.error(`[reprocess-all] Failed for attachment ${att._id}:`, err);
      }
    }
    return {
      success: true,
      reprocessed,
      failed,
      total: attachments.length,
      message: `Reprocessed ${reprocessed} attachments, ${failed} failed`
    };
  } catch (err) {
    return { error: err instanceof Error ? err.message : String(err) };
  }
});

export { reprocessAll_post as default };
//# sourceMappingURL=reprocess-all.post.mjs.map
