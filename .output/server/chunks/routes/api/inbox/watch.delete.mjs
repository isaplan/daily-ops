import { d as defineEventHandler, A as ensureInboxCollections, P as gmailWatchService, g as getDb, c as createError } from '../../../nitro/nitro.mjs';
import 'mongodb';
import 'papaparse';
import '/Users/alviniomolina/Documents/GitHub/daily-ops/node_modules/.pnpm/xlsx@0.18.5/node_modules/xlsx/dist/cpexcel.js';
import 'fs';
import 'stream';
import 'node:http';
import 'node:https';
import 'node:events';
import 'node:buffer';
import 'node:fs';
import 'node:path';
import 'node:crypto';
import 'path';
import 'googleapis';
import 'node:url';
import '@iconify/utils';
import 'consola';
import 'node:module';

const GMAIL_WATCH_JOB = { source: "gmail", jobType: "inbox-watch" };
const watch_delete = defineEventHandler(async () => {
  try {
    await ensureInboxCollections();
    await gmailWatchService.stop();
    const db = await getDb();
    const now = /* @__PURE__ */ new Date();
    await db.collection("integration_cron_jobs").updateOne(
      { ...GMAIL_WATCH_JOB },
      {
        $set: {
          isActive: false,
          lastSyncMessage: "Gmail users.stop called",
          updatedAt: now
        }
      }
    );
    return { success: true, data: { message: "Gmail watch stopped successfully" } };
  } catch (error) {
    throw createError({
      statusCode: 500,
      statusMessage: error instanceof Error ? error.message : "Failed to stop Gmail watch"
    });
  }
});

export { watch_delete as default };
//# sourceMappingURL=watch.delete.mjs.map
