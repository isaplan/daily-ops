import { d as defineEventHandler, a as getQuery, c as createError, g as getDb } from '../../../../nitro/nitro.mjs';
import { e as executeEitjeJob } from '../../../../_/eitjeSyncService.mjs';
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

const runScheduled_get = defineEventHandler(async (event) => {
  var _a;
  const secret = process.env.CRON_SECRET;
  const q = getQuery(event);
  if (!secret || String((_a = q.secret) != null ? _a : "") !== secret) {
    throw createError({ statusCode: 401, statusMessage: "Unauthorized" });
  }
  const db = await getDb();
  const jobs = await db.collection("integration_cron_jobs").find({ source: "eitje", isActive: true }).toArray();
  const results = [];
  const now = /* @__PURE__ */ new Date();
  for (const j of jobs) {
    const jobType = typeof j.jobType === "string" ? j.jobType : "";
    if (!jobType) continue;
    await db.collection("integration_cron_jobs").updateOne(
      { source: "eitje", jobType },
      { $set: { lastRun: now.toISOString(), lastRunUTC: now.toISOString(), updatedAt: now } }
    );
    const syncResult = await executeEitjeJob(db, jobType);
    results.push({ jobType, ...syncResult });
    await db.collection("integration_cron_jobs").updateOne(
      { source: "eitje", jobType },
      {
        $set: {
          lastSyncAt: now.toISOString(),
          lastSyncOk: syncResult.ok,
          lastSyncMessage: syncResult.message,
          lastSyncDetail: syncResult,
          updatedAt: /* @__PURE__ */ new Date()
        }
      }
    );
  }
  return { success: true, ran: results.length, results };
});

export { runScheduled_get as default };
//# sourceMappingURL=run-scheduled.get.mjs.map
