import { defineEventHandler, readBody, createError } from 'file:///Users/alviniomolina/Documents/GitHub/daily-ops/node_modules/h3/dist/index.mjs';
import { K as ensureInboxCollections, Z as gmailWatchService, a as getDb, Y as getGmailOAuthErrorMessage, W as isInvalidGrantError } from '../../../nitro/nitro.mjs';
import 'file:///Users/alviniomolina/Documents/GitHub/daily-ops/node_modules/ufo/dist/index.mjs';
import 'file:///Users/alviniomolina/Documents/GitHub/daily-ops/node_modules/.pnpm/mongodb@7.1.1/node_modules/mongodb/lib/index.js';
import 'file:///Users/alviniomolina/Documents/GitHub/daily-ops/node_modules/.pnpm/papaparse@5.5.3/node_modules/papaparse/papaparse.js';
import '/Users/alviniomolina/Documents/GitHub/daily-ops/node_modules/.pnpm/xlsx@0.18.5/node_modules/xlsx/dist/cpexcel.js';
import 'node:fs';
import 'node:stream';
import 'file:///Users/alviniomolina/Documents/GitHub/daily-ops/node_modules/destr/dist/index.mjs';
import 'file:///Users/alviniomolina/Documents/GitHub/daily-ops/node_modules/nitropack/node_modules/hookable/dist/index.mjs';
import 'file:///Users/alviniomolina/Documents/GitHub/daily-ops/node_modules/ofetch/dist/node.mjs';
import 'file:///Users/alviniomolina/Documents/GitHub/daily-ops/node_modules/node-mock-http/dist/index.mjs';
import 'file:///Users/alviniomolina/Documents/GitHub/daily-ops/node_modules/unstorage/dist/index.mjs';
import 'file:///Users/alviniomolina/Documents/GitHub/daily-ops/node_modules/unstorage/drivers/fs.mjs';
import 'node:crypto';
import 'file:///Users/alviniomolina/Documents/GitHub/daily-ops/node_modules/unstorage/drivers/fs-lite.mjs';
import 'file:///Users/alviniomolina/Documents/GitHub/daily-ops/node_modules/unstorage/drivers/lru-cache.mjs';
import 'file:///Users/alviniomolina/Documents/GitHub/daily-ops/node_modules/ohash/dist/index.mjs';
import 'file:///Users/alviniomolina/Documents/GitHub/daily-ops/node_modules/klona/dist/index.mjs';
import 'file:///Users/alviniomolina/Documents/GitHub/daily-ops/node_modules/defu/dist/defu.mjs';
import 'file:///Users/alviniomolina/Documents/GitHub/daily-ops/node_modules/scule/dist/index.mjs';
import 'file:///Users/alviniomolina/Documents/GitHub/daily-ops/node_modules/unctx/dist/index.mjs';
import 'file:///Users/alviniomolina/Documents/GitHub/daily-ops/node_modules/radix3/dist/index.mjs';
import 'node:path';
import 'file:///Users/alviniomolina/Documents/GitHub/daily-ops/node_modules/.pnpm/googleapis@171.4.0/node_modules/googleapis/build/src/index.js';
import 'node:http';
import 'node:https';
import 'node:url';
import 'file:///Users/alviniomolina/Documents/GitHub/daily-ops/node_modules/pathe/dist/index.mjs';
import 'file:///Users/alviniomolina/Documents/GitHub/daily-ops/node_modules/@iconify/utils/lib/index.js';
import 'file:///Users/alviniomolina/Documents/GitHub/daily-ops/node_modules/consola/dist/index.mjs';
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
