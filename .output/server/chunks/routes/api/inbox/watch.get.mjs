import { d as defineEventHandler, A as ensureInboxCollections, g as getDb } from '../../../nitro/nitro.mjs';
import 'mongodb';
import 'papaparse';
import 'fs';
import 'path';
import '/Users/alviniomolina/Documents/GitHub/daily-ops/node_modules/.pnpm/xlsx@0.18.5/node_modules/xlsx/dist/cpexcel.js';
import 'stream';
import 'node:http';
import 'node:https';
import 'node:events';
import 'node:buffer';
import 'node:fs';
import 'node:path';
import 'node:crypto';
import 'node:url';
import '@iconify/utils';
import 'consola';

const watch_get = defineEventHandler(async () => {
  await ensureInboxCollections();
  const db = await getDb();
  const row = await db.collection("integration_cron_jobs").findOne({
    source: "gmail",
    jobType: "inbox-watch"
  });
  return {
    success: true,
    data: {
      isActive: (row == null ? void 0 : row.isActive) === true,
      topicName: typeof (row == null ? void 0 : row.topicName) === "string" ? row.topicName : null,
      watchExpiration: typeof (row == null ? void 0 : row.watchExpiration) === "string" ? row.watchExpiration : null,
      lastHistoryId: typeof (row == null ? void 0 : row.lastHistoryId) === "string" ? row.lastHistoryId : null,
      lastRenewalAt: typeof (row == null ? void 0 : row.lastSyncAt) === "string" ? row.lastSyncAt : null,
      lastSyncOk: (row == null ? void 0 : row.lastSyncOk) === true,
      lastSyncMessage: typeof (row == null ? void 0 : row.lastSyncMessage) === "string" ? row.lastSyncMessage : null,
      hint: "Gmail push watches expire (~7 days). Renew via POST /api/inbox/watch or scheduled GET /api/inbox/watch/renew?secret=\u2026"
    }
  };
});

export { watch_get as default };
//# sourceMappingURL=watch.get.mjs.map
