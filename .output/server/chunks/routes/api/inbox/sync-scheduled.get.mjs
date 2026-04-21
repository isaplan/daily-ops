import { d as defineEventHandler, a as getQuery, c as createError, M as isInvalidGrantError, L as getGmailOAuthRedirectUri, N as getGmailInvalidGrantHint, O as getGmailOAuthErrorMessage } from '../../../nitro/nitro.mjs';
import { r as runInboxGmailSync } from '../../../_/inboxSyncService.mjs';
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
import '../../../_/inboxProcessService.mjs';
import '../../../_/documentParserService.mjs';
import '../../../_/rawDataStorageService.mjs';
import '../../../_/inboxRepository.mjs';

const syncScheduled_get = defineEventHandler(async (event) => {
  var _a, _b, _c;
  const secret = process.env.CRON_SECRET;
  const q = getQuery(event);
  if (!secret || String((_a = q.secret) != null ? _a : "") !== secret) {
    throw createError({ statusCode: 401, statusMessage: "Unauthorized" });
  }
  const maxResultsRaw = q.maxResults;
  const maxResults = typeof maxResultsRaw === "string" && /^\d+$/.test(maxResultsRaw) ? Math.min(500, Math.max(1, parseInt(maxResultsRaw, 10))) : 100;
  const query = typeof q.query === "string" && q.query.length > 0 ? q.query : void 0;
  try {
    return await runInboxGmailSync({ maxResults, query });
  } catch (error) {
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
        statusMessage: "Gmail OAuth invalid_grant: refresh token rejected. Match GMAIL_REDIRECT_URI and OAuth client to the values used when GMAIL_REFRESH_TOKEN was issued; re-authorize and update DigitalOcean env.",
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
      statusMessage: error instanceof Error ? error.message : "Scheduled sync failed"
    });
  }
});

export { syncScheduled_get as default };
//# sourceMappingURL=sync-scheduled.get.mjs.map
