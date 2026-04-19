import { d as defineEventHandler, r as readBody, g as getDb } from '../../../../nitro/nitro.mjs';
import { s as syncBorkSingleLocation, e as executeBorkJob } from '../../../../_/borkSyncService.mjs';
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

const sync_post = defineEventHandler(async (event) => {
  const body = await readBody(event);
  const db = await getDb();
  if (body == null ? void 0 : body.locationId) {
    const mode = body.ping ? "ping" : body.endpoint === "master" || body.endpoint === "master-data" ? "master" : "daily";
    const result2 = await syncBorkSingleLocation(db, body.locationId, mode);
    return {
      success: result2.ok,
      message: result2.message,
      sync: result2
    };
  }
  const jobType = (body == null ? void 0 : body.endpoint) === "master" || (body == null ? void 0 : body.endpoint) === "master-data" ? "master-data" : (body == null ? void 0 : body.endpoint) === "historical-data" ? "historical-data" : "daily-data";
  const result = await executeBorkJob(db, jobType);
  return {
    success: result.ok,
    message: result.message,
    sync: result
  };
});

export { sync_post as default };
//# sourceMappingURL=sync.post.mjs.map
