import { d as defineEventHandler, r as readBody, g as getDb } from '../../../../nitro/nitro.mjs';
import { l as loadActiveEitjeCredentials, a as eitjeCredentialsHintMessage, p as pingEitjeApi, s as syncEitjeByRequest } from '../../../../_/eitjeSyncService.mjs';
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

const sync_post = defineEventHandler(async (event) => {
  var _a;
  const body = await readBody(event);
  const db = await getDb();
  const ep = (_a = body == null ? void 0 : body.endpoint) != null ? _a : "environments";
  if (ep === "environments" || ep === "locations") {
    const creds = await loadActiveEitjeCredentials(db);
    if (!creds) {
      return { success: false, error: eitjeCredentialsHintMessage() };
    }
    const ping = await pingEitjeApi(creds);
    return {
      success: ping.ok,
      message: ping.message,
      error: ping.ok ? void 0 : ping.message
    };
  }
  const result = await syncEitjeByRequest(db, {
    endpoint: ep,
    startDate: body == null ? void 0 : body.startDate,
    endDate: body == null ? void 0 : body.endDate
  });
  return {
    success: result.ok,
    message: result.message,
    error: result.ok ? void 0 : result.message,
    sync: result
  };
});

export { sync_post as default };
//# sourceMappingURL=sync.post.mjs.map
