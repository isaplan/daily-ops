import { d as defineEventHandler, A as ensureInboxCollections, r as readBody, c as createError, g as getDb } from '../../../nitro/nitro.mjs';
import { g as gmailWatchService } from '../../../_/gmailWatchService.mjs';
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
const watch_post = defineEventHandler(async (event) => {
  try {
    await ensureInboxCollections();
    const body = await readBody(event).catch(() => ({}));
    const topicName = body.topicName || process.env.GMAIL_PUBSUB_TOPIC;
    if (!topicName) {
      throw createError({
        statusCode: 400,
        statusMessage: "Pub/Sub topic name is required. Set GMAIL_PUBSUB_TOPIC or provide topicName in request body."
      });
    }
    const result = await gmailWatchService.watch({
      topicName,
      labelIds: body.labelIds || ["INBOX"]
    });
    const db = await getDb();
    const now = /* @__PURE__ */ new Date();
    await db.collection("integration_cron_jobs").updateOne(
      { ...GMAIL_WATCH_JOB },
      {
        $set: {
          ...GMAIL_WATCH_JOB,
          topicName,
          labelIds: body.labelIds || ["INBOX"],
          watchExpiration: result.expiration,
          lastHistoryId: result.historyId,
          lastSyncAt: now.toISOString(),
          lastSyncOk: true,
          lastSyncMessage: "Gmail users.watch started (manual or API)",
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
    if (error && typeof error === "object" && "statusCode" in error) throw error;
    throw createError({
      statusCode: 500,
      statusMessage: error instanceof Error ? error.message : "Failed to start Gmail watch"
    });
  }
});

export { watch_post as default };
//# sourceMappingURL=watch.post.mjs.map
