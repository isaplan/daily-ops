import { d as defineEventHandler, A as ensureInboxCollections, r as readBody, c as createError, P as gmailWatchService, g as getDb, O as getGmailOAuthErrorMessage, M as isInvalidGrantError } from '../../../nitro/nitro.mjs';
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
    const msg = getGmailOAuthErrorMessage(error);
    if (isInvalidGrantError(error)) {
      throw createError({
        statusCode: 401,
        statusMessage: "Gmail OAuth invalid_grant: refresh token rejected. Use the same GMAIL_CLIENT_ID/SECRET as when the token was created; set GMAIL_REDIRECT_URI to the exact authorized redirect URI (e.g. http://localhost:8080). Then re-run OAuth and replace GMAIL_REFRESH_TOKEN.",
        data: { google: msg }
      });
    }
    throw createError({
      statusCode: 500,
      statusMessage: msg
    });
  }
});

export { watch_post as default };
//# sourceMappingURL=watch.post.mjs.map
