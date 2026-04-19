import { d as defineEventHandler, a as getQuery, c as createError, A as ensureInboxCollections, g as getDb } from '../../../../nitro/nitro.mjs';
import { g as gmailWatchService } from '../../../../_/gmailWatchService.mjs';
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
import 'googleapis';

const GMAIL_WATCH_JOB = { source: "gmail", jobType: "inbox-watch" };
const renew_get = defineEventHandler(async (event) => {
  var _a;
  const secret = process.env.CRON_SECRET;
  const q = getQuery(event);
  if (!secret || String((_a = q.secret) != null ? _a : "") !== secret) {
    throw createError({ statusCode: 401, statusMessage: "Unauthorized" });
  }
  const topicName = process.env.GMAIL_PUBSUB_TOPIC;
  if (!topicName) {
    throw createError({
      statusCode: 500,
      statusMessage: "GMAIL_PUBSUB_TOPIC is not set on the server"
    });
  }
  await ensureInboxCollections();
  const db = await getDb();
  const now = /* @__PURE__ */ new Date();
  try {
    const result = await gmailWatchService.watch({
      topicName,
      labelIds: ["INBOX"]
    });
    await db.collection("integration_cron_jobs").updateOne(
      { ...GMAIL_WATCH_JOB },
      {
        $set: {
          ...GMAIL_WATCH_JOB,
          topicName,
          labelIds: ["INBOX"],
          watchExpiration: result.expiration,
          lastHistoryId: result.historyId,
          lastSyncAt: now.toISOString(),
          lastSyncOk: true,
          lastSyncMessage: "Gmail users.watch renewed (scheduled)",
          lastSyncDetail: result,
          updatedAt: now,
          isActive: true
        },
        $setOnInsert: { createdAt: now }
      },
      { upsert: true }
    );
    return {
      success: true,
      data: {
        historyId: result.historyId,
        expiration: result.expiration,
        topicName
      }
    };
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Gmail watch renew failed";
    await db.collection("integration_cron_jobs").updateOne(
      { ...GMAIL_WATCH_JOB },
      {
        $set: {
          ...GMAIL_WATCH_JOB,
          lastSyncAt: now.toISOString(),
          lastSyncOk: false,
          lastSyncMessage: msg,
          updatedAt: now
        },
        $setOnInsert: { createdAt: now }
      },
      { upsert: true }
    ).catch(() => {
    });
    throw createError({
      statusCode: 500,
      statusMessage: msg
    });
  }
});

export { renew_get as default };
//# sourceMappingURL=renew.get.mjs.map
