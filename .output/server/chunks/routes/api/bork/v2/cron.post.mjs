import { d as defineEventHandler, r as readBody, c as createError, g as getDb } from '../../../../nitro/nitro.mjs';
import { e as executeBorkJob } from '../../../../_/borkSyncService.mjs';
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

const cron_post = defineEventHandler(async (event) => {
  const body = await readBody(event);
  if (!(body == null ? void 0 : body.jobType) || !(body == null ? void 0 : body.action)) {
    throw createError({ statusCode: 400, statusMessage: "jobType and action are required" });
  }
  const db = await getDb();
  const now = /* @__PURE__ */ new Date();
  const query = { source: "bork", jobType: body.jobType };
  if (body.action === "update") {
    await db.collection("integration_cron_jobs").updateOne(
      query,
      {
        $set: {
          ...body.config,
          source: "bork",
          jobType: body.jobType,
          updatedAt: now
        },
        $setOnInsert: { createdAt: now }
      },
      { upsert: true }
    );
    return { success: true, message: "Cron config updated" };
  }
  if (body.action === "run-now") {
    await db.collection("integration_cron_jobs").updateOne(
      query,
      {
        $set: {
          source: "bork",
          jobType: body.jobType,
          lastRun: now.toISOString(),
          lastRunUTC: now.toISOString(),
          updatedAt: now
        },
        $setOnInsert: { createdAt: now, isActive: true }
      },
      { upsert: true }
    );
    const syncResult = await executeBorkJob(db, body.jobType);
    await db.collection("integration_cron_jobs").updateOne(query, {
      $set: {
        lastSyncAt: now.toISOString(),
        lastSyncOk: syncResult.ok,
        lastSyncMessage: syncResult.message,
        lastSyncDetail: syncResult,
        updatedAt: /* @__PURE__ */ new Date()
      }
    });
    return {
      success: syncResult.ok,
      message: syncResult.message,
      sync: syncResult
    };
  }
  await db.collection("integration_cron_jobs").updateOne(
    query,
    {
      $set: {
        source: "bork",
        jobType: body.jobType,
        isActive: body.action === "start",
        updatedAt: now
      },
      $setOnInsert: { createdAt: now }
    },
    { upsert: true }
  );
  return { success: true, message: `Job ${body.action}ed` };
});

export { cron_post as default };
//# sourceMappingURL=cron.post.mjs.map
