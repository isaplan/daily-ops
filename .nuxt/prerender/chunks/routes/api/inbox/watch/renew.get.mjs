import { defineEventHandler, getQuery, createError } from 'file:///Users/alviniomolina/Documents/GitHub/daily-ops/node_modules/h3/dist/index.mjs';
import { K as ensureInboxCollections, a as getDb, Z as gmailWatchService, W as isInvalidGrantError, X as getGmailInvalidGrantHint, Y as getGmailOAuthErrorMessage } from '../../../../nitro/nitro.mjs';
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
const renew_get = defineEventHandler(async (event) => {
  var _a, _b, _c;
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
    if (isInvalidGrantError(error)) {
      const clientId = (_b = process.env.GMAIL_CLIENT_ID) != null ? _b : "";
      const clientIdHint = clientId.length > 14 ? `${clientId.slice(0, 8)}\u2026${clientId.slice(-6)}` : clientId || "(unset)";
      const gmailRedirectUriEnv = ((_c = process.env.GMAIL_REDIRECT_URI) == null ? void 0 : _c.trim()) || "(unset)";
      let gmailRedirectUriUsedForOAuth;
      try {
        gmailRedirectUriUsedForOAuth = getGmailOAuthRedirectUri();
      } catch (e) {
        gmailRedirectUriUsedForOAuth = e instanceof Error ? e.message : "unknown";
      }
      throw createError({
        statusCode: 401,
        statusMessage: "Gmail OAuth invalid_grant: refresh token rejected. Match GMAIL_REDIRECT_URI and OAuth client to the values used when GMAIL_REFRESH_TOKEN was issued; re-authorize and update env.",
        data: {
          google: getGmailOAuthErrorMessage(error),
          gmailRedirectUriEnv,
          gmailRedirectUriUsedForOAuth,
          gmailClientIdHint: clientIdHint,
          hint: getGmailInvalidGrantHint(gmailRedirectUriEnv, gmailRedirectUriUsedForOAuth)
        }
      });
    }
    throw createError({
      statusCode: 500,
      statusMessage: msg
    });
  }
});

export { renew_get as default };
//# sourceMappingURL=renew.get.mjs.map
