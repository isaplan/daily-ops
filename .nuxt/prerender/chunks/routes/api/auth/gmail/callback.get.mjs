import { defineEventHandler, sendRedirect, getQuery } from 'file:///Users/alviniomolina/Documents/GitHub/daily-ops/node_modules/h3/dist/index.mjs';
import { google } from 'file:///Users/alviniomolina/Documents/GitHub/daily-ops/node_modules/.pnpm/googleapis@171.4.0/node_modules/googleapis/build/src/index.js';
import { g as getGmailRedirectUri } from '../../../../nitro/nitro.mjs';
import { s as saveGmailRefreshToken } from '../../../../_/gmailOAuthService.mjs';
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
import 'node:http';
import 'node:https';
import 'node:url';
import 'file:///Users/alviniomolina/Documents/GitHub/daily-ops/node_modules/pathe/dist/index.mjs';
import 'file:///Users/alviniomolina/Documents/GitHub/daily-ops/node_modules/@iconify/utils/lib/index.js';
import 'file:///Users/alviniomolina/Documents/GitHub/daily-ops/node_modules/consola/dist/index.mjs';
import 'node:module';

const callback_get = defineEventHandler(async (event) => {
  const clientId = process.env.GMAIL_CLIENT_ID;
  const clientSecret = process.env.GMAIL_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    return sendRedirect(event, "/daily-ops/inbox?error=server_misconfigured");
  }
  const query = getQuery(event);
  const code = query.code;
  const error = query.error;
  if (error) {
    console.log("[callback] OAuth error:", error);
    return sendRedirect(event, `/daily-ops/inbox?error=${error}`);
  }
  if (!code) {
    console.log("[callback] No code in query");
    return sendRedirect(event, "/daily-ops/inbox?error=missing_code");
  }
  try {
    const redirectUri = getGmailRedirectUri();
    const oauth2Client = new google.auth.OAuth2(clientId, clientSecret, redirectUri);
    console.log("[callback] Exchanging code with redirectUri:", redirectUri);
    const { tokens } = await oauth2Client.getToken(code);
    console.log("[callback] Received tokens:", {
      hasRefresh: !!tokens.refresh_token,
      hasAccess: !!tokens.access_token,
      refreshPrefix: tokens.refresh_token ? tokens.refresh_token.slice(0, 20) : "none"
    });
    if (!tokens.refresh_token) {
      console.log("[callback] No refresh_token in response");
      return sendRedirect(
        event,
        "/daily-ops/inbox?error=no_refresh_token&hint=use_prompt_consent"
      );
    }
    await saveGmailRefreshToken(tokens.refresh_token);
    console.log("[callback] Token saved to DB");
    return sendRedirect(event, "/daily-ops/inbox?connected=gmail");
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("[callback] Error:", message);
    return sendRedirect(
      event,
      `/daily-ops/inbox?error=oauth_failed&message=${encodeURIComponent(message)}`
    );
  }
});

export { callback_get as default };
//# sourceMappingURL=callback.get.mjs.map
